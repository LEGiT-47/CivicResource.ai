import Incident from '../models/Incident.js';
import Personnel from '../models/Personnel.js';
import Resource from '../models/Resource.js';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

const CRISIS_TEMPLATES = {
  normal: {
    label: 'Normal Operations',
    weights: { urgency: 0.35, eta: 0.25, family: 0.25, severity: 0.15 },
    slaMultiplier: 1,
    resourcePriority: ['maintenance', 'water', 'garbage'],
    trafficIndex: 1,
    roadConditionIndex: 1,
  },
  flood: {
    label: 'Flood Mode',
    weights: { urgency: 0.4, eta: 0.2, family: 0.25, severity: 0.15 },
    slaMultiplier: 0.75,
    resourcePriority: ['water', 'maintenance', 'garbage'],
    trafficIndex: 1.3,
    roadConditionIndex: 1.35,
  },
  heatwave: {
    label: 'Heatwave Mode',
    weights: { urgency: 0.32, eta: 0.22, family: 0.28, severity: 0.18 },
    slaMultiplier: 0.82,
    resourcePriority: ['water', 'maintenance', 'garbage'],
    trafficIndex: 1.1,
    roadConditionIndex: 1.05,
  },
  festival: {
    label: 'Festival Mode',
    weights: { urgency: 0.34, eta: 0.28, family: 0.24, severity: 0.14 },
    slaMultiplier: 0.85,
    resourcePriority: ['garbage', 'water', 'maintenance'],
    trafficIndex: 1.4,
    roadConditionIndex: 1.15,
  },
  strike: {
    label: 'Strike Mode',
    weights: { urgency: 0.42, eta: 0.2, family: 0.22, severity: 0.16 },
    slaMultiplier: 0.78,
    resourcePriority: ['maintenance', 'garbage', 'water'],
    trafficIndex: 1.25,
    roadConditionIndex: 1.25,
  },
};

let activeCrisisMode = 'normal';

const safeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const classifyNeed = (value) => {
  const text = String(value || '').toLowerCase();
  if (/(garbage|trash|waste|sanitation|litter|dump)/.test(text)) return 'garbage';
  if (/(water|tank|tanker|pipe|leak|hydrant)/.test(text)) return 'water';
  if (/(maintenance|repair|road|street|drain|sewer|electric|infrastructure)/.test(text)) return 'maintenance';
  return 'general';
};

const incidentNeed = (incident) => {
  const triageNeed = String(incident?.aiTriage?.resourceFamily || incident?.aiTriage?.predictedType || '').toLowerCase();
  if (triageNeed && triageNeed !== 'general') {
    return classifyNeed(triageNeed);
  }

  return classifyNeed(`${incident?.type || ''} ${incident?.title || ''} ${incident?.details || ''}`);
};

const getCrisisTemplate = (mode) => {
  const key = String(mode || activeCrisisMode || 'normal').toLowerCase();
  return {
    mode: CRISIS_TEMPLATES[key] ? key : 'normal',
    ...(CRISIS_TEMPLATES[key] || CRISIS_TEMPLATES.normal),
  };
};

const applyScenarioPreset = (liveInputs = {}) => {
  const scenarioMode = String(liveInputs?.scenario_mode || activeCrisisMode || 'normal').toLowerCase();
  const presets = {
    normal: { weather_rain_mm: 6, event_factor: 1.1, population_density_boost: 1.0, traffic_index: 1.0, road_condition_index: 1.0 },
    flood: { weather_rain_mm: 28, event_factor: 1.45, population_density_boost: 1.2, traffic_index: 1.3, road_condition_index: 1.35 },
    festival: { weather_rain_mm: 4, event_factor: 1.7, population_density_boost: 1.35, traffic_index: 1.4, road_condition_index: 1.15 },
    strike: { weather_rain_mm: 5, event_factor: 1.35, population_density_boost: 1.1, traffic_index: 1.25, road_condition_index: 1.25 },
    heatwave: { weather_rain_mm: 1, event_factor: 1.25, population_density_boost: 1.05, traffic_index: 1.1, road_condition_index: 1.05 },
  };

  const base = presets[scenarioMode] || presets.normal;
  const crisisTemplate = getCrisisTemplate(scenarioMode);
  return {
    scenario_mode: crisisTemplate.mode,
    weather_rain_mm: Number.isFinite(Number(liveInputs?.weather_rain_mm)) ? Number(liveInputs.weather_rain_mm) : base.weather_rain_mm,
    weather_temp_c: Number.isFinite(Number(liveInputs?.weather_temp_c)) ? Number(liveInputs.weather_temp_c) : undefined,
    event_factor: Number.isFinite(Number(liveInputs?.event_factor)) ? Number(liveInputs.event_factor) : base.event_factor,
    population_density_boost: Number.isFinite(Number(liveInputs?.population_density_boost))
      ? Number(liveInputs.population_density_boost)
      : base.population_density_boost,
    traffic_index: Number.isFinite(Number(liveInputs?.traffic_index)) ? Number(liveInputs.traffic_index) : crisisTemplate.trafficIndex,
    road_condition_index: Number.isFinite(Number(liveInputs?.road_condition_index)) ? Number(liveInputs.road_condition_index) : crisisTemplate.roadConditionIndex,
  };
};

