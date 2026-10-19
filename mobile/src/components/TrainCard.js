import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme";


const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function operatingDays(train) {
  const raw = train?.runDays ?? train?.runningDays ?? train?.daysOfRun ?? train?.days;
  if (raw == null || raw === "") return null;
  if (typeof raw === "string" && /daily|every day/i.test(raw)) return "Daily";
  const values = Array.isArray(raw) ? raw : String(raw).split(/[,&|\s]+/).filter(Boolean);
  const aliases = {
    MON: "Mon", MONDAY: "Mon", TUE: "Tue", TUESDAY: "Tue", WED: "Wed", WEDNESDAY: "Wed",
    THU: "Thu", THURSDAY: "Thu", FRI: "Fri", FRIDAY: "Fri", SAT: "Sat", SATURDAY: "Sat",
    SUN: "Sun", SUNDAY: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun",
  };
  const days = values.map((item) => aliases[String(item).trim().toUpperCase()] || aliases[String(item).trim()]).filter(Boolean);
  if (days.length === 7) return "Daily";
  return days.length ? days.join(" · ") : null;
}

function todayInIndia() {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(new Date());
}

function delayLabel(train) {
  const delay = train?.delayMinutes;
  if (delay === null || delay === undefined || delay === "") return "Delay unavailable";
  const minutes = Number(delay);
  if (!Number.isFinite(minutes) || minutes <= 0) return "On time";
  return `${minutes} min late`;
}

export default function TrainCard({ train, onPress, selected = false, journey = false }) {
  const number = String(train?.trainNumber ?? train?.number ?? "—");
  const name = train?.trainName || train?.name || `Train ${number}`;
  const demo = train?.source === "demo";
  const delayed = Number(train?.delayMinutes) > 10;
  const days = operatingDays(train);
  const runsToday = days === "Daily" || Boolean(days?.split(" · ").includes(todayInIndia()));

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.outer, selected && styles.selectedOuter, pressed && styles.pressed]}>
      <LinearGradient
        colors={selected ? ["#e1edff", "#e7e4ff"] : ["#ffffff", "#f0f5ff"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <LinearGradient colors={selected ? [C.blue, C.violet] : ["#e3edff", "#e9e5ff"]} style={styles.iconBox}>
          <Ionicons name="train-outline" size={22} color={selected ? C.white : C.blue} />
        </LinearGradient>
        <View style={styles.main}>
          <View style={styles.badgesRow}>
            <Text style={styles.number}>{number}</Text>
            <View style={styles.typeBadge}><Text style={styles.typeText}>{train?.trainType || "Train"}</Text></View>
            {demo && <View style={styles.demoBadge}><Text style={styles.demoText}>DEMO</Text></View>}
          </View>
          <Text style={styles.name} numberOfLines={2}>{name}</Text>

          {journey ? (
            <View style={styles.routeRow}>
              <View style={styles.routeEnd}>
                <Text style={styles.routeTime}>{train?.departure || "--:--"}</Text>
                <Text style={styles.routeCode}>{train?.sourceCode || "From"}</Text>
              </View>
              <View style={styles.routeTrack}>
                <View style={styles.routeLine} />
                <Ionicons name="train" size={16} color={C.violet} />
                <View style={styles.routeLine} />
              </View>
              <View style={[styles.routeEnd, styles.routeEndRight]}>
                <Text style={styles.routeTime}>{train?.arrival || "--:--"}</Text>
                <Text style={styles.routeCode}>{train?.destinationCode || "To"}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color={C.muted} />
              <Text style={styles.location} numberOfLines={1}>{train?.currentStation || "Position not reported"}</Text>
              {train?.distanceKm != null && <Text style={styles.distance}>{train.distanceKm} km</Text>}
            </View>
          )}

          {journey && (
            <View style={styles.daysRow}>
              <Ionicons name="calendar-outline" size={13} color={C.violet} />
              <Text style={styles.daysLabel}>{days || "Operating days not provided"}</Text>
              {days && <View style={[styles.todayBadge, runsToday ? styles.todayBadgeOn : styles.todayBadgeOff]}><Text style={[styles.todayBadgeText, runsToday ? styles.todayBadgeTextOn : styles.todayBadgeTextOff]}>{runsToday ? `${todayInIndia().toUpperCase()} · TODAY` : `${todayInIndia().toUpperCase()} · NO SERVICE`}</Text></View>}
            </View>
          )}

          <View style={styles.footerRow}>
            {journey ? (
              <>
                <View style={styles.metaItem}><Ionicons name="time-outline" size={14} color={C.muted} /><Text style={styles.metaText}>{train?.duration || (train?.durationMinutes ? `${Math.floor(train.durationMinutes / 60)}h ${train.durationMinutes % 60}m` : "Duration varies")}</Text></View>
                <View style={styles.metaItem}><Ionicons name="git-branch-outline" size={14} color={C.muted} /><Text style={styles.metaText}>{train?.halts ?? "—"} stops</Text></View>
              </>
            ) : (
              <>
                <View style={styles.metaItem}><Ionicons name="speedometer-outline" size={14} color={C.muted} /><Text style={styles.metaText}>{train?.speedKmh != null ? `${Math.round(Number(train.speedKmh))} km/h` : "Speed unavailable"}</Text></View>
                <View style={styles.metaItem}><Ionicons name="time-outline" size={14} color={delayed ? C.red : C.muted} /><Text style={[styles.metaText, delayed && styles.late]}>{delayLabel(train)}</Text></View>
              </>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#8a9cba" style={styles.chevron} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: { marginBottom: 10, borderRadius: 18, shadowColor: "#071735", shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
  selectedOuter: { borderWidth: 1.5, borderColor: "#6d86f8", shadowOpacity: 0.17 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  card: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 13, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,.9)" },
  iconBox: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13 },
  main: { flex: 1, minWidth: 0 },
  badgesRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
  number: { fontSize: 13, fontWeight: "900", color: "#3158b4" },
  typeBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: "#edf2fb" },
  typeText: { color: "#586e8e", fontSize: 10, fontWeight: "800" },
  demoBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: "#fff0d8" },
  demoText: { color: "#986220", fontSize: 9, fontWeight: "900" },
  name: { color: C.ink, fontSize: 14, fontWeight: "900", lineHeight: 19, marginTop: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 7, minWidth: 0 },
  location: { flex: 1, minWidth: 0, color: C.muted, fontSize: 11, fontWeight: "600" },
  distance: { color: C.inkSoft, fontSize: 10, fontWeight: "800" },
  daysRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5, marginTop: 8 },
  daysLabel: { color: "#526a91", fontSize: 10, fontWeight: "750" },
  todayBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  todayBadgeOn: { backgroundColor: "#d9f7eb" },
  todayBadgeOff: { backgroundColor: "#fff0e8" },
  todayBadgeText: { fontSize: 8, fontWeight: "900" },
  todayBadgeTextOn: { color: "#167b5d" },
  todayBadgeTextOff: { color: "#aa5c37" },
  footerRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { color: C.muted, fontSize: 10, fontWeight: "700" },
  late: { color: C.red },
  chevron: { marginTop: 3 },
  routeRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 6 },
  routeEnd: { minWidth: 45 },
  routeEndRight: { alignItems: "flex-end" },
  routeTime: { color: C.ink, fontSize: 12, fontWeight: "900" },
  routeCode: { color: C.muted, fontSize: 10, marginTop: 2 },
  routeTrack: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  routeLine: { height: 2, flex: 1, backgroundColor: "#aabcf1", borderRadius: 5 },
});
