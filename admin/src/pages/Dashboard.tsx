import { useState } from "react";
import CommandsPage from "./CommandsPage";
import CallsPage from "./CallsPage";
import NotificationsPage from "./NotificationsPage";

type Tab = "commands" | "calls" | "notifications";

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("commands");

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "commands", label: "Komutlar", icon: "📋" },
    { id: "calls", label: "Aramalar", icon: "📞" },
    { id: "notifications", label: "Bildirimler", icon: "🔔" },
  ];

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.logoCircle}>
            <span style={{ fontSize: 22 }}>🤖</span>
          </div>
          <span style={styles.logoText}>Sonia Admin</span>
        </div>

        <nav style={styles.nav}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.navButton,
                ...(activeTab === tab.id ? styles.navButtonActive : {}),
              }}
            >
              <span style={styles.navIcon}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <button onClick={onLogout} style={styles.logoutButton}>
          <span style={{ marginRight: 8 }}>🚪</span>
          Çıkış Yap
        </button>
      </aside>

      {/* Main content */}
      <main style={styles.main}>
        {activeTab === "commands" && <CommandsPage />}
        {activeTab === "calls" && <CallsPage />}
        {activeTab === "notifications" && <NotificationsPage />}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "#0D0D1A",
  },
  sidebar: {
    width: 240,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRight: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    flexDirection: "column",
    padding: "24px 16px",
    position: "fixed" as const,
    top: 0,
    left: 0,
    height: "100vh",
    overflowY: "auto",
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 32,
    paddingLeft: 8,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(79,70,229,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 17,
    fontWeight: 700,
    color: "#fff",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    flex: 1,
  },
  navButton: {
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
    textAlign: "left" as const,
    width: "100%",
    transition: "all 0.15s",
  },
  navButtonActive: {
    backgroundColor: "rgba(79,70,229,0.2)",
    color: "#A5B4FC",
  },
  navIcon: {
    fontSize: 16,
  },
  logoutButton: {
    display: "flex",
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
    cursor: "pointer",
    textAlign: "left" as const,
    width: "100%",
  },
  main: {
    flex: 1,
    marginLeft: 240,
    padding: "32px",
    minHeight: "100vh",
  },
};
