import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";

interface Command {
  assistantName: string;
  time: string;
  prompt: string;
  assistantId: string | null;
}

interface CallRecord {
  assistantId: string;
  assistantName: string;
  lastCalledDate: string | null;
}

export default function CallsPage() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [callRecords, setCallRecords] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/commands`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const cmds: Command[] = data.commands ?? [];
      setCommands(cmds);

      // Fetch last-called date for each assistant
      const records: CallRecord[] = await Promise.all(
        cmds
          .filter((cmd) => cmd.assistantId)
          .map(async (cmd) => {
            try {
              const r = await fetch(
                `${API_BASE_URL}/api/commands/last-called/${cmd.assistantId}`
              );
              const d = await r.json();
              return {
                assistantId: cmd.assistantId!,
                assistantName: cmd.assistantName,
                lastCalledDate: d.lastCalledDate ?? null,
              };
            } catch {
              return {
                assistantId: cmd.assistantId!,
                assistantName: cmd.assistantName,
                lastCalledDate: null,
              };
            }
          })
      );
      setCallRecords(records);
    } catch {
      setError("Veriler yüklenemedi. Backend bağlantısını kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Aramalar</h1>
          <p style={styles.pageSubtitle}>
            Her asistanın en son arama tarihini görüntüleyin.
          </p>
        </div>
        <button onClick={fetchData} style={styles.refreshButton}>
          🔄 Yenile
        </button>
      </div>

      {loading ? (
        <div style={styles.center}>
          <p style={styles.mutedText}>Yükleniyor...</p>
        </div>
      ) : error ? (
        <div style={styles.center}>
          <p style={styles.errorText}>{error}</p>
          <button onClick={fetchData} style={styles.refreshButton}>
            Tekrar Dene
          </button>
        </div>
      ) : callRecords.length === 0 ? (
        <div style={styles.emptyState}>
          <span style={{ fontSize: 48 }}>📞</span>
          <p style={styles.emptyTitle}>Arama kaydı yok</p>
          <p style={styles.mutedText}>
            {commands.length === 0
              ? "Henüz komut oluşturulmamış."
              : "Asistan ID'si olan komut bulunamadı."}
          </p>
        </div>
      ) : (
        <div style={styles.grid}>
          {callRecords.map((record) => (
            <div key={record.assistantId} style={styles.card}>
              <div style={styles.cardIcon}>📞</div>
              <div style={styles.cardContent}>
                <h3 style={styles.cardTitle}>{record.assistantName}</h3>
                <p style={styles.assistantId}>{record.assistantId}</p>
                <div style={styles.statusRow}>
                  {record.lastCalledDate ? (
                    <>
                      <span style={styles.calledBadge}>✓ Arandı</span>
                      <span style={styles.dateText}>
                        {formatDate(record.lastCalledDate)}
                      </span>
                    </>
                  ) : (
                    <span style={styles.neverCalledBadge}>Henüz aranmadı</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary stats */}
      {!loading && !error && callRecords.length > 0 && (
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <span style={styles.statNumber}>{callRecords.length}</span>
            <span style={styles.statLabel}>Toplam Asistan</span>
          </div>
          <div style={styles.statCard}>
            <span style={styles.statNumber}>
              {callRecords.filter((r) => r.lastCalledDate).length}
            </span>
            <span style={styles.statLabel}>Arama Yapıldı</span>
          </div>
          <div style={styles.statCard}>
            <span style={styles.statNumber}>
              {callRecords.filter((r) => !r.lastCalledDate).length}
            </span>
            <span style={styles.statLabel}>Henüz Aranmadı</span>
          </div>
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
  refreshButton: {
    backgroundColor: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: "10px 16px",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    cursor: "pointer",
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
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    margin: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 16,
    marginBottom: 32,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 20,
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
  },
  cardIcon: {
    fontSize: 28,
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "#fff",
    margin: "0 0 4px",
  },
  assistantId: {
    fontSize: 11,
    color: "rgba(255,255,255,0.25)",
    margin: "0 0 12px",
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  calledBadge: {
    backgroundColor: "rgba(34,197,94,0.15)",
    color: "#22C55E",
    fontSize: 12,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 6,
  },
  neverCalledBadge: {
    backgroundColor: "rgba(239,68,68,0.15)",
    color: "#EF4444",
    fontSize: 12,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 6,
  },
  dateText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },
  statsRow: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
  },
  statCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "16px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    minWidth: 120,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 700,
    color: "#A5B4FC",
  },
  statLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
};
