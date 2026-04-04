import Incident from '../models/Incident.js';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

const TYPE_MAP = {
  public_safety: 'safety',
  utility_fault: 'utility',
  road: 'roads',
  infrastructure: 'infrastructure',
  sanitation: 'sanitation',
  safety: 'safety',
  utility: 'utility',
  water: 'water',
  roads: 'roads',
  maintenance: 'maintenance',
  medical: 'medical',
  fire: 'fire',
  crime: 'crime',
  traffic: 'traffic',
};

const COORD_FALLBACK = {
  lat: 19.076,
  lng: 72.8777,
};

const buildTrackingId = () => `CF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

const PUBLIC_FIELDS = 'title type severity location status createdAt trackingId details detailsEnglish sourceLanguage titleOriginal detailsOriginal titleEnglish';

const ensureTrackingIds = async (incidents = []) => {
  const missing = incidents.filter((incident) => !incident.trackingId);
  if (missing.length === 0) {
    return incidents;
  }

  await Promise.all(
    missing.map(async (incident) => {
      incident.trackingId = buildTrackingId();
      await incident.save();
    })
  );

  return incidents;
};

const inferCoordinates = (location = {}) => {
  if (typeof location.lat === 'number' && typeof location.lng === 'number') {
    return { lat: location.lat, lng: location.lng };
  }

  const address = (location.address || '').toLowerCase();
  if (address.includes('andheri')) return { lat: 19.1136, lng: 72.8697 };
  if (address.includes('bandra')) return { lat: 19.0544, lng: 72.8406 };
  if (address.includes('thane')) return { lat: 19.1176, lng: 72.906 };

  return COORD_FALLBACK;
};

const normalizeLanguage = (lang = 'english') => {
  const value = String(lang).toLowerCase();
  if (value === 'hi' || value === 'hindi') return 'hindi';
  if (value === 'mr' || value === 'marathi') return 'marathi';
  return 'english';
};

const normalizeType = (type = 'infrastructure') => {
  const value = String(type || '').toLowerCase().replace(/\s+/g, '_');
  return TYPE_MAP[value] || 'infrastructure';
};

const nlpNormalize = async ({ text, language }) => {
  try {
    const response = await fetch(`${AI_ENGINE_URL}/nlp/normalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
};

// @desc    Get all active incidents
// @route   GET /api/incidents
// @access  Private
export const getIncidents = async (req, res, next) => {
  try {
    // Only return non-resolved by default; allow explicit status or all.
    let statusFilter = { status: { $ne: 'resolved' } };
    if (req.query.status && req.query.status !== 'all') {
      statusFilter = { status: req.query.status };
    }
    if (req.query.status === 'all') {
      statusFilter = {};
    }
    const incidents = await Incident.find(statusFilter).sort({ createdAt: -1 });
    res.json(incidents);
  } catch (error) {
    next(error);
  }
};

// @desc    Get public complaint archive
// @route   GET /api/public/incidents
// @access  Public
export const getPublicIncidents = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 24), 50);
    const incidents = await Incident.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .select(PUBLIC_FIELDS);

    await ensureTrackingIds(incidents);

    res.json(incidents);
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single public complaint detail
// @route   GET /api/public/incidents/:id
// @access  Public
export const getPublicIncidentById = async (req, res, next) => {
  try {
    const incident = await Incident.findById(req.params.id).select(PUBLIC_FIELDS);

    if (!incident) {
      res.status(404);
      throw new Error('Incident not found');
    }

    await ensureTrackingIds([incident]);
    res.json(incident);
  } catch (error) {
    next(error);
  }
};

// @desc    Track public complaints by phone or tracking id
// @route   GET /api/public/incidents/track
// @access  Public
export const trackPublicComplaint = async (req, res, next) => {
  try {
    const { phone, trackingId } = req.query;
    const filters = [];

    if (trackingId) {
      filters.push({ trackingId: String(trackingId).trim().toUpperCase() });
    }

    if (phone) {
      filters.push({ reporterPhone: String(phone).trim() });
    }

    if (filters.length === 0) {
      return res.json([]);
    }

    const incidents = await Incident.find({ $and: filters })
      .sort({ createdAt: -1 })
      .select(PUBLIC_FIELDS);

    await ensureTrackingIds(incidents);

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
    const {
      title,
      type,
      severity,
      location,
      details,
      description,
      aiPredictionConfidence,
      sourceLanguage,
      reporterPhone,
      isAnonymous = true,
    } = req.body;

    const normalizedLanguage = normalizeLanguage(sourceLanguage);
    const normalizedType = normalizeType(type);
    const detailsText = details || description || '';
    const locationWithCoords = {
      ...(location || {}),
      ...inferCoordinates(location),
    };

    const [titleNlp, detailsNlp] = await Promise.all([
      nlpNormalize({ text: title || '', language: normalizedLanguage }),
      nlpNormalize({ text: detailsText, language: normalizedLanguage }),
    ]);

    const titleEnglish = titleNlp?.english_text || title || 'Untitled incident';
    const detailsEnglish = detailsNlp?.english_text || detailsText;

    const incident = new Incident({
      trackingId: buildTrackingId(),
      title: titleEnglish,
      type: normalizedType,
      severity: ['low', 'medium', 'high', 'critical'].includes(severity) ? severity : 'medium',
      location: locationWithCoords,
      details: detailsEnglish,
      aiPredictionConfidence: aiPredictionConfidence || 0,
      reporterPhone: reporterPhone ? String(reporterPhone).trim() : '',
      isAnonymous: Boolean(isAnonymous),
      sourceLanguage: normalizedLanguage,
      titleOriginal: title || titleEnglish,
      detailsOriginal: detailsText,
      titleEnglish,
      detailsEnglish,
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