const estimateTravelTime = ({ distanceKm, severity, liveInputs, crisisTemplate }) => {
  const trafficIndex = Math.max(0.75, safeNumber(liveInputs?.traffic_index, crisisTemplate.trafficIndex || 1));
  const roadConditionIndex = Math.max(0.7, safeNumber(liveInputs?.road_condition_index, crisisTemplate.roadConditionIndex || 1));
  const rainPenalty = 1 + Math.min(0.5, safeNumber(liveInputs?.weather_rain_mm, 0) / 120);
  const hour = new Date().getHours();
  const peakFactor = (hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21) ? 1.18 : 1;
  const severityBoost = severity === 'critical' ? 0.88 : severity === 'high' ? 0.93 : 1;

  const effectiveSpeedKmh = Math.max(14, 34 / (trafficIndex * roadConditionIndex * rainPenalty * peakFactor));
  const predictedMinutes = Math.max(4, (safeNumber(distanceKm, 0) / effectiveSpeedKmh) * 60 * severityBoost);
  return {
    predictedMinutes: Number(predictedMinutes.toFixed(1)),
    factors: {
      trafficIndex: Number(trafficIndex.toFixed(2)),
      roadConditionIndex: Number(roadConditionIndex.toFixed(2)),
      rainPenalty: Number(rainPenalty.toFixed(2)),
      peakFactor: Number(peakFactor.toFixed(2)),
    },
  };
};

const deriveLearningWeights = (resolvedIncidents = [], crisisTemplate) => {
  if (!resolvedIncidents.length) {
    return {
      urgency: crisisTemplate.weights.urgency,
      eta: crisisTemplate.weights.eta,
      family: crisisTemplate.weights.family,
      severity: crisisTemplate.weights.severity,
      confidence: 0,
      samples: 0,
    };
  }

  const rows = resolvedIncidents
    .map((incident) => ({
      success: incident?.outcomeLearning?.success !== false,
      rating: safeNumber(incident?.outcomeLearning?.citizenRating, 3),
      resolutionMins: safeNumber(incident?.outcomeLearning?.actualResolutionMinutes, 120),
      trust: safeNumber(incident?.trustScore, 50),
      family: incidentNeed(incident),
    }))
    .filter((row) => Number.isFinite(row.resolutionMins));

  if (!rows.length) {
    return {
      urgency: crisisTemplate.weights.urgency,
      eta: crisisTemplate.weights.eta,
      family: crisisTemplate.weights.family,
      severity: crisisTemplate.weights.severity,
      confidence: 0,
      samples: 0,
    };
  }

  const avgResolution = rows.reduce((sum, row) => sum + row.resolutionMins, 0) / rows.length;
  const successRate = rows.filter((row) => row.success).length / rows.length;
  const avgRating = rows.reduce((sum, row) => sum + row.rating, 0) / rows.length;
  const avgTrust = rows.reduce((sum, row) => sum + row.trust, 0) / rows.length;

  const etaShift = avgResolution <= 70 ? 0.05 : avgResolution >= 150 ? -0.04 : 0;
  const familyShift = avgRating >= 4 ? 0.04 : avgRating <= 2.5 ? -0.03 : 0;
  const urgencyShift = successRate < 0.7 ? 0.04 : 0;
  const severityShift = avgTrust < 55 ? 0.03 : 0;

  const raw = {
    urgency: Math.max(0.15, crisisTemplate.weights.urgency + urgencyShift),
    eta: Math.max(0.12, crisisTemplate.weights.eta + etaShift),
    family: Math.max(0.12, crisisTemplate.weights.family + familyShift),
    severity: Math.max(0.1, crisisTemplate.weights.severity + severityShift),
  };
  const total = raw.urgency + raw.eta + raw.family + raw.severity;

  return {
    urgency: Number((raw.urgency / total).toFixed(3)),
    eta: Number((raw.eta / total).toFixed(3)),
    family: Number((raw.family / total).toFixed(3)),
    severity: Number((raw.severity / total).toFixed(3)),
    confidence: Number(((Math.min(rows.length, 60) / 60) * 100).toFixed(1)),
    samples: rows.length,
    successRate: Number((successRate * 100).toFixed(1)),
    avgRating: Number(avgRating.toFixed(2)),
    avgResolutionMinutes: Number(avgResolution.toFixed(1)),
  };
};

