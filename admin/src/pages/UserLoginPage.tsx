import { useState } from "react";
import { login, register, getAccessToken, clearTokens, fetchProfile } from "../api";
import { useNavigate } from "react-router-dom";

type Mode = "login" | "signup";

export default function UserLoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [patientName, setPatientName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Check if already logged in
  const token = getAccessToken();
  if (token) {
    // Show logged-in state with profile info
    return <LoggedInView />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!username.trim() || !password.trim()) {
      setError("Lütfen kullanıcı adı ve şifre girin.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await login(username, password);
        setSuccess("Giriş başarılı! Yönlendiriliyorsunuz...");
        setTimeout(() => window.location.reload(), 800);
      } else {
        await register(username, password, patientName);
        setSuccess("Hesap oluşturuldu ve giriş yapıldı!");
        setTimeout(() => window.location.reload(), 800);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "İşlem başarısız.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
    setSuccess("");
  };

  return (
    <div className="user-auth-container">
      {/* Decorative background elements */}
      <div className="user-auth-bg">
        <div className="user-auth-orb user-auth-orb--1" />
        <div className="user-auth-orb user-auth-orb--2" />
        <div className="user-auth-orb user-auth-orb--3" />
      </div>

      <div className="user-auth-card">
        {/* Logo */}
        <div className="user-auth-logo">
          <span>🤖</span>
        </div>
        <h1 className="user-auth-title">Sonia</h1>
        <p className="user-auth-subtitle">
          {mode === "login"
            ? "Hesabınıza giriş yapın"
            : "Yeni hesap oluşturun"}
        </p>

        {/* Tab toggle */}
        <div className="user-auth-tabs">
          <button
            className={`user-auth-tab ${mode === "login" ? "user-auth-tab--active" : ""}`}
            onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
            type="button"
          >
            Giriş Yap
          </button>
          <button
            className={`user-auth-tab ${mode === "signup" ? "user-auth-tab--active" : ""}`}
            onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}
            type="button"
          >
            Kayıt Ol
          </button>
        </div>

        <form onSubmit={handleSubmit} className="user-auth-form">
          {mode === "signup" && (
            <div className="user-auth-field">
              <label className="user-auth-label">Ad Soyad</label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Adınız Soyadınız"
                className="user-auth-input"
                autoComplete="name"
              />
            </div>
          )}
          <div className="user-auth-field">
            <label className="user-auth-label">Kullanıcı Adı</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="kullanici_adi"
              className="user-auth-input"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
            />
          </div>
          <div className="user-auth-field">
            <label className="user-auth-label">
              Şifre
              {mode === "signup" && (
                <span className="user-auth-hint">(en az 8 karakter)</span>
              )}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="user-auth-input"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error && (
            <div className="user-auth-msg user-auth-msg--error">
              <span>✕</span> {error}
            </div>
          )}
          {success && (
            <div className="user-auth-msg user-auth-msg--success">
              <span>✓</span> {success}
            </div>
          )}

          <button
            type="submit"
            className="user-auth-submit"
            disabled={loading}
          >
            {loading
              ? "İşleniyor..."
              : mode === "login"
              ? "Giriş Yap"
              : "Hesap Oluştur"}
          </button>
        </form>

        <p className="user-auth-switch">
          {mode === "login" ? "Hesabınız yok mu?" : "Zaten hesabınız var mı?"}{" "}
          <button
            type="button"
            className="user-auth-switch-btn"
            onClick={switchMode}
          >
            {mode === "login" ? "Kayıt Ol" : "Giriş Yap"}
          </button>
        </p>

        {/* Admin link */}
        <button
          type="button"
          className="user-auth-admin-link"
          onClick={() => navigate("/dashboard")}
        >
          Yönetici Paneli →
        </button>
      </div>
    </div>
  );
}

/** Simple logged-in view when user visits /login while already authenticated */
function LoggedInView() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ patient_name?: string; username?: string } | null>(null);

  useState(() => {
    fetchProfile()
      .then((data) => setProfile(data.profile))
      .catch(() => {});
  });

  const handleLogout = () => {
    clearTokens();
    window.location.reload();
  };

  return (
    <div className="user-auth-container">
      <div className="user-auth-bg">
        <div className="user-auth-orb user-auth-orb--1" />
        <div className="user-auth-orb user-auth-orb--2" />
      </div>
      <div className="user-auth-card">
        <div className="user-auth-logo">
          <span>✓</span>
        </div>
        <h1 className="user-auth-title">Hoş Geldiniz</h1>
        <p className="user-auth-subtitle">
          {profile?.patient_name || profile?.username || "Kullanıcı"} olarak giriş yapılmış
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", marginTop: 12 }}>
          <button
            className="user-auth-submit"
            onClick={() => navigate("/dashboard")}
          >
            Yönetici Paneline Git
          </button>
          <button
            className="user-auth-submit user-auth-submit--outline"
            onClick={handleLogout}
          >
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
}
