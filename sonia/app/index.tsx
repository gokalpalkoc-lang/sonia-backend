import { useAudioPlayer } from "expo-audio";
import { Redirect, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isVoiceSetupDone } from "@/lib/storage";

import pic3 from "../assets/images/gojo.jpg";
import pic2 from "../assets/images/keddy.png";
import pic1 from "../assets/images/manzara.jpg";

import sound1 from "../assets/audio/ses1.m4a";
import sound2 from "../assets/audio/ses2.m4a";
import sound3 from "../assets/audio/ses3.m4a";

const ITEMS = [
  { image: pic1, sound: sound1, label: "Manzara" },
  { image: pic2, sound: sound2, label: "Keddy" },
  { image: pic3, sound: sound3, label: "Gojo" },
];

export default function CarouselScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Check if voice setup has been completed
  const [voiceReady, setVoiceReady] = useState<boolean | null>(null);
  useEffect(() => {
    isVoiceSetupDone().then((c)=>setVoiceReady(c));
  }, []);

  const [currentIndex, setCurrentIndex] = useState(0);
  const player = useAudioPlayer(ITEMS[currentIndex].sound);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const playSound = () => {
    // Animate the image on press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
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
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex((prev) => {
        if (direction === "right")
          return prev === ITEMS.length - 1 ? 0 : prev + 1;
        return prev === 0 ? ITEMS.length - 1 : prev - 1;
      });
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  };

  // Show loading while checking voice setup status
  if (voiceReady === null) {
    return (
      <View
        style={[
          styles.container,
          { alignItems: "center", justifyContent: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  console.log(voiceReady)
  // Redirect to voice setup if not completed
  if (!voiceReady) {
    return <Redirect href={"/voice-setup" as const} />;
  }

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push("/password")}
          activeOpacity={0.7}
        >
          <Text style={styles.headerButtonIcon}>☰</Text>
          <Text style={styles.headerButtonText}>Menü</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.aiButton}
          onPress={() => router.push("/talk-ai")}
          activeOpacity={0.7}
        >
          <Text style={styles.aiButtonText}>✦ Yapay Zekâ ile Konuş</Text>
        </TouchableOpacity>
      </View>

      {/* Carousel area */}
      <View style={styles.carouselArea}>
        <TouchableOpacity
          onPress={() => navigate("left")}
          style={styles.arrowButton}
          activeOpacity={0.6}
        >
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={playSound} activeOpacity={0.85}>
          <Animated.View
            style={[
              styles.imageCard,
              {
                transform: [{ scale: scaleAnim }],
                opacity: fadeAnim,
              },
            ]}
          >
            <Image
              source={ITEMS[currentIndex].image}
              style={styles.image}
              resizeMode="cover"
            />
            {/* Overlay label */}
            <View style={styles.imageOverlay}>
              <Text style={styles.imageLabel}>{ITEMS[currentIndex].label}</Text>
              <Text style={styles.tapHint}>Sesi çalmak için dokun</Text>
            </View>
          </Animated.View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigate("right")}
          style={styles.arrowButton}
          activeOpacity={0.6}
        >
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Dots indicator */}
      <View style={styles.dotsRow}>
        {ITEMS.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === currentIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D1A",
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  headerButtonIcon: {
    fontSize: 18,
    color: "#fff",
    marginRight: 6,
  },
  headerButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  aiButton: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  aiButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
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
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: {
    fontSize: 32,
    color: "#fff",
    lineHeight: 36,
    marginTop: -2,
  },
  imageCard: {
    width: 260,
    height: 400,
    borderRadius: 24,
    overflow: "hidden",
    marginHorizontal: 12,
    // Soft shadow / glow
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  imageLabel: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  tapHint: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: 2,
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
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  dotActive: {
    backgroundColor: "#4F46E5",
    width: 24,
    borderRadius: 4,
  },
});
