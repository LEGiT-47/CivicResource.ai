import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Incident from '../models/Incident.js';
import Resource from '../models/Resource.js';
import Analytics from '../models/Analytics.js';
import Personnel from '../models/Personnel.js';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB for Seeding'))
  .catch(err => { console.error(err); process.exit(1); });

const cleanupLegacyUserIndexes = async () => {
  if (!mongoose.connection.db) {
    await mongoose.connection.asPromise();
  }

  const userCollection = mongoose.connection.db.collection('users');
  let indexes = [];
  try {
    indexes = await userCollection.indexes();
  } catch (error) {
    // Fresh databases may not have the users collection yet.
    if (error?.code === 26 || error?.codeName === 'NamespaceNotFound') {
      return;
    }
    throw error;
  }
  const legacyPhoneIndex = indexes.find((idx) => idx.name === 'phone_1' && idx.unique);

  if (legacyPhoneIndex) {
    await userCollection.dropIndex('phone_1');
    console.log('Dropped legacy users.phone_1 unique index');
  }
};

const seedData = async () => {
  try {
    await mongoose.connection.asPromise();
    const dbName = mongoose.connection.db?.databaseName || '';
    const isProtectedDefaultDb = ['test', 'admin', 'local'].includes(dbName);
    if (isProtectedDefaultDb && process.env.SEED_ALLOW_DEFAULT_DB !== 'true') {
      throw new Error(
        `Refusing to seed default database '${dbName}'. Set an explicit DB name in MONGODB_URI (recommended), or set SEED_ALLOW_DEFAULT_DB=true to override.`
      );
    }

    await cleanupLegacyUserIndexes();

    await User.deleteMany();
    await Incident.deleteMany();
    await Resource.deleteMany();
    await Analytics.deleteMany();
    await Personnel.deleteMany();

    // Create admin and operator users - pass plain passwords, pre-save hook will hash them
    const createdUsers = await User.create([
      { name: 'Admin', email: 'admin@civicflow.ai', password: 'admin123', role: 'admin', organization: 'Mumbai Command' },
      { name: 'Operator 1', email: 'operator@civicflow.ai', password: 'admin123', role: 'operator', organization: 'Mumbai Command' }
    ]);

    // Create worker users (responders) - 10 workers of different types
    // Pass plain passwords, the User.pre('save') hook will hash them
    const workerUsers = await User.create([
      // Police Officers (2)
      { name: 'Worker 1 - Police Officer', email: 'worker1@civicflow.ai', password: 'worker1', role: 'responder', organization: 'Mumbai Police', unitId: 'POL-001' },
      { name: 'Worker 2 - Police Officer', email: 'worker2@civicflow.ai', password: 'worker2', role: 'responder', organization: 'Mumbai Police', unitId: 'POL-002' },
      // Firefighters (2)
      { name: 'Worker 3 - Firefighter', email: 'worker3@civicflow.ai', password: 'worker3', role: 'responder', organization: 'Mumbai Fire Brigade', unitId: 'FIR-001' },
      { name: 'Worker 4 - Firefighter', email: 'worker4@civicflow.ai', password: 'worker4', role: 'responder', organization: 'Mumbai Fire Brigade', unitId: 'FIR-002' },
      // Medical Officers (2)
      { name: 'Worker 5 - Medical Officer', email: 'worker5@civicflow.ai', password: 'worker5', role: 'responder', organization: 'Mumbai Health Department', unitId: 'MED-001' },
      { name: 'Worker 6 - Medical Officer', email: 'worker6@civicflow.ai', password: 'worker6', role: 'responder', organization: 'Mumbai Health Department', unitId: 'MED-002' },
      // Utility Workers (2)
      { name: 'Worker 7 - Utility Technician', email: 'worker7@civicflow.ai', password: 'worker7', role: 'responder', organization: 'Mumbai Electricity Board', unitId: 'UTL-001' },
      { name: 'Worker 8 - Utility Technician', email: 'worker8@civicflow.ai', password: 'worker8', role: 'responder', organization: 'Mumbai Electricity Board', unitId: 'UTL-002' },
      // Sanitation Worker (1)
      { name: 'Worker 9 - Sanitation Supervisor', email: 'worker9@civicflow.ai', password: 'worker9', role: 'responder', organization: 'Mumbai Sanitation Department', unitId: 'SAN-001' },
      // Water/Sewage Worker (1)
      { name: 'Worker 10 - Water Supply Technician', email: 'worker10@civicflow.ai', password: 'worker10', role: 'responder', organization: 'Mumbai Water Supply', unitId: 'WAT-001' }
    ]);

    const incidents = await Incident.create([
      // Police incidents (assign to POL-001, POL-002)
      {
        title: 'Traffic choke near Dadar TT flyover',
        type: 'traffic',
        severity: 'high',
        location: { lat: 19.0178, lng: 72.8478, address: 'Dadar TT Flyover, Mumbai' },
        aiPredictionConfidence: 82,
        sourceLanguage: 'english',
      },
      {
        title: 'Public safety crowd surge at festival route',
        type: 'safety',
        severity: 'medium',
        location: { lat: 19.033, lng: 72.838, address: 'Worli Sea Face, Mumbai' },
        aiPredictionConfidence: 70,
      },
      // Fire incidents (assign to FIR-001, FIR-002)
      {
        title: 'Minor fire in market electrical panel',
        type: 'fire',
        severity: 'critical',
        location: { lat: 19.0765, lng: 72.877, address: 'Kurla Market, Mumbai' },
        aiPredictionConfidence: 92,
      },
      {
        title: 'Building electrical fire - high rise apartment',
        type: 'fire',
        severity: 'critical',
        location: { lat: 19.1200, lng: 72.8500, address: 'Bandra High Rise, Mumbai' },
        aiPredictionConfidence: 95,
      },
      // Medical incidents (assign to MED-001, MED-002)
      {
        title: 'Ambulance access blocked by illegal parking in Dadar',
        type: 'medical',
        severity: 'critical',
        location: { lat: 19.0174, lng: 72.8479, address: 'Dadar West, Mumbai' },
        aiPredictionConfidence: 88,
      },
      {
        title: 'Road accident with multiple casualties near Vile Parle',
        type: 'medical',
        severity: 'critical',
        location: { lat: 19.1150, lng: 72.8000, address: 'Vile Parle Junction, Mumbai' },
        aiPredictionConfidence: 93,
      },
      // Utility incidents (assign to UTL-001, UTL-002)
      {
        title: 'Streetlight failure chain in Powai',
        type: 'utility',
        severity: 'medium',
        location: { lat: 19.1176, lng: 72.906, address: 'Powai Lake Road, Mumbai' },
        aiPredictionConfidence: 78,
      },
      {
        title: 'Public bus stop electrical hazard at Ghatkopar',
        type: 'utility',
        severity: 'critical',
        location: { lat: 19.0856, lng: 72.9081, address: 'Ghatkopar East Bus Depot, Mumbai' },
        aiPredictionConfidence: 91,
      },
      // Sanitation incidents (assign to SAN-001)
      {
        title: 'Garbage overflow near Andheri East station',
        type: 'sanitation',
        severity: 'high',
        location: { lat: 19.1136, lng: 72.8697, address: 'Andheri East Station, Mumbai' },
        aiPredictionConfidence: 90,
      },
      {
        title: 'Night sanitation pickup missed',
        type: 'sanitation',
        severity: 'medium',
        location: { lat: 19.0759, lng: 72.8258, address: 'Mahim Causeway, Mumbai' },
        aiPredictionConfidence: 75,
      },
      // Water incidents (assign to WAT-001)
      {
        title: 'Water tanker delay in Dharavi sector 5',
        type: 'water',
        severity: 'critical',
        location: { lat: 19.0413, lng: 72.8553, address: 'Dharavi Sector 5, Mumbai' },
        aiPredictionConfidence: 94,
      },
      {
        title: 'Waterlogging near CST pedestrian underpass',
        type: 'water',
        severity: 'high',
        location: { lat: 18.9398, lng: 72.8355, address: 'CST Underpass, Mumbai' },
        aiPredictionConfidence: 86,
      },
      // Maintenance/Roads incidents
      {
        title: 'Road pothole cluster near Sion Circle',
        type: 'roads',
        severity: 'high',
        location: { lat: 19.0476, lng: 72.8664, address: 'Sion Circle, Mumbai' },
        aiPredictionConfidence: 87,
      },
      {
        title: 'Drainage choke after rainfall in Kurla',
        type: 'maintenance',
        severity: 'high',
        location: { lat: 19.0728, lng: 72.8826, address: 'Kurla West, Mumbai' },
        aiPredictionConfidence: 84,
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

    const personnel = await Personnel.create([
      // Police Officers (2)
      { name: 'Worker 1 - Police Officer', type: 'police', status: 'available', location: { lat: 19.05, lng: 72.84 }, contact: { phone: '+91-9000000001', unitId: 'POL-001' } },
      { name: 'Worker 2 - Police Officer', type: 'police', status: 'available', location: { lat: 19.02, lng: 72.85 }, contact: { phone: '+91-9000000002', unitId: 'POL-002' } },
      // Firefighters (2)
      { name: 'Worker 3 - Firefighter', type: 'fire', status: 'available', location: { lat: 19.08, lng: 72.88 }, contact: { phone: '+91-9000000003', unitId: 'FIR-001' } },
      { name: 'Worker 4 - Firefighter', type: 'fire', status: 'available', location: { lat: 19.07, lng: 72.87 }, contact: { phone: '+91-9000000004', unitId: 'FIR-002' } },
      // Medical Officers (2)
      { name: 'Worker 5 - Medical Officer', type: 'medical', status: 'available', location: { lat: 19.2, lng: 72.97 }, contact: { phone: '+91-9000000005', unitId: 'MED-001' } },
      { name: 'Worker 6 - Medical Officer', type: 'medical', status: 'available', location: { lat: 19.18, lng: 72.95 }, contact: { phone: '+91-9000000006', unitId: 'MED-002' } },
      // Utility Workers (2)
      { name: 'Worker 7 - Utility Technician', type: 'utility', status: 'available', location: { lat: 19.11, lng: 72.9 }, contact: { phone: '+91-9000000007', unitId: 'UTL-001' } },
      { name: 'Worker 8 - Utility Technician', type: 'utility', status: 'available', location: { lat: 19.12, lng: 72.92 }, contact: { phone: '+91-9000000008', unitId: 'UTL-002' } },
      // Sanitation Worker (1)
      { name: 'Worker 9 - Sanitation Supervisor', type: 'sanitation', status: 'available', location: { lat: 19.07, lng: 72.82 }, contact: { phone: '+91-9000000009', unitId: 'SAN-001' } },
      // Water/Sewage Worker (1)
      { name: 'Worker 10 - Water Supply Technician', type: 'utility', status: 'available', location: { lat: 19.09, lng: 72.91 }, contact: { phone: '+91-9000000010', unitId: 'WAT-001' } }
    ]);

    // Assign at least one incident to every worker with mixed states
    // Worker 1 (ongoing)
    incidents[0].assignedPersonnel = personnel[0]._id;
    incidents[0].dispatchStatus = 'dispatched';
    incidents[0].status = 'investigating';
    personnel[0].status = 'busy';
    personnel[0].currentIncident = incidents[0]._id;

    // Worker 2 (resolved/inactive) so police has at least one available responder for new Public Safety dispatches
    incidents[1].assignedPersonnel = personnel[1]._id;
    incidents[1].dispatchStatus = 'completed';
    incidents[1].status = 'resolved';
    personnel[1].status = 'available';
    personnel[1].currentIncident = null;

    // Worker 3 (ongoing)
    incidents[2].assignedPersonnel = personnel[2]._id;
    incidents[2].dispatchStatus = 'dispatched';
    incidents[2].status = 'investigating';
    personnel[2].status = 'busy';
    personnel[2].currentIncident = incidents[2]._id;

    // Worker 4 (resolved/inactive)
    incidents[3].assignedPersonnel = personnel[3]._id;
    incidents[3].dispatchStatus = 'completed';
    incidents[3].status = 'resolved';
    personnel[3].status = 'available';
    personnel[3].currentIncident = null;

    // Worker 5 (ongoing)
    incidents[4].assignedPersonnel = personnel[4]._id;
    incidents[4].dispatchStatus = 'resolving';
    incidents[4].status = 'investigating';
    personnel[4].status = 'busy';
    personnel[4].currentIncident = incidents[4]._id;

    // Worker 6 (resolved/inactive)
    incidents[5].assignedPersonnel = personnel[5]._id;
    incidents[5].dispatchStatus = 'completed';
    incidents[5].status = 'resolved';
    personnel[5].status = 'off-duty';
    personnel[5].currentIncident = null;

    // Worker 7 (ongoing)
    incidents[6].assignedPersonnel = personnel[6]._id;
    incidents[6].dispatchStatus = 'dispatched';
    incidents[6].status = 'active';
    personnel[6].status = 'busy';
    personnel[6].currentIncident = incidents[6]._id;

    // Worker 8 (resolved/inactive)
    incidents[7].assignedPersonnel = personnel[7]._id;
    incidents[7].dispatchStatus = 'completed';
    incidents[7].status = 'resolved';
    personnel[7].status = 'available';
    personnel[7].currentIncident = null;

    // Worker 9 (ongoing)
    incidents[8].assignedPersonnel = personnel[8]._id;
    incidents[8].dispatchStatus = 'on-site';
    incidents[8].status = 'investigating';
    personnel[8].status = 'busy';
    personnel[8].currentIncident = incidents[8]._id;

    // Worker 10 (ongoing)
    incidents[10].assignedPersonnel = personnel[9]._id;
    incidents[10].dispatchStatus = 'dispatched';
    incidents[10].status = 'investigating';
    personnel[9].status = 'busy';
    personnel[9].currentIncident = incidents[10]._id;

    // Keep queue for admin dispatch demo
    incidents[9].dispatchStatus = 'unassigned';
    incidents[11].dispatchStatus = 'unassigned';
    incidents[12].dispatchStatus = 'unassigned';
    incidents[13].dispatchStatus = 'unassigned';

    // Save all updates
    await Promise.all([
      ...incidents.map(i => i.save()),
      ...personnel.map(p => p.save())
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
