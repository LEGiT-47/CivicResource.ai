import mongoose from 'mongoose';

const resourceSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['police', 'fire', 'medical', 'public_works', 'drone', 'utility', 'sanitation'],
      required: true,
    },
    status: {
      type: String,
      enum: ['patrol', 'dispatched', 'maintenance', 'offline'],
      default: 'patrol',
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    currentIncident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Incident',
      default: null,
    },
    assignedPersonnel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Personnel',
      default: null,
    },
    batteryOrFuelLevel: {
      type: Number,
      required: true,
      default: 100,
    },
    serviceCapabilities: {
      waterLitersCapacity: { type: Number, default: 0 },
      wasteKgCapacity: { type: Number, default: 0 },
      maxStopsPerTrip: { type: Number, default: 3 },
      refillMinutes: { type: Number, default: 20 },
      crewSize: { type: Number, default: 2 },
      serviceRadiusKm: { type: Number, default: 6 },
      shiftRemainingMinutes: { type: Number, default: 240 },
    },
  },
  {
    timestamps: true,
  }
);

const Resource = mongoose.model('Resource', resourceSchema);
export default Resource;
