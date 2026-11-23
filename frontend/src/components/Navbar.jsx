import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container">
        <Link className="navbar-brand fw-semibold" to="/">
          SecAudit
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#secaudit-navbar"
          aria-controls="secaudit-navbar"
          aria-expanded="false"
          aria-label="Navigáció váltása"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="secaudit-navbar">
          <div className="ms-auto d-flex align-items-center gap-3">
            {user ? (
              <>
                <span className="text-light">{user.name}</span>
                <span className="badge bg-primary">{user.role}</span>
                <button className="btn btn-outline-light btn-sm" type="button" onClick={handleLogout}>
                  Kijelentkezés
                </button>
              </>
            ) : (
              <>
                <Link className="btn btn-outline-light btn-sm" to="/login">
                  Bejelentkezés
                </Link>
                <Link className="btn btn-light btn-sm" to="/login?mode=register">
                  Regisztráció
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
