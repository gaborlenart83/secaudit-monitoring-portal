import React from "react";
import { createRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";

function App() {
  return (
    <main className="container py-5">
      <h1>SecAudit</h1>
      <p className="text-body-secondary">
        Weboldalak biztonsági és elérhetőségi monitorozása.
      </p>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
