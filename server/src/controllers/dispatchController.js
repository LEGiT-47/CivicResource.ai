import Incident from '../models/Incident.js';
import Personnel from '../models/Personnel.js';
import Resource from '../models/Resource.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

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
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const safeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const classifyNeed = (value) => {
  const text = String(value || '').toLowerCase();
  if (/(garbage|trash|waste|sanitation|litter|dump)/.test(text)) return 'garbage';
  if (/(water|tank|tanker|pipe|leak|hydrant)/.test(text)) return 'water';
  if (/(maintenance|repair|road|street|drain|sewer|electric|infrastructure)/.test(text)) return 'maintenance';
  return 'general';
};

const classifyIncidentFamily = (incident) => {
  const text = `${incident?.type || ''} ${incident?.title || ''} ${incident?.details || ''}`.toLowerCase();
  if (/(water|tanker|pipe|leak|hydrant|flood|drain|sewer)/.test(text)) return 'water';
  if (/(garbage|trash|waste|sanitation|litter|dump)/.test(text)) return 'garbage';
  if (/(road|pothole|street|bridge|traffic|signal|maintenance)/.test(text)) return 'maintenance';
  if (/(fire|crime|unsafe|hazard|assault|police)/.test(text)) return 'safety';
  return 'general';
};

const classifyResourceServiceFamily = (resource) => {
  const text = `${resource?.type || ''} ${resource?.name || ''}`.toLowerCase();
  if (/(garbage|trash|waste|sanitation|litter|dump)/.test(text)) return 'garbage';
  if (/(water|tanker|pipe|pipeline|hydrant|wt-)/.test(text)) return 'water';
  if (/(road|pothole|maintenance|repair|utility|public_works|public works)/.test(text)) return 'maintenance';
  if (/(fire)/.test(text)) return 'fire';
  if (/(medical|ambulance)/.test(text)) return 'medical';
  if (/(police|patrol)/.test(text)) return 'safety';
  return 'general';
};

const scoreResourceForIncident = ({ incident, resource, aiPreferredResourceId }) => {
  const family = classifyIncidentFamily(incident);
  const resourceFamily = classifyResourceServiceFamily(resource);
  const km = distanceKm(resource?.location, incident?.location);

  const familyPenalty =
    family === 'general'
      ? 0.7
      : resourceFamily === family
        ? 0
        : resourceFamily === 'general'
          ? 1.2
          : 2.4;

  const aiPreferenceBonus = String(resource?._id) === String(aiPreferredResourceId || '') ? -0.5 : 0;
  return km + familyPenalty + aiPreferenceBonus;
};

const incidentToPersonnelType = (incident) => {
  const incidentType = String(incident?.type || '').toLowerCase();
  const need = incidentNeed(incident);

  if (incidentType === 'fire') return 'fire';
  if (incidentType === 'medical') return 'medical';
  if (incidentType === 'crime' || incidentType === 'safety' || incidentType === 'traffic') return 'police';
  if (incidentType === 'sanitation' || need === 'garbage') return 'sanitation';
  return 'utility';
};

const severityDemandWeight = {
  low: 1,
  medium: 1.6,
  high: 2.4,
  critical: 3.2,
};

const incidentDemandEstimate = (incident, family) => {
  const details = `${incident?.title || ''} ${incident?.details || ''}`.toLowerCase();
  const severityFactor = severityDemandWeight[String(incident?.severity || 'medium').toLowerCase()] || 1.6;

  if (family === 'water') {
    const litersMatch = details.match(/(\d{2,5})\s*(l|lit|liter|litre|liters|litres)/i);
    const liters = litersMatch ? Math.max(250, Math.min(12000, Number(litersMatch[1]))) : Math.round(900 * severityFactor);
    return { units: liters, unitLabel: 'liters' };
  }

  if (family === 'garbage') {
    const tonMatch = details.match(/(\d+(?:\.\d+)?)\s*(ton|tons|tonne|tonnes|t)/i);
    const kgMatch = details.match(/(\d{2,5})\s*(kg|kilogram|kilograms)/i);
    let wasteKg = Math.round(300 * severityFactor);
    if (tonMatch) {
      wasteKg = Math.round(Number(tonMatch[1]) * 1000);
    } else if (kgMatch) {
      wasteKg = Math.round(Number(kgMatch[1]));
    }
    return { units: Math.max(100, Math.min(9000, wasteKg)), unitLabel: 'kg' };
  }

  return { units: Math.max(1, Math.round(1 * severityFactor)), unitLabel: 'jobs' };
};

const canResourceServeFamily = (resource, family) => {
  if (family === 'general') return true;
  const resourceFamily = classifyResourceServiceFamily(resource);
  if (resourceFamily === family) return true;
  if (resourceFamily === 'general') {
    // General-purpose units can support maintenance/general, not specialized water/garbage runs.
    return family === 'maintenance';
  }

  const text = `${resource?.name || ''} ${resource?.type || ''}`.toLowerCase();
  if (family === 'water') return /(water|tanker|pipeline|hydrant|wt-)/.test(text);
  if (family === 'garbage') return /(garbage|waste|trash|sanitation)/.test(text);
  if (family === 'maintenance') return /(road|repair|maintenance|utility|public_works|public works)/.test(text);
  if (family === 'safety') return /(police|patrol|fire)/.test(text);
  return false;
};

const resourceCapacityForFamily = (resource, family) => {
  const caps = resource?.serviceCapabilities || {};
  const text = `${resource?.name || ''} ${resource?.type || ''}`.toLowerCase();
  const defaultWater = /(water|tanker)/.test(text) ? 9000 : 1800;
  const defaultWaste = /(garbage|waste|trash)/.test(text) ? 4200 : 1200;
  const waterCapRaw = safeNumber(caps.waterLitersCapacity, NaN);
  const wasteCapRaw = safeNumber(caps.wasteKgCapacity, NaN);
  const resolvedWaterCapacity = Number.isFinite(waterCapRaw) && waterCapRaw > 0 ? waterCapRaw : defaultWater;
  const resolvedWasteCapacity = Number.isFinite(wasteCapRaw) && wasteCapRaw > 0 ? wasteCapRaw : defaultWaste;

  return {
    capacityUnits:
      family === 'water'
        ? Math.max(600, resolvedWaterCapacity)
        : family === 'garbage'
          ? Math.max(300, resolvedWasteCapacity)
          : Math.max(1, safeNumber(caps.maxStopsPerTrip, 3)),
    maxStops: Math.max(1, safeNumber(caps.maxStopsPerTrip, 3)),
    serviceRadiusKm: Math.max(1, safeNumber(caps.serviceRadiusKm, 6)),
    shiftRemainingMinutes: Math.max(20, safeNumber(caps.shiftRemainingMinutes, 240)),
    crewSize: Math.max(1, safeNumber(caps.crewSize, 2)),
    refillMinutes: Math.max(5, safeNumber(caps.refillMinutes, 20)),
  };
};

const buildClusterInstruction = ({ clusterId, stopOrder, totalStops, family }) => ({
  english: `Cluster ${clusterId}: stop ${stopOrder}/${totalStops}. Complete service and update GPS before proceeding to the next grouped complaint (${family}).`,
  hindi: `क्लस्टर ${clusterId}: स्टॉप ${stopOrder}/${totalStops}. सेवा पूरी करें और अगली समूह शिकायत (${family}) पर जाने से पहले GPS अपडेट करें।`,
  marathi: `क्लस्टर ${clusterId}: थांबा ${stopOrder}/${totalStops}. सेवा पूर्ण करा आणि पुढील गट तक्रारीकडे (${family}) जाण्यापूर्वी GPS अपडेट करा.`,
});

