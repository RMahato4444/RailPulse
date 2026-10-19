import { useEffect, useMemo, useRef, useState } from "react";
import AppDownloadBanner from "./components/AppDownloadBanner.jsx";
import {
  AlertCircle,
  MapPin,
  Route,
  TrainFront,
  RefreshCw,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import EmptyState from "./components/EmptyState.jsx";
import {
  findTrainsBetween,
  getHealth,
  getNearbyTrains,
  getTrainStatus,
} from "./api/client.js";

import LocationSearch from "./components/LocationSearch.jsx";
import TrainSearch from "./components/TrainSearch.jsx";
import JourneySearch from "./components/JourneySearch.jsx";
import TrainMap from "./components/TrainMap.jsx";
import TrainCard from "./components/TrainCard.jsx";

const modes = [
  {
    id: "nearby",
    label: "Trains nearby",
    description: "District, city or PIN code",
    icon: MapPin,
  },
  {
    id: "train",
    label: "Find a train",
    description: "Train number or name",
    icon: TrainFront,
  },
  {
    id: "journey",
    label: "Between stations",
    description: "Source to destination",
    icon: Route,
  },
];

function LoadingState({ title }) {
  return (
    <div className="loading-state">
      <span className="loading-icon">
        <TrainFront size={24} />
      </span>
      <strong>{title}</strong>
    </div>
  );
}

function AlternativeRoute({ route }) {
  const legs = Array.isArray(route.legs) ? route.legs : [];

  return (
    <article className="alternate-route-card">
      <div className="alternate-route-heading">
        <Route size={18} />
        <strong>
          {route.title ||
            `Connecting route via ${route.viaName || route.via?.name || "another station"}`}
        </strong>
      </div>

      {legs.length > 0 ? (
        <div className="alternate-route-legs">
          {legs.map((leg, index) => (
            <div
              className="alternate-route-leg"
              key={`${leg.trainNumber || leg.number || "leg"}-${index}`}
            >
              <span className="alternate-leg-number">
                {leg.trainNumber || leg.number || "Train"}
              </span>
              <div>
                <strong>{leg.trainName || leg.name || "Train service"}</strong>
                <small>
                  {leg.fromName || leg.fromCode || leg.from || "Source"}
                  {" → "}
                  {leg.toName || leg.toCode || leg.to || "Destination"}
                </small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>
          {route.description || "Connecting service details were not provided."}
        </p>
      )}
    </article>
  );
}

export default function App() {
  const [mode, setMode] = useState("nearby");
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [mobileSelectedTrain, setMobileSelectedTrain] = useState(null);

  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState("");

  const [nearby, setNearby] = useState(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [journey, setJourney] = useState(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [journeyError, setJourneyError] = useState("");

  const [selectedNumber, setSelectedNumber] = useState("");

  const detailRequestRef = useRef({
    number: "",
    status: "idle",
    requestId: 0,
  });

  // Track the real CSS viewport instead of relying on the browser's
  // device-emulation zoom or the dimensions of the result cards.
  useEffect(() => {
    const media = window.matchMedia("(max-width: 860px)");

    const updateViewport = () => setIsMobile(media.matches);
    updateViewport();

    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    getHealth({ signal: controller.signal })
      .then(setHealth)
      .catch((error) => {
        if (error.name !== "AbortError") {
          setHealthError(error.message);
        }
      });

    return () => controller.abort();
  }, []);

  const activeSource =
    mode === "nearby"
      ? nearby?.source
      : mode === "journey"
        ? journey?.source
        : detail?.source;

  const sourceMode = activeSource || health?.provider?.mode || "unconfigured";

  const mapTrains = useMemo(() => {
    const found = mode === "nearby" ? [...(nearby?.trains || [])] : [];

    const candidate = detail || mobileSelectedTrain;

    if (candidate?.latitude != null && candidate?.longitude != null) {
      const existing = found.findIndex(
        (train) => String(train.trainNumber) === String(candidate.trainNumber),
      );

      if (existing >= 0) {
        found[existing] = { ...found[existing], ...candidate };
      } else {
        found.push(candidate);
      }
    }

    return found;
  }, [mode, nearby, detail, mobileSelectedTrain]);

  const chooseMode = (nextMode) => {
    setMode(nextMode);
    setMobileMapOpen(false);
    setNearbyError("");
    setDetailError("");
    setJourneyError("");
  };

  const invalidateDetailRequest = () => {
    detailRequestRef.current = {
      number: "",
      status: "idle",
      requestId: detailRequestRef.current.requestId + 1,
    };

    setDetailLoading(false);
  };

  const searchNearby = async (query, radiusKm) => {
    invalidateDetailRequest();

    setMode("nearby");
    setMobileMapOpen(false);
    setMobileSelectedTrain(null);
    setNearbyLoading(true);
    setNearbyError("");
    setDetail(null);
    setDetailError("");
    setSelectedNumber("");

    try {
      const result = await getNearbyTrains(query, radiusKm);

      result.location.shortName =
        result.location.displayName?.split(",")[0] || query;

      setNearby(result);
    } catch (error) {
      setNearbyError(error.message);
      setNearby(null);
    } finally {
      setNearbyLoading(false);
    }
  };

  const loadTrainDetails = async (
    number,
    { changeMode = false, openMobileMap = true, summary = null } = {},
  ) => {
    if (
      number === null ||
      number === undefined ||
      String(number).trim() === ""
    ) {
      return;
    }

    const key = String(number).trim();

    if (changeMode) setMode("train");

    // Open the mobile map immediately. The existing card supplies the
    // compact label while the live-status request is loading.
    if (summary) setMobileSelectedTrain(summary);

    if (isMobile && openMobileMap) {
      setMobileMapOpen(true);
    }

    if (selectedNumber === key && String(detail?.trainNumber ?? "") === key) {
      return;
    }

    const previous = detailRequestRef.current;

    if (previous.number === key && previous.status === "loading") {
      return;
    }

    const requestId = previous.requestId + 1;

    detailRequestRef.current = {
      number: key,
      status: "loading",
      requestId,
    };

    setDetailLoading(true);
    setDetailError("");
    setSelectedNumber(key);

    try {
      const result = await getTrainStatus(key);

      if (detailRequestRef.current.requestId !== requestId) {
        return;
      }

      setDetail(result.train);
      setMobileSelectedTrain(result.train);

      detailRequestRef.current = {
        number: key,
        status: "loaded",
        requestId,
      };
    } catch (error) {
      if (detailRequestRef.current.requestId !== requestId) {
        return;
      }

      setDetail(null);
      setDetailError(error.message);

      detailRequestRef.current = {
        number: key,
        status: "idle",
        requestId,
      };
    } finally {
      if (detailRequestRef.current.requestId === requestId) {
        setDetailLoading(false);
      }
    }
  };

  const trackFromCard = (train) =>
    loadTrainDetails(train?.trainNumber || train?.number, {
      summary: train,
      openMobileMap: true,
    });

  const searchByNumber = (number) =>
    loadTrainDetails(number, {
      changeMode: true,
      openMobileMap: true,
      summary: {
        trainNumber: String(number),
        trainName: `Train ${number}`,
      },
    });

  const selectTrainSuggestion = (train) =>
    loadTrainDetails(train.number, {
      changeMode: true,
      openMobileMap: true,
      summary: train,
    });

  const searchJourney = async (from, to, date) => {
    invalidateDetailRequest();

    setMode("journey");
    setMobileMapOpen(false);
    setMobileSelectedTrain(null);
    setJourneyLoading(true);
    setJourneyError("");
    setJourney(null);
    setDetail(null);
    setDetailError("");
    setSelectedNumber("");

    try {
      setJourney(await findTrainsBetween(from, to, date));
    } catch (error) {
      setJourneyError(error.message);
    } finally {
      setJourneyLoading(false);
    }
  };

  const clearDetail = () => {
    invalidateDetailRequest();
    setDetail(null);
    setMobileSelectedTrain(null);
    setSelectedNumber("");
    setDetailError("");
    setMobileMapOpen(false);
  };

  const healthLabel = health?.success
    ? "Server connected"
    : healthError
      ? "Server unavailable"
      : "Connecting…";

  const statusLabel =
    activeSource === "live"
      ? "RailRadar data"
      : health?.provider?.configured
        ? "RailRadar configured"
        : "Provider not configured";

  const alternatives = Array.isArray(journey?.alternatives)
    ? journey.alternatives
    : [];

  const directTrains = Array.isArray(journey?.trains) ? journey.trains : [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          type="button"
          onClick={() => chooseMode("nearby")}
          aria-label="RailPulse home"
        >
          <span className="brand-icon">
            <TrainFront size={25} strokeWidth={2.2} />
          </span>

          <span className="brand-wordmark">
            <strong>
              rail<span>pulse</span>
            </strong>
            <small>INDIA RAIL EXPLORER</small>
          </span>
        </button>

        <div className="sidebar-section-label">SEARCH TRAINS</div>

        <nav className="sidebar-nav" aria-label="Train search options">
          {modes.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-link ${
                  mode === item.id ? "sidebar-link-active" : ""
                }`}
                onClick={() => chooseMode(item.id)}
                aria-current={mode === item.id ? "page" : undefined}
              >
                <span className="sidebar-link-icon">
                  <Icon size={21} />
                </span>

                <span className="sidebar-link-text">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>

                {mode === item.id && <span className="sidebar-active-bar" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span
              className={
                health?.success ? "status-led" : "status-led status-led-off"
              }
            />

            <div>
              <strong>{healthLabel}</strong>
              <small>{statusLabel}</small>
            </div>

            <button
              type="button"
              className="status-refresh"
              title="Refresh connection status"
              aria-label="Refresh connection status"
              onClick={() =>
                getHealth()
                  .then(setHealth)
                  .catch((error) => setHealthError(error.message))
              }
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <main className="content-wrap">
          <section className="page-heading">
            <div>
              <h1>Find trains</h1>
              <p className="page-subtitle">
                Search nearby trains, a train number, or a journey between
                stations.
              </p>
            </div>
          </section>
          
          <AppDownloadBanner />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              className="search-form-slot"
              initial={{ opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
            >
              {mode === "nearby" && (
                <LocationSearch
                  loading={nearbyLoading}
                  onSearch={searchNearby}
                />
              )}

              {mode === "train" && (
                <TrainSearch
                  loading={detailLoading}
                  onFindNumber={searchByNumber}
                  onSelectTrain={selectTrainSuggestion}
                />
              )}

              {mode === "journey" && (
                <JourneySearch
                  loading={journeyLoading}
                  onSearch={searchJourney}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {(nearbyError || detailError || journeyError) && (
            <div className="alert-box" role="alert">
              <AlertCircle size={20} />
              <span>{nearbyError || detailError || journeyError}</span>
              <button
                type="button"
                onClick={() => {
                  setNearbyError("");
                  setDetailError("");
                  setJourneyError("");
                }}
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="content-grid">
            <section className="results-panel">
              {mode === "nearby" && (
                <>
                  <div className="panel-heading">
                    <div>
                      <h2>
                        {nearby
                          ? `${nearby.count} train${nearby.count === 1 ? "" : "s"} found`
                          : "Nearby trains"}
                      </h2>
                      <p>
                        {nearby
                          ? `${nearby.location.shortName || nearby.location.displayName} · ${nearby.radiusKm} km radius`
                          : "Search a place to see reported trains."}
                      </p>
                    </div>

                    {nearby && (
                      <span className="count-chip">{nearby.radiusKm} km</span>
                    )}
                  </div>

                  <div className="results-body-scroll">
                    {nearbyLoading ? (
                      <LoadingState title="Searching nearby trains…" />
                    ) : nearby?.trains?.length ? (
                      <div className="train-results-list">
                        {nearby.trains.map((train) => (
                          <TrainCard
                            key={train.trainNumber}
                            train={train}
                            selected={
                              selectedNumber === String(train.trainNumber)
                            }
                            onClick={() => trackFromCard(train)}
                            onClose={clearDetail}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={MapPin}
                        title={nearby ? "No trains found" : "Search a location"}
                        description={
                          nearby
                            ? "Try a larger radius or another nearby place."
                            : "Enter a district, city, locality or PIN code above."
                        }
                      />
                    )}
                  </div>
                </>
              )}

              {mode === "train" && (
                <>
                  <div className="panel-heading">
                    <div>
                      <h2>{detail ? "Selected train" : "Train details"}</h2>
                      <p>
                        {detail
                          ? `Train ${detail.trainNumber}`
                          : "Search by train number or name above."}
                      </p>
                    </div>
                  </div>

                  <div className="results-body-scroll">
                    {detailLoading ? (
                      <LoadingState title="Loading train…" />
                    ) : detail ? (
                      <div className="train-results-list train-results-list-single">
                        <TrainCard
                          train={detail}
                          selected
                          onClick={() =>
                            loadTrainDetails(detail.trainNumber, {
                              openMobileMap: true,
                              summary: detail,
                            })
                          }
                          onClose={clearDetail}
                        />
                      </div>
                    ) : (
                      <EmptyState
                        icon={TrainFront}
                        title="Find a train"
                        description="Enter its number or name in the search box."
                      />
                    )}
                  </div>
                </>
              )}

              {mode === "journey" && (
                <>
                  <div className="panel-heading">
                    <div>
                      <h2>
                        {journey
                          ? directTrains.length
                            ? `${directTrains.length} train${directTrains.length === 1 ? "" : "s"} found`
                            : "No direct trains found"
                          : "Journey results"}
                      </h2>

                      <p>
                        {journey
                          ? `${journey.fromName || journey.fromCode} → ${journey.toName || journey.toCode}${journey.date ? ` · ${journey.date}` : ""}`
                          : "Choose a source and destination."}
                      </p>
                    </div>
                  </div>

                  <div className="results-body-scroll">
                    {journeyLoading ? (
                      <LoadingState title="Finding trains…" />
                    ) : directTrains.length > 0 ? (
                      <div className="train-results-list">
                        {directTrains.map((train, index) => (
                          <TrainCard
                            key={`${train.trainNumber}-${index}`}
                            train={train}
                            variant="journey"
                            travelDate={journey?.date || null}
                            selected={
                              selectedNumber === String(train.trainNumber)
                            }
                            onClick={() => trackFromCard(train)}
                            onClose={clearDetail}
                          />
                        ))}
                      </div>
                    ) : journey ? (
                      <div className="journey-no-direct">
                        <EmptyState
                          icon={Route}
                          title="No direct trains found"
                          description="There is no direct service in the returned results."
                        />

                        {alternatives.length > 0 ? (
                          <div className="alternate-route-list">
                            <h3>Alternative connections</h3>
                            {alternatives.map((route, index) => (
                              <AlternativeRoute
                                key={
                                  route.id ||
                                  `${route.viaCode || route.viaName || "via"}-${index}`
                                }
                                route={route}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="alternate-route-note">
                            No connecting options were returned by the server
                            for this journey.
                          </p>
                        )}
                      </div>
                    ) : (
                      <EmptyState
                        icon={Route}
                        title="Plan a journey"
                        description="Select both stations above to compare services."
                      />
                    )}
                  </div>
                </>
              )}
            </section>

            <TrainMap
              trains={mapTrains}
              location={mode === "nearby" ? nearby?.location || null : null}
              radiusKm={nearby?.radiusKm || 50}
              selectedNumber={selectedNumber}
              onSelect={trackFromCard}
              source={activeSource || "unconfigured"}
              routeTrain={detail}
              mobileSelectedTrain={mobileSelectedTrain}
              mobileOpen={mobileMapOpen}
              onCloseMobileMap={() => setMobileMapOpen(false)}
              onCloseDetail={clearDetail}
              title={
                detail
                  ? detail.trainName
                  : mode === "nearby" && nearby
                    ? `Trains near ${nearby.location.shortName || nearby.location.displayName?.split(",")[0]}`
                    : mode === "journey" && journey
                      ? "Journey map"
                      : "Train map"
              }
            />
          </div>
        </main>
      </div>
    </div>
  );
}
