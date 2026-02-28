import { useState } from "react";
import { API_BASE_URL } from "../config";

export default function NotificationsPage() {
  const [title, setTitle] = useState("Sonia");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, data: { screen: "talk-ai" } }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult({
          success: true,
          message: `Bildirim ${data.devicesNotified ?? "?"} cihaza gönderildi.`,
        });
        setBody("");
      } else {
        setResult({
          success: false,
          message: data.error || "Bildirim gönderilemedi.",
        });
      }
    } catch {
      setResult({ success: false, message: "Ağ hatası. Tekrar deneyin." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Bildirimler</h1>
          <p style={styles.pageSubtitle}>
            Kayıtlı tüm cihazlara anlık bildirim gönderin.
          </p>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Bildirim Gönder</h2>
        <form onSubmit={handleSend} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Başlık</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bildirim başlığı"
              style={styles.input}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Mesaj</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Bildirim metni..."
              style={{ ...styles.input, ...styles.textarea }}
              required
            />
          </div>

          {result && (
            <div
              style={{
                ...styles.resultBox,
                ...(result.success ? styles.resultSuccess : styles.resultError),
              }}
            >
              {result.success ? "✓ " : "✕ "}
              {result.message}
            </div>
          )}

          <button
            type="submit"
            style={{ ...styles.sendButton, ...(sending ? styles.buttonDisabled : {}) }}
            disabled={sending || !body.trim()}
          >
            {sending ? "Gönderiliyor..." : "🔔 Bildirim Gönder"}
          </button>
        </form>
      </div>

      {/* Info box */}
      <div style={styles.infoBox}>
        <span style={styles.infoIcon}>ℹ️</span>
        <p style={styles.infoText}>
          Bu özellik, Expo push token'ı kayıtlı tüm cihazlara bildirim gönderir.
          Bildirime tıklandığında uygulama açılır ve AI arama ekranına yönlendirilir.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    marginBottom: 28,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: "#fff",
    margin: "0 0 4px",
  },
  pageSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    margin: 0,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: "24px",
    maxWidth: 520,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#fff",
    margin: "0 0 20px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.8px",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 14,
    color: "#fff",
    outline: "none",
    width: "100%",
  },
  textarea: {
    minHeight: 100,
    resize: "vertical" as const,
    fontFamily: "inherit",
  },
  sendButton: {
    backgroundColor: "#4F46E5",
    border: "none",
    borderRadius: 10,
    padding: "13px 0",
    fontSize: 15,
    fontWeight: 600,
    color: "#fff",
    cursor: "pointer",
    width: "100%",
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  resultBox: {
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 500,
  },
  resultSuccess: {
    backgroundColor: "rgba(34,197,94,0.1)",
    color: "#22C55E",
    border: "1px solid rgba(34,197,94,0.2)",
  },
  resultError: {
    backgroundColor: "rgba(239,68,68,0.1)",
    color: "#EF4444",
    border: "1px solid rgba(239,68,68,0.2)",
  },
  infoBox: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    backgroundColor: "rgba(79,70,229,0.08)",
    border: "1px solid rgba(79,70,229,0.2)",
    borderRadius: 12,
    padding: "14px 16px",
    maxWidth: 520,
  },
  infoIcon: {
    fontSize: 18,
    flexShrink: 0,
  },
  infoText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    margin: 0,
    lineHeight: 1.6,
  },
};
