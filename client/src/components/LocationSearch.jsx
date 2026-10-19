import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  LoaderCircle,
  MapPin,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { motion } from "framer-motion";

const examples = [
  { label: "Kolkata", query: "Kolkata" },
  { label: "Jhargram · 721507", query: "721507" },
  { label: "Purulia · 723101", query: "723101" },
];

const knownPlaces = [
  { label: "Kolkata, West Bengal, India", query: "Kolkata" },
  { label: "Howrah, West Bengal, India", query: "Howrah" },
  { label: "Jhargram, West Bengal, India · 721507", query: "721507" },
  { label: "Purulia, West Bengal, India · 723101", query: "723101" },
  { label: "Kharagpur, West Bengal, India · 721301", query: "721301" },
  { label: "Durgapur, West Bengal, India · 713201", query: "713201" },
  { label: "Asansol, West Bengal, India · 713301", query: "713301" },
  { label: "New Delhi, India · 110001", query: "110001" },
  { label: "Mumbai, Maharashtra, India · 400001", query: "400001" },
  { label: "Chennai, Tamil Nadu, India · 600001", query: "600001" },
];

const placeCache = new Map();
let lastRemoteRequestAt = 0;

function findLocalPlaces(query) {
  const q = query.trim().toLowerCase();

  if (!q) return [];

  return knownPlaces
    .filter((place) =>
      `${place.label} ${place.query}`.toLowerCase().includes(q),
    )
    .slice(0, 5)
    .map((place) => ({
      ...place,
      subtitle: "Suggested place",
    }));
}

function abortableDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Request aborted", "AbortError"));
      return;
    }

    const timer = window.setTimeout(resolve, ms);

    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Request aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

async function searchPlacesRemotely(query, signal) {
  const normalized = query.trim().toLowerCase();

  if (placeCache.has(normalized)) {
    return placeCache.get(normalized);
  }

  // Respect the public geocoder's one-request-per-second guidance.
  const wait = Math.max(0, 1100 - (Date.now() - lastRemoteRequestAt));
  if (wait) await abortableDelay(wait, signal);

  if (signal.aborted) {
    throw new DOMException("Request aborted", "AbortError");
  }

  lastRemoteRequestAt = Date.now();

  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    countrycodes: "in",
    "accept-language": "en",
  });

  if (/^\d{6}$/.test(query.trim())) {
    params.set("postalcode", query.trim());
  } else {
    params.set("q", `${query.trim()}, India`);
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      signal,
      headers: { Accept: "application/json" },
    },
  );

  if (!response.ok) {
    throw new Error("Place suggestions are temporarily unavailable.");
  }

  const rows = await response.json();

  const suggestions = rows
    .filter(
      (row) =>
        Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lon)),
    )
    .map((row) => ({
      label: row.display_name,
      query: row.display_name,
      subtitle:
        [row.address?.postcode, row.address?.state, row.address?.country]
          .filter(Boolean)
          .join(" · ") || "India",
    }));

  placeCache.set(normalized, suggestions);
  return suggestions;
}

