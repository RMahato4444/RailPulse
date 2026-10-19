import mongoose from 'mongoose';
import TrainSnapshot from '../models/TrainSnapshot.js';
import { getLiveMap, getNearbyTrains, getProviderStatus, getTrainLiveStatus, getTrainsBetween } from '../services/railDataService.js';

export async function liveMap(_req, res, next) {
  try { res.json({ success: true, ...(await getLiveMap()), provider: getProviderStatus() }); } catch (error) { next(error); }
}

export async function nearbyTrains(req, res, next) {
  try {
    const query = String(req.query.query || '').trim();
    const radiusKm = Number(req.query.radiusKm || 50);
    const result = await getNearbyTrains(query, radiusKm);
    res.json({ success: true, ...result, provider: getProviderStatus() });
  } catch (error) { next(error); }
}

export async function oneTrain(req, res, next) {
  try {
    const number = String(req.params.trainNumber || '').trim();
    if (!/^\d{4,6}$/.test(number)) return res.status(400).json({ success: false, message: 'Enter a train number containing 4–6 digits.' });
    const train = await getTrainLiveStatus(number);
    if (mongoose.connection.readyState === 1) {
      await TrainSnapshot.create({
        trainNumber: train.trainNumber, trainName: train.trainName,
        sourceStation: train.sourceStation, destinationStation: train.destinationStation,
        currentStation: train.currentStation, latitude: train.latitude, longitude: train.longitude,
        delayMinutes: train.delayMinutes, speedKmh: train.speedKmh,
        providerUpdatedAt: train.updatedAt ? new Date(train.updatedAt) : null, dataSource: train.source
      }).catch((error) => console.warn('[db] Snapshot was not saved:', error.message));
    }
    res.json({ success: true, train, provider: getProviderStatus() });
  } catch (error) { next(error); }
}

export async function trainsBetween(req, res, next) {
  try {
    const result = await getTrainsBetween(req.query.from, req.query.to, req.query.date);
    res.json({ success: true, ...result, provider: getProviderStatus() });
  } catch (error) { next(error); }
}

export async function trainHistory(req, res, next) {
  try {
    const number = String(req.params.trainNumber || '').trim();
    if (mongoose.connection.readyState !== 1) return res.json({ success: true, history: [], storageEnabled: false });
    const history = await TrainSnapshot.find({ trainNumber: number }).sort({ createdAt: -1 }).limit(12).lean();
    res.json({ success: true, history, storageEnabled: true });
  } catch (error) { next(error); }
}
