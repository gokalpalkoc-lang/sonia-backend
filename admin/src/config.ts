// Admin panel configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!API_BASE_URL) throw new Error("VITE_API_BASE_URL is not defined in environment variables");

// Vapi API key for fetching call transcripts
export const VAPI_API_KEY = import.meta.env.VITE_VAPI_API_KEY;
if (!VAPI_API_KEY) throw new Error("VITE_VAPI_API_KEY is not defined in environment variables");
