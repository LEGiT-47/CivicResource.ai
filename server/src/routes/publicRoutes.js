import express from 'express';
import {
  getPublicIncidents,
  getPublicIncidentById,
  trackPublicComplaint,
  createIncident,
} from '../controllers/incidentController.js';

const router = express.Router();

router.route('/incidents').get(getPublicIncidents).post(createIncident);
router.route('/incidents/track').get(trackPublicComplaint);
router.route('/incidents/:id').get(getPublicIncidentById);

export default router;