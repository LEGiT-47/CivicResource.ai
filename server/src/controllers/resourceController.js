import Resource from '../models/Resource.js';

// @desc    Get all resources
// @route   GET /api/resources
// @access  Private
export const getResources = async (req, res, next) => {
  try {
    const filters = req.query.type ? { type: req.query.type } : {};
    const resources = await Resource.find(filters).populate('currentIncident', 'title severity location');
    res.json(resources);
  } catch (error) {
    next(error);
  }
};

// @desc    Update resource location (telemetry)
// @route   PUT /api/resources/:id/location
// @access  Private
export const updateResourceLocation = async (req, res, next) => {
  try {
    const { lat, lng, batteryOrFuelLevel } = req.body;
    const resource = await Resource.findById(req.params.id);

    if (resource) {
      if (lat && lng) {
        resource.location = { lat, lng };
      }
      if (batteryOrFuelLevel !== undefined) {
        resource.batteryOrFuelLevel = batteryOrFuelLevel;
      }
      const updatedResource = await resource.save();
      res.json(updatedResource);
    } else {
      res.status(404);
      throw new Error('Resource not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Dispatch resource to incident
// @route   PUT /api/resources/:id/dispatch
// @access  Private
export const dispatchResource = async (req, res, next) => {
  try {
    const { incidentId } = req.body;
    const resource = await Resource.findById(req.params.id);

    if (resource) {
      resource.status = 'dispatched';
      resource.currentIncident = incidentId;
      const updatedResource = await resource.save();
      res.json(updatedResource);
    } else {
      res.status(404);
      throw new Error('Resource not found');
    }
  } catch (error) {
    next(error);
  }
};
