import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import {
  findTrainsBetween,
  getHealth,
  getNearbyTrains,
  getTrainStatus,
  searchStationDirectory,
  searchTrainDirectory,
} from "./src/api";
import { C } from "./src/theme";
import TrainCard from "./src/components/TrainCard";
import StationPicker from "./src/components/StationPicker";
import TrainMapModal from "./src/components/TrainMapModal";

const MODES = [
  { id: "nearby", label: "Nearby", subtitle: "Place or PIN", icon: "location-outline" },
  { id: "train", label: "Find train", subtitle: "Name or number", icon: "train-outline" },
  { id: "journey", label: "Between", subtitle: "From → To", icon: "git-compare-outline" },
];

const QUICK_LOCATIONS = [
  { label: "Kolkata", query: "Kolkata" },
  { label: "Jhargram · 721507", query: "721507" },
  { label: "Purulia · 723101", query: "723101" },
];

const KNOWN_PLACES = [
  { label: "Kolkata, West Bengal", query: "Kolkata" },
  { label: "Howrah, West Bengal", query: "Howrah" },
  { label: "Jhargram · 721507", query: "721507" },
  { label: "Purulia · 723101", query: "723101" },
  { label: "Kharagpur · 721301", query: "721301" },
  { label: "Durgapur · 713201", query: "713201" },
  { label: "Asansol · 713301", query: "713301" },
  { label: "New Delhi · 110001", query: "110001" },
  { label: "Mumbai · 400001", query: "400001" },
  { label: "Chennai · 600001", query: "600001" },
];

function PrimaryButton({ title, onPress, loading, disabled, icon = "search-outline" }) {
  return (
    <Pressable disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.primaryButtonOuter, pressed && styles.pressed, (disabled || loading) && styles.disabledButton]}>
      <LinearGradient colors={[C.blue, "#566df5", C.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryButton}>
        {loading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name={icon} size={17} color="#fff" />}
        <Text style={styles.primaryButtonText}>{loading ? "Please wait…" : title}</Text>
        {!loading && <Ionicons name="arrow-forward" size={16} color="#fff" />}
      </LinearGradient>
    </Pressable>
  );
}

function EmptyState({ icon = "search-outline", title, description }) {
  return (
    <View style={styles.emptyCard}>
      <LinearGradient colors={[C.blue, C.violet]} style={styles.emptyIcon}>
        <Ionicons name={icon} size={24} color="#fff" />
      </LinearGradient>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );
}

function SectionTitle({ eyebrow, title, subtitle, count }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {count !== undefined && <View style={styles.countPill}><Text style={styles.countPillText}>{count}</Text></View>}
    </View>
  );
}

function AlertBox({ message, onDismiss }) {
  if (!message) return null;
  return (
    <View style={styles.alertBox}>
      <Ionicons name="alert-circle-outline" size={19} color="#b13e49" />
      <Text style={styles.alertText}>{message}</Text>
      <Pressable onPress={onDismiss} hitSlop={8}><Ionicons name="close" size={18} color="#9b4551" /></Pressable>
    </View>
  );
}

function PlaceSuggestionList({ query, onChoose }) {
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return KNOWN_PLACES.filter((item) => `${item.label} ${item.query}`.toLowerCase().includes(q)).slice(0, 5);
  }, [query]);

  if (!suggestions.length) return null;
  return (
    <View style={styles.suggestionsBox}>
      {suggestions.map((item) => (
        <Pressable key={item.label} onPress={() => onChoose(item)} style={styles.suggestionRow}>
          <View style={styles.suggestionIcon}><Ionicons name="location-outline" size={17} color={C.blue} /></View>
          <Text style={styles.suggestionText}>{item.label}</Text>
          <Ionicons name="arrow-forward" size={15} color={C.muted} />
        </Pressable>
      ))}
    </View>
  );
}