const distanceKm = (a, b) => {
  const lat1 = safeNumber(a?.lat, 19.076);
  const lng1 = safeNumber(a?.lng, 72.8777);
  const lat2 = safeNumber(b?.lat, 19.076);
  const lng2 = safeNumber(b?.lng, 72.8777);
  const toRad = (v) => (Math.PI / 180) * Number(v || 0);
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const c =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
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
        freshness_factor: 1.0,
        latest_incident_at: null,
        need_counts: {},
      };
    }

    const need = incidentNeed(incident);
    bins[key].complaints_last_7d += 1;
    bins[key].historical_daily_avg += incident.severity === 'critical' ? 2 : 1;
    bins[key].need_counts[need] = (bins[key].need_counts[need] || 0) + 1;

    const createdAt = incident.createdAt ? new Date(incident.createdAt).getTime() : Date.now();
    const latestAt = bins[key].latest_incident_at ? new Date(bins[key].latest_incident_at).getTime() : 0;
    if (!bins[key].latest_incident_at || createdAt > latestAt) {
      bins[key].latest_incident_at = new Date(createdAt).toISOString();
    }

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
    const ageMinutes = zone.latest_incident_at
      ? Math.max(1, (Date.now() - new Date(zone.latest_incident_at).getTime()) / 60000)
      : 180;
    zone.freshness_factor = Math.max(0.85, Math.min(1.4, 1.25 - Math.log1p(ageMinutes) / 7));
    delete zone.need_counts;
    delete zone.latest_incident_at;
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

const severityWeightScore = (severity) => ({ critical: 1, high: 0.8, medium: 0.55, low: 0.3 }[String(severity || '').toLowerCase()] || 0.5);

const familyPriorityScore = (family) => ({ water: 0.95, garbage: 0.9, maintenance: 0.82, general: 0.68, safety: 0.78 }[String(family || '').toLowerCase()] || 0.7);

const buildClusterFeasibilityPayload = (cluster, liveInputs = {}) => {
  const incidents = Array.isArray(cluster?.incidents) ? cluster.incidents : [];
  const capacity = cluster?.capacity || {};
  const incidentCount = Math.max(1, incidents.length || safeNumber(capacity.plannedStops, 1));
  const capacityUnits = Math.max(1, safeNumber(capacity.units, 1));
  const demandUnits = Math.max(0, safeNumber(capacity.used, 0));
  const utilizationPercent = Number.isFinite(Number(capacity.utilizationPercent))
    ? Math.max(0, safeNumber(capacity.utilizationPercent, 0))
    : (demandUnits / capacityUnits) * 100;
  const avgDistanceKm = incidents.length
    ? incidents.reduce((sum, incident) => sum + safeNumber(incident.distanceFromSeedKm, 0), 0) / incidents.length
    : safeNumber(cluster?.radiusKm, 4);
  const avgSeverityScore = incidents.length
    ? incidents.reduce((sum, incident) => sum + severityWeightScore(incident.severity) * 100, 0) / incidents.length
    : 50;
  const mixedFamilyRatio = Math.max(0, Math.min(1, incidents.length > 1 ? incidents.filter((incident) => safeNumber(incident.demandUnits, 0) > 0).length / (incidentCount * 2) : 0.15));
  const hasResource = Boolean(cluster?.assignment?.resource);
  const hasPersonnel = Boolean(cluster?.assignment?.personnel);
  const family = String(cluster?.serviceFamily || 'general').toLowerCase();
  const familyMatchRatio = cluster?.assignment?.resource
    ? family === 'water'
      ? /water|tanker|drain|flood/i.test(String(cluster.assignment.resource.name || ''))
        ? 1
        : 0.45
      : family === 'garbage'
        ? /garbage|waste|trash|sanitation/i.test(String(cluster.assignment.resource.name || ''))
          ? 1
          : 0.4
        : family === 'maintenance'
          ? /road|repair|maintenance|public works|public_works/i.test(String(cluster.assignment.resource.name || ''))
            ? 1
            : 0.5
          : 0.65
    : hasPersonnel
      ? 0.72
      : 0.35;

  return {
    cluster_id: String(cluster?.clusterId || ''),
    service_family: family,
    incident_count: incidentCount,
    capacity_units: capacityUnits,
    demand_units: demandUnits,
    utilization_percent: utilizationPercent,
    avg_distance_km: avgDistanceKm,
    avg_severity_score: avgSeverityScore,
    mixed_family_ratio: mixedFamilyRatio,
    available_personnel: hasPersonnel ? 1 : 0,
    resource_available: hasResource,
    shift_remaining_minutes: safeNumber(capacity.shiftRemainingMinutes, 120),
    refill_minutes: safeNumber(capacity.refillMinutes, 20),
    weather_rain_mm: safeNumber(liveInputs?.weather_rain_mm, 0),
    traffic_index: safeNumber(liveInputs?.traffic_index, 1),
    road_condition_index: safeNumber(liveInputs?.road_condition_index, 1),
    family_match_ratio: familyMatchRatio,
    crew_size: safeNumber(capacity.crewSize, hasPersonnel ? 2 : 1),
    radius_km: safeNumber(cluster?.radiusKm, 4),
    queue_pressure: Math.max(0, incidentCount - safeNumber(capacity.maxStops, incidentCount)) / Math.max(1, safeNumber(capacity.maxStops, incidentCount)),
  };
};

const fallbackClusterFeasibilityScore = (cluster) => {
  const capacity = cluster?.capacity || {};
  const incidents = Array.isArray(cluster?.incidents) ? cluster.incidents : [];
  const incidentCount = Math.max(1, incidents.length || safeNumber(capacity.plannedStops, 1));
  const utilization = Number.isFinite(Number(capacity.utilizationPercent)) ? safeNumber(capacity.utilizationPercent, 0) : 0;
  const underCapacity = Math.max(0, 100 - utilization) / 100;
  const compactness = Math.max(0, 1 - safeNumber(cluster?.radiusKm, 4) / 10);
  const familyScore = familyPriorityScore(cluster?.serviceFamily);
  const resourceScore = cluster?.assignment?.resource ? 1 : 0.72;
  const personnelScore = cluster?.assignment?.personnel ? 1 : 0.78;
  const severityScore = incidents.length
    ? incidents.reduce((sum, incident) => sum + severityWeightScore(incident.severity), 0) / incidents.length
    : 0.5;

  const score = Math.max(
    0,
    Math.min(
      100,
      42 + familyScore * 18 + severityScore * 14 + underCapacity * 16 + compactness * 10 + resourceScore * 6 + personnelScore * 4 - Math.max(0, incidentCount - safeNumber(capacity.maxStops, incidentCount)) * 2
    )
  );

  return {
    feasibility_score: Number(score.toFixed(1)),
    feasibility_probability: Number((score / 100).toFixed(3)),
    source: 'heuristic-fallback',
  };
};

