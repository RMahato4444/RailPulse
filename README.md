# RailPulse — India Rail Explorer

A search-first MERN project for exploring trains in India. Instead of dropping every train on the map as soon as the page opens, the user chooses one workflow:

1. **Nearby trains** — search a district, city, locality, or PIN code; choose a search radius and view positions returned within it.
2. **Train lookup** — search a train number or a partial train name, then open its latest running-status report.
3. **Between stations** — select source and destination stations from autocomplete and see services listed between those stations, including scheduled times and provider-reported departure status where available.

The refreshed interface uses a floating glass-style sidebar for the three workflows, larger readable text, one search form at a time, a scrollable train-results panel, and a map that stays beside the results on desktop. Clicking anywhere on a train card selects it and opens a floating details panel on the map. The details show current station and report time in 24-hour Indian Standard Time, with route stops collapsed behind Show all / Show less. The map can expand into a full-screen view and draws route lines with station checkpoints whenever coordinate-bearing route data is available. The map uses top-down locomotive SVGs and corrects the provider bearing direction when one is supplied. The interface is modular and responsive and uses Tailwind CSS v4 through the Vite plugin, with Framer Motion for restrained transitions. Demo trains include clearly labelled approximate checkpoint paths for preview only; they are not exact rail geometry or real-time positions.

> **Data honesty:** the app starts in demo mode. Demo coordinates and demo timetable rows are illustrative and are labelled in the UI; they are not real train locations or a live timetable. Add a provider API key to use provider-backed data. Train data is only as fresh/accurate as the configured provider's latest response, and this is not an official Indian Railways / IRCTC / NTES service.

## Latest interface polish

The latest UI pass makes the map panel taller on desktop while keeping the train results in their own scroll area. Selected train cards now have a stable green-violet highlight (no horizontal shift) and include a close-details control. The floating detail panel uses larger type, shows report time in 24-hour IST, and highlights the matched current stop in the route timeline. Passed stops use green connectors, the current stop is highlighted in violet/mint, and upcoming route sections use a separate dashed violet line on the map. If the current stop is later in a long route, the collapsed detail view opens around that stop; use **Show all stops** to view the complete route.

## Technology stack

- **Client:** React 19, Vite, Tailwind CSS v4 (`@tailwindcss/vite`), React Leaflet, Leaflet, Framer Motion, Lucide icons
- **Server:** Node.js v26.7.0+, Express 5, Mongoose, Helmet, CORS and API rate limiting
- **Database:** MongoDB (optional for storing recent train lookup snapshots; search workflows also run without MongoDB)
- **External data:** RailRadar API for train status / route searches; OpenStreetMap Nominatim for geocoding arbitrary Indian place names and PIN codes. Common example locations have a tiny built-in fallback index.

## 1. Prerequisites

Install:

- Node.js **v26.7.0** or later (the project `engines` field requires Node 26.7+)
- npm (ships with Node)
- A browser with JavaScript enabled
- Optional: MongoDB local or Atlas connection string
- Optional: a RailRadar API key for real provider-backed train information

Check your versions:

```powershell
node -v
npm -v
```

## 2. Extract and configure

Extract the RailPulse project ZIP, open a terminal in the `railpulse` directory, then create the root environment file:

```powershell
Copy-Item .env.example .env
```

