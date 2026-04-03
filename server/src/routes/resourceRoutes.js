import express from 'express';
import { getResources, updateResourceLocation, dispatchResource } from '../controllers/resourceController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getResources);

router.route('/:id/location')
  .put(protect, updateResourceLocation);

router.route('/:id/dispatch')
  .put(protect, dispatchResource);

export default router;
