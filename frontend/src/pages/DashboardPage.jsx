import { useEffect, useState } from "react";
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
    D: "bg-warning text-dark",
    F: "bg-danger",
  }[grade] || "bg-secondary";
}

function formatScanDate(value) {
  if (!value) return "Még nem történt vizsgálat";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Érvénytelen időpont" : date.toLocaleString("hu-HU");
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [sites, setSites] = useState([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [formError, setFormError] = useState("");
  const [pageError, setPageError] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [scanningIds, setScanningIds] = useState([]);
  const [deletingIds, setDeletingIds] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadSites() {
      setLoading(true);
      setPageError("");

      try {
        const response = await fetch(`${API_URL}/sites`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(getErrorMessage(data));
        if (active) setSites(data.sites || []);
      } catch (error) {
        if (active) setPageError(error.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSites();
    return () => {
      active = false;
    };
  }, [token]);

  async function handleAdd(event) {
    event.preventDefault();
    setFormError("");
    setAdding(true);

    try {
      const response = await fetch(`${API_URL}/sites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, url }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getErrorMessage(data));

      setSites((current) => [{ ...data.site, latestScan: null }, ...current]);
      setName("");
      setUrl("");
    } catch (error) {
      setFormError(error.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleScan(siteId) {
    setPageError("");
    setScanningIds((current) => [...current, siteId]);

    try {
      const response = await fetch(`${API_URL}/sites/${siteId}/scan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getErrorMessage(data));

      setSites((current) =>
        current.map((site) =>
          site.id === siteId ? { ...site, latestScan: data.scan } : site,
        ),
      );
    } catch (error) {
      setPageError(error.message);
    } finally {
      setScanningIds((current) => current.filter((id) => id !== siteId));
    }
  }

  async function handleDelete(site) {
    if (!window.confirm(`Biztosan törli a(z) "${site.name}" weboldalt?`)) return;

    setPageError("");
    setDeletingIds((current) => [...current, site.id]);

    try {
      const response = await fetch(`${API_URL}/sites/${site.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getErrorMessage(data));

      setSites((current) => current.filter((item) => item.id !== site.id));
    } catch (error) {
      setPageError(error.message);
    } finally {
      setDeletingIds((current) => current.filter((id) => id !== site.id));
    }
  }

  return (
    <main className="container py-4">
      <h1 className="h3 mb-4">Műszerfal</h1>

      {pageError && <div className="alert alert-danger">{pageError}</div>}

      <section className="card shadow-sm mb-5">
        <div className="card-body p-4">
          <h2 className="h5 mb-3">Új weboldal hozzáadása</h2>
          {formError && <div className="alert alert-danger">{formError}</div>}

          <form onSubmit={handleAdd}>
            <div className="row g-3 align-items-end">
              <div className="col-md-4">
                <label className="form-label" htmlFor="site-name">Név</label>
                <input
                  id="site-name"
                  className="form-control"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="site-url">URL</label>
                <input
                  id="site-url"
                  type="url"
                  className="form-control"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com"
                  required
                />
              </div>
              <div className="col-md-2 d-grid">
                <button className="btn btn-primary" type="submit" disabled={adding}>
                  {adding ? "Hozzáadás..." : "Hozzáadás"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Betöltés...</span>
          </div>
        </div>
      ) : (
        <section className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
          {sites.map((site) => {
            const scan = site.latestScan;
            const grade = scan?.grade;
            const isScanning = scanningIds.includes(site.id);
            const isDeleting = deletingIds.includes(site.id);

            return (
              <div className="col" key={site.id}>
                <div className="card h-100 shadow-sm">
                  <div className="card-body d-flex flex-column">
                    <h2 className="h5 card-title">{site.name}</h2>
                    <a href={site.url} target="_blank" rel="noreferrer" className="text-break mb-3">
                      {site.url}
                    </a>

                    <div className="d-flex align-items-center gap-2 mb-3">
                      {scan ? (
                        <>
                          <span className={`badge ${gradeBadgeClass(grade)} fs-6`}>{grade}</span>
                          <strong>{scan.score}/100</strong>
                        </>
                      ) : (
                        <>
                          <span className="badge bg-secondary fs-6">N/A</span>
                          <span className="text-body-secondary">Még nincs vizsgálat</span>
                        </>
                      )}
                    </div>

                    {scan ? (
                      <>
                        <dl className="row small mb-3">
                          <dt className="col-5">Válaszidő</dt>
                          <dd className="col-7">{scan.responseTimeMs} ms</dd>
                          <dt className="col-5">HTTP státusz</dt>
                          <dd className="col-7">{scan.statusCode === 0 ? "Elérhetetlen" : scan.statusCode}</dd>
                          <dt className="col-5">Utolsó vizsgálat</dt>
                          <dd className="col-7">{formatScanDate(scan.scannedAt)}</dd>
                        </dl>

                        <div className="small mb-3">
                          <strong>Biztonsági fejlécek</strong>
                          <div className="d-flex flex-wrap gap-1 mt-2">
                            {[
                              ["HTTPS", scan.hasHttps],
                              ["CSP", scan.hasCsp],
                              ["HSTS", scan.hasHsts],
                              ["X-Frame", scan.hasXFrame],
                            ].map(([label, active]) => (
                              <span key={label} className={`badge ${active ? "bg-success" : "bg-danger"}`}>
                                {label}: {active ? "OK" : "Hiányzik"}
                              </span>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-body-secondary small mb-3">
                        Indítson vizsgálatot a részletekért.
                      </p>
                    )}

                    <div className="d-flex gap-2 mt-auto">
                      <button
                        className="btn btn-primary btn-sm flex-grow-1"
                        type="button"
                        onClick={() => handleScan(site.id)}
                        disabled={isScanning || isDeleting}
                      >
                        {isScanning && (
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            aria-hidden="true"
                          ></span>
                        )}
                        {isScanning ? "Vizsgálat..." : "Vizsgálat indítása"}
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        type="button"
                        onClick={() => handleDelete(site)}
                        disabled={isDeleting || isScanning}
                      >
                        {isDeleting ? "Törlés..." : "Törlés"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {sites.length === 0 && (
            <div className="col">
              <div className="alert alert-secondary mb-0">Még nincs rögzített weboldal.</div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
