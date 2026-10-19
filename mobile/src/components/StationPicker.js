import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { searchStationDirectory } from "../api.js";
import { C } from "../theme";

export default function StationPicker({ label, placeholder, value, onChange }) {
  const [text, setText] = useState(value ? `${value.name} (${value.code})` : "");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const selectedText = useRef("");

  useEffect(() => {
    const display = value ? `${value.name} (${value.code})` : "";
    selectedText.current = display;
    setText(display);
  }, [value?.code, value?.name]);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2 || (selectedText.current && q === selectedText.current)) {
      setSuggestions([]);
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const rows = await searchStationDirectory(q, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setSuggestions(rows.slice(0, 7));
          setOpen(true);
        }
      } catch (err) {
        if (err.name !== "AbortError" && !controller.signal.aborted) setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  const choose = (station) => {
    const display = `${station.name} (${station.code})`;
    selectedText.current = display;
    setText(display);
    setSuggestions([]);
    setOpen(false);
    setError("");
    onChange(station);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <Ionicons name="search-outline" size={17} color="#5a7bc7" />
        <TextInput
          value={text}
          onChangeText={(next) => {
            selectedText.current = "";
            setText(next);
            setOpen(true);
            onChange(null);
          }}
          onFocus={() => suggestions.length && setOpen(true)}
          placeholder={placeholder}
          placeholderTextColor="#8294b1"
          autoCorrect={false}
          autoCapitalize="words"
          style={styles.input}
        />
        {loading && <ActivityIndicator size="small" color={C.blue} />}
        {value && <Ionicons name="checkmark-circle" size={17} color={C.green} />}
      </View>

      {open && suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map((station) => (
            <Pressable key={station.code} style={styles.option} onPress={() => choose(station)}>
              <View style={styles.optionIcon}><Ionicons name="location-outline" size={16} color={C.blue} /></View>
              <View style={styles.optionMain}>
                <Text style={styles.optionName} numberOfLines={1}>{station.name}</Text>
                <Text style={styles.optionCity} numberOfLines={1}>{station.city || "Indian Railways station"}</Text>
              </View>
              <Text style={styles.code}>{station.code}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative", zIndex: 5, marginBottom: 12 },
  label: { color: "#344b70", fontSize: 10, fontWeight: "900", letterSpacing: 0.7, marginBottom: 7 },
  inputWrap: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderColor: "#d5e0f4", borderRadius: 13, backgroundColor: "#fff", paddingHorizontal: 12 },
  input: { flex: 1, minWidth: 0, paddingVertical: 12, color: C.ink, fontSize: 13, fontWeight: "600" },
  suggestions: { marginTop: 6, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e0e8f8", overflow: "hidden", shadowColor: "#0b1c3b", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8 },
  option: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e8eef9" },
  optionIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#eaf0ff", alignItems: "center", justifyContent: "center" },
  optionMain: { flex: 1, minWidth: 0 },
  optionName: { fontSize: 12, color: C.ink, fontWeight: "800" },
  optionCity: { marginTop: 3, fontSize: 10, color: C.muted },
  code: { color: "#4367bd", fontSize: 11, fontWeight: "900" },
  error: { marginTop: 6, color: C.red, fontSize: 11 },
});
