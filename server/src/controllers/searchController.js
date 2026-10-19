import { searchStations, searchTrains } from '../services/railDataService.js';

export async function stations(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ success: true, results: [] });
    res.json({ success: true, results: await searchStations(q) });
  } catch (error) { next(error); }
}

export async function trains(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ success: true, results: [] });
    res.json({ success: true, results: await searchTrains(q) });
  } catch (error) { next(error); }
}