const localClusterPriorityScore = (cluster, feasibilityScore) => {
  const incidents = Array.isArray(cluster?.incidents) ? cluster.incidents : [];
  const severityAvg = incidents.length ? incidents.reduce((sum, incident) => sum + severityWeightScore(incident.severity), 0) / incidents.length : 0.5;
  const capacity = cluster?.capacity || {};
  const utilization = Number.isFinite(Number(capacity.utilizationPercent)) ? safeNumber(capacity.utilizationPercent, 0) : 0;
  const utilizationFit = utilization <= 100 ? 1 - utilization / 120 : Math.max(0, 1 - (utilization - 100) / 80);
  const compactness = Math.max(0, 1 - safeNumber(cluster?.radiusKm, 4) / 10);
  const familyScore = familyPriorityScore(cluster?.serviceFamily);
  const resourceScore = cluster?.assignment?.resource ? 1 : 0.7;
  const personnelScore = cluster?.assignment?.personnel ? 1 : 0.8;

  return Math.max(
    0,
    Math.min(
      100,
      (feasibilityScore * 0.62) + (familyScore * 14) + (severityAvg * 10) + (utilizationFit * 9) + (compactness * 5) + (resourceScore * 3) + (personnelScore * 2)
    )
  );
};

const clusterDedupKey = (cluster) => {
  const firstIncident = Array.isArray(cluster?.incidents) && cluster.incidents.length ? cluster.incidents[0] : null;
  const lat = safeNumber(firstIncident?.location?.lat, 0);
  const lng = safeNumber(firstIncident?.location?.lng, 0);
  const geo = `${Math.round(lat * 100) / 100}_${Math.round(lng * 100) / 100}`;
  return [
    String(cluster?.serviceFamily || 'general'),
    geo,
    String(cluster?.assignment?.resource?.id || 'none'),
    String(Math.round(safeNumber(cluster?.capacity?.units, 0))),
    String(Math.round(safeNumber(cluster?.capacity?.used, 0))),
  ].join('|');
};

