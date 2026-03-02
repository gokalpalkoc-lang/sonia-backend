import { useState } from "react";
import { login, clearTokens, getAccessToken } from "./api";
import Dashboard from "./pages/Dashboard";
import "./index.css";

export default function App() {
  const [token, setToken] = useState<string | null>(getAccessToken);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Lütfen kullanıcı adı ve şifre girin.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await login(username, password);
      setToken(data.access);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Giriş başarısız.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearTokens();
    setToken(null);
    setUsername("");
    setPassword("");
  };

  if (token) {
    return <Dashboard onLogout={handleLogout} />;
  }

  return (
    <div style={styles.loginContainer}>
      <div style={styles.loginCard}>
        <div style={styles.logoCircle}>
          <span style={{ fontSize: 32 }}>🤖</span>
        </div>
        <h1 style={styles.title}>Sonia Paneli</h1>
        <p style={styles.subtitle}>Hesabınızla giriş yapın.</p>
        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Kullanıcı Adı</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="kullanici_adi"
              style={styles.input}
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={styles.input}
            />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button
            type="submit"
            style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}
            disabled={loading}
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
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
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(79,70,229,0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#fff",
    margin: "0 0 6px",
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
    gap: 14,
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.7px",
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
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  error: {
    color: "#EF4444",
    fontSize: 13,
    margin: 0,
    textAlign: "center",
  },
};
