import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  LoaderCircle,
  Search,
  TrainFront,
} from "lucide-react";
import { motion } from "framer-motion";
import { searchTrainDirectory } from "../api/client.js";

export default function TrainSearch({
  loading,
  onFindNumber,
  onSelectTrain,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const root = useRef(null);
  const selectedQuery = useRef("");

  useEffect(() => {
    const q = query.trim();

    if (
      q.length < 2 ||
      /^\d{4,6}$/.test(q) ||
      (selectedQuery.current && q === selectedQuery.current)
    ) {
      setResults([]);
      setSuggesting(false);
      return undefined;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setSuggesting(true);
      setError("");

      try {
        const matches = await searchTrainDirectory(q, {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setResults(matches);
          setOpen(true);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSuggesting(false);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const onOutside = (event) => {
      if (!root.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);

    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, []);

  const chooseTrain = (train) => {
    const display = `${train.number} · ${train.name}`;

    selectedQuery.current = display;
    setQuery(display);
    setResults([]);
    setOpen(false);
    setError("");

    onSelectTrain(train);
  };

  const submit = (event) => {
    event.preventDefault();

    const value = query.trim();
    if (!value || loading) return;

    setOpen(false);
    setError("");

    const numbered = value.match(/^(\d{4,6})(?:\s*[·|—-].*)?$/);

    if (numbered) {
      onFindNumber(numbered[1]);
    } else if (results.length === 1) {
      chooseTrain(results[0]);
    } else if (results.length > 1) {
      setOpen(true);
    } else {
      setError("No matches found. Try a train number or a different name.");
    }
  };

  return (
    <motion.section
      className="workflow-panel train-workflow"
      initial={{ opacity: 0, y: 7 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="workflow-heading">
        <span className="workflow-icon workflow-icon-orange">
          <TrainFront size={21} />
        </span>
        <div>
          <h2>Find a train</h2>
          <p>Enter a train number or name.</p>
        </div>
      </div>

      <form className="single-train-form" onSubmit={submit} ref={root}>
        <div className="train-search-field-wrap">
          <div className="train-search-input">
            <Search size={19} />

            <input
              value={query}
              onChange={(event) => {
                selectedQuery.current = "";
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => {
                if (results.length > 0 || query.length > 1) {
                  setOpen(true);
                }
              }}
              placeholder="Train number or name"
              autoComplete="off"
              aria-label="Train number or name"
              aria-expanded={open}
              aria-autocomplete="list"
            />

            {suggesting && (
              <LoaderCircle size={17} className="spin-icon" />
            )}
          </div>

          {open && results.length > 0 && (
            <div className="autocomplete-menu train-suggestion-menu" role="listbox">
              {results.slice(0, 8).map((train) => (
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  key={train.number}
                  className="autocomplete-option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseTrain(train)}
                >
                  <span className="train-option-number">
                    {train.number}
                  </span>

                  <span className="station-option-copy">
                    <strong>{train.name}</strong>
                    <small>
                      {train.source || "Origin"}
                      {" → "}
                      {train.destination || "Destination"}
                    </small>
                  </span>

                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          className="btn-primary train-submit-button"
          disabled={loading}
        >
          {loading ? (
            <span className="spinner" />
          ) : (
            <>
              Track train
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {error && <p className="inline-error">{error}</p>}
    </motion.section>
  );
}