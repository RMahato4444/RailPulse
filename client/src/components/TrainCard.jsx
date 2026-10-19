import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Gauge,
  MapPin,
  Navigation,
  TrainFront,
  X,
} from 'lucide-react';
import {
  getJourneyStatus,
  getOperatingDays,
  getTodayIST,
} from '../utils/trainSchedule.js';

function formatDelay(delay) {
  if (delay === null || delay === undefined ||
      !Number.isFinite(Number(delay))) {
    return 'Delay unavailable';
  }

  if (Number(delay) <= 0) return 'On time';
  return `${Number(delay)} min late`;
}

function ServiceDays({ train }) {
  const operation = getOperatingDays(train);
  const today = getTodayIST();
  const runsToday = operation.daily || operation.days.includes(today);

  return (
    <div className="train-operating-days" aria-label="Train operating days">
      <span className="service-days-label">
        <CalendarDays size={13} /> Runs
      </span>

      <div className="service-days-list">
        {operation.daily ? (
          <span className="service-day-daily">Daily</span>
        ) : operation.known ? (
          operation.days.map((day) => (
            <span
              key={day}
              className={`service-day-chip ${
                day === today ? 'service-day-chip-today' : ''
              }`}
              title={day === today ? `${day}, today in India` : `Runs on ${day}`}
            >
              {day}
              {day === today && <small>TODAY</small>}
            </span>
          ))
        ) : (
          <span className="service-days-unknown">Not provided</span>
        )}

        {((!operation.daily && operation.known && !runsToday) ||
          operation.daily) && (
          <span
            className={`service-today-chip ${
              runsToday ? 'service-today-active' : 'service-today-off'
            }`}
          >
            <strong>{today}</strong>
            <small>
              {runsToday ? 'TODAY' : 'TODAY · NO SERVICE'}
            </small>
          </span>
        )}

        {!operation.known && (
          <span className="service-today-chip service-today-neutral">
            <strong>{today}</strong>
            <small>TODAY</small>
          </span>
        )}
      </div>
    </div>
  );
}

function JourneyStatus({ status }) {
  const Icon =
    status.state === 'running'
      ? CheckCircle2
      : status.state === 'not-started'
        ? CircleDashed
        : Clock3;

  return (
    <span className={`train-journey-status train-journey-status-${status.state}`}>
      <Icon size={14} aria-hidden="true" />
      {status.label}

      {status.source === 'schedule' &&
        status.state === 'schedule-window' && (
          <small>ESTIMATED</small>
        )}
    </span>
  );
}

/**
 * Shared card for Nearby Trains, Find a Train, and Between Stations.
 * Keep the card layout here so it remains consistent across all modes.
 */
export default function TrainCard({
  train,
  selected = false,
  onClick,
  onClose,
  variant = 'nearby',
  travelDate = null,
}) {
  const number = train.trainNumber || train.number;
  const name = train.trainName || train.name || `Train ${number}`;
  const isJourney = variant === 'journey';
  const delay = train.delayMinutes;

  const journeyStatus = isJourney
    ? getJourneyStatus(train, travelDate)
    : null;

  const statusClass = isJourney
    ? `train-result-item-${journeyStatus.state}`
    : `train-result-item-${String(train.status || 'running').toLowerCase()}`;

  return (
    <article
      className={`train-result-item ${statusClass} ${
        selected ? 'train-result-item-selected' : ''
      }`}
      data-train-number={number}
      data-selected={selected ? 'true' : 'false'}
    >
      <button
        type="button"
        className={`train-result-card ${
          selected ? 'train-result-selected' : ''
        }`}
        onClick={onClick}
        aria-pressed={selected}
        aria-label={`Show details for ${name}, train ${number}`}
      >
        <span className="train-card-mark" aria-hidden="true">
          <TrainFront size={21} />
        </span>

        <span className="train-card-main">
          <span className="train-card-title-row">
            <span className="train-number">{number}</span>
            <span className="train-type-chip">
              {train.trainType || 'Train'}
            </span>

            {train.source === 'demo' && (
              <span className="demo-mini-badge">DEMO</span>
            )}
          </span>

          <strong className="train-card-name">{name}</strong>

          {isJourney && <JourneyStatus status={journeyStatus} />}

          {isJourney ? (
            <span className="journey-card-route">
              <span>
                <strong>{train.departure || '--:--'}</strong>
                <small>{train.sourceCode || 'Source'}</small>
              </span>

              <span className="journey-card-track">
                <i />
                <TrainFront size={16} />
                <i />
              </span>

              <span className="journey-card-destination">
                <strong>{train.arrival || '--:--'}</strong>
                <small>{train.destinationCode || 'Destination'}</small>
              </span>
            </span>
          ) : (
            <span className="train-card-location">
              <MapPin size={15} />
              <span>
                {train.currentStation || 'Current station not reported'}
              </span>
              {train.distanceKm !== undefined && (
                <b>{train.distanceKm} km away</b>
              )}
            </span>
          )}

          <span className="train-card-meta">
            {isJourney ? (
              <>
                <span>
                  <Clock3 size={15} />
                  {train.durationMinutes
                    ? `${Math.floor(train.durationMinutes / 60)}h ${
                        train.durationMinutes % 60
                      }m`
                    : train.duration || 'Duration varies'}
                </span>

                <span>
                  <Navigation size={15} />
                  {train.halts ?? '—'} stops
                </span>
              </>
            ) : (
              <>
                <span>
                  <Gauge size={15} />
                  {train.speedKmh != null
                    ? `${Math.round(Number(train.speedKmh))} km/h`
                    : 'Speed unavailable'}
                </span>

                <span
                  className={`delay-label ${
                    Number(delay) > 10 ? 'delay-label-late' : ''
                  }`}
                >
                  <Clock3 size={15} />
                  {formatDelay(delay)}
                </span>
              </>
            )}
          </span>

          {isJourney && <ServiceDays train={train} />}
        </span>

        {!selected && (
          <ArrowUpRight
            className="train-card-action-icon"
            size={19}
            aria-hidden="true"
          />
        )}
      </button>

      {selected && onClose && (
        <button
          type="button"
          className="train-card-close"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label={`Close details for ${name}`}
          title="Close train details"
        >
          <X size={16} />
        </button>
      )}
    </article>
  );
}