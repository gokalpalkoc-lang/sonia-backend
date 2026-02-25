import { useRouter } from "expo-router";
import React, { useRef } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";

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

    function sendMessage(type, args) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: type,
          message: args.map(arg => {
            try {
              return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
            } catch (e) {
              return String(arg);
            }
          }).join(' ')
        }));
      } catch (e) {
        // Ignore errors
      }
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

    window.onerror = function(message, source, lineno, colno, error) {
      sendMessage('error', [message + ' (line ' + lineno + ':' + colno + ')']);
    };
  })();
`;

export default function TalkAIScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      const { type, message } = data;
      
      // Log to React Native console with appropriate prefix
      switch (type) {
        case 'error':
          console.warn(`[WebView Error] ${message}`);
          break;
        case 'warn':
          console.warn(`[WebView Warn] ${message}`);
          break;
        case 'info':
          console.info(`[WebView Info] ${message}`);
          break;
        default:
          console.log(`[WebView Log] ${message}`);
      }
    } catch (e) {
      // Ignore parsing errors
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
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

      {/* WebView */}
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
