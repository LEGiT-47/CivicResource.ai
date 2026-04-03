import Incident from '../models/Incident.js';
import Personnel from '../models/Personnel.js';

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
        const incidents = await Incident.find({ status: 'active' });
        // In a real scenario, this would call the Python AI Engine at http://localhost:8000
        // For now, we simulate the proxy call
        const aiResponse = {
            proneAreas: incidents.map(i => ({ lat: i.location.lat, lng: i.location.lng, weight: 0.8 })),
            growthTrend: "+12.4%",
            mitigationEfficiency: "78.2%",
            strategicAdvice: "Deploy additional utility units to the Downtown sector due to clustered infrastructure reports."
        };
        res.json(aiResponse);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
