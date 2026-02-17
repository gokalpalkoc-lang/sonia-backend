import { Audio } from "expo-av";
import React, { useRef, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import pic3 from "../../assets/images/gojo.jpg";
import pic2 from "../../assets/images/keddy.png";
import pic1 from "../../assets/images/manzara.jpg";

import sound1 from "../../assets/audio/ses1.m4a";
import sound2 from "../../assets/audio/ses2.m4a";
import sound3 from "../../assets/audio/ses3.m4a";

import menuIcon from "../../assets/images/menu-icon.png";


export default function HomeScreen() {
  const rectangles = [pic1, pic2, pic3];
  const sounds = [sound1, sound2, sound3];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentScreen, setCurrentScreen] = useState("carousel");
  const [commands, setCommands] = useState<any[]>([]);
  const [timeInput, setTimeInput] = useState("");
  const [promptInput, setPromptInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  const soundRef = useRef<Audio.Sound | null>(null);
  const PASSWORD = "1234";

  const playSound = async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
    }

    const { sound } = await Audio.Sound.createAsync(sounds[currentIndex]);
    soundRef.current = sound;
    await sound.playAsync();
  };

  const goRight = () =>
    setCurrentIndex((prev) =>
      prev === rectangles.length - 1 ? 0 : prev + 1
    );

  const goLeft = () =>
    setCurrentIndex((prev) =>
      prev === 0 ? rectangles.length - 1 : prev - 1
    );

  const checkPassword = () => {
    if (passwordInput === PASSWORD) {
      setCurrentScreen("protected");
      setPasswordInput("");
    } else {
      Alert.alert("Incorrect password!");
      setCurrentScreen("carousel");
    }
  };

  const handleAppendClick = () => {
    if (!timeInput.trim() || !promptInput.trim()) {
      Alert.alert("Please enter both time and prompt.");
      return;
    }

    setCommands((prev) => [
      ...prev,
      { time: timeInput, prompt: promptInput, expanded: false },
    ]);

    setTimeInput("");
    setPromptInput("");
    setCurrentScreen("protected");
  };

  const handleDelete = (index: number) =>
    setCommands((prev) => prev.filter((_, i) => i !== index));

  const toggleExpand = (index: number) => {
    const newCommands = [...commands];
    newCommands[index].expanded = !newCommands[index].expanded;
    setCommands(newCommands);
  };

  return (
    <View style={styles.container}>
      {/* CAROUSEL */}
      {currentScreen === "carousel" && (
        <>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setCurrentScreen("password")}
          >
            <Image source={menuIcon} style={styles.menuIcon} />
            <Text>Menu</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.aiButton}
            onPress={()=>{}}
          >
            <Text style={{ color: "white" }}>Talk AI</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={goLeft} style={styles.arrowLeft}>
            <Text style={styles.arrowText}>◀</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rectangle}
            onPress={playSound}
          >
            <Image
              source={rectangles[currentIndex]}
              style={styles.image}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={goRight} style={styles.arrowRight}>
            <Text style={styles.arrowText}>▶</Text>
          </TouchableOpacity>
        </>
      )}

      {/* PASSWORD */}
      {currentScreen === "password" && (
        <View style={styles.centerBox}>
          <Text style={styles.title}>Enter Password</Text>

          <TextInput
            style={styles.input}
            secureTextEntry
            value={passwordInput}
            onChangeText={setPasswordInput}
            placeholder="Password"
          />

          <TouchableOpacity style={styles.button} onPress={checkPassword}>
            <Text style={styles.buttonText}>Submit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: "gray" }]}
            onPress={() => setCurrentScreen("carousel")}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* PROTECTED */}
      {currentScreen === "protected" && (
        <View style={{ width: "100%" }}>
          <Text style={styles.title}>Protected Screen</Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => setCurrentScreen("add")}
          >
            <Text style={styles.buttonText}>Add Command</Text>
          </TouchableOpacity>

          <ScrollView style={{ maxHeight: 300 }}>
            {commands.map((cmd, index) => (
              <View key={index} style={styles.commandItem}>
                <Text>
                  <Text style={{ fontWeight: "bold" }}>
                    {cmd.time}:
                  </Text>{" "}
                  {cmd.expanded
                    ? cmd.prompt
                    : cmd.prompt.slice(0, 40)}
                </Text>

                <View style={{ flexDirection: "row", marginTop: 5 }}>
                  <TouchableOpacity
                    onPress={() => toggleExpand(index)}
                  >
                    <Text style={{ marginRight: 10 }}>
                      {cmd.expanded ? "▲" : "▼"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDelete(index)}
                  >
                    <Text style={{ color: "red" }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: "gray" }]}
            onPress={() => setCurrentScreen("carousel")}
          >
            <Text style={styles.buttonText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ADD */}
      {currentScreen === "add" && (
        <View style={styles.centerBox}>
          <Text style={styles.title}>Add Command</Text>

          <TextInput
            style={styles.input}
            placeholder="Time (HH:MM)"
            value={timeInput}
            onChangeText={setTimeInput}
          />

          <TextInput
            style={[styles.input, { height: 100 }]}
            multiline
            placeholder="Prompt"
            value={promptInput}
            onChangeText={setPromptInput}
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleAppendClick}
          >
            <Text style={styles.buttonText}>Append</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: "gray" }]}
            onPress={() => setCurrentScreen("protected")}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  rectangle: { width: 250, height: 400, borderRadius: 20, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  arrowLeft: { position: "absolute", left: 10 },
  arrowRight: { position: "absolute", right: 10 },
  arrowText: { fontSize: 30 },
  menuButton: { position: "absolute", top: 50, left: 20, flexDirection: "row", alignItems: "center" },
  menuIcon: { width: 20, height: 20, marginRight: 5 },
  aiButton: { position: "absolute", top: 50, right: 20, backgroundColor: "#0066ff", padding: 10, borderRadius: 8 },
  centerBox: { alignItems: "center", width: "100%" },
  title: { fontSize: 22, marginBottom: 15 },
  input: { borderWidth: 1, width: "100%", padding: 10, borderRadius: 8, marginBottom: 10 },
  button: { backgroundColor: "#28a745", padding: 10, borderRadius: 8, marginBottom: 10, width: "100%", alignItems: "center" },
  buttonText: { color: "white" },
  commandItem: { backgroundColor: "#eee", padding: 10, marginBottom: 10, borderRadius: 8 },
});
