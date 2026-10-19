const responseCache = new Map();
const geocodeCache = new Map();
let nominatimLastCall = 0;
let mapCache = { at: 0, trains: null };

const knownLocations = [
  {
    terms: ["kolkata", "calcutta", "700001", "west bengal capital"],
    displayName: "Kolkata, West Bengal, India",
    lat: 22.5726,
    lon: 88.3639,
  },
  {
    terms: ["howrah", "711101"],
    displayName: "Howrah, West Bengal, India",
    lat: 22.5958,
    lon: 88.2636,
  },
  {
    terms: ["jhargram", "721507"],
    displayName: "Jhargram, West Bengal, India",
    lat: 22.4533,
    lon: 86.9977,
  },
  {
    terms: ["purulia", "723101"],
    displayName: "Purulia, West Bengal, India",
    lat: 23.3322,
    lon: 86.3652,
  },
  {
    terms: ["kharagpur", "721301"],
    displayName: "Kharagpur, West Bengal, India",
    lat: 22.346,
    lon: 87.232,
  },
  {
    terms: ["durgapur", "713201"],
    displayName: "Durgapur, West Bengal, India",
    lat: 23.5204,
    lon: 87.3119,
  },
  {
    terms: ["asansol", "713301"],
    displayName: "Asansol, West Bengal, India",
    lat: 23.6889,
    lon: 86.9661,
  },
  {
    terms: ["delhi", "new delhi", "110001"],
    displayName: "New Delhi, Delhi, India",
    lat: 28.6139,
    lon: 77.209,
  },
  {
    terms: ["mumbai", "400001"],
    displayName: "Mumbai, Maharashtra, India",
    lat: 19.076,
    lon: 72.8777,
  },
  {
    terms: ["chennai", "600001"],
    displayName: "Chennai, Tamil Nadu, India",
    lat: 13.0827,
    lon: 80.2707,
  },
  {
    terms: ["bengaluru", "bangalore", "560001"],
    displayName: "Bengaluru, Karnataka, India",
    lat: 12.9716,
    lon: 77.5946,
  },
  {
    terms: ["hyderabad", "500001"],
    displayName: "Hyderabad, Telangana, India",
    lat: 17.385,
    lon: 78.4867,
  },
  {
    terms: ["patna", "800001"],
    displayName: "Patna, Bihar, India",
    lat: 25.5941,
    lon: 85.1376,
  },
  {
    terms: ["guwahati", "781001"],
    displayName: "Guwahati, Assam, India",
    lat: 26.1445,
    lon: 91.7362,
  },
  {
    terms: ["bhopal", "462001"],
    displayName: "Bhopal, Madhya Pradesh, India",
    lat: 23.2599,
    lon: 77.4126,
  },
  {
    terms: ["agra", "282001"],
    displayName: "Agra, Uttar Pradesh, India",
    lat: 27.1767,
    lon: 78.0081,
  },
  {
    terms: ["lucknow", "226001"],
    displayName: "Lucknow, Uttar Pradesh, India",
    lat: 26.8467,
    lon: 80.9462,
  },
];

const providerEnabled = () =>
  process.env.TRAIN_DATA_PROVIDER === "railradar" &&
  Boolean(process.env.RAILRADAR_API_KEY);
function requireRailRadar() {
  if (!providerEnabled()) {
    const error = new Error(
      "RailRadar is not configured. Check TRAIN_DATA_PROVIDER and RAILRADAR_API_KEY in the server environment.",
    );

    error.statusCode = 503;
    throw error;
  }
}
const cacheGet = (key) => {
  const hit = responseCache.get(key);
  if (!hit || hit.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return hit.value;
};
const cacheSet = (
  key,
  value,
  seconds = Number(process.env.SEARCH_CACHE_SECONDS || 60),
) => {
  responseCache.set(key, {
    value,
    expiresAt: Date.now() + Math.max(10, seconds) * 1000,
  });
  return value;
};

async function railRadarRequest(path) {
  const baseUrl = (
    process.env.RAILRADAR_BASE_URL || "https://api.railradar.in"
  ).replace(/\/$/, "");
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${process.env.RAILRADAR_API_KEY}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12000),
    });
  } catch (cause) {
    const error = new Error(
      "The train-data provider could not be reached. Check your connection and try again.",
    );
    error.statusCode = 502;
    error.cause = cause;
    throw error;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const error = new Error(
      body?.error?.message ||
        `Train-data provider returned HTTP ${response.status}.`,
    );
    error.statusCode =
      response.status === 429
        ? 429
        : response.status >= 500
          ? 502
          : response.status;
    throw error;
  }
  return body?.data ?? body;
}

