// Typed API client for Rutas de Éxito — Dispatch.

export type OrderStatus =
  | "new"
  | "suggested"
  | "assigned"
  | "delivered"
  | "cancelled";
export type TruckStatus = "available" | "on_trip" | "maintenance" | "offline";
export type DriverStatus = "available" | "driving" | "off_duty";

export interface Client {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export interface Trailer {
  id: number;
  identifier: string;
  trailer_type: string;
  allowed_products: string;
  max_tonnage: number;
  max_volume_m3: number;
  active: boolean;
}

export interface Truck {
  id: number;
  plate: string;
  label?: string | null;
  status: TruckStatus;
  default_trailer_id?: number | null;
  home_lat?: number | null;
  home_lng?: number | null;
  gps_device_id?: string | null;
}

export interface Driver {
  id: number;
  name: string;
  phone?: string | null;
  status: DriverStatus;
  truck_id?: number | null;
}

export interface Order {
  id: number;
  client_id?: number | null;
  status: OrderStatus;
  product: string;
  tonnage: number;
  volume_m3?: number | null;
  pickup_location: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_location: string;
  pickup_date?: string | null;
  details?: string | null;
  source: string;
  source_ref?: string | null;
  created_at: string;
}

export interface Suggestion {
  truck_id: number;
  truck_plate: string;
  trailer_id?: number | null;
  trailer_identifier?: string | null;
  driver_id?: number | null;
  driver_name?: string | null;
  score: number;
  distance_km?: number | null;
  reason: string;
}

export interface Assignment {
  id: number;
  order_id: number;
  truck_id: number;
  trailer_id?: number | null;
  driver_id?: number | null;
  status: string;
  score: number;
  distance_km?: number | null;
  reason?: string | null;
}

export interface GpsPosition {
  gps_device_id: string;
  lat: number;
  lng: number;
  speed_kmh?: number | null;
}

export interface ConnectorStatus {
  key: string;
  label: string;
  connected: boolean;
  detail: string;
  is_stub: boolean;
  configured: boolean;
}

export interface ConnectorField {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  placeholder: string;
  help: string;
}

export interface ConnectorValue {
  has_value: boolean;
  display: string;
}

export interface ConnectorDetail {
  schema: { key: string; label: string; description: string; fields: ConnectorField[] };
  values: Record<string, ConnectorValue>;
  status: Omit<ConnectorStatus, "key" | "label">;
}

export interface TestResult {
  ok: boolean;
  message: string;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  }
  // DELETE endpoints may return small JSON; all our endpoints return JSON.
  return res.json() as Promise<T>;
}

export const api = {
  health: () => req<{ status: string }>("/api/health"),

  // Clients
  listClients: () => req<Client[]>("/api/clients"),
  createClient: (b: Partial<Client>) =>
    req<Client>("/api/clients", { method: "POST", body: JSON.stringify(b) }),
  deleteClient: (id: number) =>
    req<unknown>(`/api/clients/${id}`, { method: "DELETE" }),

  // Trailers
  listTrailers: () => req<Trailer[]>("/api/trailers"),
  createTrailer: (b: Partial<Trailer>) =>
    req<Trailer>("/api/trailers", { method: "POST", body: JSON.stringify(b) }),
  deleteTrailer: (id: number) =>
    req<unknown>(`/api/trailers/${id}`, { method: "DELETE" }),

  // Trucks
  listTrucks: () => req<Truck[]>("/api/trucks"),
  createTruck: (b: Partial<Truck>) =>
    req<Truck>("/api/trucks", { method: "POST", body: JSON.stringify(b) }),
  deleteTruck: (id: number) =>
    req<unknown>(`/api/trucks/${id}`, { method: "DELETE" }),

  // Drivers
  listDrivers: () => req<Driver[]>("/api/drivers"),
  createDriver: (b: Partial<Driver>) =>
    req<Driver>("/api/drivers", { method: "POST", body: JSON.stringify(b) }),
  deleteDriver: (id: number) =>
    req<unknown>(`/api/drivers/${id}`, { method: "DELETE" }),

  // Orders
  listOrders: () => req<Order[]>("/api/orders"),
  createOrder: (b: Partial<Order>) =>
    req<Order>("/api/orders", { method: "POST", body: JSON.stringify(b) }),
  getOrder: (id: number) => req<Order>(`/api/orders/${id}`),
  intakeEmail: () =>
    req<Order[]>("/api/orders/intake-email", { method: "POST" }),
  getSuggestions: (id: number) =>
    req<Suggestion[]>(`/api/orders/${id}/suggestions`),
  confirm: (id: number, b: { truck_id: number; trailer_id?: number | null; driver_id?: number | null }) =>
    req<Assignment>(`/api/orders/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
  setStatus: (id: number, status: OrderStatus) =>
    req<Order>(`/api/orders/${id}/status/${status}`, { method: "POST" }),

  // GPS
  gpsPositions: () => req<GpsPosition[]>("/api/gps/positions"),

  // Connectors
  listConnectors: () => req<ConnectorStatus[]>("/api/connectors"),
  getConnector: (key: string) => req<ConnectorDetail>(`/api/connectors/${key}`),
  saveConnector: (key: string, values: Record<string, string>) =>
    req<{ saved: boolean; values: Record<string, ConnectorValue>; status: ConnectorDetail["status"] }>(
      `/api/connectors/${key}`,
      { method: "PUT", body: JSON.stringify({ values }) },
    ),
  testConnector: (key: string) =>
    req<TestResult>(`/api/connectors/${key}/test`, { method: "POST" }),
};