function TrainSuggestions({ rows, onChoose }) {
  if (!rows?.length) return null;
  return (
    <View style={styles.suggestionsBox}>
      {rows.slice(0, 6).map((train) => (
        <Pressable key={train.number} onPress={() => onChoose(train)} style={styles.suggestionRow}>
          <View style={styles.trainNumberMini}><Text style={styles.trainNumberMiniText}>{train.number}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.suggestionText} numberOfLines={1}>{train.name}</Text>
            <Text style={styles.suggestionSubtext} numberOfLines={1}>{train.source || "Origin"} → {train.destination || "Destination"}</Text>
          </View>
          <Ionicons name="arrow-forward" size={15} color={C.muted} />
        </Pressable>
      ))}
    </View>
  );
}

function AlternativeRouteCard({ route, index }) {
  const legs = Array.isArray(route.legs) ? route.legs : [];
  return (
    <View style={styles.alternativeCard}>
      <View style={styles.alternativeHeading}>
        <View style={styles.alternativeIcon}><Ionicons name="git-branch-outline" size={17} color={C.violet} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.alternativeTitle}>{route.title || `Connecting option ${index + 1}`}</Text>
          {route.viaName || route.via?.name ? <Text style={styles.alternativeVia}>Change at {route.viaName || route.via.name}</Text> : null}
        </View>
      </View>
      {legs.length ? legs.map((leg, i) => (
        <View key={`${leg.trainNumber || leg.number}-${i}`} style={styles.alternativeLeg}>
          <Text style={styles.alternativeTrainNo}>{leg.trainNumber || leg.number || "Train"}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.alternativeLegName}>{leg.trainName || leg.name || "Train service"}</Text>
            <Text style={styles.alternativeLegRoute}>{leg.fromName || leg.fromCode || leg.from || "Source"} → {leg.toName || leg.toCode || leg.to || "Destination"}</Text>
          </View>
        </View>
      )) : <Text style={styles.alternativeLegRoute}>{route.description || "Connecting service details not provided by the provider."}</Text>}
    </View>
  );
}

