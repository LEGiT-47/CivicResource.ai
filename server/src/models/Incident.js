import mongoose from 'mongoose';

const incidentSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['medical', 'fire', 'crime', 'infrastructure', 'traffic', 'sanitation', 'utility', 'water', 'roads', 'maintenance', 'safety'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String },
    },
    trackingId: {
      type: String,
      unique: true,
      sparse: true,
    },
    reporterPhone: {
      type: String,
    },
    isAnonymous: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'investigating', 'resolved'],
      default: 'active',
    },
    dispatchStatus: {
      type: String,
      enum: ['unassigned', 'dispatched', 'on-site', 'resolving', 'completed'],
      default: 'unassigned',
    },
    assignedPersonnel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Personnel',
    },
    aiPredictionConfidence: {
      type: Number,
      default: 0,
    },
    impactAnalysis: {
      growthTrend: { type: Number, default: 0 },
      mitigationEfficiency: { type: Number, default: 0 },
      areaStressScore: { type: Number, default: 0 },
    },
    details: {
      type: String,
    },
    sourceLanguage: {
      type: String,
      enum: ['english', 'hindi', 'marathi'],
      default: 'english',
    },
    titleOriginal: {
      type: String,
    },
    detailsOriginal: {
      type: String,
    },
    titleEnglish: {
      type: String,
    },
    detailsEnglish: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Incident = mongoose.model('Incident', incidentSchema);
export default Incident;
