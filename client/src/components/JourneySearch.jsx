import { useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  CalendarDays,
  Route,
  Search,
} from "lucide-react";
import { motion } from "framer-motion";
import StationAutocomplete from "./StationAutocomplete.jsx";

export default function JourneySearch({ loading, onSearch }) {
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [date, setDate] = useState("");
  const [swapVersion, setSwapVersion] = useState(0);
  const [error, setError] = useState("");

  const swap = () => {
    setFrom(to);
    setTo(from);
    setSwapVersion((version) => version + 1);
    setError("");
  };

  const submit = (event) => {
    event.preventDefault();

    if (!from || !to) {
      setError("Choose both stations from the suggestions.");
      return;
    }

    if (from.code === to.code) {
      setError("Source and destination must be different.");
      return;
    }

    setError("");
    onSearch(from, to, date);
  };

  return (
    <motion.section
      className="workflow-panel journey-workflow"
      initial={{ opacity: 0, y: 7 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="workflow-heading">
        <span className="workflow-icon workflow-icon-purple">
          <Route size={20} />
        </span>

        <div>
          <h2>Find trains between stations</h2>
          <p>Choose the source and destination stations.</p>
        </div>
      </div>

      <form className="journey-form" onSubmit={submit}>
        <StationAutocomplete
          label="FROM STATION"
          placeholder="Search source station"
          value={from}
          onChange={setFrom}
          resetKey={swapVersion}
        />

        <button
          type="button"
          className="swap-stations"
          onClick={swap}
          title="Swap stations"
          aria-label="Swap source and destination"
        >
          <ArrowDownUp size={17} />
        </button>

        <StationAutocomplete
          label="TO STATION"
          placeholder="Search destination station"
          value={to}
          onChange={setTo}
          resetKey={swapVersion}
        />

        <label className="journey-date-field">
          <span className="field-label">
            TRAVEL DATE <small>OPTIONAL</small>
          </span>

          <span className="journey-date-input">
            <CalendarDays size={17} />
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              min={new Date().toLocaleDateString("en-CA", {
                timeZone: "Asia/Kolkata",
              })}
              aria-label="Travel date"
            />
          </span>
        </label>

        {error && (
          <p className="inline-error journey-form-error" role="alert">
            {error}
          </p>
        )}

        <div className="journey-submit-row">
          <button
            className="btn-primary btn-route"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner" />
            ) : (
              <>
                <Search size={16} />
                Find trains
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </form>
    </motion.section>
  );
}