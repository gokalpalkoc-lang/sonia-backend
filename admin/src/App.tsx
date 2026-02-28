import { useState } from "react";
import { ADMIN_PASSWORD } from "./config";
import Dashboard from "./pages/Dashboard";
import "./index.css";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setError("");
    } else {
      setError("Hatalı şifre. Lütfen tekrar deneyin.");
      setPassword("");
    }
  };

  if (isAuthenticated) {
    return <Dashboard onLogout={() => setIsAuthenticated(false)} />;
  }

  return (
    <div style={styles.loginContainer}>
      <div style={styles.loginCard}>
        <div style={styles.lockCircle}>
          <span style={{ fontSize: 36 }}>🔒</span>
        </div>
        <h1 style={styles.title}>Sonia Yönetim Paneli</h1>
        <p style={styles.subtitle}>
          Devam etmek için şifrenizi girin.
        </p>
        <form onSubmit={handleLogin} style={styles.form}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifre"
            style={styles.input}
            autoFocus
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" style={styles.button}>
            Kilidi Aç
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loginContainer: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0D0D1A",
    padding: "20px",
  },
  loginCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 24,
    padding: "40px 32px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  lockCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(79,70,229,0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#fff",
    margin: "0 0 8px",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    margin: "0 0 28px",
  },
  form: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  input: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: "14px 16px",
    fontSize: 16,
    color: "#fff",
    outline: "none",
  },
  button: {
    width: "100%",
    backgroundColor: "#4F46E5",
    border: "none",
    borderRadius: 12,
    padding: "15px 0",
    fontSize: 16,
    fontWeight: 600,
    color: "#fff",
    cursor: "pointer",
    transition: "opacity 0.2s",
  },
  error: {
    color: "#EF4444",
    fontSize: 13,
    margin: 0,
    textAlign: "center",
  },
};