function normalizeLiveMapRow(row) {
  const number = String(
    row.train_number ?? row.trainNumber ?? row.number ?? "",
  ).trim();
  const latitudeRaw =
    row.current_lat ??
    row.currentLat ??
    row.latitude ??
    row.currentLocation?.lat ??
    row.currentLocation?.latitude;
  const longitudeRaw =
    row.current_lng ??
    row.currentLng ??
    row.longitude ??
    row.currentLocation?.lng ??
    row.currentLocation?.longitude;
  const latitude =
    latitudeRaw == null || latitudeRaw === "" ? NaN : Number(latitudeRaw);
  const longitude =
    longitudeRaw == null || longitudeRaw === "" ? NaN : Number(longitudeRaw);
  if (
    !number ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return null;
  const delayMinutes =
    row.delay_minutes ?? row.delayMinutes ?? row.live?.delayMinutes ?? null;
  const nextLatRaw = row.next_lat ?? row.nextLat ?? row.nextLocation?.lat;
  const nextLngRaw = row.next_lng ?? row.nextLng ?? row.nextLocation?.lng;
  const nextLat =
    nextLatRaw == null || nextLatRaw === "" ? NaN : Number(nextLatRaw);
  const nextLng =
    nextLngRaw == null || nextLngRaw === "" ? NaN : Number(nextLngRaw);
  const reportedBearing =
    row.currentLocation?.bearingDegrees ??
    row.bearingDegrees ??
    row.bearing_degrees;
  const bearingDegrees =
    reportedBearing != null && Number.isFinite(Number(reportedBearing))
      ? Number(reportedBearing)
      : Number.isFinite(nextLat) && Number.isFinite(nextLng)
        ? bearingBetween(latitude, longitude, nextLat, nextLng)
        : 0;
  const rawRoute = Array.isArray(row.route)
    ? row.route
    : Array.isArray(row.routePoints)
      ? row.routePoints
      : [];
  const route = rawRoute.map((point) => {
    const latRaw = point.lat ?? point.latitude ?? point.location?.lat;
    const lngRaw =
      point.lng ??
      point.lon ??
      point.longitude ??
      point.location?.lng ??
      point.location?.lon;
    return {
      stationCode: point.stationCode ?? point.station_code ?? point.code ?? "",
      stationName:
        point.stationName ?? point.station_name ?? point.name ?? "Station",
      lat: latRaw == null || latRaw === "" ? null : Number(latRaw),
      lng: lngRaw == null || lngRaw === "" ? null : Number(lngRaw),
      status: point.status ?? "upcoming",
    };
  });
  return {
    trainNumber: number,
    trainName: row.train_name ?? row.trainName ?? row.name ?? `Train ${number}`,
    trainType: row.type ?? row.trainType ?? "Express",
    sourceCode:
      row.source?.code ?? row.source_code ?? row.from_station_code ?? "",
    destinationCode:
      row.destination?.code ??
      row.destination_code ??
      row.to_station_code ??
      "",
    sourceStation:
      row.source?.name ??
      row.source_station_name ??
      row.from_station ??
      row.source ??
      "Origin not provided",
    destinationStation:
      row.destination?.name ??
      row.destination_station_name ??
      row.to_station ??
      row.destination ??
      "Destination not provided",
    currentStation:
      row.current_station_name ??
      row.currentStationName ??
      row.current_station ??
      row.currentLocation?.stationName ??
      "Latest reported location",
    nextStation:
      row.next_station_name ??
      row.nextStationName ??
      row.next_station ??
      row.nextHalt?.stationName ??
      row.next_station ??
      "Not reported",
    latitude,
    longitude,
    delayMinutes:
      delayMinutes === null || delayMinutes === undefined
        ? null
        : Number(delayMinutes),
    speedKmh:
      row.speed_kmh ??
      row.speedKmh ??
      row.speed ??
      row.currentLocation?.speedKmh ??
      null,
    status:
      row.status ?? (Number(delayMinutes || 0) > 10 ? "delayed" : "running"),
    bearingDegrees,
    route,
    updatedAt:
      row.last_updated ?? row.lastUpdatedAt ?? new Date().toISOString(),
    source: "live",
    isActualPosition: row.isActualPosition ?? row.is_actual_position ?? null,
  };
}

function bearingBetween(lat1, lon1, lat2, lon2) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const toDeg = (radians) => (radians * 180) / Math.PI;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.cos(toRad(lon2 - lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function normalizeTrainDetail(data, fallbackNumber) {
  const routeRaw = Array.isArray(data.route) ? data.route : [];
  const current = data.currentLocation ?? {};
  const train = data.train ?? {};
  const currentStation =
    current.stationName ??
    current.station_name ??
    current.stationCode ??
    data.currentStation ??
    "Position not reported";
  const next =
    data.nextHalt?.stationName ??
    data.nextHalt?.station_name ??
    data.nextStation ??
    "Not reported";
  const route = routeRaw.map((point) => {
    const latRaw = point.lat ?? point.latitude ?? point.location?.lat;
    const lngRaw =
      point.lng ??
      point.lon ??
      point.longitude ??
      point.location?.lng ??
      point.location?.lon;
    return {
      stationCode: point.stationCode ?? point.station_code ?? point.code ?? "",
      stationName:
        point.stationName ?? point.station_name ?? point.name ?? "Station",
      lat: latRaw == null || latRaw === "" ? null : Number(latRaw),
      lng: lngRaw == null || lngRaw === "" ? null : Number(lngRaw),
      status: point.status ?? "upcoming",
      scheduledArrival:
        point.scheduledArrival ?? point.scheduled_arrival ?? null,
      scheduledDeparture:
        point.scheduledDeparture ?? point.scheduled_departure ?? null,
      delayArrival: point.delayArrival ?? point.delay_arrival ?? null,
      delayDeparture: point.delayDeparture ?? point.delay_departure ?? null,
    };
  });
  const currentRoute =
    route.find((stop) => stop.stationCode === current.stationCode) ||
    route.find((stop) => stop.stationName === currentStation);
  const lat = current.lat ?? current.latitude ?? currentRoute?.lat ?? null;
  const lng = current.lng ?? current.longitude ?? currentRoute?.lng ?? null;
  const source =
    train.source?.name ??
    train.source?.code ??
    route[0]?.stationName ??
    "Origin not provided";
  const destination =
    train.destination?.name ??
    train.destination?.code ??
    route.at(-1)?.stationName ??
    "Destination not provided";
  const delay = data.delayMinutes ?? data.delay_minutes ?? null;
  return {
    trainNumber: String(
      data.trainNumber ?? data.train_number ?? train.number ?? fallbackNumber,
    ),
    trainName:
      data.trainName ??
      data.train_name ??
      train.name ??
      `Train ${fallbackNumber}`,
    trainType: train.type ?? train.category ?? "Express",
    sourceCode: train.source?.code ?? "",
    destinationCode: train.destination?.code ?? "",
    sourceStation: source,
    destinationStation: destination,
    currentStation,
    nextStation: next,
    latitude: lat === null ? null : Number(lat),
    longitude: lng === null ? null : Number(lng),
    delayMinutes: delay === null ? null : Number(delay),
    speedKmh: current.speedKmh ?? current.speed_kmh ?? null,
    bearingDegrees: Number(
      current.bearingDegrees ?? current.bearing_degrees ?? 0,
    ),
    progress:
      current.segmentProgress == null
        ? null
        : Math.round(Number(current.segmentProgress) * 100),
    status: data.status ?? (Number(delay || 0) > 10 ? "delayed" : "running"),
    updatedAt:
      data.lastUpdatedAt ?? data.last_updated ?? new Date().toISOString(),
    route,
    source: "live",
    isLive: data.isLive ?? true,
    isActualPosition: current.isActualPosition ?? null,
  };
}

export function getProviderStatus() {
  const configured = providerEnabled();

  return {
    provider: "railradar",
    mode: configured ? "live" : "unconfigured",
    configured,
  };
}

export async function getLiveMap() {
  requireRailRadar();

  const ttl =
    Math.max(15, Number(process.env.LIVE_MAP_CACHE_SECONDS || 45)) * 1000;

  if (mapCache.trains && Date.now() - mapCache.at < ttl) {
    return {
      source: "live",
      updatedAt: new Date(mapCache.at).toISOString(),
      trains: mapCache.trains,
      cached: true,
    };
  }

  const raw = await railRadarRequest("/v1/legacy/trains/live-map");

  const rows = Array.isArray(raw) ? raw : (raw.trains ?? raw.data ?? []);

  mapCache = {
    at: Date.now(),
    trains: rows.map(normalizeLiveMapRow).filter(Boolean),
  };

  return {
    source: "live",
    updatedAt: new Date(mapCache.at).toISOString(),
    trains: mapCache.trains,
    cached: false,
  };
}

export async function getNearbyTrains(query, radiusKm = 50) {
  const location = await geocodeIndiaLocation(query);
  const feed = await getLiveMap();
  const radius = Math.min(250, Math.max(5, Number(radiusKm) || 50));
  const trains = feed.trains
    .map((train) => ({
      ...train,
      distanceKm: Number(
        haversineKm(
          location.lat,
          location.lon,
          train.latitude,
          train.longitude,
        ).toFixed(1),
      ),
    }))
    .filter((train) => train.distanceKm <= radius)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return {
    source: feed.source,
    updatedAt: feed.updatedAt,
    cached: feed.cached ?? false,
    location,
    radiusKm: radius,
    count: trains.length,
    trains,
    notice: feed.notice,
  };
}

export async function getTrainLiveStatus(number) {
  requireRailRadar();

  const key = `train:${number}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const raw = await railRadarRequest(
    `/v1/trains/${encodeURIComponent(number)}/live?includeCoordinates=true`,
  );

  const result = normalizeTrainDetail(raw, number);
  cacheSet(key, result, 60);

  return result;
}

export async function searchTrains(query) {
  const q = String(query || "").trim();
  if (q.length < 2) return [];

  requireRailRadar();

  const key = `train-search:${q.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    q,
    limit: "10",
  });

  const raw = await railRadarRequest(`/v1/lookup/search/trains?${params}`);

  const result = (Array.isArray(raw) ? raw : (raw.trains ?? []))
    .map((item) => ({
      number: String(
        item.number ?? item.trainNumber ?? item.train_number ?? "",
      ),
      name:
        item.name ??
        item.trainName ??
        item.train_name ??
        "Indian Railways train",
      source: item.source?.code ?? item.source ?? item.from ?? "",
      destination: item.destination?.code ?? item.destination ?? item.to ?? "",
    }))
    .filter((item) => item.number);

  return cacheSet(key, result, 300);
}

export async function searchStations(query) {
  const q = String(query || "").trim();
  if (q.length < 2) return [];

  requireRailRadar();

  const key = `station-search:${q.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    q,
    limit: "10",
  });

  const raw = await railRadarRequest(`/v1/lookup/search/stations?${params}`);

  const rows = Array.isArray(raw) ? raw : (raw.stations ?? []);

  const result = rows
    .map((item) => ({
      code: String(item.code ?? item.stationCode ?? ""),
      name: item.name ?? item.stationName ?? "",
      city: item.city ?? "",
    }))
    .filter((item) => item.code && item.name);

  return cacheSet(key, result, 1800);
}

export async function getTrainsBetween(from, to, date) {
  const fromCode = String(from || "")
    .trim()
    .toUpperCase();
  const toCode = String(to || "")
    .trim()
    .toUpperCase();

  if (!/^[A-Z0-9]{2,8}$/.test(fromCode) || !/^[A-Z0-9]{2,8}$/.test(toCode)) {
    const error = new Error(
      "Select a source and destination from the station suggestions.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (fromCode === toCode) {
    const error = new Error(
      "Source and destination must be different stations.",
    );
    error.statusCode = 400;
    throw error;
  }

  requireRailRadar();

  const key = `between:${fromCode}:${toCode}:${date || "today"}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    live: "true",
    byCity: "false",
  });

  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    params.set("date", date);
  }

  const raw = await railRadarRequest(
    `/v1/trains/between/${encodeURIComponent(fromCode)}/${encodeURIComponent(toCode)}?${params}`,
  );

  const rows = Array.isArray(raw) ? raw : (raw.trains ?? []);

  const trains = rows
    .map((row) => ({
      trainNumber: String(
        row.train?.number ?? row.trainNumber ?? row.number ?? "",
      ),
      trainName:
        row.train?.name ?? row.trainName ?? row.name ?? "Indian Railways train",
      trainType: row.train?.type ?? row.train?.category ?? "Express",
      sourceCode: fromCode,
      destinationCode: toCode,
      departure: row.from?.departure ?? row.from?.departureTime ?? "--:--",
      arrival: row.to?.arrival ?? row.to?.arrivalTime ?? "--:--",
      departureDay: row.from?.day ?? 1,
      arrivalDay: row.to?.day ?? 1,
      distanceKm: row.distance ?? null,
      durationMinutes: row.duration ?? null,
      halts: row.totalHaltsBetween ?? null,
      liveStatus: row.live?.type ?? null,
      delayMinutes: row.live?.delayMinutes ?? null,
      platform: row.live?.platform ?? null,
      runDays:
        row.train?.runDays ??
        row.train?.runningDays ??
        row.train?.daysOfRun ??
        row.train?.days ??
        [],
      source: "live",
    }))
    .filter((row) => row.trainNumber);

  return cacheSet(
    key,
    {
      source: "live",
      fromCode: raw.from?.code ?? fromCode,
      toCode: raw.to?.code ?? toCode,
      fromName: raw.from?.name ?? "",
      toName: raw.to?.name ?? "",
      date: date || null,
      count: trains.length,
      trains,
      alternatives: Array.isArray(
        raw?.alternatives ?? raw?.connectingRoutes ?? raw?.connecting_routes,
      )
        ? (raw.alternatives ?? raw.connectingRoutes ?? raw.connecting_routes)
        : [],
    },
    90,
  );
}

