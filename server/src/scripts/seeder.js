import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Incident from '../models/Incident.js';
import Resource from '../models/Resource.js';
import Analytics from '../models/Analytics.js';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB for Seeding'))
  .catch(err => { console.error(err); process.exit(1); });

const seedData = async () => {
  try {
    await User.deleteMany();
    await Incident.deleteMany();
    await Resource.deleteMany();
    await Analytics.deleteMany();

    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash('admin123', salt);

    const createdUsers = await User.create([
      { name: 'Admin', email: 'admin@CivicResource Ai.com', password, role: 'admin', organization: 'Global Command' },
      { name: 'Operator 1', email: 'operator@CivicResource Ai.com', password, role: 'operator', organization: 'Global Command' }
    ]);

    const incidents = await Incident.create([
      { title: 'Subway Power Outage', type: 'infrastructure', severity: 'critical', location: { lat: 40.7128, lng: -74.0060, address: 'Penn Station' }, aiPredictionConfidence: 94 },
      { title: 'Highway Pileup', type: 'traffic', severity: 'high', location: { lat: 40.7580, lng: -73.9855, address: 'Times Sq' }, aiPredictionConfidence: 88 },
      { title: 'Suspicious Package', type: 'crime', severity: 'medium', location: { lat: 40.7829, lng: -73.9654, address: 'Central Park' }, aiPredictionConfidence: 65 }
    ]);

    await Resource.create([
      { name: 'Squad 1 (Fire)', type: 'fire', status: 'dispatched', location: { lat: 40.7128, lng: -74.0060 }, currentIncident: incidents[0]._id, batteryOrFuelLevel: 85 },
      { name: 'Drone Recon X1', type: 'drone', status: 'patrol', location: { lat: 40.7680, lng: -73.9955 }, batteryOrFuelLevel: 62 },
      { name: 'Patrol 14 (Police)', type: 'police', status: 'patrol', location: { lat: 40.7729, lng: -73.9554 }, batteryOrFuelLevel: 90 }
    ]);

    await Analytics.create([
      {
        organization: 'Global Command',
        activeIncidentsCount: 3,
        unitsDeployed: 3,
        avgResponseTimeMinutes: 4.2,
        slaCompliancePercent: 96,
        aiPredictionsCount: 1240,
        systemHealthPercent: 99.8,
        demandTimeSeries: [
          { time: "00:00", actual: 45, predicted: 42, optimized: 38 },
          { time: "04:00", actual: 30, predicted: 35, optimized: 28 },
          { time: "08:00", actual: 85, predicted: 80, optimized: 72 },
          { time: "12:00", actual: 65, predicted: 70, optimized: 58 },
          { time: "16:00", actual: 95, predicted: 90, optimized: 82 },
          { time: "20:00", actual: 55, predicted: 60, optimized: 48 },
          { time: "23:00", actual: 40, predicted: 45, optimized: 35 }
        ],
        categoryBreakdown: [
          { name: "Medical", value: 35, color: "hsl(0, 84%, 60%)" },
          { name: "Fire", value: 20, color: "hsl(38, 92%, 50%)" },
          { name: "Traffic", value: 25, color: "hsl(207, 90%, 54%)" },
          { name: "Infrastructure", value: 15, color: "hsl(160, 84%, 39%)" },
          { name: "Other", value: 5, color: "hsl(215, 20%, 55%)" }
        ],
        weeklyTrend: [
          { day: "Mon", incidents: 42, resolved: 38 },
          { day: "Tue", incidents: 55, resolved: 52 },
          { day: "Wed", incidents: 48, resolved: 45 },
          { day: "Thu", incidents: 62, resolved: 58 },
          { day: "Fri", incidents: 75, resolved: 70 },
          { day: "Sat", incidents: 35, resolved: 32 },
          { day: "Sun", incidents: 28, resolved: 26 }
        ]
      }
    ]);

    console.log('✅ Data Seeded Successfully');
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedData();
