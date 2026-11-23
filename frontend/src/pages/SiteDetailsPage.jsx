import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

function getErrorMessage(data) {
  return data.error || data.message || "A művelet sikertelen";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Érvénytelen időpont" : date.toLocaleString("hu-HU");
}

function gradeBadgeClass(grade) {
  return {
    A: "bg-success",
    B: "bg-primary",
    C: "bg-warning text-dark",
    D: "text-dark",
    F: "bg-danger",
  }[grade] || "bg-secondary";
}

function gradeBadgeStyle(grade) {
  return grade === "D" ? { backgroundColor: "#fd7e14" } : undefined;
}

function HeaderStatus({ present }) {
  return present ? (
    <span className="text-success fw-bold" title="Jelen volt" aria-label="Jelen volt">✓</span>
  ) : (
    <span className="text-danger fw-bold" title="Hiányzott" aria-label="Hiányzott">✕</span>
  );
}

export default function SiteDetailsPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [site, setSite] = useState(null);
  const [scans, setScans] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolvingIds, setResolvingIds] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_URL}/sites/${id}/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(getErrorMessage(data));

        if (active) {
          setSite(data.site);
          setScans(data.scans || []);
          setIncidents(data.incidents || []);
        }
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadHistory();
    return () => {
      active = false;
    };
  }, [id, token]);

  async function resolveIncident(incidentId) {
    setError("");
    setResolvingIds((current) => [...current, incidentId]);

    try {
      const response = await fetch(`${API_URL}/incidents/${incidentId}/resolve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getErrorMessage(data));

      setIncidents((current) =>
        current.map((incident) =>
          incident.id === incidentId
            ? { ...incident, ...data, isResolved: true }
            : incident,
        ),
      );
    } catch (resolveError) {
      setError(resolveError.message);
    } finally {
      setResolvingIds((current) => current.filter((resolvedId) => resolvedId !== incidentId));
    }
  }

  return (
    <main className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">{site?.name || "Weboldal részletei"}</h1>
          {site && (
            <a href={site.url} target="_blank" rel="noreferrer" className="text-break">
              {site.url}
            </a>
          )}
        </div>
        <Link className="btn btn-outline-secondary" to="/">
          Vissza a műszerfalra
        </Link>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Betöltés...</span>
          </div>
        </div>
      ) : (
        <>
          <section className="mb-5">
            <h2 className="h5 mb-3">Biztonsági incidensek</h2>
            {incidents.length === 0 ? (
              <div className="alert alert-secondary mb-0">Nincs rögzített incidens.</div>
            ) : (
              <div className="list-group">
                {incidents.map((incident) => {
                  const resolving = resolvingIds.includes(incident.id);
                  return (
                    <div
                      className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-3"
                      key={incident.id}
                    >
                      <div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <span className="fw-semibold">{incident.severity}</span>
                          {incident.isResolved ? (
                            <span className="badge bg-success">Megoldva</span>
                          ) : (
                            <span className="badge bg-danger">Aktív</span>
                          )}
                        </div>
                        <div>{incident.message}</div>
                        <small className="text-body-secondary">{formatDate(incident.createdAt)}</small>
                      </div>

                      {!incident.isResolved && (
                        <button
                          type="button"
                          className="btn btn-outline-success btn-sm"
                          onClick={() => resolveIncident(incident.id)}
                          disabled={resolving}
                        >
                          {resolving && (
                            <span
                              className="spinner-border spinner-border-sm me-2"
                              aria-hidden="true"
                            ></span>
                          )}
                          Megoldva
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="h5 mb-3">Mérés-történet</h2>
            {scans.length === 0 ? (
              <div className="alert alert-secondary mb-0">Még nem történt mérés.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover align-middle">
                  <thead>
                    <tr>
                      <th>Időpont</th>
                      <th>HTTP státusz</th>
                      <th>Válaszidő</th>
                      <th>Pontszám</th>
                      <th>Osztályzat</th>
                      <th>HTTPS</th>
                      <th>HSTS</th>
                      <th>CSP</th>
                      <th>X-Frame-Options</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scans.map((scan) => (
                      <tr key={scan.id}>
                        <td>{formatDate(scan.scannedAt)}</td>
                        <td>{scan.statusCode === 0 ? "Elérhetetlen" : scan.statusCode}</td>
                        <td>{scan.responseTimeMs} ms</td>
                        <td>{scan.score}/100</td>
                        <td>
                          <span
                            className={`badge ${gradeBadgeClass(scan.grade)}`}
                            style={gradeBadgeStyle(scan.grade)}
                          >
                            {scan.grade}
                          </span>
                        </td>
                        <td><HeaderStatus present={scan.hasHttps} /></td>
                        <td><HeaderStatus present={scan.hasHsts} /></td>
                        <td><HeaderStatus present={scan.hasCsp} /></td>
                        <td><HeaderStatus present={scan.hasXFrame} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
