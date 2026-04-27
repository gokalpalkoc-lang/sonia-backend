import { useLocalSearchParams, useRouter } from "expo-router";
import { AudioModule } from "expo-audio";
import React, { useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";

import { useAuth } from "@/context/auth-context";
import { useCommands } from "@/context/commands-context";
import { useTheme } from "@/context/theme-context";
import { scheduleCommandReminder } from "@/lib/notifications";
import { getVoiceId } from "@/lib/storage";

const VOICE_WEBVIEW_URL = process.env.EXPO_PUBLIC_WEBSITE_URL!;

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
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [webUri, setWebUri] = React.useState(VOICE_WEBVIEW_URL);
  const [hasMicPermission, setHasMicPermission] = React.useState<boolean | null>(null);

  const requestMicPermission = React.useCallback(async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      setHasMicPermission(status.granted);

      if (!status.granted) {
        Alert.alert(
          "Access to Microphone required",
          profile?.username 
            ? `You need to give access to microphone in order to call ${profile.username}.`
            : "You need to give access to microphone in order to make a call.",
        );
      }
    } catch (error) {
      console.error("Failed to request microphone permission", error);
      setHasMicPermission(false);
    }
  }, []);

  const { assistantId, autoStart } = useLocalSearchParams<{
    assistantId?: string;
    autoStart?: string;
  }>();

  React.useEffect(() => {
    requestMicPermission();
  }, [requestMicPermission]);

  React.useEffect(() => {
    let isMounted = true;

    const setWebViewUrl = async () => {
      try {
        const voiceId = await getVoiceId();
        if (!isMounted) return;

        const url = new URL(VOICE_WEBVIEW_URL);

        // Use the user's single assistant ID from profile
        const userAssistantId = profile?.assistant_id;
        if (userAssistantId?.trim()) {
          url.searchParams.set("assistant_id", userAssistantId);
        }

        if (voiceId?.trim()) {
          url.searchParams.set("voiceId", voiceId);
        }

        // Allow override via params (e.g. from notification deep link)
        if (autoStart === "1" && assistantId?.trim()) {
          url.searchParams.set("start_assistant_id", assistantId.trim());
        }

        setWebUri(url.toString());
      } catch (error) {
        console.warn("Failed to build webview URL", error);
      }
    };

    setWebViewUrl();

    return () => {
      isMounted = false;
    };
  }, [autoStart, assistantId, profile]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      const { type, message, command } = data;

      if (type === "command-created" && command?.time && command?.prompt) {
        const incomingCommand = {
          id: `${Date.now()}-${Math.random()}`,
          time: String(command.time),
          prompt: String(command.prompt),
          firstMessage: command.firstMessage
            ? String(command.firstMessage)
            : undefined,
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.surface }]}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/carousel");
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.backButtonText, { color: colors.text }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>✦ {profile?.username ? `Call ${profile.username}` : 'Call'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {hasMicPermission ? (
        Platform.OS === "web" ? (
          <iframe
            src={webUri}
            allow="microphone"
            style={{ flex: 1, width: "100%", height: "100%", border: "none" }}
          />
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: webUri }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            startInLoadingState={true}
            injectedJavaScript={CONSOLE_INJECT_SCRIPT}
            mediaCapturePermissionGrantType={
              Platform.OS === "android" ? "grantIfSameHostElsePrompt" : undefined
            }
            onMessage={handleMessage}
            renderLoading={() => (
              <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={[styles.loadingText, { color: colors.text }]}>{profile?.username ? `Calling ${profile.username}...` : 'Calling...'}</Text>
              </View>
            )}
          />
        )
      ) : (
        <View style={styles.permissionContainer}>
          <Text style={[styles.permissionTitle, { color: colors.text }]}>Waiting for microphone access</Text>
          <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
            {profile?.username 
              ? `Microphone Access is required in order to call ${profile.username}.`
              : "Microphone Access is required in order to make a call."}
          </Text>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: colors.accent }]}
            onPress={requestMicPermission}
            activeOpacity={0.8}
          >
            <Text style={styles.permissionButtonText}>Give Microphone Access</Text>
          </TouchableOpacity>
        </View>
      )}
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
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  permissionTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  permissionText: {
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
  },
  permissionButton: {
    marginTop: 8,
    backgroundColor: "#4F46E5",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  permissionButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
});
