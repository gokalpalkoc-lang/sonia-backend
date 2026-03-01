import { useState } from "react";
import { sendPushNotification } from "../api";

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
      const data = await sendPushNotification(title, body);
      if (data.success) {
        setResult({ success: true, message: `Bildirim ${data.devicesNotified ?? "?"} cihaza gönderildi.` });
        setBody("");
      } else {
        setResult({ success: false, message: data.error || "Bildirim gönderilemedi." });
      }
    } catch {
      setResult({ success: false, message: "Ağ hatası. Tekrar deneyin." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.pageTitle}>Bildirimler</h1>
        <p style={s.pageSub}>Cihazınıza anlık bildirim gönderin.</p>
      </div>

      <div style={s.card}>
        <h2 style={s.cardTitle}>Bildirim Gönder</h2>
        <form onSubmit={handleSend} style={s.form}>
          <div style={s.fieldGroup}>
            <label style={s.label}>Başlık</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sonia"
              style={s.input}
            />
          </div>
          <div style={s.fieldGroup}>
            <label style={s.label}>Mesaj</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Bildirim metni..."
              style={{ ...s.input, minHeight: 100, resize: "vertical" as const }}
              required
            />
          </div>
          {result && (
            <div style={{ ...s.result, ...(result.success ? s.resultOk : s.resultErr) }}>
              {result.success ? "✓ " : "✕ "}{result.message}
            </div>
          )}
          <button
            type="submit"
            style={{ ...s.sendBtn, ...(sending || !body.trim() ? s.disabled : {}) }}
            disabled={sending || !body.trim()}
          >
            {sending ? "Gönderiliyor..." : "🔔 Bildirim Gönder"}
          </button>
        </form>
      </div>

      <div style={s.infoBox}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>ℹ️</span>
        <p style={s.infoText}>
          Bu bildirim yalnızca hesabınıza bağlı cihazlara gönderilir.
          Bildirime tıklandığında uygulama açılır ve arama ekranına yönlendirilirsiniz.
        </p>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: { marginBottom: 24 },
  pageTitle: { fontSize: 26, fontWeight: 700, color: "#fff", margin: "0 0 4px" },
  pageSub: { fontSize: 14, color: "rgba(255,255,255,0.4)", margin: 0 },
  card: { backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, maxWidth: 500, marginBottom: 20 },
  cardTitle: { fontSize: 17, fontWeight: 700, color: "#fff", margin: "0 0 18px" },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.7px" } as React.CSSProperties,
  input: { backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#fff", outline: "none", width: "100%" },
  result: { borderRadius: 10, padding: "11px 14px", fontSize: 14, fontWeight: 500 },
  resultOk: { backgroundColor: "rgba(34,197,94,0.1)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.2)" },
  resultErr: { backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" },
  sendBtn: { backgroundColor: "#4F46E5", border: "none", borderRadius: 10, padding: "13px 0", fontSize: 15, fontWeight: 600, color: "#fff", cursor: "pointer", width: "100%" },
  disabled: { opacity: 0.5, cursor: "not-allowed" },
  infoBox: { display: "flex", gap: 12, alignItems: "flex-start", backgroundColor: "rgba(79,70,229,0.08)", border: "1px solid rgba(79,70,229,0.2)", borderRadius: 12, padding: "14px 16px", maxWidth: 500 },
  infoText: { fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.6 },
};
