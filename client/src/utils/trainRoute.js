const CURRENT_STATUSES = new Set(['current', 'at-station', 'at_station', 'here', 'arrived', 'halt']);

export function normalizeStationName(value) {
  return String(value ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(junction|jn|railway station|station)\b/gi, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function stationName(stop) {
  return stop?.stationName ?? stop?.name ?? stop?.station ?? stop?.station_name ?? '';
}

function stationCode(stop) {
  return stop?.stationCode ?? stop?.code ?? stop?.station_code ?? '';
}

export function getCurrentRouteIndex(route = [], train = {}) {
  if (!Array.isArray(route) || route.length === 0 || !train) return -1;

  const explicit = route.findIndex((stop) => stop?.isCurrent === true || stop?.is_current === true || CURRENT_STATUSES.has(String(stop?.status ?? '').toLowerCase()));
  if (explicit >= 0) return explicit;

  const currentCode = String(train.currentStationCode ?? train.current_station_code ?? '').trim().toLowerCase();
  if (currentCode) {
    const byCode = route.findIndex((stop) => String(stationCode(stop)).trim().toLowerCase() === currentCode);
    if (byCode >= 0) return byCode;
  }

  const current = normalizeStationName(train.currentStation ?? train.currentStationName ?? train.current_station ?? '');
  if (!current) return -1;
  const normalizedNames = route.map((stop) => normalizeStationName(stationName(stop)));
  const exact = normalizedNames.findIndex((name) => name && name === current);
  if (exact >= 0) return exact;

  // Provider names sometimes differ only by abbreviations such as "Howrah Jn".
  if (current.length >= 4) {
    const partial = normalizedNames.findIndex((name) => name.length >= 4 && (name.includes(current) || current.includes(name)));
    if (partial >= 0) return partial;
  }
  return -1;
}

export function isRouteStopCurrent(stop, index, currentIndex) {
  const status = String(stop?.status ?? '').toLowerCase();
  return stop?.isCurrent === true || stop?.is_current === true || CURRENT_STATUSES.has(status) || (currentIndex >= 0 && index === currentIndex);
}
