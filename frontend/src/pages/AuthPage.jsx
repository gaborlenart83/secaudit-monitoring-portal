import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get("mode") === "register" ? "register" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMode(searchParams.get("mode") === "register" ? "register" : "login");
  }, [searchParams]);

  function changeMode(nextMode) {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setSearchParams(nextMode === "register" ? { mode: "register" } : {});
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
        navigate("/", { replace: true });
      } else {
        await register(name, email, password);
        setSuccess("Sikeres regisztráció. Most jelentkezzen be.");
        setPassword("");
        changeMode("login");
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <div className="btn-group w-100 mb-4" role="group" aria-label="Hitelesítési mód">
                <button
                  type="button"
                  className={`btn ${mode === "login" ? "btn-primary" : "btn-outline-primary"}`}
                  onClick={() => changeMode("login")}
                >
                  Bejelentkezés
                </button>
                <button
                  type="button"
                  className={`btn ${mode === "register" ? "btn-primary" : "btn-outline-primary"}`}
                  onClick={() => changeMode("register")}
                >
                  Regisztráció
                </button>
              </div>

              {error && <div className="alert alert-danger">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}

              <form onSubmit={handleSubmit}>
                {mode === "register" && (
                  <div className="mb-3">
                    <label className="form-label" htmlFor="name">Név</label>
                    <input
                      id="name"
                      className="form-control"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label" htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="form-label" htmlFor="password">Jelszó</label>
                  <input
                    id="password"
                    type="password"
                    className="form-control"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={mode === "register" ? 8 : undefined}
                    required
                  />
                </div>

                <button className="btn btn-primary w-100" type="submit" disabled={submitting}>
                  {submitting
                    ? "Feldolgozás..."
                    : mode === "login"
                      ? "Bejelentkezés"
                      : "Regisztráció"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