export default function LocationSearch({ loading, onSearch }) {
  const [query, setQuery] = useState("");
  const [radius, setRadius] = useState("50");
  const [suggestions, setSuggestions] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [open, setOpen] = useState(false);

  const root = useRef(null);
  const selectedQuery = useRef("");

  useEffect(() => {
    const q = query.trim();
    if (selectedQuery.current === q) {
      selectedQuery.current = "";
      setSuggestions([]);
      setSuggesting(false);
      setOpen(false);
      setSuggestionError("");
      return undefined;
    }
    if (q.length < 2) {
      setSuggestions([]);
      setSuggesting(false);
      setSuggestionError("");
      return undefined;
    }

    const local = findLocalPlaces(q);
    setSuggestions(local);
    setSuggestionError("");
    setOpen(true);

    if (q.length < 3 && !/^\d{6}$/.test(q)) {
      return undefined;
    }

    const controller = new AbortController();

    // Debounce typing so we do not query the geocoder on each keystroke.
    const timer = window.setTimeout(async () => {
      setSuggesting(true);

      try {
        const remote = await searchPlacesRemotely(q, controller.signal);

        if (controller.signal.aborted) return;

        const unique = new Map();

        [...local, ...remote].forEach((item) => {
          unique.set(item.label.toLowerCase(), item);
        });

        setSuggestions([...unique.values()].slice(0, 7));
        setSuggestionError("");
        setOpen(true);
      } catch (error) {
        if (error.name !== "AbortError") {
          // The user can still submit a manually typed place.
          setSuggestionError("Suggestions unavailable. You can still search.");
          setSuggestions(local);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSuggesting(false);
        }
      }
    }, 800);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (!root.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, []);

  const submit = (event) => {
    event.preventDefault();

    const value = query.trim();
    if (!value || loading) return;

    setOpen(false);
    onSearch(value, Number(radius));
  };

  const pickExample = (value) => {
    selectedQuery.current = value;
    setQuery(value);
    setSuggestions([]);
    setOpen(false);
    setSuggestionError("");
    onSearch(value, Number(radius));
  };

  const chooseSuggestion = (item) => {
    selectedQuery.current = item.query || item.label;
    setQuery(item.query || item.label);
    setOpen(false);
    setSuggestions([]);
    setSuggestionError("");
  };

  return (
    <motion.section
      className="search-hero"
      initial={{ opacity: 0, y: 7 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="search-hero-copy">
        <h2>Trains near a location</h2>
        <p>Search by district, city, locality or PIN code.</p>
      </div>

      <form className="location-form" onSubmit={submit}>
        <div className="location-autocomplete-wrap" ref={root}>
          <label className="location-input-wrap">
            <MapPin size={19} />
            <span className="sr-only">District, city or PIN code</span>

            <input
              value={query}
              onChange={(event) => {
                selectedQuery.current = "";
                setQuery(event.target.value);
              }}
              onFocus={() => suggestions.length && setOpen(true)}
              placeholder="Enter a place or PIN code"
              aria-label="District, city or PIN code"
              aria-expanded={open}
              aria-autocomplete="list"
              autoComplete="off"
              required
            />

            {suggesting && <LoaderCircle className="spin-icon" size={17} />}

            {query && (
              <button
                type="button"
                className="clear-query"
                onClick={() => {
                  setQuery("");
                  setSuggestions([]);
                  setSuggestionError("");
                  setOpen(false);
                }}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </label>

          {open && suggestions.length > 0 && (
            <div className="location-suggestion-menu" role="listbox">
              {suggestions.map((item, index) => (
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="location-suggestion-option"
                  key={`${item.label}-${index}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseSuggestion(item)}
                >
                  <span className="location-suggestion-icon">
                    <MapPin size={17} />
                  </span>

                  <span className="location-suggestion-copy">
                    <strong>{item.label}</strong>
                    <small>{item.subtitle}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="radius-select-wrap">
          <SlidersHorizontal size={16} />
          <span className="sr-only">Search radius</span>
          <select
            value={radius}
            onChange={(event) => setRadius(event.target.value)}
            aria-label="Search radius"
          >
            <option value="10">10 km</option>
            <option value="25">25 km</option>
            <option value="50">50 km</option>
            <option value="100">100 km</option>
            <option value="200">200 km</option>
          </select>
        </label>

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? (
            <span className="spinner" />
          ) : (
            <>
              <Search size={17} />
              Find trains
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {suggestionError && (
        <p className="location-suggestion-error" role="status">
          {suggestionError}
        </p>
      )}

      <div className="quick-search-row">
        <span>Try</span>
        {examples.map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => pickExample(example.query)}
            disabled={loading}
          >
            {example.label}
          </button>
        ))}
      </div>
    </motion.section>
  );
}