const severityWeight = (severity) => ({ critical: 1.0, high: 0.75, medium: 0.5, low: 0.25 }[severity] || 0.5);

const buildAllocationExplainability = (allocation, zone, incident, scenarioMode, learningWeights, travelModel, crisisTemplate) => {
  const etaNorm = Math.max(0.1, 1 - Number(travelModel?.predictedMinutes || allocation.eta_minutes || 60) / 60);
  const urgencyNorm = Math.min(1, Number(zone?.urgency_score || allocation?.urgency_score || 0) / 30);
  const familyMatch = allocation.preferred_family !== 'general' && allocation.preferred_family === allocation.resource_family ? 1 : 0;
  const severityNorm = severityWeight(incident?.severity);
  const crisisBoost = crisisTemplate.resourcePriority.includes(String(allocation.resource_family || '').toLowerCase()) ? 0.12 : 0;
  const scenarioBoost = scenarioMode !== 'normal' ? 0.08 : 0;

  const score = Math.min(
    100,
    Math.round(
      (
        urgencyNorm * learningWeights.urgency +
        etaNorm * learningWeights.eta +
        familyMatch * learningWeights.family +
        severityNorm * learningWeights.severity +
        scenarioBoost +
        crisisBoost
      ) * 100
    )
  );
  return {
    score,
    why: [
      `Urgency score ${Number(zone?.urgency_score || allocation?.urgency_score || 0).toFixed(1)} with rank #${zone?.urgency_rank || allocation?.urgency_rank}`,
      `Predicted travel time ${travelModel?.predictedMinutes || allocation.eta_minutes} minutes for ${allocation.distance_km} km`,
      familyMatch ? `Resource family match confirmed (${allocation.resource_family})` : `Nearest feasible resource selected (fallback from ${allocation.preferred_family || 'general'})`,
      `Incident severity contribution: ${(severityNorm * 100).toFixed(0)}%`,
    ],
    factors: {
      urgency: Number((urgencyNorm * 100).toFixed(1)),
      eta: Number((etaNorm * 100).toFixed(1)),
      familyMatch: Number((familyMatch * 100).toFixed(1)),
      severity: Number((severityNorm * 100).toFixed(1)),
      trafficIndex: Number(travelModel?.factors?.trafficIndex || 1),
      roadConditionIndex: Number(travelModel?.factors?.roadConditionIndex || 1),
      learningConfidence: Number(learningWeights?.confidence || 0),
    },
  };
};

