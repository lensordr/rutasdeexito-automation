import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import App from "./App";
import OrdersPage from "./pages/OrdersPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import FleetPage from "./pages/FleetPage";
import ClientsPage from "./pages/ClientsPage";
import ConnectorsPage from "./pages/ConnectorsPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <OrdersPage /> },
      { path: "orders/:orderId", element: <OrderDetailPage /> },
      { path: "fleet", element: <FleetPage /> },
      { path: "clients", element: <ClientsPage /> },
      { path: "connectors", element: <ConnectorsPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
