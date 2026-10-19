# RailPulse Mobile (React Native + Expo)

This is a native mobile client for the existing RailPulse Express API. It is a separate `mobile/` app; it does not attempt to reuse the browser-only React/Vite UI.

## Features

- Nearby train search by city, district, locality or PIN code, with radius selection.
- Train number/name lookup using the existing train-directory endpoint.
- Source-to-destination train search with station suggestions and travel date.
- Native map screen when a train is selected, with train marker, route polyline, current position, speed, delay, timestamps, and expandable station list.
- Uses the existing backend and does not embed the RailRadar API key in the app.
- Shows provider errors rather than inventing train positions when no live response is available.

## Prerequisites

- Node.js 26.7.0 or later (matches the existing RailPulse backend requirement).
- npm.
- Android: Expo Go for initial testing, or Android Studio/Android SDK for emulator/local builds.

Expo's `create-expo-app` is the officially recommended starter tool, and the mobile client uses Expo SDK 57 / React Native 0.86.3. See the [Expo project guide](https://docs.expo.dev/get-started/create-a-project/) and [react-native-maps guide](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/).

## Step 1 — Preserve your existing API configuration

The project archive intentionally does not contain the real root `.env` file. Copy your existing private `railpulse/.env` into the root of the extracted project. Confirm its server-side values are set correctly, for example:

```env
PORT=5000
TRAIN_DATA_PROVIDER=railradar
RAILRADAR_API_KEY=your_actual_key
RAILRADAR_BASE_URL=https://api.railradar.in
```

Do not place `RAILRADAR_API_KEY` in `mobile/.env`, and do not use an `EXPO_PUBLIC_` variable for it. Anything with the `EXPO_PUBLIC_` prefix is bundled into the client app.

## Step 2 — Start the backend

Open a terminal at the project root (`railpulse/`) and run:

```powershell
npm install
npm --prefix server install
npm --prefix server run dev
```

Keep this terminal open. The server should listen on port 5000.

Check `http://localhost:5000/api/health` on your computer before continuing. The provider must have remaining quota for live results; an exhausted RailRadar quota cannot be corrected from the mobile client.

## Step 3 — Set the mobile API URL

Open `mobile/.env.example`, copy it to `mobile/.env`, then select the URL for your test environment.

**Android emulator:**

```env
EXPO_PUBLIC_API_URL=http://YOUR-LAPTOP-IP:5000/api
```

**iOS simulator:**

```env
EXPO_PUBLIC_API_URL=http://localhost:5000/api
```

**A physical phone on the same Wi-Fi as your computer:**

1. On Windows, run `ipconfig` and find the computer's Wi-Fi IPv4 address (for example `192.168.1.12`).
2. Set `EXPO_PUBLIC_API_URL=http://YOUR-LAPTOP-IP:5000/api` using your actual address.
3. Allow Node.js through Windows Firewall on your private network if prompted.
4. Keep the phone and computer on the same Wi-Fi.

A phone's `localhost` points to the phone itself, not your computer. For a production build, use an HTTPS API URL instead of a private LAN address.

## Step 4 — Install mobile dependencies

Open a second terminal at the project root and run:

```powershell
cd mobile
npm install
npx expo install --fix
npx expo-doctor
```

If Expo asks you to align a native package version, run `npx expo install react-native-maps expo-linear-gradient expo-status-bar react-native-safe-area-context @expo/vector-icons`.

## Step 5 — Run the app on Android

Install **Expo Go** from Google Play on your phone. In the `mobile/` folder run:

```powershell
npx expo start --clear
```

A QR code appears. Scan it using Expo Go. If the device cannot reach Metro on your network, stop the server and try:

```powershell
npx expo start --tunnel
```

For an Android emulator with Android Studio installed, run `npx expo start --android`.

## Step 6 — Make an installable APK

To create a test APK in the cloud, install and log in to EAS CLI:

```powershell
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

The build output provides an APK download URL. Follow Expo's Google Maps setup for standalone Android builds: create a Google Maps Android API key and set `GOOGLE_MAPS_API_KEY` in the EAS build environment before building, so the native map displays in the standalone APK. Do not commit this key. The backend also needs to be deployed to an HTTPS URL for an app used outside your home network.

For an app-store bundle, run:

```powershell
eas build --platform android --profile production
```

## How the API is used

The app calls the existing endpoints:

- `GET /api/health`
- `GET /api/trains/nearby?query=...&radiusKm=...`
- `GET /api/trains/:trainNumber/live`
- `GET /api/search/trains?q=...`
- `GET /api/search/stations?q=...`
- `GET /api/trains/between?from=...&to=...&date=...`

The mobile app does not contain the provider key. The Express server makes RailRadar requests and applies the existing cache/rate limits.

## Current limitations

- Location suggestions include a small local list of common places and PINs. Arbitrary locations can still be submitted and geocoded by the backend; only known places appear as type-ahead suggestions without adding a new geocoder endpoint.
- Alternate connections are rendered only when the backend/provider returns `alternatives`; the mobile app does not invent connecting services.
- Exact GPS locations, station-coordinate coverage, and train status depend on the provider response and active RailRadar quota.
