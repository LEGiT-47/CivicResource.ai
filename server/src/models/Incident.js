import mongoose from 'mongoose';

const incidentSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['medical', 'fire', 'crime', 'infrastructure', 'traffic'],
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
    status: {
      type: String,
      enum: ['active', 'investigating', 'resolved'],
      default: 'active',
    },
    aiPredictionConfidence: {
      type: Number,
      default: 0,
    },
    details: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Incident = mongoose.model('Incident', incidentSchema);
export default Incident;