// @desc    Dispatch personnel to an incident with a resource
// @route   POST /api/dispatch/assign
// @access  Private (Officer)
export const assignPersonnel = async (req, res) => {
  const { incidentId, personnelId, personnelIds, resourceId } = req.body;
  const idsToProcess = Array.isArray(personnelIds) ? personnelIds : (personnelId ? [personnelId] : []);

  if (!incidentId || idsToProcess.length === 0) {
    return res.status(400).json({ message: 'Incident and Personnel selection required' });
  }

  try {
    const incident = await Incident.findById(incidentId);
    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    let resource = resourceId ? await Resource.findById(resourceId) : null;
    const results = [];
    let didDispatch = false;
    let didQueue = false;
    const expectedType = incidentToPersonnelType(incident);

    for (const pId of idsToProcess) {
      const personnel = await Personnel.findById(pId);
      if (!personnel) continue;

      const personnelType = String(personnel.type || '').toLowerCase();
      if (personnelType !== expectedType) {
        results.push({ id: pId, status: 'skipped_type_mismatch', expectedType, actualType: personnelType || 'unknown' });
        continue;
      }

      // Handle Queuing if busy
      if (personnel.status === 'busy') {
        if (!personnel.taskQueue.includes(incidentId) && personnel.taskQueue.length < 5) {
          personnel.taskQueue.push(incidentId);
          await personnel.save();
          results.push({ id: pId, status: 'queued' });
          didQueue = true;
        }
        continue;
      }

      if (personnel.status === 'off-duty') {
        results.push({ id: pId, status: 'skipped_off_duty' });
        continue;
      }

      // Live Dispatch
      const finalResource = resource || (personnel.assignedResource ? await Resource.findById(personnel.assignedResource) : null);
      
      personnel.status = 'busy';
      personnel.currentIncident = incidentId;
      if (finalResource) {
        personnel.assignedResource = finalResource._id;
        finalResource.status = 'dispatched';
        finalResource.assignedPersonnel = pId;
        finalResource.currentIncident = incidentId;
        await finalResource.save();
      }
      await personnel.save();

      // Update Incident
      if (!incident.assignedPersonnel) incident.assignedPersonnel = pId;
      const assignedList = (incident.assignedPersonnelList || []).map(id => String(id));
      if (!assignedList.includes(String(pId))) {
        incident.assignedPersonnelList.push(pId);
      }
      results.push({ id: pId, status: 'dispatched' });
      didDispatch = true;
    }

    if (didDispatch) {
      incident.dispatchStatus = 'dispatched';
    } else if (!didQueue) {
      incident.dispatchStatus = 'unassigned';
    }
    if (resourceId && !incident.assignedResources.includes(resourceId)) {
      incident.assignedResources.push(resourceId);
    }
    
    incident.workflow = incident.workflow || {};
    if (!incident.workflow.allocatedAt) incident.workflow.allocatedAt = new Date();
    if (!incident.workflow.enRouteAt) incident.workflow.enRouteAt = new Date();
    
    await incident.save();

    res.status(200).json({
      message: `Processed ${idsToProcess.length} personnel for dispatch`,
      results,
      incident
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Worker rejects a queued task
// @route   POST /api/dispatch/reject-task
// @access  Private (Worker)
export const rejectTask = async (req, res) => {
  const { incidentId, reason } = req.body;
  const unitId = req.user?.unitId;

  try {
    const personnel = await Personnel.findOne({ 'contact.unitId': unitId });
    if (!personnel) {
      return res.status(404).json({ message: 'Personnel not found' });
    }

    // Remove from queue
    personnel.taskQueue = (personnel.taskQueue || []).filter(id => String(id) !== String(incidentId));
    
    // If it was the current incident (unlikely but possible if they want to drop current)
    if (String(personnel.currentIncident) === String(incidentId)) {
      personnel.currentIncident = null;
      personnel.status = personnel.taskQueue.length > 0 ? 'busy' : 'available';
    }

    await personnel.save();

    // Update incident to be unassigned
    const incident = await Incident.findById(incidentId);
    if (incident) {
      incident.assignedPersonnel = null;
      incident.dispatchStatus = 'unassigned';
      incident.assignedPersonnelList = (incident.assignedPersonnelList || []).filter(id => String(id) !== String(personnel._id));
      await incident.save();
    }

    res.status(200).json({ message: 'Task rejected successfully', personnel });
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
    const personnel = includeAll
      ? await Personnel.find({}).populate('currentIncident', 'title severity status dispatchStatus trackingId location tracking workflow createdAt updatedAt')
      : await Personnel.find({ status: 'available' });
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
      .populate('currentIncident', 'title severity status dispatchStatus trackingId location clustering createdAt updatedAt');

    if (!personnel) {
      return res.status(404).json({ message: 'Personnel unit not found' });
    }

    const assignedIncidents = await Incident.find({
      $or: [{ assignedPersonnel: personnel._id }, { assignedPersonnelList: personnel._id }],
    })
      .sort({ updatedAt: -1 })
      .select('title severity status dispatchStatus trackingId location tracking workflow clustering createdAt updatedAt');

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
      .select('title severity status dispatchStatus type trackingId location details tracking workflow clustering assignedPersonnel createdAt updatedAt');

    res.json(incidents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Start worker journey simulation for logged-in responder
// @route   POST /api/dispatch/start-journey-simulation
// @access  Private (Worker/Responder)
export const startJourneySimulation = async (req, res) => {
  try {
    let personnel = null;
    if (req.user?.unitId) {
      personnel = await Personnel.findOne({ 'contact.unitId': String(req.user.unitId).toUpperCase() });
    }

    if (!personnel && req.user?.name) {
      personnel = await Personnel.findOne({ name: req.user.name });
    }

    if (!personnel || !personnel.contact?.unitId) {
      return res.status(404).json({ message: 'Unable to resolve responder profile for simulation.' });
    }

    const requestedIncidentId = String(req.body?.incidentId || '').trim();
    let incident = null;

    if (requestedIncidentId) {
      incident = await Incident.findById(requestedIncidentId);
    }

    if (!incident && personnel.currentIncident) {
      incident = await Incident.findById(personnel.currentIncident);
    }

    if (!incident) {
      incident = await Incident.findOne({
        $or: [{ assignedPersonnel: personnel._id }, { assignedPersonnelList: personnel._id }],
        status: { $ne: 'resolved' },
      }).sort({ createdAt: -1 });
    }

    if (!incident) {
      return res.status(404).json({ message: 'No active assigned incident found for this unit.' });
    }

    if (String(incident.status || '').toLowerCase() === 'resolved') {
      return res.status(400).json({ message: 'Incident is already resolved. Choose an active incident.' });
    }

    const intervalMinutes = Math.max(0.25, safeNumber(req.body?.intervalMinutes, 1));
    const timeScale = Math.max(0.01, safeNumber(req.body?.timeScale, 0.1));
    const speedKmph = Math.max(8, safeNumber(req.body?.speedKmph, 32));
    const workMinutes = safeNumber(req.body?.workMinutes, NaN);
    const plannedTravelMinutes = Number.isFinite(Number(req.body?.plannedTravelMinutes))
      ? Math.max(1, Number(req.body.plannedTravelMinutes))
      : randomInt(11, 20);

    incident.tracking = incident.tracking || {};
    incident.tracking.currentLocation = {
      ...(incident.tracking.currentLocation || {}),
      lat: Number(personnel.location?.lat),
      lng: Number(personnel.location?.lng),
      at: new Date(),
      phase: 'en-route',
      speedKmph,
      etaMinutes: plannedTravelMinutes,
      etaSeconds: plannedTravelMinutes * 60,
      etaUpdatedAt: new Date(),
    };
    if (!Array.isArray(incident.tracking.path) || incident.tracking.path.length === 0) {
      incident.tracking.path = [
        {
          lat: Number(personnel.location?.lat),
          lng: Number(personnel.location?.lng),
          at: new Date(),
          phase: 'en-route',
          speedKmph,
          etaMinutes: plannedTravelMinutes,
          etaSeconds: plannedTravelMinutes * 60,
          etaUpdatedAt: new Date(),
        },
      ];
    }
    await incident.save();

    const scriptPath = path.resolve(__dirname, '../scripts/simulateWorkerJourney.js');
    const args = [
      scriptPath,
      '--unitId',
      String(personnel.contact.unitId).toUpperCase(),
      '--incidentId',
      String(incident._id),
      '--intervalMinutes',
      String(intervalMinutes),
      '--timeScale',
      String(timeScale),
      '--speedKmph',
      String(speedKmph),
      '--plannedTravelMinutes',
      String(plannedTravelMinutes),
    ];

    if (Number.isFinite(workMinutes)) {
      args.push('--workMinutes', String(Math.max(1, workMinutes)));
    }

    const child = spawn('node', args, {
      detached: true,
      stdio: 'ignore',
      cwd: path.resolve(__dirname, '..', '..'),
      env: process.env,
    });
    child.unref();

    return res.status(202).json({
      message: `Journey simulation started for unit ${String(personnel.contact.unitId).toUpperCase()}`,
      pid: child.pid,
      incidentId: String(incident._id),
      unitId: String(personnel.contact.unitId).toUpperCase(),
      simulation: {
        intervalMinutes,
        timeScale,
        speedKmph,
        plannedTravelMinutes,
        workMinutes: Number.isFinite(workMinutes) ? Math.max(1, workMinutes) : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
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
      postAI('/analyze/resource-allocation', { 
        zones, 
        resources: payloadResources,
        personnel: (await Personnel.find({})).map(p => ({
          id: String(p._id),
          name: p.name,
          type: p.type,
          status: p.status,
          lat: safeNumber(p.location?.lat, 19.076),
          lng: safeNumber(p.location?.lng, 72.8777),
          current_task_eta_minutes: 15, // Mock current task ETA
          assigned_resource_id: p.assignedResource ? String(p.assignedResource) : null
        })),
        traffic_index: liveInputs.traffic_index,
        road_condition_index: liveInputs.road_condition_index
      }),
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

// @desc    Apply AI allocation plan to live incidents
// @route   POST /api/dispatch/apply-plan-live
// @access  Private
export const applyPlanLive = async (req, res) => {
  try {
    const liveInputs = applyScenarioPreset(req.body?.liveInputs || {});
    const maxAssignments = Math.max(1, Math.min(10, Number(req.body?.maxAssignments || 3)));

    const incidents = await Incident.find({ status: { $ne: 'resolved' } }).sort({ createdAt: -1 });
    const resources = await Resource.find({ status: { $ne: 'offline' } });

    if (!incidents.length) {
      return res.status(200).json({
        message: 'No active incidents to allocate',
        applied: [],
        summary: { appliedCount: 0, requested: maxAssignments },
      });
    }

    const zones = buildDemandZones(incidents, liveInputs);
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

    const incidentsByZone = incidents.reduce((acc, incident) => {
      const lat = safeNumber(incident?.location?.lat, 19.076);
      const lng = safeNumber(incident?.location?.lng, 72.8777);
      const key = `${Math.round(lat * 10) / 10}_${Math.round(lng * 10) / 10}`;
      acc[key] = acc[key] || [];
      acc[key].push(incident);
      return acc;
    }, {});

    const personnelPool = await Personnel.find({ status: 'available' });
    const resourceById = new Map(resources.map((r) => [String(r._id), r]));
    const newestIncident = incidents.find((incident) => String(incident?.dispatchStatus || '').toLowerCase() === 'unassigned') || incidents[0] || null;
    const aiAllocations = [...(allocationResp?.allocations || [])];
    const fallbackAllocations = incidents
      .filter((incident) => String(incident?.dispatchStatus || '').toLowerCase() === 'unassigned')
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aFresh = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bFresh = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return (severityOrder[b?.severity] || 0) - (severityOrder[a?.severity] || 0) || (bFresh - aFresh);
      })
      .slice(0, Math.max(maxAssignments * 2, 6))
      .map((incident) => {
        const zoneId = `${Math.round(safeNumber(incident?.location?.lat, 19.076) * 10) / 10}_${Math.round(safeNumber(incident?.location?.lng, 72.8777) * 10) / 10}`;
        const nearestResource = [...resources]
          .filter((r) => r.status !== 'offline' && r.status !== 'dispatched' && r.status !== 'maintenance')
          .sort((a, b) => distanceKm(a.location, incident.location) - distanceKm(b.location, incident.location))[0];

        return {
          zone_id: zoneId,
          preferred_family: classifyIncidentFamily(incident),
          resource_id: nearestResource ? String(nearestResource._id) : null,
          priority_incident_id: String(incident._id),
          urgency_score: 50,
        };
      });

    const prioritizedAllocations = aiAllocations.length > 0 ? aiAllocations : fallbackAllocations;

    if (newestIncident && prioritizedAllocations.length > 0) {
      const newestIncidentId = String(newestIncident._id);
      const alreadySelected = prioritizedAllocations.some(
        (allocation) => String(allocation?.priority_incident_id || '') === newestIncidentId
      );

      if (!alreadySelected) {
        const firstAllocation = prioritizedAllocations[0] || {};
        const nearestAvailableResource = [...resources]
          .filter((r) => r.status !== 'offline' && r.status !== 'dispatched' && r.status !== 'maintenance')
          .sort((a, b) => distanceKm(a.location, newestIncident.location) - distanceKm(b.location, newestIncident.location))[0];

        prioritizedAllocations.unshift({
          ...firstAllocation,
          zone_id: `${Math.round(safeNumber(newestIncident?.location?.lat, 19.076) * 10) / 10}_${Math.round(safeNumber(newestIncident?.location?.lng, 72.8777) * 10) / 10}`,
          preferred_family: classifyIncidentFamily(newestIncident),
          resource_id: nearestAvailableResource ? String(nearestAvailableResource._id) : (firstAllocation.resource_id ? String(firstAllocation.resource_id) : null),
          priority_incident_id: newestIncidentId,
        });
      }
    }

    const applied = [];
    const usedIncidentIds = new Set();
    const usedResourceIds = new Set();

    for (const allocation of prioritizedAllocations) {
      if (applied.length >= maxAssignments) break;

      const priorityIncidentId = allocation.priority_incident_id ? String(allocation.priority_incident_id) : null;
      let zoneIncidents = (incidentsByZone[String(allocation.zone_id)] || [])
        .filter((incident) => !usedIncidentIds.has(String(incident._id)));

      if (priorityIncidentId) {
        const priorityIncident = incidents.find((incident) => String(incident._id) === priorityIncidentId);
        zoneIncidents = priorityIncident && !usedIncidentIds.has(priorityIncidentId) ? [priorityIncident] : zoneIncidents;
      }

      const preferredFamily = String(allocation.preferred_family || allocation.resource_family || 'general').toLowerCase();
      const targetIncident = priorityIncidentId
        ? zoneIncidents[0]
        : [...zoneIncidents]
            .sort((a, b) => {
              const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
              const aFamily = classifyIncidentFamily(a);
              const bFamily = classifyIncidentFamily(b);
              const aMatch = aFamily === preferredFamily ? 3 : aFamily !== 'general' ? 1 : 0;
              const bMatch = bFamily === preferredFamily ? 3 : bFamily !== 'general' ? 1 : 0;
              const aFresh = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const bFresh = b.createdAt ? new Date(b.createdAt).getTime() : 0;

              return (
                bMatch - aMatch ||
                ((severityOrder[b?.severity] || 0) - (severityOrder[a?.severity] || 0)) ||
                (bFresh - aFresh)
              );
            })
            .find((incident) => String(incident.dispatchStatus || '').toLowerCase() === 'unassigned') ||
        [...zoneIncidents].sort((a, b) => {
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          const aFresh = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bFresh = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return (severityOrder[b?.severity] || 0) - (severityOrder[a?.severity] || 0) || (bFresh - aFresh);
        })[0];

      if (!targetIncident) continue;

      const aiPreferredResource = resourceById.get(String(allocation.resource_id));
      const candidateResources = resources
        .filter((r) => !usedResourceIds.has(String(r._id)))
        .filter((r) => r.status !== 'offline' && r.status !== 'dispatched' && r.status !== 'maintenance')
        .sort(
          (a, b) =>
            scoreResourceForIncident({ incident: targetIncident, resource: a, aiPreferredResourceId: aiPreferredResource?._id }) -
            scoreResourceForIncident({ incident: targetIncident, resource: b, aiPreferredResourceId: aiPreferredResource?._id })
        );

      const resource = candidateResources[0] || aiPreferredResource || null;

      if (resource) {
        const previousIncidentId = resource.currentIncident ? String(resource.currentIncident) : null;
        if (previousIncidentId && previousIncidentId !== String(targetIncident._id)) {
          await Incident.findByIdAndUpdate(previousIncidentId, {
            $pull: { assignedResources: resource._id },
          });
        }

        resource.status = 'dispatched';
        resource.currentIncident = targetIncident._id;
        await resource.save();
        usedResourceIds.add(String(resource._id));
      }

      let assignedPersonnel = null;
      if (!targetIncident.assignedPersonnel) {
        const requiredType = incidentToPersonnelType(targetIncident);
        const nearest = personnelPool
          .filter((p) => p.status === 'available' && p.type === requiredType)
          .sort(
            (a, b) =>
              distanceKm(a.location, targetIncident.location) - distanceKm(b.location, targetIncident.location)
          )[0];

        if (nearest) {
          nearest.status = 'busy';
          nearest.currentIncident = targetIncident._id;
          await nearest.save();

          targetIncident.assignedPersonnel = nearest._id;
          targetIncident.assignedPersonnelList = targetIncident.assignedPersonnelList || [];
          if (!targetIncident.assignedPersonnelList.map((id) => String(id)).includes(String(nearest._id))) {
            targetIncident.assignedPersonnelList.push(nearest._id);
          }

          assignedPersonnel = {
            id: String(nearest._id),
            name: nearest.name,
            unitId: nearest.contact?.unitId,
          };
        }
      }

      const alreadyHasPersonnel = Boolean(targetIncident.assignedPersonnel);
      const hasDispatchCapacity = Boolean(resource) || alreadyHasPersonnel || Boolean(assignedPersonnel);
      if (!hasDispatchCapacity) {
        continue;
      }

      targetIncident.dispatchStatus = 'dispatched';
      if (targetIncident.status === 'resolved') {
        targetIncident.status = 'active';
      }
      targetIncident.assignedResources = targetIncident.assignedResources || [];
      if (resource && !targetIncident.assignedResources.map((id) => String(id)).includes(String(resource._id))) {
        targetIncident.assignedResources.push(resource._id);
      }
      targetIncident.workflow = targetIncident.workflow || {};
      if (!targetIncident.workflow.allocatedAt) targetIncident.workflow.allocatedAt = new Date();
      if (!targetIncident.workflow.enRouteAt) targetIncident.workflow.enRouteAt = new Date();

      await targetIncident.save();
      usedIncidentIds.add(String(targetIncident._id));

      applied.push({
        incidentId: String(targetIncident._id),
        incidentTitle: targetIncident.title,
        incidentType: targetIncident.type,
        zoneId: allocation.zone_id,
        resource: resource
          ? {
              id: String(resource._id),
              name: resource.name,
              type: resource.type,
            }
          : null,
        personnel: assignedPersonnel,
        etaMinutes: resource
          ? Math.max(3, Math.round(distanceKm(resource.location, targetIncident.location) / 0.45))
          : null,
        urgencyScore: allocation.urgency_score,
        distanceKm: resource ? Number(distanceKm(resource.location, targetIncident.location).toFixed(2)) : null,
        resourceFamily: resource ? classifyResourceServiceFamily(resource) : 'personnel-only',
      });
    }

    if (applied.length === 0) {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const fallbackIncidents = incidents
        .filter((incident) => String(incident?.dispatchStatus || '').toLowerCase() === 'unassigned')
        .sort((a, b) => {
          const aFresh = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bFresh = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return (severityOrder[b?.severity] || 0) - (severityOrder[a?.severity] || 0) || (bFresh - aFresh);
        });

      for (const incident of fallbackIncidents) {
        const requiredType = incidentToPersonnelType(incident);
        const nearest = personnelPool
          .filter((p) => p.status === 'available' && p.type === requiredType)
          .sort((a, b) => distanceKm(a.location, incident.location) - distanceKm(b.location, incident.location))[0];

        if (!nearest) continue;

        nearest.status = 'busy';
        nearest.currentIncident = incident._id;
        await nearest.save();

        incident.dispatchStatus = 'dispatched';
        if (incident.status === 'resolved') {
          incident.status = 'active';
        }
        incident.assignedPersonnel = nearest._id;
        incident.assignedPersonnelList = incident.assignedPersonnelList || [];
        if (!incident.assignedPersonnelList.map((id) => String(id)).includes(String(nearest._id))) {
          incident.assignedPersonnelList.push(nearest._id);
        }
        incident.workflow = incident.workflow || {};
        if (!incident.workflow.allocatedAt) incident.workflow.allocatedAt = new Date();
        if (!incident.workflow.enRouteAt) incident.workflow.enRouteAt = new Date();
        await incident.save();

        const zoneId = `${Math.round(safeNumber(incident?.location?.lat, 19.076) * 10) / 10}_${Math.round(safeNumber(incident?.location?.lng, 72.8777) * 10) / 10}`;
        applied.push({
          incidentId: String(incident._id),
          incidentTitle: incident.title,
          incidentType: incident.type,
          zoneId,
          resource: null,
          personnel: {
            id: String(nearest._id),
            name: nearest.name,
            unitId: nearest.contact?.unitId,
          },
          etaMinutes: null,
          urgencyScore: 50,
          distanceKm: Number(distanceKm(nearest.location, incident.location).toFixed(2)),
          resourceFamily: 'personnel-only',
        });
        break;
      }
    }

    return res.status(200).json({
      message: applied.length
        ? `Applied live plan to ${applied.length} incident(s)`
        : 'No suitable live allocations available at this moment',
      applied,
      summary: {
        appliedCount: applied.length,
        requested: maxAssignments,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Generate capacity-aware grouping recommendations
// @route   POST /api/dispatch/group-clusters/recommend
// @access  Private
export const recommendGroupedClusters = async (req, res) => {
  try {
    const liveInputs = applyScenarioPreset(req.body?.liveInputs || {});
    const radiusKm = Math.max(1, Math.min(10, safeNumber(req.body?.radiusKm, 4)));
    const maxClusters = Math.max(1, Math.min(20, safeNumber(req.body?.maxClusters, 8)));
    const minIncidentsPerCluster = Math.max(2, Math.min(5, safeNumber(req.body?.minIncidentsPerCluster, 2)));
    const includeDispatched = String(req.body?.includeDispatched || 'false').toLowerCase() === 'true';

    const incidents = await Incident.find({
      status: { $ne: 'resolved' },
      dispatchStatus: includeDispatched ? { $in: ['unassigned', 'dispatched', 'on-site', 'resolving'] } : 'unassigned',
    }).sort({ createdAt: -1 });
    const resources = await Resource.find({ status: { $nin: ['offline', 'maintenance'] } });
    const availablePersonnel = await Personnel.find({ status: 'available' });

    if (!incidents.length) {
      return res.status(200).json({ clusters: [], summary: { candidates: 0, clusters: 0 } });
    }

    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const sortedIncidents = [...incidents].sort((a, b) => {
      const aFresh = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bFresh = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return (severityOrder[String(b?.severity)] || 0) - (severityOrder[String(a?.severity)] || 0) || (bFresh - aFresh);
    });

    const usedIncidentIds = new Set();
    const clusters = [];
    let clusterSequence = 1;

    for (const seedIncident of sortedIncidents) {
      if (clusters.length >= maxClusters) break;
      const seedId = String(seedIncident._id);
      if (usedIncidentIds.has(seedId)) continue;

      const family = classifyIncidentFamily(seedIncident);
      if (!['water', 'garbage', 'maintenance', 'general'].includes(family)) {
        continue;
      }

      const candidateResources = resources
        .filter((resource) => canResourceServeFamily(resource, family))
        .sort((a, b) => distanceKm(a.location, seedIncident.location) - distanceKm(b.location, seedIncident.location));

      const assignedResource = candidateResources[0] || null;
      const capacityProfile = assignedResource
        ? resourceCapacityForFamily(assignedResource, family)
        : { capacityUnits: 1, maxStops: 1, serviceRadiusKm: radiusKm, shiftRemainingMinutes: 120, crewSize: 1, refillMinutes: 20 };

      const clusterRadiusKm = Math.min(radiusKm, capacityProfile.serviceRadiusKm);
      const familyIncidents = sortedIncidents
        .filter((incident) => !usedIncidentIds.has(String(incident._id)))
        .filter((incident) => classifyIncidentFamily(incident) === family)
        .filter((incident) => distanceKm(seedIncident.location, incident.location) <= clusterRadiusKm)
        .sort((a, b) => {
          const aUnassigned = String(a?.dispatchStatus || '').toLowerCase() === 'unassigned' ? 1 : 0;
          const bUnassigned = String(b?.dispatchStatus || '').toLowerCase() === 'unassigned' ? 1 : 0;
          if (bUnassigned !== aUnassigned) return bUnassigned - aUnassigned;

          const byDistance = distanceKm(seedIncident.location, a.location) - distanceKm(seedIncident.location, b.location);
          if (Math.abs(byDistance) > 0.15) return byDistance;

          const aFresh = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bFresh = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          if (bFresh !== aFresh) return bFresh - aFresh;

          return (severityOrder[String(b?.severity)] || 0) - (severityOrder[String(a?.severity)] || 0);
        });

      const selectedIncidents = [];
      let totalDemand = 0;
      let unitLabel = family === 'water' ? 'liters' : family === 'garbage' ? 'kg' : 'jobs';
      let capacityOverrun = false;

      for (const incident of familyIncidents) {
        if (selectedIncidents.length >= capacityProfile.maxStops) break;

        const demand = incidentDemandEstimate(incident, family);
        unitLabel = demand.unitLabel;
        const nextDemand = totalDemand + demand.units;
        const canFitByCapacity = family === 'maintenance' || family === 'general' || nextDemand <= capacityProfile.capacityUnits;
        if (!canFitByCapacity) {
          capacityOverrun = true;
          continue;
        }

        selectedIncidents.push({
          incident,
          demandUnits: demand.units,
          distanceFromSeedKm: Number(distanceKm(seedIncident.location, incident.location).toFixed(2)),
        });
        totalDemand = nextDemand;
      }

      if (!selectedIncidents.length) {
        const demand = incidentDemandEstimate(seedIncident, family);
        if (family === 'water' || family === 'garbage') {
          if (demand.units > capacityProfile.capacityUnits) {
            capacityOverrun = true;
            selectedIncidents.push({ incident: seedIncident, demandUnits: demand.units, distanceFromSeedKm: 0 });
            totalDemand = demand.units;
            unitLabel = demand.unitLabel;
          } else {
            selectedIncidents.push({ incident: seedIncident, demandUnits: demand.units, distanceFromSeedKm: 0 });
            totalDemand = demand.units;
            unitLabel = demand.unitLabel;
          }
        } else {
          selectedIncidents.push({ incident: seedIncident, demandUnits: demand.units, distanceFromSeedKm: 0 });
          totalDemand = demand.units;
          unitLabel = demand.unitLabel;
        }
      }

      if (selectedIncidents.length < minIncidentsPerCluster) {
        // Not a real cluster yet: keep incidents unclaimed so they can combine with other seeds.
        continue;
      }

      selectedIncidents.forEach((entry) => usedIncidentIds.add(String(entry.incident._id)));

      const requiredPersonnelType = family === 'garbage' ? 'sanitation' : incidentToPersonnelType(seedIncident);
      const assignedPersonnel = availablePersonnel
        .filter((person) => String(person.type || '').toLowerCase() === requiredPersonnelType)
        .sort((a, b) => {
          const target = assignedResource?.location || seedIncident.location;
          return distanceKm(a.location, target) - distanceKm(b.location, target);
        })[0] || null;

      const utilization = family === 'maintenance' || family === 'general'
        ? (selectedIncidents.length / Math.max(1, capacityProfile.maxStops)) * 100
        : (totalDemand / Math.max(1, capacityProfile.capacityUnits)) * 100;
      capacityOverrun = capacityOverrun || (family !== 'maintenance' && family !== 'general' && utilization > 100);
      const clusterId = `CL-${family.toUpperCase()}-${String(clusterSequence).padStart(3, '0')}`;
      clusterSequence += 1;
      const applyEligible = !capacityOverrun && (Boolean(assignedResource) || Boolean(assignedPersonnel));

      clusters.push({
        clusterId,
        serviceFamily: family,
        radiusKm: Number(clusterRadiusKm.toFixed(2)),
        applyEligible,
        capacityOverrun,
        capacity: {
          units: Math.round(capacityProfile.capacityUnits),
          used: Math.round(totalDemand),
          unitLabel,
          utilizationPercent: Number(Math.min(150, utilization).toFixed(1)),
          overCapacity: capacityOverrun,
          maxStops: capacityProfile.maxStops,
          plannedStops: selectedIncidents.length,
          crewSize: capacityProfile.crewSize,
          shiftRemainingMinutes: capacityProfile.shiftRemainingMinutes,
          refillMinutes: capacityProfile.refillMinutes,
        },
        incidents: selectedIncidents.map((entry, index) => ({
          id: String(entry.incident._id),
          title: entry.incident.title,
          severity: entry.incident.severity,
          stopOrder: index + 1,
          demandUnits: Math.round(entry.demandUnits),
          demandUnitLabel: unitLabel,
          distanceFromSeedKm: entry.distanceFromSeedKm,
          location: entry.incident.location,
          dispatchStatus: entry.incident.dispatchStatus,
        })),
        assignment: {
          resource: assignedResource
            ? {
                id: String(assignedResource._id),
                name: assignedResource.name,
                type: assignedResource.type,
                status: assignedResource.status,
              }
            : null,
          personnel: assignedPersonnel
            ? {
                id: String(assignedPersonnel._id),
                name: assignedPersonnel.name,
                type: assignedPersonnel.type,
                unitId: assignedPersonnel.contact?.unitId,
              }
            : null,
        },
        explainability: [
          `${selectedIncidents.length} nearby complaint(s) within ${clusterRadiusKm.toFixed(1)} km grouped by ${family} service family.`,
          `Capacity guardrails applied: ${Math.round(totalDemand)} / ${Math.round(capacityProfile.capacityUnits)} ${unitLabel}.`,
          capacityOverrun
            ? 'Cluster exceeds current unit capacity and is marked non-actionable until split or reassigned to higher-capacity resource.'
            : 'Cluster is within capacity limits for direct apply.',
          assignedResource
            ? `Assigned ${assignedResource.name} due to nearest compatible service and active shift capacity.`
            : 'No compatible resource currently online; personnel-only plan suggested.',
        ],
      });
    }

    const aiClusterPayload = clusters.map((cluster) => buildClusterFeasibilityPayload(cluster, liveInputs));
    let feasibilityScores = [];
    let clusterModelMeta = null;

    try {
      let response = await postAI('/analyze/grouping-feasibility', { clusters: aiClusterPayload });
      const hasFallbackRows = Array.isArray(response?.clusters) && response.clusters.some((row) => String(row?.source || '') === 'heuristic-fallback');
      const modelTrained = Boolean(response?.model?.trained);
      if (hasFallbackRows && modelTrained) {
        try {
          await postAI('/model/train-clustering', {});
          response = await postAI('/analyze/grouping-feasibility', { clusters: aiClusterPayload });
        } catch (retrainError) {
          // keep first response if retrain attempt fails
        }
      }
      feasibilityScores = Array.isArray(response?.clusters) ? response.clusters : [];
      clusterModelMeta = response?.model || null;
    } catch (error) {
      feasibilityScores = clusters.map((cluster) => ({
        cluster_id: cluster.clusterId,
        ...fallbackClusterFeasibilityScore(cluster),
      }));
    }

    const aiScoreMap = new Map(
      feasibilityScores.map((entry) => [String(entry.cluster_id || entry.clusterId || ''), entry])
    );

    const rankedClustersRaw = clusters
      .map((cluster) => {
        const aiScore = aiScoreMap.get(String(cluster.clusterId)) || fallbackClusterFeasibilityScore(cluster);
        const feasibilityScore = safeNumber(aiScore.feasibility_score, 0);
        const localPriorityScore = localClusterPriorityScore(cluster, feasibilityScore);
        const finalScore = Math.min(100, Math.round((feasibilityScore * 0.72) + (localPriorityScore * 0.28)));

        return {
          ...cluster,
          aiFeasibilityScore: Number(feasibilityScore.toFixed(1)),
          aiFeasibilitySource: aiScore.source || 'heuristic-fallback',
          feasibilityProbability: Number(safeNumber(aiScore.feasibility_probability, feasibilityScore / 100).toFixed(3)),
          operationalPriorityScore: Number(localPriorityScore.toFixed(1)),
          rankingScore: finalScore,
          applyEligible: Boolean(cluster.applyEligible),
          capacityOverrun: Boolean(cluster.capacityOverrun),
          explainability: [
            ...cluster.explainability,
            `AI feasibility score: ${Number(feasibilityScore).toFixed(1)} / 100 (${(safeNumber(aiScore.feasibility_probability, feasibilityScore / 100) * 100).toFixed(0)}% probability).`,
          ],
        };
      })
      .sort((a, b) => Number(b.rankingScore || 0) - Number(a.rankingScore || 0));

    const dedupeMap = new Map();
    const rankedClusters = [];
    for (const cluster of rankedClustersRaw) {
      const shouldDedupe = cluster.applyEligible === false && cluster.capacityOverrun === true;
      if (!shouldDedupe) {
        rankedClusters.push(cluster);
        continue;
      }

      const key = clusterDedupKey(cluster);
      if (dedupeMap.has(key)) {
        const existing = dedupeMap.get(key);
        const existingIds = new Set((existing.incidents || []).map((incident) => String(incident.id || '')));
        const mergedIncidents = [
          ...(existing.incidents || []),
          ...(cluster.incidents || []).filter((incident) => !existingIds.has(String(incident.id || ''))),
        ];
        existing.incidents = mergedIncidents;
        existing.capacity.plannedStops = mergedIncidents.length;
        existing.capacity.used = mergedIncidents.reduce((sum, incident) => sum + safeNumber(incident.demandUnits, 0), 0);
        if (safeNumber(existing.capacity.units, 1) > 0 && !['maintenance', 'general'].includes(String(existing.serviceFamily || ''))) {
          const util = (safeNumber(existing.capacity.used, 0) / safeNumber(existing.capacity.units, 1)) * 100;
          existing.capacity.utilizationPercent = Number(Math.min(150, util).toFixed(1));
        }
        existing.explainability = [
          `${mergedIncidents.length} nearby complaint(s) represented in this blocked cluster signature.`,
          ...existing.explainability.slice(1),
        ];
        continue;
      }

      dedupeMap.set(key, cluster);
      rankedClusters.push(cluster);
    }

    return res.status(200).json({
      clusters: rankedClusters,
      summary: {
        candidates: incidents.length,
        clusters: rankedClusters.length,
        groupedIncidents: rankedClusters.reduce((sum, cluster) => sum + cluster.incidents.length, 0),
        minIncidentsPerCluster,
      },
      parameters: { radiusKm, maxClusters, minIncidentsPerCluster, liveInputs },
      filters: { includeDispatched },
      message: rankedClusters.length
        ? undefined
        : `No multi-incident clusters found for current filters (minimum ${minIncidentsPerCluster} incidents per cluster).`,
      model: clusterModelMeta,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Apply a grouped cluster plan to live dispatch
// @route   POST /api/dispatch/group-clusters/apply
// @access  Private
export const applyGroupedClusterPlan = async (req, res) => {
  try {
    const cluster = req.body?.cluster;
    const incidentIds = Array.isArray(cluster?.incidents)
      ? cluster.incidents.map((incident) => String(incident?.id || incident?._id || '')).filter(Boolean)
      : [];

    if (!incidentIds.length) {
      return res.status(400).json({ message: 'cluster.incidents is required to apply grouped plan' });
    }

    const incidents = await Incident.find({ _id: { $in: incidentIds }, status: { $ne: 'resolved' } });
    if (!incidents.length) {
      return res.status(404).json({ message: 'No active incidents found for this cluster plan' });
    }

    const incidentById = new Map(incidents.map((incident) => [String(incident._id), incident]));
    const orderedIncidentRecords = incidentIds.map((id) => incidentById.get(String(id))).filter(Boolean);
    const normalizedFamily = String(cluster?.serviceFamily || classifyIncidentFamily(orderedIncidentRecords[0])).toLowerCase();
    const clusterId = String(cluster?.clusterId || `CL-${normalizedFamily.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`);

    if (cluster?.applyEligible === false || cluster?.capacityOverrun === true || safeNumber(cluster?.capacity?.utilizationPercent, 0) > 100) {
      return res.status(400).json({
        message: 'Cluster is over capacity or marked non-actionable. Split or re-plan before apply.',
      });
    }

    let resource = null;
    const resourceId = String(cluster?.assignment?.resource?.id || cluster?.resourceId || '').trim();
    if (resourceId) {
      resource = await Resource.findById(resourceId);
    }

    let personnel = null;
    const personnelId = String(cluster?.assignment?.personnel?.id || cluster?.personnelId || '').trim();
    if (personnelId) {
      personnel = await Personnel.findById(personnelId);
    }

    if (!personnel) {
      const requiredType = normalizedFamily === 'garbage' ? 'sanitation' : incidentToPersonnelType(orderedIncidentRecords[0]);
      personnel = await Personnel.findOne({ status: 'available', type: requiredType }).sort({ updatedAt: 1 });
    }

    if ((normalizedFamily === 'water' || normalizedFamily === 'garbage') && !resource) {
      return res.status(400).json({
        message: `A compatible ${normalizedFamily} resource is required before applying this grouped plan.`,
      });
    }

    if (resource && !canResourceServeFamily(resource, normalizedFamily)) {
      return res.status(400).json({
        message: `Selected resource ${resource.name} is not compatible with ${normalizedFamily} cluster demand.`,
      });
    }

    if (resource && (normalizedFamily === 'water' || normalizedFamily === 'garbage')) {
      const capacityProfile = resourceCapacityForFamily(resource, normalizedFamily);
      const totalDemandUnits = orderedIncidentRecords.reduce((sum, incident) => {
        const demand = incidentDemandEstimate(incident, normalizedFamily);
        return sum + demand.units;
      }, 0);

      if (totalDemandUnits > capacityProfile.capacityUnits) {
        return res.status(400).json({
          message: `Cluster demand ${Math.round(totalDemandUnits)} exceeds resource capacity ${Math.round(capacityProfile.capacityUnits)}. Split cluster or choose higher-capacity unit.`,
        });
      }
    }

    const now = new Date();
    const applied = [];
    const allIds = orderedIncidentRecords.map((incident) => String(incident._id));

    for (let i = 0; i < orderedIncidentRecords.length; i += 1) {
      const incident = orderedIncidentRecords[i];
      const incidentId = String(incident._id);
      const demand = incidentDemandEstimate(incident, normalizedFamily);

      incident.dispatchStatus = 'dispatched';
      if (incident.status === 'resolved') {
        incident.status = 'active';
      }

      incident.workflow = incident.workflow || {};
      if (!incident.workflow.allocatedAt) incident.workflow.allocatedAt = now;
      if (!incident.workflow.enRouteAt) incident.workflow.enRouteAt = now;

      incident.assignedResources = incident.assignedResources || [];
      if (resource && !incident.assignedResources.map((id) => String(id)).includes(String(resource._id))) {
        incident.assignedResources.push(resource._id);
      }

      if (personnel) {
        incident.assignedPersonnel = personnel._id;
        incident.assignedPersonnelList = incident.assignedPersonnelList || [];
        if (!incident.assignedPersonnelList.map((id) => String(id)).includes(String(personnel._id))) {
          incident.assignedPersonnelList.push(personnel._id);
        }
      }

      incident.clustering = {
        clusterId,
        serviceFamily: normalizedFamily,
        stopOrder: i + 1,
        totalStops: orderedIncidentRecords.length,
        estimatedDemandUnits: demand.units,
        demandUnitLabel: demand.unitLabel,
        groupedWith: allIds.filter((id) => id !== incidentId),
        instructionByLanguage: buildClusterInstruction({
          clusterId,
          stopOrder: i + 1,
          totalStops: orderedIncidentRecords.length,
          family: normalizedFamily,
        }),
        plannedAt: now,
      };

      await incident.save();
      applied.push({
        incidentId,
        title: incident.title,
        stopOrder: i + 1,
        totalStops: orderedIncidentRecords.length,
      });
    }

    if (resource) {
      resource.status = 'dispatched';
      resource.currentIncident = orderedIncidentRecords[0]._id;
      if (personnel) {
        resource.assignedPersonnel = personnel._id;
      }
      await resource.save();
    }

    if (personnel) {
      personnel.status = 'busy';
      personnel.currentIncident = orderedIncidentRecords[0]._id;
      if (resource) {
        personnel.assignedResource = resource._id;
      }

      const queueIds = orderedIncidentRecords.slice(1).map((incident) => String(incident._id));
      personnel.taskQueue = Array.from(new Set([...(personnel.taskQueue || []).map((id) => String(id)), ...queueIds]));
      await personnel.save();
    }

    return res.status(200).json({
      message: `Applied grouped cluster ${clusterId} to ${applied.length} incident(s)`,
      clusterId,
      applied,
      assignment: {
        resource: resource
          ? { id: String(resource._id), name: resource.name, type: resource.type }
          : null,
        personnel: personnel
          ? { id: String(personnel._id), name: personnel.name, unitId: personnel.contact?.unitId }
          : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
