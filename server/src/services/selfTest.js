import assert from "node:assert/strict";

import {
  getLiveMap,
  getNearbyTrains,
  getTrainLiveStatus,
  getTrainsBetween,
  searchStations,
  searchTrains,
} from "./railDataService.js";

// Tests must not call RailRadar or rely on fabricated train records.
process.env.TRAIN_DATA_PROVIDER = "demo";
process.env.RAILRADAR_API_KEY = "";

const configuredError = (error) =>
  error?.statusCode === 503 &&
  /RailRadar is not configured/i.test(error.message);

await assert.rejects(getLiveMap(), configuredError);
await assert.rejects(getNearbyTrains("Kolkata", 50), configuredError);
await assert.rejects(getTrainLiveStatus("12301"), configuredError);
await assert.rejects(searchStations("Howrah"), configuredError);
await assert.rejects(searchTrains("Rajdhani"), configuredError);
await assert.rejects(getTrainsBetween("HWH", "NDLS"), configuredError);

await assert.rejects(
  getTrainsBetween("HWH", "HWH"),
  (error) =>
    error?.statusCode === 400 && /different stations/i.test(error.message),
);

console.log(
  "RailPulse checks passed: unconfigured mode refuses train data and invalid journey pairs are rejected.",
);
