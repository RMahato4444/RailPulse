import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, MapPin, Search } from "lucide-react";
import { searchStationDirectory } from "../api/client.js";

export default function StationAutocomplete({
  label,
  placeholder,
  value,
  onChange,
  icon = "search",
  resetKey = 0,
}) {
  const [text, setText] = useState(value?.name || "");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const root = useRef(null);

  useEffect(() => {
    if (value) setText(`${value.name} (${value.code})`);
  }, [value?.code, value?.name]);
  useEffect(() => {
    setText(value ? `${value.name} (${value.code})` : "");
    setSuggestions([]);
    setOpen(false);
  }, [resetKey]);
  useEffect(() => {
    const trimmed = text.trim();
    if (value && `${value.name} (${value.code})` === trimmed) return;
    if (trimmed.length < 2) {
      setSuggestions([]);
      setLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        setSuggestions(
          await searchStationDirectory(trimmed, { signal: controller.signal }),
        );
        setOpen(true);
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 280);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  useEffect(() => {
    const onOutside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const choose = (station) => {
    setText(`${station.name} (${station.code})`);
    setSuggestions([]);
    setOpen(false);
    setError("");
    onChange(station);
  };
  const Icon = icon === "pin" ? MapPin : Search;

  return (
    <div className="station-field" ref={root}>
      <label className="field-label">{label}</label>
      <div
        className={`station-input-box ${open && suggestions.length ? "station-input-active" : ""}`}
      >
        <Icon size={17} />
        <input
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            onChange(null);
            setOpen(true);
          }}
          onFocus={() => suggestions.length && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          aria-label={label}
        />
        {loading && <LoaderCircle className="spin-icon" size={16} />}
        {value && (
          <span className="station-selected-check">
            <Check size={13} />
          </span>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="autocomplete-menu">
          {suggestions.map((station) => (
            <button
              type="button"
              className="autocomplete-option"
              key={station.code}
              onClick={() => choose(station)}
            >
              <span className="station-option-icon">
                <MapPin size={15} />
              </span>
              <span className="station-option-copy">
                <strong>{station.name}</strong>
                <small>{station.city || "Indian Railways station"}</small>
              </span>
              <code>{station.code}</code>
            </button>
          ))}
        </div>
      )}
      {open &&
        !loading &&
        text.trim().length > 1 &&
        suggestions.length === 0 &&
        !error && (
          <div className="autocomplete-menu autocomplete-empty">
            No station matches yet. Try the station name or code.
          </div>
        )}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}
