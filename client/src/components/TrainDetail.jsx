import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Gauge,
  MapPin,
  Navigation,
  TrainFront,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  getCurrentRouteIndex,
  isRouteStopCurrent,
} from '../utils/trainRoute.js';

function dateTimeIST(value, compact = false) {
  if (value === null || value === undefined || value === '') {
    return 'Time not reported';
  }

  if (
    typeof value === 'string' &&
    /^\d{1,2}:\d{2}(:\d{2})?$/.test(value.trim())
  ) {
    return `${value.trim().slice(0, 5)} IST`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: compact ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const get = (type) =>
    parts.find((part) => part.type === type)?.value || '';

  const dateLabel = [get('day'), get('month'), get('year')]
    .filter(Boolean)
    .join(' ');

  return `${dateLabel} · ${get('hour')}:${get('minute')} IST`;
}

function stationTime(stop) {
  const raw =
    stop.actualDeparture ||
    stop.actualArrival ||
    stop.scheduledDeparture ||
    stop.scheduledArrival ||
    stop.departureTime ||
    stop.arrivalTime ||
    stop.time;

  return dateTimeIST(raw, true);
}

export default function TrainDetail({ train, onClose }) {
  const [showAllStops, setShowAllStops] = useState(false);

  const route = useMemo(
    () => (Array.isArray(train?.route) ? train.route : []),
    [train?.route]
  );

  const currentIndex = useMemo(
    () => getCurrentRouteIndex(route, train),
    [route, train]
  );

  const delay = Number(train?.delayMinutes);

  const reportedAt =
    train?.updatedAt ||
    train?.lastUpdated ||
    train?.reportedAt ||
    train?.updated_at;

  const formattedReport = dateTimeIST(reportedAt);

  const visibleStops = useMemo(() => {
    if (showAllStops) {
      return route.map((stop, originalIndex) => ({
        stop,
        originalIndex,
      }));
    }

    if (currentIndex > 4) {
      const start = Math.max(0, currentIndex - 2);

      return route
        .slice(start, Math.min(route.length, currentIndex + 3))
        .map((stop, offset) => ({
          stop,
          originalIndex: start + offset,
        }));
    }

    return route
      .slice(0, 5)
      .map((stop, originalIndex) => ({
        stop,
        originalIndex,
      }));
  }, [route, showAllStops, currentIndex]);

  if (!train) return null;

  const sourceLabel =
    train.source === 'live' ? 'Live provider report' : 'Demo record';

  return (
    <motion.section
      className="train-detail-card map-train-detail"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
      aria-label={`Details for train ${train.trainNumber}`}
    >
      <div className="detail-header detail-header-sticky">
        <span className="detail-train-icon">
          <TrainFront size={25} />
        </span>

        <div className="detail-heading-copy">
          <span className="detail-number">
            TRAIN {train.trainNumber}
          </span>

          <h3>{train.trainName || `Train ${train.trainNumber}`}</h3>

          <p>
            {train.trainType || 'Passenger service'}
            <span> · </span>
            {sourceLabel}
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            className="detail-close"
            onClick={onClose}
            aria-label="Close train details"
            title="Close train details"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="current-station-block">
        <span className="current-station-icon">
          <MapPin size={19} />
        </span>

        <div>
          <small>CURRENT POSITION</small>
          <strong>
            {train.currentStation || 'Station not reported'}
          </strong>

          <span>
            <Clock3 size={14} />
            Last reported: {formattedReport}
          </span>
        </div>
      </div>

      <div className="detail-metric-grid">
        <div className="detail-metric">
          <span className="metric-icon metric-blue">
            <Navigation size={18} />
          </span>
          <div>
            <small>NEXT STOP</small>
            <strong>{train.nextStation || 'Not reported'}</strong>
          </div>
        </div>

        <div className="detail-metric">
          <span className="metric-icon metric-green">
            <Gauge size={18} />
          </span>
          <div>
            <small>REPORTED SPEED</small>
            <strong>
              {train.speedKmh == null
                ? 'Not reported'
                : `${Math.round(Number(train.speedKmh))} km/h`}
            </strong>
          </div>
        </div>

        <div className="detail-metric">
          <span className="metric-icon metric-orange">
            <Clock3 size={18} />
          </span>
          <div>
            <small>DELAY</small>
            <strong className={delay > 10 ? 'text-late' : ''}>
              {train.delayMinutes == null
                ? 'Not reported'
                : delay <= 0
                  ? 'On time'
                  : `${delay} minutes`}
            </strong>
          </div>
        </div>
      </div>

      {route.length > 0 && (
        <div className="route-stop-list">
          <div className="route-stop-list-heading">
            <span>
              <Activity size={18} />
              Journey stations
            </span>
            <span>{route.length} stops</span>
          </div>

          {currentIndex < 0 && (
            <p className="route-position-note">
              Current station has not been matched to a route stop.
              Times and station order are shown as reported.
            </p>
          )}

          {!showAllStops && currentIndex > 4 && (
            <p className="route-position-note">
              Showing the stops around the current position.
            </p>
          )}

          <div className="route-stop-items">
            {visibleStops.map(({ stop, originalIndex }) => {
              const current = isRouteStopCurrent(
                stop,
                originalIndex,
                currentIndex
              );

              const stopStatus = String(stop.status || '').toLowerCase();

              const past =
                stopStatus === 'departed' ||
                stopStatus === 'passed' ||
                (currentIndex >= 0 &&
                  originalIndex < currentIndex &&
                  !current);

              const stateClass = current
                ? 'route-stop-current'
                : past
                  ? 'route-stop-past'
                  : 'route-stop-future';

              return (
                <div
                  className={`route-stop ${stateClass}`}
                  key={`${
                    stop.stationCode ||
                    stop.stationName ||
                    stop.name
                  }-${originalIndex}`}
                  aria-current={current ? 'location' : undefined}
                >
                  {/* Dedicated timeline column fixes dot/line alignment. */}
                  <span
                    className="route-stop-timeline"
                    aria-hidden="true"
                  >
                    <span className="route-stop-dot">
                      {current && <span />}
                    </span>
                  </span>

                  <div className="route-stop-copy">
                    <strong>
                      {stop.stationName || stop.name || 'Station'}
                    </strong>

                    {stop.stationCode && (
                      <small>{stop.stationCode}</small>
                    )}

                    {current && (
                      <span className="route-stop-current-label">
                        <CheckCircle2 size={12} />
                        CURRENT POSITION
                      </span>
                    )}
                  </div>

                  <span className="route-stop-time">
                    {stationTime(stop)}
                  </span>
                </div>
              );
            })}
          </div>

          {route.length > 5 && (
            <button
              type="button"
              className="show-stops-button"
              onClick={() => setShowAllStops((value) => !value)}
            >
              {showAllStops ? (
                <>
                  Show less <ChevronUp size={16} />
                </>
              ) : (
                <>
                  Show all {route.length} stops
                  <ChevronDown size={16} />
                </>
              )}
            </button>
          )}
        </div>
      )}
    </motion.section>
  );
}