function AppContent() {
  const [mode, setMode] = useState("nearby");
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState("");

  const [placeQuery, setPlaceQuery] = useState("");
  const [placeSuggestionsOpen, setPlaceSuggestionsOpen] = useState(false);
  const [radiusKm, setRadiusKm] = useState(50);
  const [nearby, setNearby] = useState(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");

  const [trainQuery, setTrainQuery] = useState("");
  const [trainSuggestions, setTrainSuggestions] = useState([]);
  const [trainSuggesting, setTrainSuggesting] = useState(false);
  const [trainSuggestionsOpen, setTrainSuggestionsOpen] = useState(false);
  const [trainLoading, setTrainLoading] = useState(false);
  const [trainError, setTrainError] = useState("");

  const [fromStation, setFromStation] = useState(null);
  const [toStation, setToStation] = useState(null);
  const [travelDate, setTravelDate] = useState("");
  const [journey, setJourney] = useState(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [journeyError, setJourneyError] = useState("");

  const [selectedTrain, setSelectedTrain] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [mapVisible, setMapVisible] = useState(false);
  const detailRequest = useRef({ number: "", state: "idle", token: 0 });
  const trainQuerySelected = useRef("");

  useEffect(() => {
    let mounted = true;
    getHealth()
      .then((result) => { if (mounted) setHealth(result); })
      .catch((error) => { if (mounted) setHealthError(error.message); })
      .finally(() => { if (mounted) setHealthLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const q = trainQuery.trim();
    if (q.length < 2 || /^\d{4,6}$/.test(q) || (trainQuerySelected.current && q === trainQuerySelected.current)) {
      setTrainSuggestions([]);
      setTrainSuggesting(false);
      return undefined;
    }

    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(async () => {
      setTrainSuggesting(true);
      try {
        const rows = await searchTrainDirectory(q, { signal: controller.signal });
        if (active) { setTrainSuggestions(rows); setTrainSuggestionsOpen(true); setTrainError(""); }
      } catch (error) {
        if (active && error.name !== "AbortError") setTrainError(error.message);
      } finally {
        if (active) setTrainSuggesting(false);
      }
    }, 450);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [trainQuery]);

  const chooseMode = (next) => {
    Keyboard.dismiss();
    setMode(next);
    setPlaceSuggestionsOpen(false);
    setTrainSuggestionsOpen(false);
    setMapVisible(false);
    setSelectedTrain(null);
    setDetailLoading(false);
    setDetailError("");
    detailRequest.current = { number: "", state: "idle", token: detailRequest.current.token + 1 };
  };



  const openTrainMap = async (train, { forceRefresh = false } = {}) => {
    const number = String(train?.trainNumber ?? train?.number ?? "").trim();
    if (!number) return;
    Keyboard.dismiss();
    setMapVisible(true);
    setTrainSuggestionsOpen(false);

    const current = detailRequest.current;
    if (!forceRefresh && current.number === number && current.state === "loading") return;
    if (!forceRefresh && current.number === number && current.state === "loaded" && String(selectedTrain?.trainNumber) === number) return;

    const token = current.token + 1;
    detailRequest.current = { number, state: "loading", token };
    setSelectedTrain({ ...train, trainNumber: number, trainName: train.trainName || train.name || `Train ${number}` });
    setDetailLoading(true);
    setDetailError("");

    try {
      const detail = await getTrainStatus(number);
      if (detailRequest.current.token !== token) return;
      setSelectedTrain({ ...train, ...detail, trainNumber: String(detail?.trainNumber || number), source: detail?.source || train.source });
      detailRequest.current = { number, state: "loaded", token };
    } catch (error) {
      if (detailRequest.current.token !== token) return;
      setDetailError(error.message);
      detailRequest.current = { number, state: "idle", token };
    } finally {
      if (detailRequest.current.token === token) setDetailLoading(false);
    }
  };

  const searchNearby = async (value = placeQuery) => {
    const query = value.trim();
    if (!query) { setNearbyError("Enter a place name or PIN code."); return; }
    Keyboard.dismiss();
    setPlaceSuggestionsOpen(false);
    setNearbyLoading(true);
    setNearbyError("");
    setNearby(null);
    setMapVisible(false);
    setSelectedTrain(null);
    setDetailLoading(false);
    detailRequest.current = { number: "", state: "idle", token: detailRequest.current.token + 1 };
    try {
      const result = await getNearbyTrains(query, radiusKm);
      setNearby(result);
      if (result.location?.displayName) setPlaceQuery(result.location.displayName.split(",")[0]);
    } catch (error) {
      setNearbyError(error.message);
    } finally {
      setNearbyLoading(false);
    }
  };

  const searchTrain = async (numberOrName = trainQuery) => {
    const value = String(numberOrName || "").trim();
    if (!value) { setTrainError("Enter a train number or name."); return; }
    const match = value.match(/^(\d{4,6})(?:\s*[·|—-].*)?$/);
    if (match) {
      setTrainLoading(true);
      setTrainError("");
      try {
        await openTrainMap({ trainNumber: match[1], trainName: `Train ${match[1]}` });
      } catch (error) {
        setTrainError(error.message);
      } finally {
        setTrainLoading(false);
      }
      return;
    }
    if (trainSuggestions.length === 1) {
      const train = trainSuggestions[0];
      trainQuerySelected.current = `${train.number} · ${train.name}`;
      setTrainQuery(trainQuerySelected.current);
      await openTrainMap({ ...train, trainNumber: train.number, trainName: train.name });
      return;
    }
    if (trainSuggestions.length > 1) { setTrainSuggestionsOpen(true); return; }
    setTrainError("No train matches. Search by a valid train number or a different name.");
  };

  const searchJourney = async () => {
    if (!fromStation || !toStation) { setJourneyError("Choose both stations from the suggestions."); return; }
    if (fromStation.code === toStation.code) { setJourneyError("Source and destination must be different."); return; }
    if (travelDate && !/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) { setJourneyError("Use the date format YYYY-MM-DD."); return; }
    Keyboard.dismiss();
    setJourneyLoading(true);
    setJourneyError("");
    setJourney(null);
    setMapVisible(false);
    setSelectedTrain(null);
    setDetailLoading(false);
    detailRequest.current = { number: "", state: "idle", token: detailRequest.current.token + 1 };
    try {
      setJourney(await findTrainsBetween(fromStation, toStation, travelDate));
    } catch (error) {
      setJourneyError(error.message);
    } finally {
      setJourneyLoading(false);
    }
  };



  const providerConfigured = Boolean(health?.provider?.configured);
  const providerLabel = healthLoading
    ? "Connecting to server"
    : healthError
      ? "Server unavailable"
      : health?.provider?.mode === "live"
        ? "RailRadar configured"
        : providerConfigured
          ? "Provider configured"
          : "Provider not configured";

  const directTrains = Array.isArray(journey?.trains) ? journey.trains : [];
  const alternatives = Array.isArray(journey?.alternatives) ? journey.alternatives : [];

  const handleTrainSuggestion = async (train) => {
    const display = `${train.number} · ${train.name}`;
    trainQuerySelected.current = display;
    setTrainQuery(display);
    setTrainSuggestions([]);
    setTrainSuggestionsOpen(false);
    await openTrainMap({ ...train, trainNumber: train.number, trainName: train.name });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <StatusBar style="light" />
      <LinearGradient colors={["#0a1225", "#111a31", "#1c2350"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <LinearGradient colors={[C.blue, C.violet]} style={styles.brandIcon}>
              <Ionicons name="train" size={25} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={styles.brandTitle}>rail<Text style={styles.brandAccent}>pulse</Text></Text>
              <Text style={styles.brandSubtitle}>INDIA RAIL EXPLORER</Text>
            </View>
          </View>
          <View style={styles.connectionPill}>
            <View style={[styles.connectionDot, (healthError || !providerConfigured) && styles.connectionDotWarn]} />
            <Text style={styles.connectionText}>{providerLabel}</Text>
          </View>
        </View>

        <View style={styles.heroTitleWrap}>
          <Text style={styles.heroEyebrow}>INDIA RAIL EXPLORER</Text>
          <Text style={styles.heroTitle}>Find your train.</Text>
          <Text style={styles.heroSubtitle}>Search a place, a train, or a journey between stations.</Text>
        </View>

        <View style={styles.modeBar}>
          {MODES.map((item) => {
            const active = mode === item.id;
            return (
              <Pressable key={item.id} style={[styles.modeTab, active && styles.modeTabActive]} onPress={() => chooseMode(item.id)}>
                <View style={[styles.modeIcon, active && styles.modeIconActive]}>
                  <Ionicons name={item.icon} size={18} color={active ? "#fff" : "#8da2c5"} />
                </View>
                <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{item.label}</Text>
                <Text style={styles.modeSubtitle}>{item.subtitle}</Text>
              </Pressable>
            );
          })}
        </View>

        {mode === "nearby" && (
          <View style={styles.searchPanel}>
            <View style={styles.panelHeading}>
              <View style={styles.panelHeadingIcon}><Ionicons name="location-outline" size={21} color={C.blue} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.panelTitle}>Trains near a location</Text>
                <Text style={styles.panelSubtitle}>Search by district, city, locality or PIN code.</Text>
              </View>
            </View>
            <View style={styles.locationFieldWrap}>
              <View style={styles.inputRow}>
                <Ionicons name="location-outline" size={18} color="#6980a4" />
                <TextInput
                  value={placeQuery}
                  onChangeText={(text) => { setPlaceQuery(text); setPlaceSuggestionsOpen(true); }}
                  onFocus={() => setPlaceSuggestionsOpen(true)}
                  placeholder="Enter a place or PIN code"
                  placeholderTextColor="#8b9bb5"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={() => searchNearby()}
                  style={styles.textInput}
                />
                {!!placeQuery && <Pressable onPress={() => { setPlaceQuery(""); setPlaceSuggestionsOpen(false); }}><Ionicons name="close-circle" size={18} color="#95a4bc" /></Pressable>}
              </View>
              {placeSuggestionsOpen && placeQuery.trim().length >= 2 && (
                <PlaceSuggestionList query={placeQuery} onChoose={(item) => { setPlaceQuery(item.query); setPlaceSuggestionsOpen(false); }} />
              )}
            </View>
            <Text style={styles.smallLabel}>SEARCH RADIUS</Text>
            <View style={styles.radiusRow}>
              {[10, 25, 50, 100, 200].map((km) => (
                <Pressable key={km} onPress={() => setRadiusKm(km)} style={[styles.radiusChip, radiusKm === km && styles.radiusChipActive]}>
                  <Text style={[styles.radiusText, radiusKm === km && styles.radiusTextActive]}>{km} km</Text>
                </Pressable>
              ))}
            </View>
            <PrimaryButton title="Find trains" onPress={() => searchNearby()} loading={nearbyLoading} icon="search-outline" />
            <View style={styles.quickRow}>
              <Text style={styles.quickLabel}>TRY</Text>
              {QUICK_LOCATIONS.map((item) => (
                <Pressable key={item.label} style={styles.quickChip} onPress={() => { setPlaceQuery(item.query); setPlaceSuggestionsOpen(false); searchNearby(item.query); }}>
                  <Text style={styles.quickChipText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {mode === "train" && (
          <View style={styles.searchPanel}>
            <View style={styles.panelHeading}>
              <View style={styles.panelHeadingIcon}><Ionicons name="train-outline" size={21} color={C.blue} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.panelTitle}>Find a train</Text>
                <Text style={styles.panelSubtitle}>Track a train by its number or name.</Text>
              </View>
            </View>
            <View style={styles.locationFieldWrap}>
              <View style={styles.inputRow}>
                <Ionicons name="search-outline" size={18} color="#6980a4" />
                <TextInput
                  value={trainQuery}
                  onChangeText={(text) => { trainQuerySelected.current = ""; setTrainQuery(text); setTrainSuggestionsOpen(true); setTrainError(""); }}
                  onFocus={() => trainSuggestions.length && setTrainSuggestionsOpen(true)}
                  placeholder="Train number or name"
                  placeholderTextColor="#8b9bb5"
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  onSubmitEditing={() => searchTrain()}
                  style={styles.textInput}
                />
                {trainSuggesting && <ActivityIndicator color={C.blue} size="small" />}
              </View>
              {trainSuggestionsOpen && trainSuggestions.length > 0 && (
                <TrainSuggestions rows={trainSuggestions} onChoose={handleTrainSuggestion} />
              )}
            </View>
            <PrimaryButton title="Track train" onPress={() => searchTrain()} loading={trainLoading || detailLoading} icon="navigate-outline" />
            {!!trainError && <Text style={styles.inlineError}>{trainError}</Text>}
          </View>
        )}

        {mode === "journey" && (
          <View style={styles.searchPanel}>
            <View style={styles.panelHeading}>
              <View style={styles.panelHeadingIcon}><Ionicons name="git-compare-outline" size={21} color={C.violet} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.panelTitle}>Between stations</Text>
                <Text style={styles.panelSubtitle}>Choose your source and destination.</Text>
              </View>
            </View>
            <StationPicker label="FROM STATION" placeholder="Search source station" value={fromStation} onChange={setFromStation} />
            <View style={styles.swapWrap}>
              <Pressable style={styles.swapButton} onPress={() => { setFromStation(toStation); setToStation(fromStation); }}>
                <Ionicons name="swap-vertical" size={18} color={C.blue} />
                <Text style={styles.swapText}>Swap stations</Text>
              </Pressable>
            </View>
            <StationPicker label="TO STATION" placeholder="Search destination station" value={toStation} onChange={setToStation} />
            <Text style={styles.smallLabel}>TRAVEL DATE (OPTIONAL)</Text>
            <View style={styles.inputRow}>
              <Ionicons name="calendar-outline" size={18} color="#6980a4" />
              <TextInput
                value={travelDate}
                onChangeText={setTravelDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#8b9bb5"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
                style={styles.textInput}
              />
              {!!travelDate && <Pressable onPress={() => setTravelDate("")}><Ionicons name="close-circle" size={18} color="#95a4bc" /></Pressable>}
            </View>
            <PrimaryButton title="Find trains" onPress={searchJourney} loading={journeyLoading} icon="search-outline" />
            {!!journeyError && <Text style={styles.inlineError}>{journeyError}</Text>}
          </View>
        )}

        <View style={styles.resultsPanel}>
          {mode === "nearby" && (
            <>
              <SectionTitle title={nearby ? `${nearby.count ?? nearby.trains?.length ?? 0} trains found` : "Nearby trains"} subtitle={nearby ? `${nearby.location?.displayName || placeQuery} · ${nearby.radiusKm || radiusKm} km radius` : "Search a place to see reported trains."} count={nearby ? `${nearby.radiusKm || radiusKm} km` : undefined} />
              <AlertBox message={nearbyError} onDismiss={() => setNearbyError("")} />
              {nearbyLoading ? <View style={styles.loadingBox}><ActivityIndicator color={C.blue} /><Text style={styles.loadingText}>Finding trains near {placeQuery}…</Text></View> : nearby?.trains?.length ? nearby.trains.map((train) => <TrainCard key={String(train.trainNumber)} train={train} selected={String(selectedTrain?.trainNumber) === String(train.trainNumber)} onPress={() => openTrainMap(train)} />) : <EmptyState icon="location-outline" title={nearby ? "No trains found" : "Search a location"} description={nearby ? "Try a wider radius or a different nearby place." : "Enter a district, city, locality or PIN code above."} />}
            </>
          )}

          {mode === "train" && (
            <>
              <SectionTitle title={selectedTrain ? "Selected train" : "Train details"} subtitle={selectedTrain ? `Train ${selectedTrain.trainNumber}` : "Search by train number or name above."} />
              <AlertBox message={detailError} onDismiss={() => setDetailError("")} />
              {detailLoading ? <View style={styles.loadingBox}><ActivityIndicator color={C.blue} /><Text style={styles.loadingText}>Loading current train report…</Text></View> : selectedTrain ? <TrainCard train={selectedTrain} selected onPress={() => setMapVisible(true)} /> : <EmptyState icon="train-outline" title="Find a train" description="Enter its number or name in the search box above." />}
            </>
          )}

          {mode === "journey" && (
            <>
              <SectionTitle title={journey ? directTrains.length ? `${directTrains.length} trains found` : "No direct trains found" : "Journey results"} subtitle={journey ? `${journey.fromName || fromStation?.name || journey.fromCode || fromStation?.code || "Source"} → ${journey.toName || toStation?.name || journey.toCode || toStation?.code || "Destination"}` : "Choose source and destination stations."} />
              <AlertBox message={journeyError} onDismiss={() => setJourneyError("")} />
              {journeyLoading ? <View style={styles.loadingBox}><ActivityIndicator color={C.blue} /><Text style={styles.loadingText}>Searching between stations…</Text></View> : directTrains.length ? directTrains.map((train, index) => <TrainCard key={`${train.trainNumber}-${index}`} train={train} journey onPress={() => openTrainMap(train)} />) : journey ? (
                <View>
                  <EmptyState icon="git-compare-outline" title="No direct trains found" description="No direct service was returned for these stations." />
                  {alternatives.length > 0 ? (
                    <View style={{ marginTop: 14 }}>
                      <Text style={styles.altSectionTitle}>Alternative connections</Text>
                      {alternatives.map((route, index) => <AlternativeRouteCard key={route.id || index} route={route} index={index} />)}
                    </View>
                  ) : <Text style={styles.altNote}>No alternate connections were returned by the provider for this query.</Text>}
                </View>
              ) : <EmptyState icon="git-compare-outline" title="Plan a journey" description="Choose both stations from the suggestions to compare trains." />}
            </>
          )}
        </View>

        <View style={styles.footerNote}>
          <Ionicons name="information-circle-outline" size={15} color="#94a8ce" />
          <Text style={styles.footerText}>RailPulse shows provider-reported information. A missing position means the provider didn't return coordinates.</Text>
        </View>
      </ScrollView>

      <TrainMapModal
        visible={mapVisible}
        train={selectedTrain}
        loading={detailLoading}
        error={detailError}
        onClose={() => setMapVisible(false)}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.page },
  pageContent: { paddingHorizontal: 15, paddingTop: 8, paddingBottom: 32, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  brandIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 15, borderWidth: 1, borderColor: "rgba(255,255,255,.22)" },
  brandTitle: { color: "#fff", fontSize: 23, fontWeight: "900", letterSpacing: -0.8 },
  brandAccent: { color: "#8e9cff" },
  brandSubtitle: { marginTop: 1, color: "#a7b4ce", fontSize: 8, fontWeight: "900", letterSpacing: 1.15 },
  connectionPill: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 145, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: "rgba(174,195,255,.18)", backgroundColor: "rgba(255,255,255,.07)" },
  connectionDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4ee0b4" },
  connectionDotWarn: { backgroundColor: "#eeb057" },
  connectionText: { flexShrink: 1, color: "#dbe5fb", fontSize: 9, fontWeight: "800" },
  heroTitleWrap: { paddingTop: 6, gap: 4 },
  heroEyebrow: { color: "#8d9dfd", fontSize: 10, fontWeight: "900", letterSpacing: 1.7 },
  heroTitle: { color: "#fff", fontSize: 29, fontWeight: "900", letterSpacing: -0.9 },
  heroSubtitle: { maxWidth: 340, color: "#aebbd3", fontSize: 12, lineHeight: 18 },
  modeBar: { flexDirection: "row", gap: 8, padding: 7, borderRadius: 19, borderWidth: 1, borderColor: "rgba(255,255,255,.17)", backgroundColor: "rgba(255,255,255,.07)" },
  modeTab: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, paddingHorizontal: 3, borderRadius: 13 },
  modeTabActive: { backgroundColor: "rgba(88,116,235,.27)", borderWidth: 1, borderColor: "rgba(150,174,255,.28)" },
  modeIcon: { width: 35, height: 35, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "rgba(255,255,255,.08)" },
  modeIconActive: { backgroundColor: C.blue },
  modeLabel: { color: "#c3cee3", fontSize: 11, fontWeight: "800", textAlign: "center" },
  modeLabelActive: { color: "#fff" },
  modeSubtitle: { color: "#94a6c5", fontSize: 8, textAlign: "center" },
  searchPanel: { padding: 15, borderRadius: 21, borderWidth: 1, borderColor: "rgba(255,255,255,.82)", backgroundColor: "rgba(246,249,255,.94)", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: .17, shadowRadius: 20, elevation: 7, gap: 12 },
  panelHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  panelHeadingIcon: { width: 43, height: 43, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#e6edff" },
  panelTitle: { color: C.ink, fontSize: 17, fontWeight: "900" },
  panelSubtitle: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  locationFieldWrap: { position: "relative", zIndex: 20 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 50, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: "#d6e1f4", backgroundColor: "#fff" },
  textInput: { flex: 1, minWidth: 0, paddingVertical: 12, color: C.ink, fontSize: 13, fontWeight: "600" },
  suggestionsBox: { marginTop: 6, borderRadius: 14, borderWidth: 1, borderColor: "#dbe5f7", backgroundColor: "#fff", overflow: "hidden", shadowColor: "#071735", shadowOffset: { width: 0, height: 7 }, shadowOpacity: .14, shadowRadius: 14, elevation: 9 },
  suggestionRow: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 50, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e6edf8" },
  suggestionIcon: { width: 31, height: 31, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#e9efff" },
  suggestionText: { flex: 1, color: C.inkSoft, fontSize: 12, fontWeight: "800" },
  suggestionSubtext: { color: C.muted, fontSize: 10, marginTop: 3 },
  trainNumberMini: { minWidth: 45, minHeight: 31, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "#e8efff" },
  trainNumberMiniText: { color: "#3159b8", fontSize: 10, fontWeight: "900" },
  smallLabel: { color: "#687d9e", fontSize: 9, fontWeight: "900", letterSpacing: .8, marginBottom: -5 },
  radiusRow: { flexDirection: "row", gap: 6 },
  radiusChip: { flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#d8e2f4", borderRadius: 11, backgroundColor: "#fff" },
  radiusChipActive: { borderColor: "#7594f8", backgroundColor: "#e7edff" },
  radiusText: { color: "#637998", fontSize: 10, fontWeight: "700" },
  radiusTextActive: { color: "#3159b8", fontWeight: "900" },
  primaryButtonOuter: { width: "100%", borderRadius: 13, shadowColor: C.blue, shadowOffset: { width: 0, height: 8 }, shadowOpacity: .2, shadowRadius: 14, elevation: 4 },
  primaryButton: { minHeight: 49, paddingHorizontal: 14, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  primaryButtonText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  disabledButton: { opacity: .62 },
  pressed: { opacity: .88, transform: [{ scale: .995 }] },
  quickRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7, marginTop: 1 },
  quickLabel: { color: "#778aa8", fontSize: 9, fontWeight: "900", letterSpacing: .9, marginRight: 2 },
  quickChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: "#d9e4f8", backgroundColor: "rgba(255,255,255,.8)" },
  quickChipText: { color: "#506887", fontSize: 10, fontWeight: "800" },
  resultsPanel: { minHeight: 180, padding: 14, borderRadius: 21, borderWidth: 1, borderColor: "rgba(255,255,255,.72)", backgroundColor: "rgba(237,243,255,.95)", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: .14, shadowRadius: 18, elevation: 5 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 12, marginBottom: 11, borderBottomWidth: 1, borderBottomColor: "#dce5f5" },
  eyebrow: { color: C.violet, fontSize: 9, fontWeight: "900", letterSpacing: 1, marginBottom: 4 },
  sectionTitle: { color: C.ink, fontSize: 18, fontWeight: "900" },
  sectionSubtitle: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  countPill: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9, backgroundColor: "#ebe9ff" },
  countPillText: { color: C.violet, fontSize: 10, fontWeight: "900" },
  emptyCard: { minHeight: 150, padding: 17, borderRadius: 17, borderWidth: 1, borderColor: "#fff", backgroundColor: "#f7faff", shadowColor: "#10264b", shadowOffset: { width: 0, height: 8 }, shadowOpacity: .09, shadowRadius: 15, elevation: 2 },
  emptyIcon: { width: 43, height: 43, alignItems: "center", justifyContent: "center", borderRadius: 13, marginBottom: 13 },
  emptyTitle: { color: C.ink, fontSize: 16, fontWeight: "900" },
  emptyDescription: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  loadingBox: { flexDirection: "row", alignItems: "center", gap: 9, padding: 15, borderRadius: 13, backgroundColor: "#f8faff" },
  loadingText: { flex: 1, color: C.muted, fontSize: 12, fontWeight: "700" },
  alertBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 11, marginBottom: 9, borderRadius: 12, borderWidth: 1, borderColor: "#f0c9cd", backgroundColor: "#fff1f1" },
  alertText: { flex: 1, color: "#963a47", fontSize: 11, lineHeight: 16 },
  inlineError: { color: C.red, fontSize: 11, lineHeight: 16 },
  swapWrap: { alignItems: "center", marginVertical: -3 },
  swapButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1, borderColor: "#d9e4f8", backgroundColor: "#eef3ff" },
  swapText: { color: "#4e6fba", fontSize: 10, fontWeight: "800" },
  altSectionTitle: { marginBottom: 9, color: C.ink, fontSize: 14, fontWeight: "900" },
  altNote: { color: C.muted, fontSize: 11, lineHeight: 17, paddingTop: 9 },
  alternativeCard: { marginBottom: 9, padding: 12, borderRadius: 15, borderWidth: 1, borderColor: "#dce6f8", backgroundColor: "#fff" },
  alternativeHeading: { flexDirection: "row", alignItems: "center", gap: 9 },
  alternativeIcon: { width: 33, height: 33, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#eeeaff" },
  alternativeTitle: { color: C.ink, fontSize: 12, fontWeight: "900" },
  alternativeVia: { color: C.muted, fontSize: 10, marginTop: 3 },
  alternativeLeg: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginTop: 11, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e3ebf8" },
  alternativeTrainNo: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 7, color: "#3159ad", backgroundColor: "#e8efff", fontSize: 10, fontWeight: "900" },
  alternativeLegName: { color: C.inkSoft, fontSize: 11, fontWeight: "800" },
  alternativeLegRoute: { color: C.muted, fontSize: 10, marginTop: 4, lineHeight: 15 },
  footerNote: { flexDirection: "row", alignItems: "flex-start", gap: 7, paddingHorizontal: 3, paddingTop: 1 },
  footerText: { flex: 1, color: "#9eafcc", fontSize: 10, lineHeight: 15 },
});