The root `.env` file is read by the server. Start with demo mode before connecting an API. The sample config is:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
TRAIN_DATA_PROVIDER=demo
RAILRADAR_API_KEY=
RAILRADAR_BASE_URL=https://api.railradar.in
LIVE_MAP_CACHE_SECONDS=45
SEARCH_CACHE_SECONDS=60
MONGODB_URI=mongodb://127.0.0.1:27017/railpulse
GEOCODER_USER_AGENT=RailPulseIndia/2.0 (developer contact: replace-this@example.com)
```

Replace the geocoder user agent with a meaningful app identifier and your contact email before public deployment. Nominatim's public service has a usage policy and rate limits: cache requests, don't use it for high-volume autocomplete, and consider a hosted geocoding provider for production-scale use.

## 3. Install dependencies

Run these commands at the **project root**:

```powershell
npm install
npm --prefix server install
npm --prefix client install
```

## 4. Run the client and server

From the project root:

```powershell
npm run dev
```

Open the client:

- Web app: http://localhost:5173
- API health check: http://localhost:5000/api/health

The root `npm run dev` script starts the Vite client and Express server together in separate terminal panes. The lightweight demo logic checks can be run with `npm test`; they validate region/PIN radius filtering, station and train suggestions, train detail, and source-to-destination results. You can also run the client and server separately:

```powershell
npm run dev:server
npm run dev:client
```

### First demo searches to try

- **Nearby:** `Kolkata`, radius `50 km`
- **Nearby:** `Jhargram` or PIN `721507`, radius `50 km`
- **Nearby:** `Purulia` or PIN `723101`, radius `50 km`
- **Train search:** `12301`, `12841`, or type `Rajdhani`
- **Between stations:** choose `Howrah Junction (HWH)` → `New Delhi (NDLS)`

These are for testing the interface; results in demo mode are not live train data.

## 5. Route lines and current position

When a train is selected, the client uses coordinate-bearing station checkpoints from its running-status response to draw the route and show the reported current position. The live map endpoint can also draw a route for a nearby train when the provider includes route checkpoints in that response. If the provider returns no station coordinates, RailPulse shows the current position when available and explains that route geometry is not available; it does not invent a real track path. Demo routes are approximate checkpoint lines and are labelled as demo preview.

## 6. Connect live train data

1. Get an API key at the [RailRadar access page](https://railradar.in/pricing).
2. Edit the **root** `.env` file.
3. Set:

```env
TRAIN_DATA_PROVIDER=railradar
RAILRADAR_API_KEY=your_real_api_key_here
RAILRADAR_BASE_URL=https://api.railradar.in
LIVE_MAP_CACHE_SECONDS=45
SEARCH_CACHE_SECONDS=60
```

4. Restart `npm run dev` (Ctrl+C, then run it again).
5. Look at the source badge in the UI or visit http://localhost:5000/api/health. It should say `mode: live` after successful configuration.

The key must stay in the server `.env` file. Do not add it to a `VITE_...` variable or check `.env` into GitHub.

Relevant provider endpoint docs:

- [Live map snapshot feed](https://railradar.in/docs/legacy-live-map)
- [Live train running status](https://railradar.in/docs/live-train-status)
- [Trains between stations](https://railradar.in/docs/trains-between-stations)
- [Station autocomplete](https://railradar.in/docs/search-stations)
- [Train autocomplete](https://railradar.in/docs/search-trains)

**Provider semantics matter:** the nearby workflow filters the provider live-map response by geographic distance from a geocoded centre. It is a radius search around the geocoder result, not a precise administrative district-boundary/polygon intersection. The source/destination workflow returns timetable services between stations; it does not pretend that the timetable provides each train's current GPS coordinates. Select any result card to request its individual live-status report. Details float over the map and the result list remains independently scrollable.

## 7. Configure MongoDB (optional)

If MongoDB runs locally, leave:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/railpulse
```

If you don't have MongoDB installed, empty the `MONGODB_URI` value. The server will print a warning and continue; only recent train snapshot history persistence is unavailable. For MongoDB Atlas, paste the database connection string into `MONGODB_URI` and restart the server.

## 8. Client/server folder layout

```text
railpulse/
├── .env.example
├── package.json                 # starts/builds client and server together
├── README.md
├── server/
│   ├── package.json
│   └── src/
│       ├── config/db.js
│       ├── controllers/
│       │   ├── searchController.js
│       │   └── trainController.js
│       ├── models/TrainSnapshot.js
│       ├── routes/
│       │   ├── searchRoutes.js
│       │   └── trainRoutes.js
│       ├── services/
│       │   ├── demoData.js
│       │   └── railDataService.js
│       └── server.js
└── client/
    ├── package.json
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── api/client.js
        ├── components/
        │   ├── JourneySearch.jsx
        │   ├── LocationSearch.jsx
        │   ├── StationAutocomplete.jsx
        │   ├── TrainCard.jsx
        │   ├── TrainDetail.jsx
        │   ├── TrainMap.jsx
        │   └── TrainSearch.jsx
        ├── App.jsx
        ├── index.css
        └── main.jsx
```

