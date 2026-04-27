// Configuration for Vapi API
// Replace these values with your own keys

export const VAPI_PUBLIC_KEY = "23ae90c6-aed9-4b02-b6bb-efb94a9ba2d1";
export const ASSISTANT_ID =
  import.meta.env.VITE_ASSISTANT_ID || "2135f31f-5c85-4517-9574-571a1b1d0e38";

// API key for creating assistants via Vapi API (server-side only)
// WARNING: Do NOT expose this in production frontend builds.
// This should be moved to a backend endpoint for production use.
export const VAPI_API_KEY = import.meta.env.VITE_VAPI_API_KEY || "";

// Django API base URL
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Default model to use for new assistants
export const DEFAULT_MODEL = "gpt-4o-mini";