import { useEffect, useState } from "react";
import { fetchCommands, createCommand, deleteCommand } from "../api";

interface Command {
  assistantName: string;
  time: string;
  prompt: string;
  firstMessage: string | null;
  assistantId: string | null;
}

interface NewCommandForm {
  assistantName: string;
  time: string;
  prompt: string;
  firstMessage: string;
}

const emptyForm: NewCommandForm = {
  assistantName: "",
  time: "",
  prompt: "",
  firstMessage: "",
};

export default function CommandsPage() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewCommandForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCommands = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchCommands();
      setCommands(data.commands ?? []);
    } catch {
      setError("Komutlar yüklenemedi. Bağlantıyı kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCommands(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.assistantName.trim() || !form.time.trim() || !form.prompt.trim() || !form.firstMessage.trim()) {
      setSubmitError("Lütfen tüm alanları doldurun.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      await createCommand(form as unknown as Record<string, unknown>);
      setForm(emptyForm);
      setShowForm(false);
      await loadCommands();
    } catch {
      setSubmitError("Komut eklenemedi. Tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (cmd: Command) => {
    if (!cmd.assistantId) return;
    if (!confirm(`"${cmd.assistantName}" komutunu silmek istediğinizden emin misiniz?`)) return;
    setDeletingId(cmd.assistantId);
    try {
      await deleteCommand(cmd.assistantId);
      await loadCommands();
    } catch {
      alert("Komut silinemedi.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div style={s.header}>
        <div>
          <h1 style={s.pageTitle}>Komutlar</h1>
          <p style={s.pageSub}>Asistan komutlarını yönetin.</p>
        </div>
        <div style={s.headerActions}>
          <button onClick={loadCommands} style={s.ghostBtn}>🔄 Yenile</button>
          <button
            onClick={() => { setShowForm(!showForm); setSubmitError(""); }}
            style={s.primaryBtn}
          >
            {showForm ? "✕ İptal" : "+ Ekle"}
          </button>
        </div>
      </div>

      {showForm && (
        <div style={s.formCard}>
          <h2 style={s.formTitle}>Yeni Komut</h2>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-row-2">
              <div style={s.fieldGroup}>
                <label style={s.label}>Asistan Adı</label>
                <input
                  style={s.input}
                  value={form.assistantName}
                  onChange={(e) => setForm({ ...form, assistantName: e.target.value })}
                  placeholder="Sabah Asistanı"
                />
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>Saat (HH:MM)</label>
                <input
                  style={s.input}
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  placeholder="08:00"
                />
              </div>
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Sistem İstemi</label>
              <textarea
                style={{ ...s.input, minHeight: 90, resize: "vertical" as const }}
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                placeholder="Komut açıklaması..."
              />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>İlk Mesaj</label>
              <textarea
                style={{ ...s.input, minHeight: 80, resize: "vertical" as const }}
                value={form.firstMessage}
                onChange={(e) => setForm({ ...form, firstMessage: e.target.value })}
                placeholder="Asistan önce ne söylemeli?"
              />
            </div>
            {submitError && <p style={s.errorText}>{submitError}</p>}
            <button
              type="submit"
              style={{ ...s.primaryBtn, ...(submitting ? s.disabled : {}), width: "100%", padding: "13px 0" }}
              disabled={submitting}
            >
              {submitting ? "Oluşturuluyor..." : "Asistan Oluştur"}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", paddingTop: 40 }}>Yükleniyor...</p>
      ) : error ? (
        <div style={{ textAlign: "center", paddingTop: 40 }}>
          <p style={s.errorText}>{error}</p>
          <button onClick={loadCommands} style={s.ghostBtn}>Tekrar Dene</button>
        </div>
      ) : commands.length === 0 ? (
        <div style={s.empty}>
          <span style={{ fontSize: 44 }}>📋</span>
          <p style={s.emptyTitle}>Henüz komut yok</p>
          <p style={s.emptyText}>İlk komutunuzu eklemek için "+ Ekle"ye tıklayın.</p>
        </div>
      ) : (
        <div className="card-grid">
          {commands.map((cmd, i) => (
            <div key={i} style={s.card}>
              <div style={s.cardTop}>
                <span style={s.timeBadge}>{cmd.time}</span>
                <span style={s.assistantName}>{cmd.assistantName}</span>
                {cmd.assistantId && (
                  <button
                    onClick={() => handleDelete(cmd)}
                    style={s.deleteBtn}
                    disabled={deletingId === cmd.assistantId}
                    title="Sil"
                  >
                    {deletingId === cmd.assistantId ? "..." : "✕"}
                  </button>
                )}
              </div>
              <p
                style={{
                  ...s.prompt,
                  WebkitLineClamp: expandedIndex === i ? undefined : 3,
                  display: expandedIndex === i ? "block" : "-webkit-box",
                }}
              >
                {cmd.prompt}
              </p>
              {cmd.prompt.length > 100 && (
                <button
                  onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                  style={s.expandBtn}
                >
                  {expandedIndex === i ? "Daha az ▲" : "Daha fazla ▼"}
                </button>
              )}
              {cmd.firstMessage && (
                <div style={s.firstMsgBox}>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>İlk mesaj: </span>
                  <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>{cmd.firstMessage}</span>
                </div>
              )}
              {cmd.assistantId && (
                <p style={s.idText}>ID: {cmd.assistantId}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 },
  pageTitle: { fontSize: 26, fontWeight: 700, color: "#fff", margin: "0 0 4px" },
  pageSub: { fontSize: 14, color: "rgba(255,255,255,0.4)", margin: 0 },
  headerActions: { display: "flex", gap: 8 },
  primaryBtn: { backgroundColor: "#4F46E5", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer" },
  ghostBtn: { backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", fontSize: 14, color: "rgba(255,255,255,0.7)", cursor: "pointer" },
  disabled: { opacity: 0.5, cursor: "not-allowed" },
  formCard: { backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, marginBottom: 20 },
  formTitle: { fontSize: 17, fontWeight: 700, color: "#fff", margin: "0 0 16px" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.7px" } as React.CSSProperties,
  input: { backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#fff", outline: "none", width: "100%" },
  errorText: { color: "#EF4444", fontSize: 13, margin: 0 },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", padding: "50px 0", gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: 600, color: "#fff", margin: 0 },
  emptyText: { fontSize: 14, color: "rgba(255,255,255,0.35)", margin: 0, textAlign: "center" } as React.CSSProperties,
  card: { backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 18, display: "flex", flexDirection: "column", gap: 10 },
  cardTop: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  timeBadge: { backgroundColor: "rgba(79,70,229,0.2)", color: "#A5B4FC", fontSize: 13, fontWeight: 600, padding: "3px 10px", borderRadius: 7, flexShrink: 0 },
  assistantName: { fontSize: 15, fontWeight: 600, color: "#fff", flex: 1 },
  deleteBtn: { background: "rgba(239,68,68,0.12)", border: "none", color: "#EF4444", fontWeight: 700, fontSize: 13, cursor: "pointer", borderRadius: 7, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } as React.CSSProperties,
  prompt: { color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.6, margin: 0, overflow: "hidden", WebkitBoxOrient: "vertical" as const },
  expandBtn: { background: "none", border: "none", color: "#818CF8", fontSize: 13, cursor: "pointer", padding: 0, textAlign: "left" } as React.CSSProperties,
  firstMsgBox: { backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 12px" },
  idText: { fontSize: 11, color: "rgba(255,255,255,0.2)", margin: 0, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
};