const buildDemandZones = (incidents, liveInputs = {}) => {
  const bins = {};
  const rainOverride = safeNumber(liveInputs?.weather_rain_mm, NaN);
  const tempOverride = safeNumber(liveInputs?.weather_temp_c, NaN);
  const eventOverride = safeNumber(liveInputs?.event_factor, NaN);
  const populationBoost = safeNumber(liveInputs?.population_density_boost, 1);

  incidents.forEach((incident) => {
    const lat = safeNumber(incident?.location?.lat, 19.076);
    const lng = safeNumber(incident?.location?.lng, 72.8777);
    const key = `${Math.round(lat * 10) / 10}_${Math.round(lng * 10) / 10}`;
    if (!bins[key]) {
      bins[key] = {
        zone_id: key,
        population_density: (9000 + Math.round(Math.abs(lat * lng)) % 7000) * Math.max(0.5, populationBoost),
        complaints_last_7d: 0,
        weather_rain_mm: Number.isFinite(rainOverride) ? rainOverride : 4 + Math.round(Math.abs(lat) % 8),
        weather_temp_c: Number.isFinite(tempOverride) ? tempOverride : 28 + Math.round(Math.abs(lng) % 6),
        event_factor: 1.0,
        historical_daily_avg: 14,
        dominant_need: 'general',
        need_counts: {},
      };
    }

    const need = incidentNeed(incident);
    bins[key].complaints_last_7d += 1;
    bins[key].historical_daily_avg += incident.severity === 'critical' ? 2 : 1;
    bins[key].need_counts[need] = (bins[key].need_counts[need] || 0) + 1;
    if (Number.isFinite(eventOverride)) {
      bins[key].event_factor = Math.max(0, eventOverride);
    } else if (incident.severity === 'critical') {
      bins[key].event_factor = 1.25;
    }
  });

  Object.values(bins).forEach((zone) => {
    const entries = Object.entries(zone.need_counts || {});
    entries.sort((a, b) => b[1] - a[1]);
    zone.dominant_need = entries[0]?.[0] || 'general';
    delete zone.need_counts;
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
    if (!incident.assignedPersonnel) {
      incident.assignedPersonnel = personnelId;
    }

    const assignedList = (incident.assignedPersonnelList || []).map((id) => String(id));
    if (!assignedList.includes(String(personnelId))) {
      incident.assignedPersonnelList = [...(incident.assignedPersonnelList || []), personnelId];
    }

    incident.dispatchStatus = 'dispatched';
    if (incident.status === 'resolved') {
      incident.status = 'active';
    }
    incident.workflow = incident.workflow || {};
    if (!incident.workflow.allocatedAt) {
      incident.workflow.allocatedAt = new Date();
    }
    if (!incident.workflow.enRouteAt) {
      incident.workflow.enRouteAt = new Date();
    }
    
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
    const includeAll = String(req.query.all || '').toLowerCase() === 'true';
    const personnel = includeAll ? await Personnel.find({}) : await Personnel.find({ status: 'available' });
    res.json(personnel);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get worker assignments by unit id
// @route   GET /api/dispatch/assignments/:unitId
// @access  Private
export const getWorkerAssignmentsByUnitId = async (req, res) => {
  const unitId = String(req.params.unitId || '').trim().toUpperCase();

  if (!unitId) {
    return res.status(400).json({ message: 'unitId is required' });
  }

  try {
    const personnel = await Personnel.findOne({ 'contact.unitId': unitId })
      .populate('currentIncident', 'title severity status dispatchStatus trackingId location createdAt updatedAt');

    if (!personnel) {
      return res.status(404).json({ message: 'Personnel unit not found' });
    }

    const assignedIncidents = await Incident.find({
      $or: [{ assignedPersonnel: personnel._id }, { assignedPersonnelList: personnel._id }],
      status: { $ne: 'resolved' },
    })
      .sort({ updatedAt: -1 })
      .select('title severity status dispatchStatus trackingId location createdAt updatedAt');

    res.json({
      personnel: {
        _id: personnel._id,
        name: personnel.name,
        type: personnel.type,
        status: personnel.status,
        unitId: personnel.contact?.unitId,
      },
      activeIncident: personnel.currentIncident || null,
      assignedIncidents,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get incidents assigned to logged-in worker by their user's associated personnel
// @route   GET /api/dispatch/my-assignments
// @access  Private (Worker/Responder)
export const getMyAssignments = async (req, res) => {
  try {
    let personnel = null;
    if (req.user?.unitId) {
      personnel = await Personnel.findOne({ 'contact.unitId': req.user.unitId.toUpperCase() });
    }

    if (!personnel && req.user?.name) {
      personnel = await Personnel.findOne({ name: req.user.name });
    }

    if (!personnel) {
      return res.json([]);
    }

    const incidents = await Incident.find({
      $or: [{ assignedPersonnel: personnel._id }, { assignedPersonnelList: personnel._id }],
    })
      .populate('assignedPersonnel', 'name type contact status location')
      .sort({ updatedAt: -1 })
      .select('title severity status dispatchStatus type trackingId location details assignedPersonnel createdAt updatedAt');

    res.json(incidents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Quick AI Analysis Proxy
// @route   POST /api/dispatch/ai-analyze
export const getAIAnalysis = async (req, res) => {
  try {
    const liveInputs = applyScenarioPreset(req.body?.liveInputs || {});
    const crisisTemplate = getCrisisTemplate(liveInputs.scenario_mode);
    const incidents = await Incident.find({ status: { $ne: 'resolved' } });
    const resolvedForLearning = await Incident.find({
      status: 'resolved',
      'outcomeLearning.usedForTraining': true,
    })
      .sort({ updatedAt: -1 })
      .limit(120)
      .select('outcomeLearning severity type trustScore aiTriage createdAt updatedAt');
    const resources = await Resource.find({ status: { $ne: 'offline' } });
    const learningWeights = deriveLearningWeights(resolvedForLearning, crisisTemplate);
    const payloadIncidents = incidents.map((i) => ({
      id: String(i._id),
      type: i.type,
      severity: i.severity,
      lat: safeNumber(i?.location?.lat, 19.076),
      lng: safeNumber(i?.location?.lng, 72.8777),
    }));

    const payloadResources = resources.map((r) => ({
      id: String(r._id),
      name: r.name,
      type: r.type,
      status: r.status,
      lat: safeNumber(r?.location?.lat, 19.076),
      lng: safeNumber(r?.location?.lng, 72.8777),
    }));

    const zones = buildDemandZones(incidents, liveInputs);

    const [clustersResp, heatmapResp, demandResp, allocationResp] = await Promise.all([
      postAI('/analyze/clustering', { incidents: payloadIncidents }),
      postAI('/analyze/heatmap-weights', { incidents: payloadIncidents }),
      postAI('/analyze/demand-forecast', { zones }),
      postAI('/analyze/resource-allocation', { zones, resources: payloadResources }),
    ]);

    const zoneById = new Map((demandResp?.zones || []).map((zone) => [String(zone.zone_id), zone]));
    const incidentsByZone = incidents.reduce((acc, incident) => {
      const lat = safeNumber(incident?.location?.lat, 19.076);
      const lng = safeNumber(incident?.location?.lng, 72.8777);
      const key = `${Math.round(lat * 10) / 10}_${Math.round(lng * 10) / 10}`;
      acc[key] = acc[key] || [];
      acc[key].push(incident);
      return acc;
    }, {});

    const enrichedAllocationPlan = (allocationResp?.allocations || []).map((allocation) => {
      const zone = zoneById.get(String(allocation.zone_id));
      const relatedIncidents = incidentsByZone[String(allocation.zone_id)] || [];
      const topIncident = [...relatedIncidents].sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))[0] || null;
      const travelModel = estimateTravelTime({
        distanceKm: Number(allocation.distance_km || 0),
        severity: topIncident?.severity,
        liveInputs,
        crisisTemplate,
      });
      const explainability = buildAllocationExplainability(
        allocation,
        zone,
        topIncident,
        liveInputs.scenario_mode,
        learningWeights,
        travelModel,
        crisisTemplate
      );
      const crisisPriorityBoost = crisisTemplate.resourcePriority.includes(String(allocation.resource_family || '').toLowerCase()) ? 8 : 0;
      return {
        ...allocation,
        predicted_travel_time_minutes: travelModel.predictedMinutes,
        route_factors: travelModel.factors,
        ranking_score: Math.min(100, explainability.score + crisisPriorityBoost),
        explainability,
        linked_incident: topIncident
          ? {
              id: String(topIncident._id),
              title: topIncident.title,
              severity: topIncident.severity,
              verificationMode: topIncident.verificationMode,
            }
          : null,
      };
    })
      .sort((a, b) => Number(b.ranking_score || 0) - Number(a.ranking_score || 0));

    const now = new Date();
    const escalationCandidates = incidents.filter((incident) => {
      if (incident?.status === 'resolved') return false;
      const deadline = incident?.sla?.deadlineAt ? new Date(incident.sla.deadlineAt) : null;
      const adjustedDeadline = deadline
        ? new Date(new Date(incident.createdAt).getTime() + (deadline.getTime() - new Date(incident.createdAt).getTime()) * crisisTemplate.slaMultiplier)
        : null;
      return Boolean(adjustedDeadline && now > adjustedDeadline && incident?.dispatchStatus !== 'completed');
    });

    const escalationPlan = escalationCandidates.slice(0, 8).map((incident) => ({
      incidentId: String(incident._id),
      title: incident.title,
      severity: incident.severity,
      verificationMode: incident.verificationMode,
      reason: 'SLA deadline breached, prioritize reassignment and backup dispatch',
      overdueMinutes: Math.max(1, Math.round((now.getTime() - new Date(incident.sla.deadlineAt).getTime()) / 60000)),
    }));

    if (escalationCandidates.length > 0) {
      await Promise.all(
        escalationCandidates.map(async (incident) => {
          incident.sla = incident.sla || {};
          if (!incident.sla.escalated) {
            incident.sla.escalated = true;
            incident.sla.escalationLevel = Math.min(3, Number(incident.sla.escalationLevel || 0) + 1);
            incident.sla.escalationReason = 'Auto-escalated by SLA brain due to deadline breach';
            incident.sla.breachedAt = now;
            if (incident.severity !== 'critical') {
              incident.severity = incident.severity === 'high' ? 'critical' : 'high';
            }
            if (incident.status === 'active') {
              incident.status = 'investigating';
            }
            await incident.save();
          }
        })
      );
    }

    const fusionOverview = incidents.reduce(
      (acc, incident) => {
        if (incident?.fusion?.clusterId) {
          acc.clusters.add(String(incident.fusion.clusterId));
        }
        acc.duplicates += Number(incident?.fusion?.duplicateCount || 0);
        return acc;
      },
      { clusters: new Set(), duplicates: 0 }
    );

    const trustOverview = incidents.reduce(
      (acc, incident) => {
        const mode = String(incident.verificationMode || 'needs-confirmation');
        acc[mode] = (acc[mode] || 0) + 1;
        return acc;
      },
      { verified: 0, 'likely-valid': 0, 'needs-confirmation': 0, 'likely-fake': 0 }
    );

    const topZone = demandResp?.zones?.[0];
    const advice = topZone
      ? `Prioritize zone ${topZone.zone_id} with urgency rank ${topZone.urgency_rank}. Dispatch ${topZone.recommended_units} units immediately.`
      : 'Maintain current distribution and continue monitoring.';

    res.json({
      proneAreas: heatmapResp?.data || [],
      clusters: clustersResp?.clusters || [],
      demandForecast: demandResp?.zones || [],
      allocationPlan: enrichedAllocationPlan,
      allocationSummary: allocationResp?.summary || { allocated: 0, unallocated_demand: 0, zones_covered: 0 },
      growthTrend: demandResp?.growth_trend || '+0.0%',
      mitigationEfficiency: demandResp?.mitigation_efficiency || '0.0%',
      trustOverview,
      fusionOverview: {
        clusters: fusionOverview.clusters.size,
        duplicateMentions: fusionOverview.duplicates,
      },
      escalationPlan,
      strategicAdvice: advice,
      liveInputs,
      crisisMode: {
        mode: crisisTemplate.mode,
        label: crisisTemplate.label,
        resourcePriority: crisisTemplate.resourcePriority,
        slaMultiplier: crisisTemplate.slaMultiplier,
      },
      outcomeLearning: {
        weights: learningWeights,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get active crisis mode template
// @route   GET /api/dispatch/crisis-mode
// @access  Private
export const getCrisisMode = async (req, res) => {
  const template = getCrisisTemplate(activeCrisisMode);
  res.json({
    mode: template.mode,
    label: template.label,
    weights: template.weights,
    slaMultiplier: template.slaMultiplier,
    resourcePriority: template.resourcePriority,
    trafficIndex: template.trafficIndex,
    roadConditionIndex: template.roadConditionIndex,
  });
};

// @desc    Set active crisis mode template
// @route   POST /api/dispatch/crisis-mode
// @access  Private
export const setCrisisMode = async (req, res) => {
  const requested = String(req.body?.mode || '').toLowerCase();
  if (!CRISIS_TEMPLATES[requested]) {
    return res.status(400).json({
      message: 'Invalid crisis mode',
      allowedModes: Object.keys(CRISIS_TEMPLATES),
    });
  }

  activeCrisisMode = requested;
  const template = getCrisisTemplate(activeCrisisMode);
  return res.status(200).json({
    message: `${template.label} activated`,
    mode: template.mode,
    template,
  });
};

// @desc    Operator AI copilot command interface
// @route   POST /api/dispatch/copilot
// @access  Private
export const runOperatorCopilot = async (req, res) => {
  try {
    const query = String(req.body?.query || '').trim();
    if (!query) {
      return res.status(400).json({ message: 'query is required' });
    }

    const normalizedQuery = query.toLowerCase();
    const incidents = await Incident.find({ status: { $ne: 'resolved' } })
      .sort({ createdAt: -1 })
      .limit(200);
    const resources = await Resource.find({ status: { $ne: 'offline' } }).limit(200);

    const liveInputs = applyScenarioPreset(req.body?.liveInputs || {});
    const zones = buildDemandZones(incidents, liveInputs);
    const demandResp = await postAI('/analyze/demand-forecast', { zones });
    const allocationResp = await postAI('/analyze/resource-allocation', {
      zones,
      resources: resources.map((r) => ({
        id: String(r._id),
        name: r.name,
        type: r.type,
        status: r.status,
        lat: safeNumber(r?.location?.lat, 19.076),
        lng: safeNumber(r?.location?.lng, 72.8777),
      })),
    });

    if (normalizedQuery.includes('highest-risk')) {
      const need = classifyNeed(normalizedQuery);
      const highRisk = (demandResp?.zones || [])
        .filter((z) => (need === 'general' ? true : String(z?.dominant_need || '').toLowerCase() === need))
        .slice(0, 5)
        .map((z) => ({
          zone: z.zone_id,
          urgencyScore: Number(z.urgency_score || 0).toFixed(1),
          rank: z.urgency_rank,
          dominantNeed: z.dominant_need,
          recommendedUnits: z.recommended_units,
        }));

      return res.json({
        query,
        answer: highRisk.length
          ? `Top ${need === 'general' ? '' : `${need} `}risk zones for next 2 hours are ready.`
          : 'No high-risk zones detected for the requested service family.',
        cards: highRisk,
      });
    }

    if (normalizedQuery.includes('why was') && normalizedQuery.includes('chosen')) {
      const unitMatch = query.match(/[A-Za-z]{1,3}-\d{1,4}/);
      const unitId = unitMatch ? unitMatch[0].toUpperCase() : null;
      const allocations = allocationResp?.allocations || [];
      const matched = allocations.find((a) => {
        const resource = resources.find((r) => String(r._id) === String(a.resource_id));
        return unitId && String(resource?.name || '').toUpperCase().includes(unitId);
      });

      if (!matched) {
        return res.json({
          query,
          answer: unitId
            ? `No active allocation found for ${unitId}. It may be offline or not in the current recommendation set.`
            : 'Please include a unit id like WT-21 so I can explain allocation logic.',
          cards: [],
        });
      }

      const resource = resources.find((r) => String(r._id) === String(matched.resource_id));
      return res.json({
        query,
        answer: `${resource?.name || 'Selected unit'} was chosen because it matches ${matched.preferred_family} demand with ETA ${matched.eta_minutes} minutes at distance ${matched.distance_km} km.`,
        cards: [
          {
            resource: resource?.name,
            zone: matched.zone_id,
            preferredFamily: matched.preferred_family,
            resourceFamily: matched.resource_family,
            etaMinutes: matched.eta_minutes,
            distanceKm: matched.distance_km,
          },
        ],
      });
    }

    const criticalCount = incidents.filter((i) => i.severity === 'critical').length;
    const overloadedZones = (demandResp?.zones || []).filter((z) => Number(z.urgency_score || 0) >= 18).length;
    return res.json({
      query,
      answer: `Civic copilot summary: ${criticalCount} critical incidents and ${overloadedZones} high-stress zones. Ask for highest-risk zones or why a unit was chosen.`,
      cards: [
        { label: 'Critical Incidents', value: criticalCount },
        { label: 'High-Stress Zones', value: overloadedZones },
        { label: 'Mode', value: getCrisisTemplate(activeCrisisMode).label },
      ],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
