import { Router } from 'express';
import { stations, trains } from '../controllers/searchController.js';
const router = Router();
router.get('/stations', stations);
router.get('/trains', trains);
export default router;
