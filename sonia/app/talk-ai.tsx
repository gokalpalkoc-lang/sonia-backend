import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useRef } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";

import { useCommands } from "@/context/commands-context";
import { scheduleCommandReminder } from "@/lib/notifications";

const MESSSIII_URL = "https://postomental-nathaly-spongingly.ngrok-free.dev";

// JavaScript to inject into the WebView to capture console logs
const CONSOLE_INJECT_SCRIPT = `
  (function() {
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
    };

    function sendRaw(payload) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      } catch (e) {
        // Ignore errors
      }
    }

    function sendMessage(type, args) {
      sendRaw({
        type: type,
        message: args.map(arg => {
          try {
            return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
          } catch (e) {
            return String(arg);
          }
        }).join(' ')
      });
    }

    console.log = function(...args) {
      originalConsole.log.apply(console, args);
      sendMessage('log', args);
    };

    console.error = function(...args) {
      originalConsole.error.apply(console, args);
      sendMessage('error', args);
    };

    console.warn = function(...args) {
      originalConsole.warn.apply(console, args);
      sendMessage('warn', args);
    };

    console.info = function(...args) {
      originalConsole.info.apply(console, args);
      sendMessage('info', args);
    };

    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
      const response = await originalFetch(input, init);
      try {
        const url = typeof input === 'string' ? input : input?.url;
        const method = (init?.method || 'GET').toUpperCase();
        if (url && method === 'POST' && url.includes('/api/commands') && init?.body) {
          const payload = typeof init.body === 'string' ? JSON.parse(init.body) : null;
          if (payload && payload.time && payload.prompt) {
            sendRaw({ type: 'command-created', command: payload });
          }
        }
      } catch (error) {
        sendMessage('warn', ['Failed to inspect fetch payload', error]);
      }
      return response;
    };

    window.onerror = function(message, source, lineno, colno, error) {
      sendMessage('error', [message + ' (line ' + lineno + ':' + colno + ')']);
    };
  })();
`;

export default function TalkAIScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const { addCommand } = useCommands();
  const { commandPayload, autoStart } = useLocalSearchParams<{ commandPayload?: string; autoStart?: string }>();

  const autoStartScript = useMemo(() => {
    if (!commandPayload || autoStart !== "1") {
      return null;
    }

    try {
      const decoded = decodeURIComponent(String(commandPayload));
      return `
        (function() {
          try {
            const payload = ${decoded};
            window.__soniaAutoCallPayload = payload;
            window.dispatchEvent(new CustomEvent('sonia:auto-call', { detail: payload }));
          } catch (error) {
            console.error('Failed to trigger sonia:auto-call', error);
          }
        })();
        true;
      `;
    } catch {
      return null;
    }
  }, [autoStart, commandPayload]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      const { type, message, command } = data;

      if (type === "command-created" && command?.time && command?.prompt) {
        const incomingCommand = {
          id: `${Date.now()}-${Math.random()}`,
          assistantName: command.assistantName,
          time: String(command.time),
          prompt: String(command.prompt),
          firstMessage: command.firstMessage ? String(command.firstMessage) : undefined,
          expanded: false,
        };

        addCommand(incomingCommand);
        scheduleCommandReminder(incomingCommand).catch((error) => {
          console.error("Failed to schedule command reminder", error);
        });
        return;
      }

      switch (type) {
        case "error":
          console.warn(`[WebView Error] ${message}`);
          break;
        case "warn":
          console.warn(`[WebView Warn] ${message}`);
          break;
        case "info":
          console.info(`[WebView Info] ${message}`);
          break;
        default:
          console.log(`[WebView Log] ${message}`);
      }
    } catch {
      // Ignore parsing errors
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>✦ Talk AI</Text>
        <View style={styles.headerSpacer} />
      </View>

      <WebView
        ref={webViewRef}
        source={{ uri: MESSSIII_URL }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        startInLoadingState={true}
        injectedJavaScript={CONSOLE_INJECT_SCRIPT}
        onMessage={handleMessage}
        onLoadEnd={() => {
          if (autoStartScript) {
            webViewRef.current?.injectJavaScript(autoStartScript);
          }
        }}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loadingText}>Loading Talk AI...</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D1A",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backButton: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 70,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0D0D1A",
  },
  loadingText: {
    color: "#fff",
    marginTop: 12,
    fontSize: 16,
  },
});
