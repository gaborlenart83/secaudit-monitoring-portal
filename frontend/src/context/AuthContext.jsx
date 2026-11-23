import { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

function readStoredAuth() {
  try {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    return {
      token,
      user: storedUser ? JSON.parse(storedUser) : null,
    };
  } catch {
    return { token: null, user: null };
  }
}

async function request(endpoint, body) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || "A művelet sikertelen");
  }
  return data;
}

export function AuthProvider({ children }) {
  const initialAuth = useMemo(() => readStoredAuth(), []);
  const [token, setToken] = useState(initialAuth.token);
  const [user, setUser] = useState(initialAuth.user);

  async function login(email, password) {
    const data = await request("/auth/login", { email, password });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data;
  }

  async function register(name, email, password) {
    return request("/auth/register", { name, email, password });
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  const value = useMemo(
    () => ({ user, token, login, register, logout }),
    [user, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
