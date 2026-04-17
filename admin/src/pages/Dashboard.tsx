import { useEffect, useState } from "react";
import { fetchProfile } from "../api";
import CommandsPage from "./CommandsPage";
import CallsPage from "./CallsPage";
import NotificationsPage from "./NotificationsPage";

type Tab = "commands" | "calls" | "notifications";

interface DashboardProps {
  onLogout: () => void;
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "commands", label: "Komutlar", icon: "📋" },
  { id: "calls", label: "Aramalar", icon: "📞" },
  { id: "notifications", label: "Bildirimler", icon: "🔔" },
];

export default function Dashboard({ onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("commands");
  const [menuOpen, setMenuOpen] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [username, setUsername] = useState("");
  const [notificationUuid, setNotificationUuid] = useState("");

  useEffect(() => {
    fetchProfile()
      .then((data) => {
        setPatientName(data.profile?.patient_name || "");
        setUsername(data.profile?.username || "");
        setNotificationUuid(data.profile?.notification_uuid || "");
      })
      .catch(() => {});
  }, []);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setMenuOpen(false);
  };

  return (
    <div className="dashboard-root">
      {/* ── Mobile top header ── */}
      <header className="mobile-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={inlineS.logoCircle}>
            <span>🤖</span>
          </div>
          <span style={inlineS.logoText}>Sonia</span>
        </div>
        <button style={inlineS.hamburger} onClick={() => setMenuOpen(!menuOpen)} aria-label="Menü">
          <span style={inlineS.hLine} />
          <span style={inlineS.hLine} />
          <span style={inlineS.hLine} />
        </button>
      </header>

      {/* ── Overlay ── */}
      <div
        className={`sidebar-overlay${menuOpen ? " sidebar-overlay--visible" : ""}`}
        onClick={() => setMenuOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside className={`sidebar${menuOpen ? " sidebar--open" : ""}`}>
        <div style={inlineS.sidebarHeader}>
          <div style={inlineS.logoCircle}>
            <span>🤖</span>
          </div>
          <span style={inlineS.logoText}>Sonia Panel</span>
        </div>

        {username && (
          <div style={inlineS.userInfo}>
            <div style={inlineS.userAvatar}>
              {username.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={inlineS.userName}>{patientName || username}</div>
              {patientName && <div style={inlineS.userHandle}>@{username}</div>}
            </div>
          </div>
        )}

        {notificationUuid && (
          <div style={inlineS.uuidBox}>
            <div style={inlineS.uuidLabel}>AI Bildirim ID</div>
            <div style={inlineS.uuidRow}>
              <code style={inlineS.uuidCode}>{notificationUuid}</code>
              <button
                style={inlineS.copyBtn}
                title="Kopyala"
                onClick={() => {
                  navigator.clipboard.writeText(notificationUuid);
                }}
              >
                📋
              </button>
            </div>
          </div>
        )}

        <nav style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                ...inlineS.navBtn,
                ...(activeTab === tab.id ? inlineS.navBtnActive : {}),
              }}
            >
              <span style={{ fontSize: 16 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <button onClick={onLogout} style={inlineS.logoutBtn}>
          <span>🚪</span> Çıkış Yap
        </button>
      </aside>

      {/* ── Main content ── */}
      <main className="main-content">
        {activeTab === "commands" && <CommandsPage />}
        {activeTab === "calls" && <CallsPage />}
        {activeTab === "notifications" && <NotificationsPage />}
      </main>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="mobile-tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            style={{
              ...inlineS.mobileTab,
              ...(activeTab === tab.id ? inlineS.mobileTabActive : {}),
            }}
          >
            <span style={{ fontSize: 22 }}>{tab.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 500 }}>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

const inlineS: Record<string, React.CSSProperties> = {
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    paddingLeft: 8,
  },
  logoCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(79,70,229,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: 17,
  },
  logoText: {
    fontSize: 15,
    fontWeight: 700,
    color: "#fff",
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    padding: "10px 8px",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#4F46E5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
    flexShrink: 0,
  },
  userName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 140,
  },
  userHandle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
  },
  uuidBox: {
    marginBottom: 16,
    padding: "10px 10px",
    backgroundColor: "rgba(79,70,229,0.08)",
    border: "1px solid rgba(79,70,229,0.2)",
    borderRadius: 10,
  },
  uuidLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    marginBottom: 6,
  } as React.CSSProperties,
  uuidRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  uuidCode: {
    fontSize: 12,
    fontFamily: "'Courier New', monospace",
    color: "#A5B4FC",
    letterSpacing: "0.5px",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as React.CSSProperties,
  copyBtn: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    padding: "4px 6px",
    cursor: "pointer",
    fontSize: 13,
    lineHeight: 1,
    flexShrink: 0,
  },
  navBtn: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
  } as React.CSSProperties,
  navBtnActive: {
    backgroundColor: "rgba(79,70,229,0.2)",
    color: "#A5B4FC",
  },
  logoutBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
    cursor: "pointer",
    width: "100%",
  } as React.CSSProperties,
  hamburger: {
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 5,
    padding: 8,
  },
  hLine: {
    display: "block",
    width: 22,
    height: 2,
    backgroundColor: "#fff",
    borderRadius: 2,
  },
  mobileTab: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 4px 10px",
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.4)",
    cursor: "pointer",
    gap: 2,
    transition: "color 0.15s ease",
  } as React.CSSProperties,
  mobileTabActive: {
    color: "#A5B4FC",
  },
};
