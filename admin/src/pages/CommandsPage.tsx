import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";

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

  const fetchCommands = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/commands`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCommands(data.commands ?? []);
    } catch {
      setError("Komutlar yüklenemedi. Backend bağlantısını kontrol edin.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommands();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.assistantName.trim() || !form.time.trim() || !form.prompt.trim() || !form.firstMessage.trim()) {
      setSubmitError("Lütfen tüm alanları doldurun.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setForm(emptyForm);
      setShowForm(false);
      await fetchCommands();
    } catch {
      setSubmitError("Komut eklenemedi. Tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Komutlar</h1>
          <p style={styles.pageSubtitle}>
            Asistan komutlarını yönetin ve yeni komutlar ekleyin.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button onClick={fetchCommands} style={styles.refreshButton}>
            🔄 Yenile
          </button>
          <button onClick={() => { setShowForm(!showForm); setSubmitError(""); }} style={styles.addButton}>
            {showForm ? "✕ İptal" : "+ Komut Ekle"}
          </button>
        </div>
      </div>

      {/* Add Command Form */}
      {showForm && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>Yeni Komut</h2>
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Asistan Adı</label>
                <input
                  type="text"
                  value={form.assistantName}
                  onChange={(e) => setForm({ ...form, assistantName: e.target.value })}
                  placeholder="ör. Sabah Asistanı"
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Saat (HH:MM)</label>
                <input
                  type="text"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  placeholder="08:00"
                  style={styles.input}
                />
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Sistem İstemi</label>
              <textarea
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                placeholder="Komutu açıklayın..."
                style={{ ...styles.input, ...styles.textarea }}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>İlk Mesaj</label>
              <textarea
                value={form.firstMessage}
                onChange={(e) => setForm({ ...form, firstMessage: e.target.value })}
                placeholder="Asistan önce ne söylemeli?"
                style={{ ...styles.input, ...styles.textarea }}
              />
            </div>
            {submitError && <p style={styles.errorText}>{submitError}</p>}
            <button
              type="submit"
              style={{ ...styles.addButton, ...(submitting ? styles.buttonDisabled : {}) }}
              disabled={submitting}
            >
              {submitting ? "Oluşturuluyor..." : "Asistan Oluştur"}
            </button>
          </form>
        </div>
      )}

      {/* Commands List */}
      {loading ? (
        <div style={styles.center}>
          <p style={styles.mutedText}>Yükleniyor...</p>
        </div>
      ) : error ? (
        <div style={styles.center}>
          <p style={styles.errorText}>{error}</p>
          <button onClick={fetchCommands} style={styles.refreshButton}>Tekrar Dene</button>
        </div>
      ) : commands.length === 0 ? (
        <div style={styles.emptyState}>
          <span style={{ fontSize: 48 }}>📋</span>
          <p style={styles.emptyTitle}>Henüz komut yok</p>
          <p style={styles.mutedText}>İlk komutunuzu eklemek için "Komut Ekle"ye tıklayın.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {commands.map((cmd, i) => (
            <div key={i} style={styles.commandCard}>
              <div style={styles.cardHeader}>
                <span style={styles.timeBadge}>{cmd.time}</span>
                <span style={styles.assistantName}>{cmd.assistantName}</span>
              </div>
              <p
                style={{
                  ...styles.promptText,
                  WebkitLineClamp: expandedIndex === i ? undefined : 3,
                  display: expandedIndex === i ? "block" : "-webkit-box",
                }}
              >
                {cmd.prompt}
              </p>
              {cmd.prompt.length > 120 && (
                <button
                  onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                  style={styles.expandButton}
                >
                  {expandedIndex === i ? "Daha az göster ▲" : "Daha fazla göster ▼"}
                </button>
              )}
              {cmd.firstMessage && (
                <div style={styles.firstMessageBox}>
                  <span style={styles.firstMessageLabel}>İlk Mesaj: </span>
                  <span style={styles.firstMessageText}>{cmd.firstMessage}</span>
                </div>
              )}
              {cmd.assistantId && (
                <p style={styles.assistantId}>ID: {cmd.assistantId}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
    flexWrap: "wrap",
    gap: 16,
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
  headerActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  addButton: {
    backgroundColor: "#4F46E5",
    border: "none",
    borderRadius: 10,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    cursor: "pointer",
  },
  refreshButton: {
    backgroundColor: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: "10px 16px",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    cursor: "pointer",
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  formCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: "24px",
    marginBottom: 24,
  },
  formTitle: {
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
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
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
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    margin: 0,
  },
  center: {
    textAlign: "center",
    padding: "60px 0",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "60px 0",
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: "#fff",
    margin: 0,
  },
  mutedText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    margin: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: 16,
  },
  commandCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  timeBadge: {
    backgroundColor: "rgba(79,70,229,0.2)",
    color: "#A5B4FC",
    fontSize: 13,
    fontWeight: 600,
    padding: "4px 12px",
    borderRadius: 8,
  },
  assistantName: {
    fontSize: 15,
    fontWeight: 600,
    color: "#fff",
  },
  promptText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    lineHeight: 1.6,
    margin: 0,
    overflow: "hidden",
    WebkitBoxOrient: "vertical" as const,
  },
  expandButton: {
    background: "none",
    border: "none",
    color: "#818CF8",
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
    textAlign: "left" as const,
  },
  firstMessageBox: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
  },
  firstMessageLabel: {
    color: "rgba(255,255,255,0.4)",
  },
  firstMessageText: {
    color: "rgba(255,255,255,0.7)",
  },
  assistantId: {
    fontSize: 11,
    color: "rgba(255,255,255,0.25)",
    margin: 0,
    fontFamily: "monospace",
  },
};
