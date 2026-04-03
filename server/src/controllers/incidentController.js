import Incident from '../models/Incident.js';

// @desc    Get all active incidents
// @route   GET /api/incidents
// @access  Private
export const getIncidents = async (req, res, next) => {
  try {
    // Only return non-resolved by default, unless specified
    const statusFilter = req.query.status ? { status: req.query.status } : { status: { $ne: 'resolved' } };
    const incidents = await Incident.find(statusFilter).sort({ createdAt: -1 });
    res.json(incidents);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new incident report
// @route   POST /api/incidents
// @access  Private
export const createIncident = async (req, res, next) => {
  try {
    const { title, type, severity, location, details, aiPredictionConfidence } = req.body;

    const incident = new Incident({
      title,
      type,
      severity,
      location,
      details,
      aiPredictionConfidence: aiPredictionConfidence || 0
    });

    const createdIncident = await incident.save();
    res.status(201).json(createdIncident);
  } catch (error) {
    next(error);
  }
};

// @desc    Update incident status
// @route   PUT /api/incidents/:id/status
// @access  Private
export const updateIncidentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const incident = await Incident.findById(req.params.id);

    if (incident) {
      incident.status = status;
      const updatedIncident = await incident.save();
      res.json(updatedIncident);
    } else {
      res.status(404);
      throw new Error('Incident not found');
    }
  } catch (error) {
    next(error);
  }
};
