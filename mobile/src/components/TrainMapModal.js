import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme";

const INDIA_REGION = {
  latitude: 22.7,
  longitude: 79.1,
  latitudeDelta: 24,
  longitudeDelta: 24,
};

function validCoordinate(lat, lng) {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng)) &&
    Math.abs(Number(lat)) <= 90 &&
    Math.abs(Number(lng)) <= 180
  );
}

function fmtTime(value) {
  if (!value) return "Not reported";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return (
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date) + " IST"
  );
}

function buildOpenStreetMapHtml({
  trainNo,
  trainName,
  currentStation,
  position,
  route,
}) {
  const payload = {
    trainNo,
    trainName,
    currentStation: currentStation || "",
    position,
    route: route.map((stop) => ({
      latitude: stop.latitude,
      longitude: stop.longitude,
      name: stop.stationName || stop.name || stop.stationCode || "Station",
      code: stop.stationCode || stop.code || "",
    })),
  };

  // Safely embed provider-supplied text into the HTML document.
  const payloadJson = JSON.stringify(payload).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #dce7f6;
    }

    .leaflet-container {
      font-family: Arial, sans-serif;
    }

    .leaflet-control-attribution {
      font-size: 10px !important;
    }

    .station-marker-host,
    .train-marker-host {
      background: transparent;
      border: none;
    }

    .station-marker-host {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .station-dot {
      display: block;
      width: 14px;
      height: 14px;
      border: 3px solid white;
      border-radius: 50%;
      background: #3978f6;
      box-shadow: 0 2px 7px rgba(7, 23, 53, 0.35);
    }

    .station-dot.first {
      background: #8062ef;
    }

    .station-dot.last {
      background: #13a88a;
    }

    .train-marker-host {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .train-marker {
      display: flex;
      width: 40px;
      height: 40px;
      align-items: center;
      justify-content: center;
      border: 3px solid white;
      border-radius: 14px;
      background: linear-gradient(135deg, #3978f6, #8062ef);
      box-shadow: 0 4px 12px rgba(7, 23, 53, 0.35);
      font-size: 21px;
    }

    .popup-title {
      font-weight: 800;
      color: #1b2a40;
    }

    .popup-code {
      margin-top: 3px;
      color: #68768b;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
      var data = ${payloadJson};

      if (!window.L) {
        document.getElementById("map").innerHTML =
          '<div style="padding:24px;color:#203b84">Map could not load. Please check your internet connection.</div>';
        return;
      }

      var map = L.map("map", {
        zoomControl: true,
        attributionControl: true
      }).setView([22.7, 79.1], 5);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      function escapeHtml(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
          return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
          }[ch];
        });
      }

      var allPoints = [];
      var routePoints = data.route.map(function (stop) {
        return [stop.latitude, stop.longitude];
      });

      if (routePoints.length > 1) {
        L.polyline(routePoints, {
          color: "#3978f6",
          weight: 5,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round"
        }).addTo(map);
      }

      data.route.forEach(function (stop, index) {
        var className = "station-dot";

        if (index === 0) {
          className += " first";
        } else if (index === data.route.length - 1) {
          className += " last";
        }

        var icon = L.divIcon({
          className: "station-marker-host",
          html: '<span class="' + className + '"></span>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        var marker = L.marker(
          [stop.latitude, stop.longitude],
          { icon: icon, title: stop.name }
        ).addTo(map);

        var popup =
          '<div class="popup-title">' + escapeHtml(stop.name) + '</div>' +
          (stop.code
            ? '<div class="popup-code">' + escapeHtml(stop.code) + '</div>'
            : '');

        marker.bindPopup(popup);
        allPoints.push([stop.latitude, stop.longitude]);
      });

      if (data.position) {
        var trainIcon = L.divIcon({
          className: "train-marker-host",
          html: '<div class="train-marker">🚆</div>',
          iconSize: [46, 46],
          iconAnchor: [23, 23]
        });

        var trainMarker = L.marker(
          [data.position.latitude, data.position.longitude],
          { icon: trainIcon, title: data.trainName }
        ).addTo(map);

        trainMarker.bindPopup(
          '<div class="popup-title">' +
            escapeHtml(data.trainNo + " · " + data.trainName) +
          '</div>' +
          '<div class="popup-code">' +
            escapeHtml(data.currentStation || "Current train position") +
          '</div>'
        );

        allPoints.push([
          data.position.latitude,
          data.position.longitude
        ]);
      }

      if (allPoints.length === 1) {
        map.setView(allPoints[0], 12);
      } else if (allPoints.length > 1) {
        map.fitBounds(L.latLngBounds(allPoints).pad(0.18), {
          maxZoom: 12
        });
      }

      setTimeout(function () {
        map.invalidateSize();
      }, 250);
    })();
  </script>
