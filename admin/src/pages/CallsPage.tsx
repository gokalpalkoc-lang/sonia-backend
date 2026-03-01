import { useEffect, useState } from "react";
import { fetchCommands, fetchLastCalled } from "../api";
import { VAPI_API_KEY } from "../config";

interface Command {
  assistantName: string;
  time: string;
  assistantId: string | null;
}

interface VapiCall {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: string;
  transcript: string | null;
  summary: string | null;
}

interface CallRow {
  assistantId: string;
  assistantName: string;
  scheduledTime: string;
  lastCalledDate: string | null;
  calls: VapiCall[];
  loadingCalls: boolean;
  expanded: boolean;
  expandedCallId: string | null;
}

export default function CallsPage() {
  const [rows, setRows] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchCommands();
      const cmds: Command[] = (data.commands ?? []).filter(
        (c: Command) => c.assistantId,
      );
      const initial: CallRow[] = cmds.map((cmd) => ({
        assistantId: cmd.assistantId!,
        assistantName: cmd.assistantName,
        scheduledTime: cmd.time,
        lastCalledDate: null,
        calls: [],
        loadingCalls: false,
        expanded: false,
        expandedCallId: null,
      }));
      setRows(initial);

      // Fetch last-called dates in parallel
      const updated = await Promise.all(
        initial.map(async (row) => {
          try {
            const d = await fetchLastCalled(row.assistantId);
            return { ...row, lastCalledDate: d.lastCalledDate ?? null };
          } catch {
            return row;
          }
        }),
      );
      setRows(updated);
    } catch {
      setError("Veriler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const fetchCallsForRow = async (assistantId: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.assistantId === assistantId
          ? { ...r, loadingCalls: true, expanded: true }
          : r,
      ),
    );
    try {
      const params = new URLSearchParams({ assistantId, limit: "10" });
      const res = await fetch(
        `https://api.vapi.ai/call?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const calls: VapiCall[] = (Array.isArray(data) ? data : data.results ?? []).map(
        (c: Record<string, unknown>) => {
          const analysis = c.analysis as Record<string, unknown> | undefined;
          return {
            id: c.id as string,
            startedAt: (c.startedAt || c.createdAt) as string,
            endedAt: (c.endedAt as string) || null,
            status: (c.status as string) || "unknown",
            transcript: (c.transcript as string) || null,
            summary: (analysis?.summary as string) || (c.summary as string) || null,
          };
        },
      );
      setRows((prev) =>
        prev.map((r) =>
          r.assistantId === assistantId
            ? { ...r, calls, loadingCalls: false }
            : r,
        ),
      );
    } catch {
      setRows((prev) =>
        prev.map((r) =>
          r.assistantId === assistantId
            ? { ...r, loadingCalls: false }
            : r,
        ),
      );
    }
  };

  const toggleRow = (assistantId: string, row: CallRow) => {
    if (!row.expanded) {
      fetchCallsForRow(assistantId);
    } else {
      setRows((prev) =>
        prev.map((r) =>
          r.assistantId === assistantId ? { ...r, expanded: false } : r,
        ),
      );
    }
  };

  const toggleTranscript = (assistantId: string, callId: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.assistantId === assistantId
          ? { ...r, expandedCallId: r.expandedCallId === callId ? null : callId }
          : r,
      ),
    );
  };

  const formatDate = (str: string | null) => {
    if (!str) return null;
    try {
      return new Date(str).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return str;
    }
  };

  const calledToday = (lastCalledDate: string | null) => {
    if (!lastCalledDate) return false;
    const today = new Date().toISOString().split("T")[0];
    // Normalize to date-only for comparison (handles both "YYYY-MM-DD" and full ISO timestamps)
    const callDate = lastCalledDate.split("T")[0];
    return callDate === today;
  };

  const calledCount = rows.filter((r) => r.lastCalledDate).length;

  return (
    <div>
      <div style={s.header}>
        <div>
          <h1 style={s.pageTitle}>Aramalar</h1>
          <p style={s.pageSub}>Komut bazlı arama geçmişini ve transkriptleri görüntüleyin.</p>
        </div>
        <button onClick={loadData} style={s.ghostBtn}>🔄 Yenile</button>
      </div>

      {/* Summary */}
      {!loading && !error && rows.length > 0 && (
        <div style={s.statsRow}>
          <div style={s.statCard}>
            <span style={s.statNum}>{rows.length}</span>
            <span style={s.statLbl}>Asistan</span>
          </div>
          <div style={s.statCard}>
            <span style={{ ...s.statNum, color: "#22C55E" }}>{calledCount}</span>
            <span style={s.statLbl}>Arama Yapıldı</span>
          </div>
          <div style={s.statCard}>
            <span style={{ ...s.statNum, color: rows.length - calledCount > 0 ? "#EF4444" : "#22C55E" }}>
              {rows.length - calledCount}
            </span>
            <span style={s.statLbl}>Aranmadı</span>
          </div>
        </div>
      )}

      {loading ? (
        <p style={s.muted}>Yükleniyor...</p>
      ) : error ? (
        <div style={{ textAlign: "center", paddingTop: 32 }}>
          <p style={s.errTxt}>{error}</p>
          <button onClick={loadData} style={s.ghostBtn}>Tekrar Dene</button>
        </div>
      ) : rows.length === 0 ? (
        <div style={s.empty}>
          <span style={{ fontSize: 44 }}>📞</span>
          <p style={s.emptyTitle}>Henüz asistan yok</p>
          <p style={s.muted}>Komutlar oluşturulduğunda burada görünür.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((row) => (
            <div key={row.assistantId} style={s.card}>
              {/* Row header */}
              <div style={s.rowHeader}>
                <div style={s.rowLeft}>
                  <span style={s.timeBadge}>{row.scheduledTime}</span>
                  <span style={s.assistantName}>{row.assistantName}</span>
                </div>
                <div style={s.rowRight}>
                  {row.lastCalledDate ? (
                    <span style={calledToday(row.lastCalledDate) ? s.badgeGreen : s.badgeBlue}>
                      {calledToday(row.lastCalledDate) ? "✓ Bugün arandı" : "✓ Arandı"}
                    </span>
                  ) : (
                    <span style={s.badgeRed}>Henüz aranmadı</span>
                  )}
                  <button
                    style={s.expandToggle}
                    onClick={() => toggleRow(row.assistantId, row)}
                  >
                    {row.expanded ? "▲ Kapat" : "📋 Transkriptler"}
                  </button>
                </div>
              </div>

              {row.lastCalledDate && (
                <p style={s.lastCalledText}>Son arama: {formatDate(row.lastCalledDate)}</p>
              )}

              {/* Call list */}
              {row.expanded && (
                <div style={s.callsContainer}>
                  {row.loadingCalls ? (
                    <p style={s.muted}>Aramalar yükleniyor...</p>
                  ) : row.calls.length === 0 ? (
                    <p style={s.muted}>Vapi'de arama kaydı bulunamadı.</p>
                  ) : (
                    row.calls.map((call) => (
                      <div key={call.id} style={s.callItem}>
                        <div style={s.callHeader}>
                          <div style={s.callMeta}>
                            <span style={getStatusStyle(call.status)}>{statusLabel(call.status)}</span>
                            <span style={s.callDate}>{formatDate(call.startedAt)}</span>
                            {call.endedAt && call.startedAt && (
                              <span style={s.callDuration}>
                                {Math.round(
                                  (new Date(call.endedAt).getTime() -
                                    new Date(call.startedAt).getTime()) / 1000,
                                )}s
                              </span>
                            )}
                          </div>
                          {call.transcript && (
                            <button
                              style={s.transcriptToggle}
                              onClick={() => toggleTranscript(row.assistantId, call.id)}
                            >
                              {row.expandedCallId === call.id ? "▲ Kapat" : "📄 Transkript"}
                            </button>
                          )}
                        </div>
                        {call.summary && (
                          <p style={s.summary}><strong>Özet:</strong> {call.summary}</p>
                        )}
                        {row.expandedCallId === call.id && call.transcript && (
                          <div style={s.transcriptBox}>
                            <pre style={s.transcriptText}>{call.transcript}</pre>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    ended: "Tamamlandı",
    "in-progress": "Devam Ediyor",
    queued: "Sırada",
    failed: "Başarısız",
    unknown: "Bilinmiyor",
  };
  return map[status] ?? status;
}

function getStatusStyle(status: string): React.CSSProperties {
  const colors: Record<string, string> = {
    ended: "rgba(34,197,94,0.15)",
    "in-progress": "rgba(234,179,8,0.15)",
    failed: "rgba(239,68,68,0.15)",
  };
  const text: Record<string, string> = {
    ended: "#22C55E",
    "in-progress": "#EAB308",
    failed: "#EF4444",
  };
  const bg = colors[status] ?? "rgba(255,255,255,0.08)";
  const color = text[status] ?? "rgba(255,255,255,0.5)";
  return { backgroundColor: bg, color, fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 6 };
}

const s: Record<string, React.CSSProperties> = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 },
  pageTitle: { fontSize: 26, fontWeight: 700, color: "#fff", margin: "0 0 4px" },
  pageSub: { fontSize: 14, color: "rgba(255,255,255,0.4)", margin: 0 },
  ghostBtn: { backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", fontSize: 14, color: "rgba(255,255,255,0.7)", cursor: "pointer" },
  statsRow: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 },
  statCard: { backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 90 },
  statNum: { fontSize: 28, fontWeight: 700, color: "#A5B4FC", lineHeight: 1 },
  statLbl: { fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.5px" } as React.CSSProperties,
  muted: { color: "rgba(255,255,255,0.35)", fontSize: 14, textAlign: "center", paddingTop: 32 } as React.CSSProperties,
  errTxt: { color: "#EF4444", fontSize: 14, margin: 0 },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", padding: "50px 0", gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: 600, color: "#fff", margin: 0 },
  card: { backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 18 },
  rowHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 },
  rowLeft: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  rowRight: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  timeBadge: { backgroundColor: "rgba(79,70,229,0.2)", color: "#A5B4FC", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 7 },
  assistantName: { fontSize: 15, fontWeight: 600, color: "#fff" },
  badgeGreen: { backgroundColor: "rgba(34,197,94,0.12)", color: "#22C55E", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 6 },
  badgeBlue: { backgroundColor: "rgba(79,70,229,0.15)", color: "#A5B4FC", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 6 },
  badgeRed: { backgroundColor: "rgba(239,68,68,0.12)", color: "#EF4444", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 6 },
  expandToggle: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 12px", fontSize: 13, color: "rgba(255,255,255,0.7)", cursor: "pointer" },
  lastCalledText: { fontSize: 12, color: "rgba(255,255,255,0.3)", margin: "6px 0 0" },
  callsContainer: { marginTop: 14, display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 },
  callItem: { backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 14px" },
  callHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
  callMeta: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  callDate: { fontSize: 13, color: "rgba(255,255,255,0.45)" },
  callDuration: { fontSize: 12, color: "rgba(255,255,255,0.3)", backgroundColor: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 5 },
  transcriptToggle: { background: "rgba(79,70,229,0.15)", border: "none", borderRadius: 7, padding: "4px 12px", fontSize: 12, color: "#A5B4FC", cursor: "pointer" },
  summary: { fontSize: 13, color: "rgba(255,255,255,0.6)", margin: "8px 0 0", lineHeight: 1.5 },
  transcriptBox: { marginTop: 10, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "12px 14px", maxHeight: 300, overflowY: "auto" },
  transcriptText: { fontSize: 13, color: "rgba(255,255,255,0.7)", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6, fontFamily: "inherit" } as React.CSSProperties,
};
