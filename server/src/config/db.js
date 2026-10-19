import mongoose from 'mongoose';

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('[db] MONGODB_URI not set; searches will work without history persistence.');
    return;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
    console.log('[db] MongoDB connected.');
  } catch (error) {
    console.warn(`[db] MongoDB unavailable; continuing without persistence: ${error.message}`);
  }
}