## 9. API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Server/provider mode |
| GET | `/api/trains/live-map` | Provider train-position feed (cached on the server) |
| GET | `/api/trains/nearby?query=Jhargram&radiusKm=50` | Geocode location and filter train positions within the radius |
| GET | `/api/trains/:trainNumber/live` | Current running-status report for one train |
| GET | `/api/trains/between?from=HWH&to=NDLS&date=YYYY-MM-DD` | Services between selected stations |
| GET | `/api/search/stations?q=Howrah` | Station-code/name autocomplete |
| GET | `/api/search/trains?q=Rajdhani` | Train-number/name autocomplete |
| GET | `/api/trains/:trainNumber/history` | Recent saved snapshots (requires MongoDB) |

## 10. How the region search works

1. The user enters a city, district, PIN code, or locality.
2. The server resolves that query to a latitude/longitude, using a known-place cache or OpenStreetMap Nominatim.
3. The server loads the cached train-position snapshot from RailRadar (or the clearly marked demo dataset).
4. Haversine distance is calculated for each valid train coordinate. Only positions within the selected radius are returned, nearest first.
5. The client draws the radius and location marker on the map, then renders custom SVG train markers for matches.

This keeps the provider API key on the server and avoids asking the provider for a separate detail endpoint per visible train. Individual running status is fetched only when a user selects a specific train.

## 11. Production notes

- The public Nominatim server is not a high-throughput geocoding backend. Observe its current usage policy, caching requirements and rate limits; use an appropriate provider/self-hosted service for scaled deployments.
- Set `CLIENT_URL` to your production client origin. Set API secrets using your hosting platform's environment settings.
- Protect the API key, monitor quotas, and add stricter per-IP search limits before public launch.
- An Indian PIN code generally identifies a postal area, not one exact point. The radius is measured from a geocoded result, so increase the radius if the postcode is broad or a coordinate centre falls away from the rails.
- Map tiles require an internet connection and should follow the tile provider's usage rules.
- A live-status response is the provider's latest report, not guaranteed continuous GPS tracking. The UI shows source labels to avoid implying demo coordinates are live.

## Tailwind CSS v4

The client uses the current Vite-plugin pattern:

```js
import tailwindcss from '@tailwindcss/vite';
// plugins: [react(), tailwindcss()]
```

and in `src/index.css`:

```css
@import "tailwindcss";
```

No `tailwind.config.js` file is required for the base Tailwind v4 setup.


### Map tile configuration

The default map background uses the standard OpenStreetMap tile URL (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) and does not use your RailRadar API key. Visible OpenStreetMap attribution is included. The public OSM tile service is best-effort and has a usage policy; for heavy or commercial production traffic, use a tile provider whose terms and quota suit your app. Train data API credentials and map tile credentials (if using a paid tile provider) are separate.


## Journey result status and operating days

Station-to-station result cards use separate visual states for **Running now** (green), **Journey not started** (violet), **within the scheduled journey time** (blue and explicitly marked estimated when provider live status is unavailable), and non-operating/completed services (neutral). A provider-reported live status is preferred. Where a provider returns only a timetable, status is inferred from schedule times and is labelled as estimated rather than represented as confirmed GPS state.

Operating days are read from provider `runDays`, `runningDays`, `daysOfRun`, or `days` fields when available. Daily services show **Daily**; non-daily services show their listed days. Today's weekday is calculated in `Asia/Kolkata` and highlighted distinctly. If the provider does not supply operating days, the UI shows **Not provided** rather than guessing. Demo journey schedules include daily and selected-weekday examples so these states can be previewed without a provider key.

## Dark India rail + glass UI refresh

The page background now uses an Indian Railways photograph with a dark navy/black overlay, strong background blur, and blue-violet ambient gradients. The sidebar remains the darkest translucent glass surface; search forms, result lists, train cards, detail panels, autocomplete menus, and map overlays use a lighter frosted-glass treatment for readable contrast. Blue/violet gradients remain the primary accent system, with coral reserved for delay/error states. Layout and the three search workflows are unchanged.

The background photo is sourced from [Pexels — Indian Railways passenger train in Karnataka](https://www.pexels.com/photo/indian-railways-passenger-train-in-karnataka-29528961/). The CSS includes a dark gradient fallback if the photo cannot load. An internet connection is needed to fetch the background photo and map tiles.
