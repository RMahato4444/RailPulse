const DEFAULT_API_URL = "http://10.0.2.2:5000/api";

export const API_BASE_URL = String(
  process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL,
).replace(/\/$/, "");

async function request(path, { signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new Error(
      `Cannot reach RailPulse API at ${API_BASE_URL}. Check the server and mobile API URL.`,
    );
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const message = body.message || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return body;
}

export const getHealth = () => request("/health");

export const getNearbyTrains = (query, radiusKm = 50) => {
  const params = new URLSearchParams({ query, radiusKm: String(radiusKm) });
  return request(`/trains/nearby?${params}`);
};

export const getTrainStatus = async (number, options = {}) => {
  const body = await request(`/trains/${encodeURIComponent(number)}/live`, options);
  return body.train;
};

export const searchTrainDirectory = async (query, options = {}) => {
  const q = query.trim();
  if (q.length < 2) return [];
  const body = await request(`/search/trains?${new URLSearchParams({ q })}`, options);
  return Array.isArray(body.results) ? body.results : [];
};

export const searchStationDirectory = async (query, options = {}) => {
  const q = query.trim();
  if (q.length < 2) return [];
  const body = await request(`/search/stations?${new URLSearchParams({ q })}`, options);
  return Array.isArray(body.results) ? body.results : [];
};

export const findTrainsBetween = (from, to, date) => {
  const params = new URLSearchParams({ from: from.code, to: to.code });
  if (date) params.set("date", date);
  return request(`/trains/between?${params}`);
};
