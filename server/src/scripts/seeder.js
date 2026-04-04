import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Incident from '../models/Incident.js';
import Resource from '../models/Resource.js';
import Analytics from '../models/Analytics.js';
import Personnel from '../models/Personnel.js';

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
    await Personnel.deleteMany();

    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash('admin123', salt);

    const createdUsers = await User.create([
      { name: 'Admin', email: 'admin@civicflow.ai', password, role: 'admin', organization: 'Mumbai Command' },
      { name: 'Operator 1', email: 'operator@civicflow.ai', password, role: 'operator', organization: 'Mumbai Command' }
    ]);

    const incidents = await Incident.create([
      {
        title: 'Water tanker delay in Dharavi sector 5',
        type: 'water',
        severity: 'critical',
        location: { lat: 19.0413, lng: 72.8553, address: 'Dharavi Sector 5, Mumbai' },
        aiPredictionConfidence: 94,
        sourceLanguage: 'english',
      },
      {
        title: 'Garbage overflow near Andheri East station',
        type: 'sanitation',
        severity: 'high',
        location: { lat: 19.1136, lng: 72.8697, address: 'Andheri East Station, Mumbai' },
        aiPredictionConfidence: 90,
        sourceLanguage: 'english',
      },
      {
        title: 'Road pothole cluster near Sion Circle',
        type: 'roads',
        severity: 'high',
        location: { lat: 19.0476, lng: 72.8664, address: 'Sion Circle, Mumbai' },
        aiPredictionConfidence: 87,
      },
      {
        title: 'Streetlight failure chain in Powai',
        type: 'utility',
        severity: 'medium',
        location: { lat: 19.1176, lng: 72.906, address: 'Powai Lake Road, Mumbai' },
        aiPredictionConfidence: 78,
      },
      {
        title: 'Traffic choke near Dadar TT flyover',
        type: 'traffic',
        severity: 'high',
        location: { lat: 19.0178, lng: 72.8478, address: 'Dadar TT Flyover, Mumbai' },
        aiPredictionConfidence: 82,
      },
      {
        title: 'Minor fire in market electrical panel',
        type: 'fire',
        severity: 'critical',
        location: { lat: 19.0765, lng: 72.877, address: 'Kurla Market, Mumbai' },
        aiPredictionConfidence: 92,
      },
      {
        title: 'Public safety crowd surge at festival route',
        type: 'safety',
        severity: 'medium',
        location: { lat: 19.033, lng: 72.838, address: 'Worli Sea Face, Mumbai' },
        aiPredictionConfidence: 70,
      },
      {
        title: 'Drainage choke after rainfall in Kurla',
        type: 'maintenance',
        severity: 'high',
        location: { lat: 19.0728, lng: 72.8826, address: 'Kurla West, Mumbai' },
        aiPredictionConfidence: 84,
      },
      {
        title: 'Ambulance access blocked by illegal parking in Dadar',
        type: 'medical',
        severity: 'critical',
        location: { lat: 19.0174, lng: 72.8479, address: 'Dadar West, Mumbai' },
        aiPredictionConfidence: 88,
      },
      {
        title: 'Transformer sparking complaint',
        type: 'infrastructure',
        severity: 'medium',
        location: { lat: 19.2058, lng: 72.8511, address: 'Borivali West, Mumbai' },
        aiPredictionConfidence: 72,
      },
      {
        title: 'Construction debris blocking lane',
        type: 'roads',
        severity: 'low',
        location: { lat: 19.1363, lng: 72.8332, address: 'Malad Link Road, Mumbai' },
        aiPredictionConfidence: 63,
      },
      {
        title: 'Night sanitation pickup missed',
        type: 'sanitation',
        severity: 'medium',
        location: { lat: 19.0759, lng: 72.8258, address: 'Mahim Causeway, Mumbai' },
        aiPredictionConfidence: 75,
      },
      {
        title: 'Waterlogging near CST pedestrian underpass',
        type: 'water',
        severity: 'high',
        location: { lat: 18.9398, lng: 72.8355, address: 'CST Underpass, Mumbai' },
        aiPredictionConfidence: 86,
      },
      {
        title: 'Public bus stop electrical hazard at Ghatkopar',
        type: 'utility',
        severity: 'critical',
        location: { lat: 19.0856, lng: 72.9081, address: 'Ghatkopar East Bus Depot, Mumbai' },
        aiPredictionConfidence: 91,
      }
    ]);

    await Resource.create([
      { name: 'Water Tanker WT-17', type: 'public_works', status: 'dispatched', location: { lat: 19.05, lng: 72.86 }, currentIncident: incidents[0]._id, batteryOrFuelLevel: 78 },
      { name: 'Garbage Truck GT-22', type: 'public_works', status: 'dispatched', location: { lat: 19.11, lng: 72.87 }, currentIncident: incidents[1]._id, batteryOrFuelLevel: 70 },
      { name: 'Fire Tender FT-04', type: 'fire', status: 'dispatched', location: { lat: 19.08, lng: 72.88 }, currentIncident: incidents[5]._id, batteryOrFuelLevel: 82 },
      { name: 'Drone Recon X1', type: 'drone', status: 'patrol', location: { lat: 19.07, lng: 72.90 }, batteryOrFuelLevel: 62 },
      { name: 'Patrol 14', type: 'police', status: 'patrol', location: { lat: 19.02, lng: 72.85 }, batteryOrFuelLevel: 90 },
      { name: 'Ambulance AMB-09', type: 'medical', status: 'dispatched', location: { lat: 19.02, lng: 72.85 }, currentIncident: incidents[8]._id, batteryOrFuelLevel: 76 },
      { name: 'Road Repair Unit RR-31', type: 'public_works', status: 'maintenance', location: { lat: 19.09, lng: 72.89 }, batteryOrFuelLevel: 68 },
      { name: 'Public Works Van PW-08', type: 'public_works', status: 'patrol', location: { lat: 19.13, lng: 72.84 }, batteryOrFuelLevel: 88 }
    ]);

    await Personnel.create([
      { name: 'Officer A. Patil', type: 'police', status: 'available', location: { lat: 19.05, lng: 72.84 }, contact: { phone: '+91-9000000001', unitId: 'POL-101' } },
      { name: 'Fire Lead R. Shinde', type: 'fire', status: 'available', location: { lat: 19.08, lng: 72.88 }, contact: { phone: '+91-9000000002', unitId: 'FIR-204' } },
      { name: 'Medic K. Joshi', type: 'medical', status: 'available', location: { lat: 19.2, lng: 72.97 }, contact: { phone: '+91-9000000003', unitId: 'MED-115' } },
      { name: 'Utility Crew M. Gaikwad', type: 'utility', status: 'available', location: { lat: 19.11, lng: 72.9 }, contact: { phone: '+91-9000000004', unitId: 'UTL-320' } },
      { name: 'Sanitation Ops N. Kale', type: 'sanitation', status: 'available', location: { lat: 19.07, lng: 72.82 }, contact: { phone: '+91-9000000005', unitId: 'SAN-410' } }
    ]);

    await Analytics.create([
      {
        organization: 'Mumbai Command',
        activeIncidentsCount: incidents.length,
        unitsDeployed: 8,
        avgResponseTimeMinutes: 8.6,
        slaCompliancePercent: 93,
        aiPredictionsCount: 3480,
        systemHealthPercent: 99.8,
        demandTimeSeries: [
          { time: '00:00', actual: 32, predicted: 35, optimized: 29 },
          { time: '02:00', actual: 28, predicted: 30, optimized: 25 },
          { time: '04:00', actual: 26, predicted: 28, optimized: 24 },
          { time: '06:00', actual: 38, predicted: 41, optimized: 34 },
          { time: '08:00', actual: 72, predicted: 68, optimized: 61 },
          { time: '10:00', actual: 81, predicted: 78, optimized: 70 },
          { time: '12:00', actual: 88, predicted: 91, optimized: 76 },
          { time: '14:00', actual: 79, predicted: 83, optimized: 69 },
          { time: '16:00', actual: 96, predicted: 99, optimized: 84 },
          { time: '18:00', actual: 102, predicted: 96, optimized: 87 },
          { time: '20:00', actual: 74, predicted: 77, optimized: 66 },
          { time: '22:00', actual: 48, predicted: 52, optimized: 43 }
        ],
        categoryBreakdown: [
          { name: 'Sanitation', value: 22, color: 'hsl(160, 84%, 39%)' },
          { name: 'Water', value: 19, color: 'hsl(207, 90%, 54%)' },
          { name: 'Roads', value: 18, color: 'hsl(38, 92%, 50%)' },
          { name: 'Fire', value: 14, color: 'hsl(0, 84%, 60%)' },
          { name: 'Medical', value: 12, color: 'hsl(270, 70%, 60%)' },
          { name: 'Other', value: 15, color: 'hsl(215, 20%, 55%)' }
        ],
        weeklyTrend: [
          { day: 'Mon', incidents: 58, resolved: 50 },
          { day: 'Tue', incidents: 61, resolved: 54 },
          { day: 'Wed', incidents: 67, resolved: 60 },
          { day: 'Thu', incidents: 72, resolved: 63 },
          { day: 'Fri', incidents: 80, resolved: 69 },
          { day: 'Sat', incidents: 64, resolved: 56 },
          { day: 'Sun', incidents: 52, resolved: 47 }
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
