// Ensure background task definitions (TaskManager.defineTask) are loaded
// even during headless background launches, before Expo Router lazily
// discovers route files.
import "./lib/notifications";

import "expo-router/entry";
