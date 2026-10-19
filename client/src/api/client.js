const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(path, { signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' }, signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Cannot reach the RailPulse server. Make sure the server is running on port 5000.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw new Error(body.message || `Request failed (${response.status})`);
  return body;
}

export const getHealth = (options = {}) => request('/health', options);
export const getNearbyTrains = (query, radiusKm = 50, options = {}) => {
  const params = new URLSearchParams({ query, radiusKm: String(radiusKm) });
  return request(`/trains/nearby?${params}`, options);
};
export const getTrainStatus = (number, options = {}) => request(`/trains/${encodeURIComponent(number)}/live`, options);
export const searchTrainDirectory = (q, options = {}) => request(`/search/trains?${new URLSearchParams({ q })}`, options).then((data) => data.results || []);
export const searchStationDirectory = (q, options = {}) => request(`/search/stations?${new URLSearchParams({ q })}`, options).then((data) => data.results || []);
export const findTrainsBetween = (from, to, date, options = {}) => {
  const params = new URLSearchParams({ from: from.code, to: to.code });
  if (date) params.set('date', date);
  return request(`/trains/between?${params}`, options);
};
