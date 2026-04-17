import { useAudioPlayer } from "expo-audio";
import { Redirect, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import { useTheme } from "@/context/theme-context";
import { isVoiceSetupDone } from "@/lib/storage";

import img3 from "../assets/images/3.png";
import img5 from "../assets/images/5.png";
import img8 from "../assets/images/8.png";
import img9 from "../assets/images/9.png";
import img12 from "../assets/images/12.png";
import img13 from "../assets/images/13.png";
import img14 from "../assets/images/14.png";

import sound3_new from "../assets/audio/3.mp3";
import sound5 from "../assets/audio/5.mp3";
import sound8 from "../assets/audio/8.mp3";
import sound9 from "../assets/audio/9.mp3";
import sound12 from "../assets/audio/12.mp3";
import sound13 from "../assets/audio/13.mp3";
import sound14 from "../assets/audio/14.mp3";

const ITEMS = [
  { image: img3, sound: sound3_new, label: "Image 3" },
  { image: img5, sound: sound5, label: "Image 5" },
  { image: img8, sound: sound8, label: "Image 8" },
  { image: img9, sound: sound9, label: "Image 9" },
  { image: img12, sound: sound12, label: "Image 12" },
  { image: img13, sound: sound13, label: "Image 13" },
  { image: img14, sound: sound14, label: "Image 14" },
];

/* ───────────────────────── Options Menu Item ───────────────────────── */

interface MenuItemProps {
  icon: string;
  label: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
  surfaceColor: string;
  textColor: string;
  textSecondaryColor: string;
}

function MenuItem({
  icon,
  label,
  onPress,
  rightElement,
  destructive,
  surfaceColor,
  textColor,
  textSecondaryColor,
}: MenuItemProps) {
  return (
    <TouchableOpacity
      style={[menuStyles.item, { backgroundColor: surfaceColor }]}
      onPress={onPress}
      activeOpacity={rightElement ? 1 : 0.65}
      disabled={!onPress && !rightElement}
    >
      <Text style={menuStyles.itemIcon}>{icon}</Text>
      <Text
        style={[
          menuStyles.itemLabel,
          { color: destructive ? "#EF4444" : textColor },
        ]}
      >
        {label}
      </Text>
      {rightElement && (
        <View style={menuStyles.itemRight}>{rightElement}</View>
      )}
      {!rightElement && onPress && (
        <Text style={[menuStyles.itemChevron, { color: textSecondaryColor }]}>
          ›
        </Text>
      )}
    </TouchableOpacity>
  );
}

const menuStyles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 6,
  },
  itemIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 28,
    textAlign: "center",
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
  itemRight: {
    marginLeft: "auto",
  },
  itemChevron: {
    fontSize: 22,
    fontWeight: "600",
    marginLeft: "auto",
  },
});

/* ───────────────────────── Main Carousel Screen ───────────────────────── */

