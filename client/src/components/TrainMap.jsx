import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  ChevronDown,
  ChevronUp,
  LocateFixed,
  Maximize2,
  Minimize2,
  Navigation,
  TrainFront,
  X,
} from "lucide-react";

import TrainDetail from "./TrainDetail.jsx";
import { getCurrentRouteIndex } from "../utils/trainRoute.js";

const INDIA_CENTER = [22.7, 79.1];

function validCoord(lat, lng) {
  if (lat == null || lng == null || lat === "" || lng === "") {
    return false;
  }

  const latitude = Number(lat);
  const longitude = Number(lng);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

function makeTrainIcon(selected, status, bearing = null) {
  const palette =
    status === "delayed"
      ? { body: "#E96B53", glass: "#FFE4DB", trim: "#A83F2D" }
      : { body: "#3978F6", glass: "#DDF2FF", trim: "#244FC7" };

  const rawBearing =
    bearing == null || bearing === "" ? NaN : Number(bearing);

  const rotation = Number.isFinite(rawBearing)
    ? (rawBearing + 180) % 360
    : 0;

  const html = `
    <div class="train-marker-top ${
      selected ? "train-marker-top-selected" : ""
    }" style="
      --train-body:${palette.body};
      --train-glass:${palette.glass};
      --train-trim:${palette.trim};
      --train-rotation:${rotation}deg
    ">
      <span class="train-marker-halo"></span>
      <svg class="train-top-svg" width="30" height="46"
        viewBox="0 0 40 64" xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true">
        <ellipse cx="20" cy="34" rx="14" ry="27"
          fill="#173047" opacity=".12"/>
        <path d="M8 18Q8 5 20 4Q32 5 32 18V48Q32 56 25 59H15Q8 56 8 48Z"
          fill="var(--train-body)" stroke="#fff" stroke-width="2.2"/>
        <path d="M11 17Q11 8 20 8Q29 8 29 17V22H11Z"
          fill="var(--train-glass)" stroke="#fff" stroke-width="1.2"/>
        <path d="M13 14Q20 10 27 14L25 19H15Z"
          fill="#2F5364" opacity=".85"/>
        <path d="M11 27H29M11 43H29"
          stroke="#fff" stroke-width="2" opacity=".9"/>
        <rect x="12" y="31" width="5" height="8" rx="1.5"
          fill="var(--train-glass)"/>
        <rect x="23" y="31" width="5" height="8" rx="1.5"
          fill="var(--train-glass)"/>
        <path d="M13 48H27L25 53H15Z" fill="var(--train-trim)"/>
        <circle cx="10" cy="24" r="2" fill="#263C51"/>
        <circle cx="30" cy="24" r="2" fill="#263C51"/>
        <circle cx="10" cy="44" r="2" fill="#263C51"/>
        <circle cx="30" cy="44" r="2" fill="#263C51"/>
        <path d="M16 3L20 0L24 3" fill="none" stroke="#fff"
          stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>`;

  return L.divIcon({
    className: "railpulse-train-marker",
    html,
    iconSize: selected ? [44, 60] : [32, 48],
    iconAnchor: selected ? [22, 30] : [16, 24],
    tooltipAnchor: [0, -22],
  });
}

const locationIcon = L.divIcon({
  className: "railpulse-place-marker",
  html: '<span class="place-marker-pin"><span></span></span>',
  iconSize: [28, 36],
  iconAnchor: [14, 32],
});

function MapResizeFixer({ visible }) {
  const map = useMap();

  useEffect(() => {
    const resize = () => map.invalidateSize({ pan: false });
    const frame = requestAnimationFrame(resize);
    const container = map.getContainer();

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(resize);

    observer?.observe(container);
    window.addEventListener("resize", resize);

    const timer = window.setTimeout(resize, 220);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [map, visible]);

  return null;
}

function MapController({
  location,
  trains,
  routePoints,
  routeTrain,
  visible,
  mobileOpen,
}) {
  const map = useMap();

  const signature = [
    location?.lat ?? "",
    location?.lon ?? "",
    trains
      .map((train) =>
        `${train.trainNumber}-${train.latitude}-${train.longitude}`
      )
      .join(","),
    routePoints.map((point) => point.join(",")).join(";"),
    routeTrain?.trainNumber ?? "",
    routeTrain?.latitude ?? "",
    routeTrain?.longitude ?? "",
    visible ? "visible" : "hidden",
  ].join(":");

  useEffect(() => {
    const coordinates = [];

    if (routePoints.length > 1) {
      coordinates.push(...routePoints);
    }

    if (location && validCoord(location.lat, location.lon)) {
      coordinates.push([Number(location.lat), Number(location.lon)]);
    }

    trains.forEach((train) => {
      if (validCoord(train.latitude, train.longitude)) {
        coordinates.push([
          Number(train.latitude),
          Number(train.longitude),
        ]);
      }
    });

    if (
      routeTrain &&
      validCoord(routeTrain.latitude, routeTrain.longitude)
    ) {
      coordinates.push([
        Number(routeTrain.latitude),
        Number(routeTrain.longitude),
      ]);
    }

    if (coordinates.length > 1) {
      const sidePadding =
        visible && routeTrain && !mobileOpen
          ? Math.min(400, Math.round(window.innerWidth * 0.34))
          : 36;

      map.fitBounds(coordinates, {
        paddingTopLeft: [30, 30],
        paddingBottomRight: [sidePadding, 30],
        maxZoom: visible ? 12 : 11,
        animate: true,
        duration: 0.3,
      });
    } else if (coordinates.length === 1) {
      map.setView(coordinates[0], 10, {
        animate: true,
        duration: 0.3,
      });
    } else {
      map.setView(INDIA_CENTER, visible ? 5 : 4.6, {
        animate: true,
        duration: 0.3,
      });
    }
  }, [signature, map, visible, mobileOpen, routePoints, trains, location, routeTrain]);

  return null;
}

export default function TrainMap({
  trains = [],
  location = null,
  radiusKm = 50,
  selectedNumber = null,
  onSelect = () => {},
  source = "unconfigured",
  routeTrain = null,
  mobileSelectedTrain = null,
  mobileOpen = false,
  onCloseMobileMap = () => {},
  onCloseDetail = () => {},
  title = "Train map",
}) {
  const [expanded, setExpanded] = useState(false);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);

  const overlayOpen = expanded || mobileOpen;
  const mobileTrain = routeTrain || mobileSelectedTrain;

  useEffect(() => {
    if (mobileOpen) {
      setMobileDetailsOpen(false);
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (!overlayOpen) return undefined;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (mobileOpen) onCloseMobileMap();
        else setExpanded(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [overlayOpen, mobileOpen]);

  const points = useMemo(
    () => trains.filter((train) =>
      validCoord(train.latitude, train.longitude)
    ),
    [trains]
  );

  const routeStops = useMemo(
    () =>
      (Array.isArray(routeTrain?.route) ? routeTrain.route : [])
        .filter((stop) =>
          validCoord(
            stop.lat ?? stop.latitude,
            stop.lng ?? stop.longitude
          )
        )
        .map((stop) => ({
          ...stop,
          lat: Number(stop.lat ?? stop.latitude),
          lng: Number(stop.lng ?? stop.longitude),
        })),
    [routeTrain]
  );

  const routePoints = useMemo(
    () => routeStops.map((stop) => [stop.lat, stop.lng]),
    [routeStops]
  );

  const currentRouteIndex = useMemo(
    () => getCurrentRouteIndex(routeStops, routeTrain),
    [routeStops, routeTrain]
  );

  const otherRoutes = useMemo(
    () =>
      points
        .filter((train) =>
          String(train.trainNumber) !== String(routeTrain?.trainNumber)
        )
        .map((train) => ({
          train,
          stops: (Array.isArray(train.route) ? train.route : [])
            .filter((stop) =>
              validCoord(
                stop.lat ?? stop.latitude,
                stop.lng ?? stop.longitude
              )
            )
            .map((stop) => [
              Number(stop.lat ?? stop.latitude),
              Number(stop.lng ?? stop.longitude),
            ]),
        }))
        .filter((item) => item.stops.length > 1),
    [points, routeTrain]
  );

  const routeColor =
    Number(routeTrain?.delayMinutes || 0) > 10
      ? "#E96B53"
      : "#3978F6";

  const sourceLabel =
    source === "live"
      ? "LIVE"
      : source === "demo"
        ? "DEMO"
        : "OFFLINE";

  const mapCard = (
    <section
      className={[
        "map-card",
        overlayOpen ? "map-card-expanded" : "",
        mobileOpen ? "map-card-mobile-view" : "",
      ].filter(Boolean).join(" ")}
      aria-label="Train map"
    >
      <div className="map-card-top">
        <div className="map-heading-copy">
          <p className="panel-eyebrow">MAP</p>
          <h2>{title}</h2>
          <p>
            {routeTrain
              ? "Current position and journey stations"
              : location
                ? `Trains within ${radiusKm} km`
                : "Train positions and route"}
          </p>
        </div>

        <div className="map-actions">
          <span className={`map-status ${source === "live" ? "map-status-live" : ""}`}>
            <span />
            {sourceLabel}
          </span>

          {mobileOpen ? (
            <button
              type="button"
              className="mobile-map-close"
              onClick={onCloseMobileMap}
              aria-label="Close map and return to trains"
              title="Close map"
            >
              <X size={21} />
            </button>
          ) : (
            <button
              type="button"
              className="map-tool-button"
              onClick={() => setExpanded((value) => !value)}
              aria-label={expanded ? "Minimize map" : "Expand map"}
              title={expanded ? "Minimize map" : "Expand map"}
            >
              {expanded
                ? <Minimize2 size={18} />
                : <Maximize2 size={18} />}
            </button>
          )}
        </div>
      </div>

      <div className="map-viewport">
        <MapContainer
          center={INDIA_CENTER}
          zoom={4.6}
          minZoom={3}
          maxZoom={17}
          zoomControl={false}
          scrollWheelZoom
          className="rail-map-v2"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <ZoomControl position="bottomright" />

          <MapResizeFixer visible={overlayOpen} />

          <MapController
            location={location}
            trains={points}
            routePoints={routePoints}
            routeTrain={routeTrain}
            visible={overlayOpen}
            mobileOpen={mobileOpen}
          />

          {location && validCoord(location.lat, location.lon) && (
            <>
              <Circle
                center={[Number(location.lat), Number(location.lon)]}
                radius={Number(radiusKm) * 1000}
                pathOptions={{
                  color: "#7565F2",
                  fillColor: "#92AFFF",
                  fillOpacity: 0.06,
                  weight: 2,
                  dashArray: "7 7",
                }}
              />

              <Marker
                position={[Number(location.lat), Number(location.lon)]}
                icon={locationIcon}
              >
                <Tooltip direction="top">
                  <strong>{location.displayName || location.query}</strong>
                  <br />
                  Search centre
                </Tooltip>
              </Marker>
            </>
          )}

          {otherRoutes.map(({ train, stops }) => (
            <Polyline
              key={`route-${train.trainNumber}`}
              positions={stops}
              pathOptions={{
                color: "#5E8EF2",
                weight: 3,
                opacity: 0.42,
                lineCap: "round",
                lineJoin: "round",
                dashArray: "4 7",
              }}
            />
          ))}

          {routePoints.length > 1 && (
            <>
              <Polyline
                positions={routePoints}
                pathOptions={{
                  color: "#fff",
                  weight: 10,
                  opacity: 0.95,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />

              {currentRouteIndex > 0 && (
                <Polyline
                  positions={routePoints.slice(
                    0,
                    Math.min(currentRouteIndex + 1, routePoints.length)
                  )}
                  pathOptions={{
                    color: "#2F6BEA",
                    weight: 6,
                    opacity: 1,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                />
              )}

              {currentRouteIndex >= 0 &&
                currentRouteIndex < routePoints.length - 1 && (
                  <Polyline
                    positions={routePoints.slice(currentRouteIndex)}
                    pathOptions={{
                      color: "#8066E8",
                      weight: 6,
                      opacity: 0.96,
                      lineCap: "round",
                      lineJoin: "round",
                      dashArray: "7 5",
                    }}
                  />
                )}

              {currentRouteIndex < 0 && (
                <Polyline
                  positions={routePoints}
                  pathOptions={{
                    color: routeColor,
                    weight: 5,
                    opacity: 0.98,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                />
              )}

              {routeStops.map((stop, index) => {
                const isCurrent = index === currentRouteIndex;
                const isPast =
                  currentRouteIndex >= 0 && index < currentRouteIndex;

                const fillColor = isCurrent
                  ? "#8066E8"
                  : isPast
                    ? "#2F6BEA"
                    : currentRouteIndex >= 0
                      ? "#A9BBFF"
                      : index === 0
                        ? "#7565F2"
                        : index === routeStops.length - 1
                          ? "#39B7F2"
                          : "#6E9AF7";

                return (
                  <CircleMarker
                    key={`${stop.stationCode || stop.stationName || "station"}-${index}`}
                    center={[stop.lat, stop.lng]}
                    radius={isCurrent ? 8 : 5}
                    pathOptions={{
                      color: "#fff",
                      weight: isCurrent ? 3 : 2,
                      fillColor,
                      fillOpacity: 1,
                    }}
                  >
                    <Tooltip direction="top">
                      <strong>
                        {stop.stationName || stop.stationCode || "Station"}
                        {isCurrent ? " · CURRENT TRAIN POSITION" : ""}
                      </strong>
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </>
          )}

          {points.map((train) => (
            <Marker
              key={train.trainNumber}
              position={[Number(train.latitude), Number(train.longitude)]}
              icon={makeTrainIcon(
                String(train.trainNumber) === String(selectedNumber),
                train.status,
                train.bearingDegrees ?? train.bearing
              )}
              eventHandlers={{
                click: () => onSelect(train),
              }}
            >
              <Tooltip direction="top" offset={[0, -16]} opacity={1}>
                <div className="map-tooltip-v2">
                  <strong>{train.trainNumber} · {train.trainName}</strong>
                  <span>{train.currentStation || "Latest position report"}</span>
                  {train.nextStation && <small>Next: {train.nextStation}</small>}
                </div>
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>

        {points.length === 0 && routePoints.length < 2 && (
          <div className="map-empty-overlay">
            <span className="map-empty-icon">
              <TrainFront size={27} />
            </span>
            <strong>
              {location ? "No train positions available" : "Your train map"}
            </strong>
            <span>
              {location
                ? "No reported train coordinates were returned for this search."
                : "Search for trains to show their reported positions and available routes."}
            </span>
          </div>
        )}

        {routeTrain && routePoints.length < 2 && (
          <div className="route-unavailable-note">
            Route stations with coordinates are not available for this train.
          </div>
        )}

        <div className="map-legend">
          <span><i className="legend-current-train" /> Selected train</span>
          <span><i className="legend-route-line legend-route-past" /> Covered route</span>
          <span><i className="legend-route-line legend-route-future" /> Remaining route</span>
          {location && <span><i className="legend-radius" /> Search radius</span>}
        </div>

        <div className="map-coordinate-label">
          <Navigation size={14} />
          {routeTrain?.currentStation ||
            (location ? location.displayName?.split(",")[0] : "India")}
        </div>

        {mobileOpen && mobileTrain && !mobileDetailsOpen && (
          <button
            type="button"
            className="mobile-train-peek"
            onClick={() => setMobileDetailsOpen(true)}
            aria-label={`Show details for train ${mobileTrain.trainNumber}`}
          >
            <span className="mobile-train-peek-icon">
              <TrainFront size={21} />
            </span>

            <span className="mobile-train-peek-copy">
              <strong>TRAIN {mobileTrain.trainNumber || mobileTrain.number}</strong>
              <span>
                {mobileTrain.trainName || mobileTrain.name || "Train details"}
              </span>
            </span>

            <ChevronUp size={20} />
          </button>
        )}

        {mobileOpen && mobileDetailsOpen && (
          <div className="map-floating-detail mobile-detail-drawer">
            <button
              type="button"
              className="mobile-detail-minimize"
              onClick={() => setMobileDetailsOpen(false)}
            >
              <ChevronDown size={17} />
              Minimize details
            </button>

            {routeTrain ? (
              <TrainDetail
                key={routeTrain.trainNumber}
                train={routeTrain}
                onClose={() => setMobileDetailsOpen(false)}
              />
            ) : (
              <div className="mobile-detail-loading">
                <span className="loading-icon">
                  <TrainFront size={23} />
                </span>
                <strong>Loading train details…</strong>
                <span>Keep this map open while the running report loads.</span>
              </div>
            )}
          </div>
        )}

        {!mobileOpen && routeTrain && (
          <div className="map-floating-detail">
            <TrainDetail
              key={routeTrain.trainNumber}
              train={routeTrain}
              onClose={onCloseDetail}
            />
          </div>
        )}
      </div>

      <div className="map-card-footer">
        <span>
          <LocateFixed size={16} />
          {points.length} train position{points.length === 1 ? "" : "s"}
        </span>

        <span>
          {source === "demo"
            ? "Illustrative demo positions"
            : "© OpenStreetMap contributors"}
        </span>
      </div>
    </section>
  );

  if (!overlayOpen) return mapCard;

  return createPortal(
    <div className={`map-expanded-layer ${mobileOpen ? "mobile-map-layer" : ""}`}>
      <button
        type="button"
        className="map-expanded-backdrop"
        onClick={mobileOpen ? onCloseMobileMap : () => setExpanded(false)}
        aria-label={mobileOpen ? "Close map" : "Minimize map"}
        tabIndex={-1}
      />

      {mapCard}
    </div>,
    document.body
  );
}