export async function geocodeIndiaLocation(query) {
  const q = String(query || "").trim();
  if (q.length < 2 || q.length > 120) {
    const error = new Error(
      "Enter a district, city, locality or 6-digit PIN code.",
    );
    error.statusCode = 400;
    throw error;
  }
  const key = q.toLowerCase();
  const cached = geocodeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const place = knownLocations.find((item) =>
    item.terms.some(
      (term) => term === key || (term.length > 5 && key.includes(term)),
    ),
  );
  if (place) {
    const value = {
      query: q,
      displayName: place.displayName,
      lat: place.lat,
      lon: place.lon,
      geocoder: "known-place index",
    };
    geocodeCache.set(key, { value, expiresAt: Date.now() + 86400000 });
    return value;
  }
  const postal = /^\d{6}$/.test(q);
  const searchText = postal ? `${q}, India` : `${q}, India`;
  const now = Date.now();
  const wait = Math.max(0, 1000 - (now - nominatimLastCall));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  nominatimLastCall = Date.now();
  let rows = [];
  try {
    const params = new URLSearchParams({
      q: searchText,
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
      countrycodes: "in",
    });
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          "User-Agent":
            process.env.GEOCODER_USER_AGENT ||
            "RailPulseIndia/2.0 (replace-this@example.com)",
          "Accept-Language": "en",
        },
        signal: AbortSignal.timeout(9000),
      },
    );
    if (res.ok) rows = await res.json();
  } catch {
    /* fall through to a clear, user-friendly error */
  }
  const candidate = rows.find(
    (row) =>
      Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lon)),
  );
  if (!candidate) {
    const error = new Error(
      "Could not locate that place. Try a nearby city name or check the PIN code.",
    );
    error.statusCode = 404;
    throw error;
  }
  const value = {
    query: q,
    displayName: candidate.display_name,
    lat: Number(candidate.lat),
    lon: Number(candidate.lon),
    geocoder: "OpenStreetMap Nominatim",
  };
  geocodeCache.set(key, { value, expiresAt: Date.now() + 86400000 });
  return value;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const rad = (n) => (n * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
