from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
from sklearn.cluster import DBSCAN
import numpy as np

app = FastAPI(title="CivicFlow AI Engine")

class Incident(BaseModel):
    id: str
    type: str
    severity: str
    lat: float
    lng: float

class AnalysisRequest(BaseModel):
    incidents: List[Incident]

@app.get("/")
async def root():
    return {"status": "online", "engine": "CivicFlow-AI-v1"}

@app.post("/analyze/clustering")
async def analyze_clusters(request: AnalysisRequest):
    if not request.incidents:
        return {"clusters": []}
    
    # Simple DBSCAN clustering for prone areas
    coords = np.array([[i.lat, i.lng] for i in request.incidents])
    clustering = DBSCAN(eps=0.01, min_samples=2).fit(coords)
    
    results = []
    for i, label in enumerate(clustering.labels_):
        results.append({
            "incident_id": request.incidents[i].id,
            "cluster_id": int(label)
        })
    
    return {"clusters": results}

@app.post("/analyze/heatmap-weights")
async def calculate_heatmap_weights(request: AnalysisRequest):
    # Calculate intensity based on severity and local density
    weights = []
    severity_map = {"critical": 1.0, "high": 0.7, "medium": 0.4, "low": 0.2}
    
    for inc in request.incidents:
        base_weight = severity_map.get(inc.severity.lower(), 0.5)
        # In a real engine, we'd calculate local density here
        weights.append({
            "id": inc.id,
            "lat": inc.lat,
            "lng": inc.lng,
            "weight": base_weight
        })
    
    return {"data": weights}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
