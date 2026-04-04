import Incident from '../models/Incident.js';
import Personnel from '../models/Personnel.js';
import Resource from '../models/Resource.js';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

const safeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const buildDemandZones = (incidents) => {
  const bins = {};
  incidents.forEach((incident) => {
    const lat = safeNumber(incident?.location?.lat, 19.076);
    const lng = safeNumber(incident?.location?.lng, 72.8777);
    const key = `${Math.round(lat * 10) / 10}_${Math.round(lng * 10) / 10}`;
    if (!bins[key]) {
      bins[key] = {
        zone_id: key,
        population_density: 9000 + Math.round(Math.abs(lat * lng)) % 7000,
        complaints_last_7d: 0,
        weather_rain_mm: 4 + Math.round(Math.abs(lat) % 8),
        weather_temp_c: 28 + Math.round(Math.abs(lng) % 6),
        event_factor: 1.0,
        historical_daily_avg: 14,
      };
    }

    bins[key].complaints_last_7d += 1;
    bins[key].historical_daily_avg += incident.severity === 'critical' ? 2 : 1;
    if (incident.severity === 'critical') {
      bins[key].event_factor = 1.25;
    }
  });

  return Object.values(bins);
};

const postAI = async (endpoint, payload) => {
  const response = await fetch(`${AI_ENGINE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`AI engine call failed for ${endpoint}`);
  }

  return response.json();
};

// @desc    Dispatch personnel to an incident
// @route   POST /api/dispatch/assign
// @access  Private (Officer)
export const assignPersonnel = async (req, res) => {
  const { incidentId, personnelId } = req.body;

  try {
    const incident = await Incident.findById(incidentId);
    const personnel = await Personnel.findById(personnelId);

    if (!incident || !personnel) {
      return res.status(404).json({ message: 'Incident or Personnel not found' });
    }

    if (personnel.status !== 'available') {
      return res.status(400).json({ message: 'Personnel is already busy or off-duty' });
    }

    // Assign
    incident.assignedPersonnel = personnelId;
    incident.dispatchStatus = 'dispatched';
    incident.status = 'investigating';
    
    personnel.status = 'busy';
    personnel.currentIncident = incidentId;

    await incident.save();
    await personnel.save();

    res.status(200).json({
      message: 'Personnel dispatched successfully',
      incident,
      personnel
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all available personnel
// @route   GET /api/dispatch/personnel
// @access  Private (Officer)
export const getAvailablePersonnel = async (req, res) => {
  try {
    const personnel = await Personnel.find({ status: 'available' });
    res.json(personnel);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Quick AI Analysis Proxy
// @route   POST /api/dispatch/ai-analyze
export const getAIAnalysis = async (req, res) => {
  try {
    const incidents = await Incident.find({ status: { $ne: 'resolved' } });
    const resources = await Resource.find({ status: { $ne: 'offline' } });
    const payloadIncidents = incidents.map((i) => ({
      id: String(i._id),
      type: i.type,
      severity: i.severity,
      lat: safeNumber(i?.location?.lat, 19.076),
      lng: safeNumber(i?.location?.lng, 72.8777),
    }));

    const payloadResources = resources.map((r) => ({
      id: String(r._id),
      type: r.type,
      status: r.status,
      lat: safeNumber(r?.location?.lat, 19.076),
      lng: safeNumber(r?.location?.lng, 72.8777),
    }));

    const zones = buildDemandZones(incidents);

    const [clustersResp, heatmapResp, demandResp, allocationResp] = await Promise.all([
      postAI('/analyze/clustering', { incidents: payloadIncidents }),
      postAI('/analyze/heatmap-weights', { incidents: payloadIncidents }),
      postAI('/analyze/demand-forecast', { zones }),
      postAI('/analyze/resource-allocation', { zones, resources: payloadResources }),
    ]);

    const topZone = demandResp?.zones?.[0];
    const advice = topZone
      ? `Prioritize zone ${topZone.zone_id} with urgency rank ${topZone.urgency_rank}. Dispatch ${topZone.recommended_units} units immediately.`
      : 'Maintain current distribution and continue monitoring.';

    res.json({
      proneAreas: heatmapResp?.data || [],
      clusters: clustersResp?.clusters || [],
      demandForecast: demandResp?.zones || [],
      allocationPlan: allocationResp?.allocations || [],
      allocationSummary: allocationResp?.summary || { allocated: 0, unallocated_demand: 0, zones_covered: 0 },
      growthTrend: demandResp?.growth_trend || '+0.0%',
      mitigationEfficiency: demandResp?.mitigation_efficiency || '0.0%',
      strategicAdvice: advice,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
