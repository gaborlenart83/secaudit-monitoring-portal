import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

function getErrorMessage(data) {
  return data.error || data.message || "A művelet sikertelen";
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

export default function AdminPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingIds, setDeletingIds] = useState([]);

  async function loadOverview() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/admin/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getErrorMessage(data));

      setStats(data.stats);
      setSites(data.sites || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, [token]);

  async function handleDelete(site) {
    if (!window.confirm(`Biztosan törli a(z) "${site.name}" weboldalt adminisztrátorként?`)) {
      return;
    }

    setError("");
    setDeletingIds((current) => [...current, site.id]);

    try {
      const response = await fetch(`${API_URL}/admin/sites/${site.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getErrorMessage(data));

      await loadOverview();
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setDeletingIds((current) => current.filter((id) => id !== site.id));
    }
  }

  const statCards = [
    ["Összes felhasználó", stats?.userCount, "primary"],
    ["Monitorozott oldalak", stats?.siteCount, "success"],
    ["Futtatott vizsgálatok", stats?.scanCount, "info"],
    ["Aktív incidensek", stats?.activeIncidentCount, "danger"],
    [
      "Átlagos pontszám",
      stats?.averageScore == null ? "—" : `${stats.averageScore}/100`,
      "warning",
    ],
  ];

  return (
    <main className="container py-4">
      <h1 className="h3 mb-4">Admin Műszerfal</h1>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Betöltés...</span>
          </div>
        </div>
      ) : (
        <>
          <section className="row row-cols-1 row-cols-md-3 row-cols-xl-5 g-3 mb-5">
            {statCards.map(([label, value, color]) => (
              <div className="col" key={label}>
                <div className={`card border-${color} shadow-sm h-100`}>
                  <div className="card-body">
                    <div className="text-body-secondary small">{label}</div>
                    <div className={`h3 mb-0 text-${color === "warning" ? "dark" : color}`}>{value ?? 0}</div>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section>
            <h2 className="h5 mb-3">Rendszerszintű oldalak</h2>
            {sites.length === 0 ? (
              <div className="alert alert-secondary mb-0">Nincs rögzített weboldal.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover align-middle">
                  <thead>
                    <tr>
                      <th>Név</th>
                      <th>URL</th>
                      <th>Tulajdonos</th>
                      <th>Utolsó eredmény</th>
                      <th>Aktív incidensek</th>
                      <th>Műveletek</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sites.map((site) => {
                      const scan = site.latestScan;
                      const deleting = deletingIds.includes(site.id);
                      return (
                        <tr key={site.id}>
                          <td className="fw-semibold">{site.name}</td>
                          <td>
                            <a href={site.url} target="_blank" rel="noreferrer" className="text-break">
                              {site.url}
                            </a>
                          </td>
                          <td>
                            <div>{site.user?.name}</div>
                            <small className="text-body-secondary">{site.user?.email}</small>
                          </td>
                          <td>
                            {scan ? (
                              <div className="d-flex align-items-center gap-2">
                                <span
                                  className={`badge ${gradeBadgeClass(scan.grade)}`}
                                  style={gradeBadgeStyle(scan.grade)}
                                >
                                  {scan.grade}
                                </span>
                                <strong>{scan.score}/100</strong>
                              </div>
                            ) : (
                              <span className="badge bg-secondary">Nincs vizsgálat</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${site.activeIncidentCount > 0 ? "bg-danger" : "bg-success"}`}>
                              {site.activeIncidentCount}
                            </span>
                          </td>
                          <td>
                            <div className="d-flex gap-2">
                              <Link className="btn btn-outline-secondary btn-sm" to={`/sites/${site.id}`}>
                                Részletek
                              </Link>
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => handleDelete(site)}
                                disabled={deleting}
                              >
                                {deleting ? "Törlés..." : "Törlés"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
            })}
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
