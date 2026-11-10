// Typed API client for Rutas de Éxito — Dispatch.

export type OrderStatus =
  | "new"
  | "suggested"
  | "assigned"
  | "delivered"
  | "cancelled";
export type TruckStatus = "available" | "on_trip" | "maintenance" | "offline";
export type DriverStatus = "available" | "driving" | "off_duty";
export type DriverType = "in_house" | "contractor";
export type RouteType = "local" | "international" | "both";

export interface Client {
  id: number;
  name: string;
  nif_cif?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  region?: string | null;
  country: string;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
  active: boolean;
  created_at?: string;
}

export interface Trailer {
  id: number;
  identifier: string;
  trailer_type: string;
  allowed_products: string;
  max_tonnage: number;
  max_volume_m3: number;
  piston_type?: string | null;
  itv_expiry?: string | null;
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
  itv_expiry?: string | null;
}

export interface Driver {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  dni_nie?: string | null;
  status: DriverStatus;
  driver_type: DriverType;
  contractor_company?: string | null;
  route_type: RouteType;
  preferred_trailer_types: string;
  notes?: string | null;
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
  dropoff_location: string;
  pickup_location_id?: number | null;
  dropoff_location_id?: number | null;
  pickup_date?: string | null;
  dropoff_date?: string | null;
  trailer_type_required?: string | null;
  route_type?: string | null;
  distance_km?: number | null;
  unloading_confirmed: boolean;
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
  price_per_km?: number | null;
  price_total?: number | null;
  dispatcher_notes?: string | null;
}

export interface GpsPosition {
  gps_device_id: string;
  lat: number;
  lng: number;
  speed_kmh?: number | null;
}

export interface DistanceResult {
  from_id: number;
  from_name: string;
  to_id: number;
  to_name: string;
  distance_km: number | null;
  note?: string;
}

export interface IntakeMeta {
  trailer_types: string[];
}

export interface ClientLookup {
  found: boolean;
  client_id?: number | null;
  name?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface PublicOrderResponse {
  order_id: number;
  message: string;
  distance_km?: number | null;
  pickup_location: string;
  dropoff_location: string;
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
  updateClient: (id: number, b: Partial<Client>) =>
    req<Client>(`/api/clients/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  deleteClient: (id: number) =>
    req<unknown>(`/api/clients/${id}`, { method: "DELETE" }),

  // Trailers
  listTrailers: () => req<Trailer[]>("/api/trailers"),
  createTrailer: (b: Partial<Trailer>) =>
    req<Trailer>("/api/trailers", { method: "POST", body: JSON.stringify(b) }),
  updateTrailer: (id: number, b: Partial<Trailer>) =>
    req<Trailer>(`/api/trailers/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  deleteTrailer: (id: number) =>
    req<unknown>(`/api/trailers/${id}`, { method: "DELETE" }),

  // Trucks
  listTrucks: () => req<Truck[]>("/api/trucks"),
  createTruck: (b: Partial<Truck>) =>
    req<Truck>("/api/trucks", { method: "POST", body: JSON.stringify(b) }),
  updateTruck: (id: number, b: Partial<Truck>) =>
    req<Truck>(`/api/trucks/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  deleteTruck: (id: number) =>
    req<unknown>(`/api/trucks/${id}`, { method: "DELETE" }),

  // Drivers
  listDrivers: () => req<Driver[]>("/api/drivers"),
  createDriver: (b: Partial<Driver>) =>
    req<Driver>("/api/drivers", { method: "POST", body: JSON.stringify(b) }),
  updateDriver: (id: number, b: Partial<Driver>) =>
    req<Driver>(`/api/drivers/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
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
  confirm: (id: number, b: { truck_id: number; trailer_id?: number | null; driver_id?: number | null; price_per_km?: number | null; price_total?: number | null; dispatcher_notes?: string | null }) =>
    req<Assignment>(`/api/orders/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify(b),
    }),
  setStatus: (id: number, status: OrderStatus) =>
    req<Order>(`/api/orders/${id}/status/${status}`, { method: "POST" }),
  updateOrder: (id: number, b: Partial<Order>) =>
    req<Order>(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  listAssignments: (orderId: number) =>
    req<Assignment[]>(`/api/orders/${orderId}/assignments`),

  // Locations (clients table doubles as location registry)
  listLocations: (q?: string) =>
    req<Client[]>(`/api/clients${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createLocation: (b: Partial<Client>) =>
    req<Client>("/api/clients", { method: "POST", body: JSON.stringify(b) }),
  updateLocation: (id: number, b: Partial<Client>) =>
    req<Client>(`/api/clients/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  deleteLocation: (id: number) =>
    req<unknown>(`/api/clients/${id}`, { method: "DELETE" }),
  calcDistance: (from_id: number, to_id: number) =>
    req<DistanceResult>(`/api/clients/distance?from_id=${from_id}&to_id=${to_id}`),

  // Public intake
  getIntakeMeta: (token: string) =>
    req<IntakeMeta>(`/api/intake/${token}/meta`),
  lookupClientByNif: (token: string, nif_cif: string) =>
    req<ClientLookup>(`/api/intake/${token}/lookup/${encodeURIComponent(nif_cif)}`),
  submitPublicOrder: (token: string, b: Record<string, unknown>) =>
    req<PublicOrderResponse>(`/api/intake/${token}`, { method: "POST", body: JSON.stringify(b) }),

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