export default function CarouselScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, isLoading: authLoading, profile, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();

  // Options menu state
  const [menuVisible, setMenuVisible] = useState(false);
  const menuSlide = useRef(new Animated.Value(300)).current;
  const menuBackdrop = useRef(new Animated.Value(0)).current;

  // Sound autoplay state
  const [autoplaySound, setAutoplaySound] = useState(true);

  // Check if voice setup has been completed
  const [voiceReady, setVoiceReady] = useState<boolean | null>(null);
  useEffect(() => {
    if (token) {
      const profileHasVoice = !!(profile?.voice_id);
      if (profileHasVoice) {
        setVoiceReady(true);
      } else {
        isVoiceSetupDone().then((c) => setVoiceReady(c));
      }
    }
  }, [token, profile]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const player = useAudioPlayer(ITEMS[currentIndex].sound);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const openMenu = () => {
    setMenuVisible(true);
    Animated.parallel([
      Animated.spring(menuSlide, {
        toValue: 0,
        useNativeDriver: Platform.OS !== "web",
        tension: 65,
        friction: 11,
      }),
      Animated.timing(menuBackdrop, {
        toValue: 1,
        duration: 250,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  };

  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(menuSlide, {
        toValue: 300,
        duration: 200,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(menuBackdrop, {
        toValue: 0,
        duration: 200,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start(() => setMenuVisible(false));
  };

  const playSound = () => {
    // Animate the image on press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 80,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();

    // Restart from beginning and play
    player.seekTo(0);
    player.play();
  };

  const navigate = (direction: "left" | "right") => {
    // Fade out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: Platform.OS !== "web",
    }).start(() => {
      setCurrentIndex((prev) => {
        const nextIdx =
          direction === "right"
            ? prev === ITEMS.length - 1
              ? 0
              : prev + 1
            : prev === 0
              ? ITEMS.length - 1
              : prev - 1;
        return nextIdx;
      });
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    });
  };

  // Auto-play sound on slide change
  useEffect(() => {
    if (autoplaySound && voiceReady) {
      player.seekTo(0);
      player.play();
    }
  }, [currentIndex]);

  const handleLogout = async () => {
    closeMenu();
    // Small delay so the animation finishes before navigation
    setTimeout(async () => {
      await logout();
      router.replace("/");
    }, 250);
  };

  // Show loading while checking auth / voice setup
  if (authLoading || (token && voiceReady === null)) {
    return (
      <View
        style={[
          { flex: 1, backgroundColor: colors.background },
          { alignItems: "center", justifyContent: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Redirect to login if not authenticated
  if (!token) {
    return <Redirect href={"/" as const} />;
  }

  // Redirect to voice setup if not completed
  if (!voiceReady) {
    return <Redirect href={"/voice-setup" as const} />;
  }

  const greeting = profile?.patient_name || profile?.username || "User";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header bar */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: colors.surface }]}
          onPress={() => router.push("/password")}
          activeOpacity={0.7}
        >
          <Text style={[styles.headerButtonIcon, { color: colors.text }]}>
            ☰
          </Text>
          <Text style={[styles.headerButtonText, { color: colors.text }]}>
            Menü
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.aiButton, { backgroundColor: colors.accent }]}
          onPress={() => router.push("/talk-ai")}
          activeOpacity={0.7}
        >
          <Text style={styles.aiButtonText}>✦ Yapay Zekâ ile Konuş</Text>
        </TouchableOpacity>

        {/* Options button */}
        <TouchableOpacity
          style={[styles.optionsButton, { backgroundColor: colors.surface }]}
          onPress={openMenu}
          activeOpacity={0.7}
        >
          <Text style={[styles.optionsIcon, { color: colors.text }]}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Carousel area */}
      <View style={styles.carouselArea}>
        <TouchableOpacity
          onPress={() => navigate("left")}
          style={[styles.arrowButton, { backgroundColor: colors.surface }]}
          activeOpacity={0.6}
        >
          <Text style={[styles.arrowText, { color: colors.text }]}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={playSound} activeOpacity={0.85}>
          <Animated.View
            style={[
              styles.imageCard,
              {
                transform: [{ scale: scaleAnim }],
                opacity: fadeAnim,
                boxShadow: `0px 8px 20px ${colors.cardShadow}`,
              },
            ]}
          >
            <Image
              source={ITEMS[currentIndex].image}
              style={styles.image}
              resizeMode="cover"
            />
          </Animated.View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigate("right")}
          style={[styles.arrowButton, { backgroundColor: colors.surface }]}
          activeOpacity={0.6}
        >
          <Text style={[styles.arrowText, { color: colors.text }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Dots indicator */}
      <View style={styles.dotsRow}>
        {ITEMS.map((_, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => {
              if (i !== currentIndex) {
                Animated.timing(fadeAnim, {
                  toValue: 0,
                  duration: 120,
                  useNativeDriver: Platform.OS !== "web",
                }).start(() => {
                  setCurrentIndex(i);
                  Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 180,
                    useNativeDriver: Platform.OS !== "web",
                  }).start();
                });
              }
            }}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: colors.surface },
                i === currentIndex && [
                  styles.dotActive,
                  { backgroundColor: colors.accent },
                ],
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── Options Slide-up Menu (Modal) ─── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={closeMenu}
        statusBarTranslucent
      >
        <View style={styles.modalWrapper}>
          {/* Backdrop */}
          <Animated.View
            style={[
              styles.backdrop,
              { opacity: menuBackdrop },
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
          </Animated.View>

          {/* Slide-up panel */}
          <Animated.View
            style={[
              styles.menuPanel,
              {
                backgroundColor: colors.background,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                transform: [{ translateY: menuSlide }],
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            {/* Handle bar */}
            <View style={styles.menuHandle}>
              <View
                style={[
                  styles.handleBar,
                  { backgroundColor: colors.textMuted },
                ]}
              />
            </View>

            {/* User greeting */}
            <View style={styles.menuGreeting}>
              <View
                style={[
                  styles.avatarCircle,
                  { backgroundColor: colors.accentLight },
                ]}
              >
                <Text style={[styles.avatarText, { color: colors.accent }]}>
                  {greeting.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.greetingTextWrap}>
                <Text style={[styles.greetingName, { color: colors.text }]}>
                  {greeting}
                </Text>
                <Text
                  style={[
                    styles.greetingSubtext,
                    { color: colors.textSecondary },
                  ]}
                >
                  {profile?.username
                    ? `@${profile.username}`
                    : "Manage your settings"}
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            {/* Menu Items */}
            <View style={styles.menuItems}>
              {/* Dark / Light Mode Toggle */}
              <MenuItem
                icon={isDark ? "🌙" : "☀️"}
                label={isDark ? "Dark Mode" : "Light Mode"}
                surfaceColor={colors.surface}
                textColor={colors.text}
                textSecondaryColor={colors.textSecondary}
                rightElement={
                  <Switch
                    value={isDark}
                    onValueChange={toggleTheme}
                    trackColor={{
                      false: "rgba(0,0,0,0.15)",
                      true: colors.accent,
                    }}
                    thumbColor="#fff"
                  />
                }
              />

              {/* Autoplay Sound Toggle */}
              <MenuItem
                icon="🔊"
                label="Autoplay Sounds"
                surfaceColor={colors.surface}
                textColor={colors.text}
                textSecondaryColor={colors.textSecondary}
                rightElement={
                  <Switch
                    value={autoplaySound}
                    onValueChange={setAutoplaySound}
                    trackColor={{
                      false: "rgba(0,0,0,0.15)",
                      true: colors.accent,
                    }}
                    thumbColor="#fff"
                  />
                }
              />

              {/* Voice Setup */}
              <MenuItem
                icon="🎙️"
                label="Voice Settings"
                surfaceColor={colors.surface}
                textColor={colors.text}
                textSecondaryColor={colors.textSecondary}
                onPress={() => {
                  closeMenu();
                  setTimeout(() => router.push("/voice-setup"), 250);
                }}
              />

              {/* Talk to AI shortcut */}
              <MenuItem
                icon="✦"
                label="Talk to AI"
                surfaceColor={colors.surface}
                textColor={colors.text}
                textSecondaryColor={colors.textSecondary}
                onPress={() => {
                  closeMenu();
                  setTimeout(() => router.push("/talk-ai"), 250);
                }}
              />

              <View style={{ height: 6 }} />

              {/* Logout */}
              <MenuItem
                icon="🚪"
                label="Log Out"
                surfaceColor={colors.dangerBg}
                textColor={colors.text}
                textSecondaryColor={colors.textSecondary}
                destructive
                onPress={handleLogout}
              />
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

/* ───────────────────────── Styles ───────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  headerButtonIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  aiButton: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  aiButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  optionsButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionsIcon: {
    fontSize: 20,
  },
  // Carousel
  carouselArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  arrowButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: {
    fontSize: 32,
    lineHeight: 36,
    marginTop: -2,
  },
  imageCard: {
    width: 260,
    height: 400,
    borderRadius: 24,
    overflow: "hidden",
    marginHorizontal: 12,
    elevation: 12,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  // Dots
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingBottom: 36,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    borderRadius: 4,
  },
  // Modal / Menu
  modalWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  menuPanel: {
    paddingHorizontal: 20,
    maxHeight: "80%",
    // Subtle shadow for the panel
    boxShadow: "0px -4px 24px rgba(0,0,0,0.25)",
    elevation: 20,
  },
  menuHandle: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  menuGreeting: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "700",
  },
  greetingTextWrap: {
    flex: 1,
  },
  greetingName: {
    fontSize: 18,
    fontWeight: "700",
  },
  greetingSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 8,
    marginHorizontal: 4,
  },
  menuItems: {
    paddingVertical: 8,
  },
});
