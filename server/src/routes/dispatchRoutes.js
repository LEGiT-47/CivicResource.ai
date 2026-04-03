import express from 'express';
import { assignPersonnel, getAvailablePersonnel, getAIAnalysis } from '../controllers/dispatchController.js';
import { protect } from '../middleware/authMiddleware.js'; // Assuming auth middleware exists

const router = express.Router();

router.route('/personnel').get(getAvailablePersonnel);
router.route('/assign').post(assignPersonnel);
router.route('/ai-analyze').post(getAIAnalysis);

export default router;
