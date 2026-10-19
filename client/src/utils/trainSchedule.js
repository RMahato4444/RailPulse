const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_ALIASES = new Map([
  ['monday', 'Mon'], ['mon', 'Mon'], ['mo', 'Mon'],
  ['tuesday', 'Tue'], ['tue', 'Tue'], ['tues', 'Tue'], ['tu', 'Tue'],
  ['wednesday', 'Wed'], ['wed', 'Wed'], ['we', 'Wed'],
  ['thursday', 'Thu'], ['thu', 'Thu'], ['thur', 'Thu'], ['thurs', 'Thu'], ['th', 'Thu'],
  ['friday', 'Fri'], ['fri', 'Fri'], ['fr', 'Fri'],
  ['saturday', 'Sat'], ['sat', 'Sat'], ['sa', 'Sat'],
  ['sunday', 'Sun'], ['sun', 'Sun'], ['su', 'Sun']
]);

function normalizeDay(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Train timetables commonly use 1=Monday through 7=Sunday.
    return value >= 1 && value <= 7 ? DAY_ORDER[value - 1] : null;
  }
  const token = String(value ?? '').trim().toLowerCase().replace(/[^a-z]/g, '');
  return DAY_ALIASES.get(token) || null;
}

function rawOperatingDays(train) {
  const primary = train?.runDays;
  if (Array.isArray(primary) && primary.length) return primary;
  if (primary && typeof primary === 'object' && !Array.isArray(primary)) return primary;
  if (typeof primary === 'string' && primary.trim()) return primary;
  const fallback = train?.runningDays ?? train?.daysOfRun ?? train?.operatingDays ?? train?.days;
  return fallback ?? null;
}

export function getOperatingDays(train) {
  const raw = rawOperatingDays(train);
  if (raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0)) {
    return { known: false, daily: false, days: [] };
  }

  if (typeof raw === 'string' && /\b(daily|every day|all days)\b/i.test(raw)) {
    return { known: true, daily: true, days: [...DAY_ORDER] };
  }

  let values = [];
  if (Array.isArray(raw)) {
    // Some feeds return an object per day, others return weekday names directly.
    values = raw.map((item) => {
      if (item && typeof item === 'object') return item.day ?? item.name ?? item.weekday ?? item.code ?? item;
      return item;
    });
  } else if (typeof raw === 'object') {
    const keys = Object.entries(raw);
    const keyedDays = keys.filter(([key]) => normalizeDay(key));
    if (keyedDays.length) {
      values = keyedDays.filter(([, enabled]) => enabled === true || enabled === 1 || /^(true|yes|1|runs)$/i.test(String(enabled))).map(([key]) => key);
    } else {
      values = Object.values(raw);
    }
  } else {
    values = String(raw).split(/[\s,;|/]+/).filter(Boolean);
  }

  const days = [...new Set(values.map(normalizeDay).filter(Boolean))].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  if (days.length === 7) return { known: true, daily: true, days: [...DAY_ORDER] };
  return { known: days.length > 0, daily: false, days };
}

export function getTodayIST(date = new Date()) {
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(date);
  return normalizeDay(today) || 'Mon';
}

export function getDateIST(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function weekdayForISODate(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ''))) return null;
  const date = new Date(`${isoDate}T12:00:00Z`);
  const short = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(date);
  return normalizeDay(short);
}

function parseClock(value) {
  const match = String(value ?? '').match(/(?:^|\b)(\d{1,2}):(\d{2})(?:\b|$)/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function explicitStatus(train) {
  const status = [train?.liveStatus, train?.journeyStatus, train?.currentStatus, train?.status]
    .filter(Boolean).join(' ').toLowerCase().replace(/[\s-]+/g, '_');
  if (!status) return null;
  if (/cancel|short_terminated|diverted/.test(status)) return { state: 'cancelled', label: /cancel/.test(status) ? 'Cancelled' : 'Service changed', source: 'provider' };
  if (/not_started|not_yet_started|yet_to_start|upcoming|scheduled|before_departure|awaiting_departure|boarding/.test(status)) return { state: 'not-started', label: 'Journey not started', source: 'provider' };
  if (/complete|terminated|arrived_at_destination|journey_over/.test(status)) return { state: 'completed', label: 'Journey completed', source: 'provider' };
  if (/running|in_transit|en_route|on_the_way|departed|moving|in_progress/.test(status)) return { state: 'running', label: 'Running now', source: 'provider' };
  return null;
}

/**
 * Journey results sometimes contain only a timetable and sometimes a provider live status.
 * When no live status exists, the result is explicitly marked as inferred from schedule time.
 */
export function getJourneyStatus(train, travelDate = null, now = new Date()) {
  const today = getDateIST(now);
  const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(String(travelDate || '')) ? travelDate : today;
  const targetDay = weekdayForISODate(targetDate) || getTodayIST(now);
  const targetIsToday = targetDate === today;
  const explicit = explicitStatus(train);

  // A search for a future travel date must not inherit a live status from today's operation.
  if (targetDate > today) return { state: 'not-started', label: 'Journey not started', source: 'schedule' };
  if (targetDate < today) return { state: 'completed', label: 'Travel date passed', source: 'schedule' };
  if (explicit) return explicit;

  const operation = getOperatingDays(train);
  if (operation.known && !operation.daily && !operation.days.includes(targetDay)) {
    return { state: 'not-running-day', label: `Does not run ${targetDay}`, source: 'schedule' };
  }

  const departure = parseClock(train?.departure);
  const arrival = parseClock(train?.arrival);
  if (departure != null && arrival != null && targetIsToday) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(now);
    const clock = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const currentMinute = Number(clock.hour) * 60 + Number(clock.minute);
    let arrivalAdjusted = arrival;
    if (arrivalAdjusted <= departure) arrivalAdjusted += 24 * 60;
    const currentAdjusted = currentMinute < departure && arrivalAdjusted >= 24 * 60 ? currentMinute + 24 * 60 : currentMinute;
    if (currentAdjusted < departure) return { state: 'not-started', label: 'Journey not started', source: 'schedule' };
    if (currentAdjusted <= arrivalAdjusted) return { state: 'schedule-window', label: 'Within scheduled journey time', source: 'schedule' };
    return { state: 'completed', label: 'Scheduled arrival time passed', source: 'schedule' };
  }

  return { state: 'scheduled', label: 'Schedule available · live status unavailable', source: 'schedule' };
}
