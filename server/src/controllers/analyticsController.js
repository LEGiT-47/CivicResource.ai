import Analytics from '../models/Analytics.js';
import Incident from '../models/Incident.js';
import Resource from '../models/Resource.js';

// @desc    Get dashboard analytics (dynamically calculated + stored)
// @route   GET /api/dashboard
// @access  Private
export const getDashboardAnalytics = async (req, res, next) => {
  try {
    const org = req.user?.organization || 'Global';
    let analytics = await Analytics.findOne({ organization: org });
    
    // Fallback if none exist
    if (!analytics) {
      analytics = new Analytics({ organization: org });
      await analytics.save();
    }

    // Dynamic enrichment: Count actual active incidents and resources
    const activeIncidents = await Incident.countDocuments({ status: { $ne: 'resolved' } });
    const activeResources = await Resource.countDocuments({ status: { $ne: 'offline' } });

    // Ensure our DB matches realities (making it fully dynamic)
    analytics.activeIncidentsCount = activeIncidents;
    analytics.unitsDeployed = activeResources;
    await analytics.save();

    res.json(analytics);
  } catch (error) {
    next(error);
  }
};

// @desc    Update static dashboard metrics
// @route   POST /api/dashboard
// @access  Private (Admin)
export const updateAnalytics = async (req, res, next) => {
  try {
    const org = req.user?.organization || 'Global';
    let analytics = await Analytics.findOne({ organization: org });

    if (!analytics) {
      analytics = new Analytics({ organization: org });
    }

    const { avgResponseTimeMinutes, slaCompliancePercent, aiPredictionsCount, systemHealthPercent } = req.body;

    if (avgResponseTimeMinutes !== undefined) analytics.avgResponseTimeMinutes = avgResponseTimeMinutes;
    if (slaCompliancePercent !== undefined) analytics.slaCompliancePercent = slaCompliancePercent;
    if (aiPredictionsCount !== undefined) analytics.aiPredictionsCount = aiPredictionsCount;
    if (systemHealthPercent !== undefined) analytics.systemHealthPercent = systemHealthPercent;

    const updated = await analytics.save();
    res.json(updated);
  } catch (error) {
    next(error);
  }
};
