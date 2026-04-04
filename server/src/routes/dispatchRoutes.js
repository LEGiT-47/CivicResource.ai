import express from 'express';
import {
	assignPersonnel,
	getAvailablePersonnel,
	getAIAnalysis,
	getWorkerAssignmentsByUnitId,
	getMyAssignments,
	getCrisisMode,
	setCrisisMode,
	runOperatorCopilot,
} from '../controllers/dispatchController.js';
import { protect } from '../middleware/authMiddleware.js'; // Assuming auth middleware exists

const router = express.Router();

router.route('/personnel').get(protect, getAvailablePersonnel);
router.route('/assignments/:unitId').get(protect, getWorkerAssignmentsByUnitId);
router.route('/my-assignments').get(protect, getMyAssignments);
router.route('/assign').post(protect, assignPersonnel);
router.route('/ai-analyze').post(protect, getAIAnalysis);
router.route('/copilot').post(protect, runOperatorCopilot);
router.route('/crisis-mode').get(protect, getCrisisMode).post(protect, setCrisisMode);

export default router;