</body>
</html>`;
}

function InfoMetric({ icon, label, value, accent = C.blue }) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricIcon, { backgroundColor: `${accent}18` }]}>
        <Ionicons name={icon} size={17} color={accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value || "Not reported"}</Text>
      </View>
    </View>
  );
}

export default function TrainMapModal({
  visible,
  train,
  loading = false,
  error = "",
  onClose,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showAllStops, setShowAllStops] = useState(false);

  const route = useMemo(() => {
    const rows = Array.isArray(train?.route) ? train.route : [];
    return rows
      .map((stop) => ({
        ...stop,
        latitude: Number(stop.lat ?? stop.latitude),
        longitude: Number(stop.lng ?? stop.longitude ?? stop.lon),
      }))
      .filter((stop) => validCoordinate(stop.latitude, stop.longitude));
  }, [train?.route]);

  const hasPosition = validCoordinate(train?.latitude, train?.longitude);
  const position = hasPosition
    ? { latitude: Number(train.latitude), longitude: Number(train.longitude) }
    : null;

  const trainNo = train?.trainNumber || train?.number || "—";
  const trainName = train?.trainName || train?.name || `Train ${trainNo}`;

  const mapHtml = useMemo(
    () =>
      buildOpenStreetMapHtml({
        trainNo,
        trainName,
        currentStation: train?.currentStation,
        position,
        route,
      }),
    [
      trainNo,
      trainName,
      train?.currentStation,
      position?.latitude,
      position?.longitude,
      route,
    ],
  );
  const sourceLabel =
    train?.source === "live"
      ? "LIVE PROVIDER DATA"
      : train?.source === "demo"
        ? "DEMO DATA"
        : "POSITION STATUS";
  const delay =
    train?.delayMinutes == null
      ? "Not reported"
      : Number(train.delayMinutes) <= 0
        ? "On time"
        : `${train.delayMinutes} min late`;
  const stopsToShow = showAllStops ? route : route.slice(0, 5);

  React.useEffect(() => {
    if (visible) {
      setDetailsOpen(false);
      setShowAllStops(false);
    }
  }, [visible, trainNo]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        <WebView
          key={`${trainNo}-${position?.latitude || "india"}-${position?.longitude || "india"}`}
          source={{
            html: mapHtml,
            baseUrl: "https://rail-pulse-taupe.vercel.app/",
          }}
          style={StyleSheet.absoluteFill}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          bounces={false}
          mixedContentMode="never"
        />

        <View style={styles.topBar}>
          <Pressable
            style={styles.topIconButton}
            onPress={onClose}
            accessibilityLabel="Close map"
          >
            <Ionicons name="close" size={22} color={C.ink} />
          </Pressable>
          <View style={styles.topTitleBox}>
            <Text style={styles.topEyebrow}>RAILPULSE MAP</Text>
            <Text style={styles.topTitle} numberOfLines={1}>
              {trainName}
            </Text>
          </View>
          <View style={styles.livePill}>
            <View
              style={[
                styles.statusDot,
                train?.source !== "live" && { backgroundColor: "#eaa347" },
              ]}
            />
            <Text style={styles.livePillText}>
              {train?.source === "live"
                ? "LIVE"
                : train?.source === "demo"
                  ? "DEMO"
                  : "STATUS"}
            </Text>
          </View>
        </View>

        {!detailsOpen && (
          <Pressable
            style={styles.peekCard}
            onPress={() => setDetailsOpen(true)}
          >
            <LinearGradient
              colors={["#fbfdff", "#eaf0ff", "#eee9ff"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.peekGradient}
            >
              <LinearGradient
                colors={[C.blue, C.violet]}
                style={styles.peekIcon}
              >
                <Ionicons name="train" size={21} color="#fff" />
              </LinearGradient>
              <View style={styles.peekCopy}>
                <Text style={styles.peekNumber}>TRAIN {trainNo}</Text>
                <Text style={styles.peekName} numberOfLines={1}>
                  {trainName}
                </Text>
                <Text style={styles.peekStation} numberOfLines={1}>
                  {train?.currentStation || "Position not reported"}
                </Text>
              </View>
              <Ionicons name="chevron-up" size={21} color={C.blue} />
            </LinearGradient>
          </Pressable>
        )}

        {detailsOpen && (
          <View style={styles.detailDrawer}>
            <Pressable
              style={styles.minimizeButton}
              onPress={() => setDetailsOpen(false)}
            >
              <Ionicons name="chevron-down" size={17} color="#3159ad" />
              <Text style={styles.minimizeText}>Minimize details</Text>
            </Pressable>
            <ScrollView
              contentContainerStyle={styles.detailScroll}
              showsVerticalScrollIndicator
            >
              <View style={styles.detailHeader}>
                <LinearGradient
                  colors={[C.blue, C.violet]}
                  style={styles.detailIcon}
                >
                  <Ionicons name="train" size={24} color="#fff" />
                </LinearGradient>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.detailNumber}>TRAIN {trainNo}</Text>
                  <Text style={styles.detailName}>{trainName}</Text>
                  <Text style={styles.detailType}>
                    {train?.trainType || "Train service"} · {sourceLabel}
                  </Text>
                </View>
              </View>

              <LinearGradient
                colors={["#d7e8ff", "#e1ddff"]}
                style={styles.currentPosition}
              >
                <View style={styles.currentPositionIcon}>
                  <Ionicons name="location" size={20} color="#fff" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.positionLabel}>CURRENT POSITION</Text>
                  <Text style={styles.positionName}>
                    {train?.currentStation || "Station not reported"}
                  </Text>
                  <Text style={styles.reportedAt}>
                    Last reported:{" "}
                    {fmtTime(
                      train?.updatedAt ||
                        train?.lastUpdated ||
                        train?.reportedAt,
                    )}
                  </Text>
                </View>
              </LinearGradient>

              {loading && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={C.blue} />
                  <Text style={styles.muted}>Loading latest train report…</Text>
                </View>
              )}
              {!!error && <Text style={styles.errorText}>{error}</Text>}

              <View style={styles.metricsGrid}>
                <InfoMetric
                  icon="navigate-outline"
                  label="NEXT STOP"
                  value={train?.nextStation}
                />
                <InfoMetric
                  icon="speedometer-outline"
                  label="REPORTED SPEED"
                  value={
                    train?.speedKmh == null
                      ? "Not reported"
                      : `${Math.round(Number(train.speedKmh))} km/h`
                  }
                  accent={C.violet}
                />
                <InfoMetric
                  icon="time-outline"
                  label="DELAY"
                  value={delay}
                  accent={
                    Number(train?.delayMinutes || 0) > 10 ? C.red : C.blue
                  }
                />
                <InfoMetric
                  icon="radio-outline"
                  label="DATA SOURCE"
                  value={
                    train?.source === "live"
                      ? "RailRadar"
                      : train?.source === "demo"
                        ? "Demo"
                        : "Unknown"
                  }
                  accent={C.green}
                />
              </View>

              {route.length > 0 && (
                <View style={styles.routeSection}>
                  <View style={styles.routeHeading}>
                    <Text style={styles.routeTitle}>Journey stations</Text>
                    <Text style={styles.routeCount}>{route.length} stops</Text>
                  </View>
                  {stopsToShow.map((stop, index) => (
                    <View
                      style={styles.routeStop}
                      key={`${stop.stationCode || stop.stationName || "stop"}-${index}`}
                    >
                      <View style={styles.timelineCol}>
                        <View
                          style={[
                            styles.timelineDot,
                            index === 0 && styles.timelineDotFirst,
                          ]}
                        />
                        {index < stopsToShow.length - 1 && (
                          <View style={styles.timelineLine} />
                        )}
                      </View>
                      <View style={styles.routeStopCopy}>
                        <Text style={styles.routeStopName}>
                          {stop.stationName || stop.name || "Station"}
                        </Text>
                        <Text style={styles.routeStopCode}>
                          {stop.stationCode || stop.code || ""}
                        </Text>
                      </View>
                      {stop.scheduledArrival || stop.scheduledDeparture ? (
                        <Text style={styles.routeStopTime}>
                          {stop.scheduledDeparture || stop.scheduledArrival}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                  {route.length > 5 && (
                    <Pressable
                      style={styles.showMore}
                      onPress={() => setShowAllStops((value) => !value)}
                    >
                      <Text style={styles.showMoreText}>
                        {showAllStops
                          ? "Show fewer stations"
                          : `Show all ${route.length} stations`}
                      </Text>
                      <Ionicons
                        name={showAllStops ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={C.blue}
                      />
                    </Pressable>
                  )}
                </View>
              )}

              {!hasPosition && route.length === 0 && (
                <View style={styles.noCoordinates}>
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={C.muted}
                  />
                  <Text style={styles.noCoordinatesText}>
                    The provider hasn't returned coordinates for this train. The
                    map shows the route when station coordinates are available.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: "#dce7f6" },
  topBar: {
    position: "absolute",
    top: 48,
    left: 14,
    right: 14,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.92)",
    backgroundColor: "rgba(248,251,255,.97)",
    shadowColor: "#14284e",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 13,
    elevation: 6,
  },
  topIconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#eaf0ff",
  },
  topTitleBox: { flex: 1, minWidth: 0 },
  topEyebrow: {
    color: C.violet,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  topTitle: { marginTop: 2, color: C.ink, fontSize: 14, fontWeight: "900" },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: "#eef3fc",
  },
  statusDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: C.green },
  livePillText: { color: C.inkSoft, fontSize: 9, fontWeight: "900" },
  trainMarker: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    borderWidth: 3,
    borderColor: "#fff",
    elevation: 6,
  },
  stopMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: C.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  startMarker: { borderColor: C.violet },
  endMarker: { borderColor: C.cyan },
  stopMarkerInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.blue,
  },
  peekCard: {
    position: "absolute",
    zIndex: 15,
    left: 14,
    right: 14,
    bottom: 26,
    borderRadius: 19,
    shadowColor: "#071735",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 22,
    elevation: 10,
  },
  peekGradient: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.98)",
    padding: 12,
  },
  peekIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  peekCopy: { flex: 1, minWidth: 0, gap: 3 },
  peekNumber: {
    color: "#3159b8",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  peekName: { color: C.ink, fontSize: 14, fontWeight: "900" },
  peekStation: { color: C.muted, fontSize: 11, fontWeight: "600" },
  detailDrawer: {
    position: "absolute",
    zIndex: 20,
    left: 8,
    right: 8,
    bottom: 8,
    maxHeight: "64%",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.96)",
    backgroundColor: "rgba(247,250,255,.98)",
    shadowColor: "#071735",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 12,
    overflow: "hidden",
  },
  minimizeButton: {
    minHeight: 40,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#dce6f8",
    backgroundColor: "#fff",
  },
  minimizeText: { color: "#3159ad", fontSize: 12, fontWeight: "800" },
  detailScroll: { paddingHorizontal: 13, paddingBottom: 20 },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e9f7",
  },
  detailIcon: {
    width: 45,
    height: 45,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  detailNumber: {
    color: "#365fbe",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  detailName: { marginTop: 3, color: C.ink, fontSize: 15, fontWeight: "900" },
  detailType: { marginTop: 3, color: C.muted, fontSize: 10, fontWeight: "600" },
  currentPosition: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#b9c9ff",
    borderRadius: 15,
  },
  currentPositionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.blue,
  },
  positionLabel: {
    color: "#3c5ca5",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  positionName: {
    color: "#203b84",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 3,
  },
  reportedAt: { color: "#526b92", fontSize: 10, marginTop: 4 },
  loadingRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingVertical: 10,
  },
  muted: { color: C.muted, fontSize: 11 },
  errorText: { color: C.red, fontSize: 12, paddingTop: 9 },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  metric: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 125,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 9,
    borderRadius: 13,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4ebf8",
  },
  metricIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  metricLabel: {
    color: C.muted,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  metricValue: { color: C.ink, fontSize: 11, fontWeight: "800", marginTop: 4 },
  routeSection: { marginTop: 16 },
  routeHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  routeTitle: { color: C.ink, fontSize: 14, fontWeight: "900" },
  routeCount: { color: C.muted, fontSize: 10, fontWeight: "700" },
  routeStop: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 47,
    gap: 10,
  },
  timelineCol: { width: 20, alignItems: "center" },
  timelineDot: {
    width: 12,
    height: 12,
    marginTop: 6,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: "#fff",
    backgroundColor: C.blue,
    elevation: 1,
  },
  timelineDotFirst: { backgroundColor: C.violet },
  timelineLine: {
    flex: 1,
    width: 3,
    marginTop: -1,
    marginBottom: -2,
    borderRadius: 2,
    backgroundColor: "#c0d1f5",
  },
  routeStopCopy: { flex: 1, minWidth: 0, paddingTop: 4, paddingBottom: 9 },
  routeStopName: { color: C.inkSoft, fontSize: 12, fontWeight: "800" },
  routeStopCode: { color: C.muted, marginTop: 2, fontSize: 10 },
  routeStopTime: { alignSelf: "center", color: C.muted, fontSize: 10 },
  showMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
    padding: 10,
    borderRadius: 11,
    backgroundColor: "#eaf0ff",
  },
  showMoreText: { color: C.blue, fontSize: 11, fontWeight: "800" },
  noCoordinates: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    padding: 12,
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "#eef3fb",
  },
  noCoordinatesText: { flex: 1, color: C.muted, fontSize: 11, lineHeight: 16 },
});
