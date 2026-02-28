// Admin panel configuration
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Admin password — set via VITE_ADMIN_PASSWORD env variable or defaults to "1234"
export const ADMIN_PASSWORD =
  import.meta.env.VITE_ADMIN_PASSWORD || "1234";
