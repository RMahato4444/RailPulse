import mongoose from 'mongoose';

const trainSnapshotSchema = new mongoose.Schema({
  trainNumber: { type: String, required: true, index: true },
  trainName: String,
  sourceStation: String,
  destinationStation: String,
  currentStation: String,
  latitude: Number,
  longitude: Number,
  delayMinutes: Number,
  speedKmh: Number,
  providerUpdatedAt: Date,
  dataSource: String
}, { timestamps: true });

trainSnapshotSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1209600 });
export default mongoose.models.TrainSnapshot || mongoose.model('TrainSnapshot', trainSnapshotSchema);
