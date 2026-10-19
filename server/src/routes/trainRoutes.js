import { Router } from 'express';
import { liveMap, nearbyTrains, oneTrain, trainHistory, trainsBetween } from '../controllers/trainController.js';
const router = Router();
router.get('/live-map', liveMap);
router.get('/nearby', nearbyTrains);
router.get('/between', trainsBetween);
router.get('/:trainNumber/live', oneTrain);
router.get('/:trainNumber/history', trainHistory);
export default router;
