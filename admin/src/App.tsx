import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { login, clearTokens, getAccessToken } from "./api";
import Dashboard from "./pages/Dashboard";
import UserLoginPage from "./pages/UserLoginPage";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* User-facing login / signup page */}
        <Route path="/login" element={<UserLoginPage />} />

        {/* Admin dashboard (has its own login gate) */}
        <Route path="/dashboard" element={<AdminGate />} />

        {/* Default: redirect to /login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

/** Admin panel gate — shows admin login form or dashboard */
function AdminGate() {
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
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <span>🤖</span>
        </div>
        <h1 className="login-title">Sonia Yönetici Paneli</h1>
        <p className="login-subtitle">Yönetici hesabınızla giriş yapın.</p>
        <form onSubmit={handleLogin} className="login-form">
          <div className="login-field-group">
            <label className="login-label">Kullanıcı Adı</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="kullanici_adi"
              className="login-input"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
            />
          </div>
          <div className="login-field-group">
            <label className="login-label">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="login-input"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>
      </div>
    </div>
  );
}
