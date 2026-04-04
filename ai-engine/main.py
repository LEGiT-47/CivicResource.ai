from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import List
from sklearn.cluster import DBSCAN
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
import numpy as np
import spacy

app = FastAPI(title="CivicFlow AI Engine")


LANGUAGE_MAP = {
    "english": "en",
    "en": "en",
    "hindi": "hi",
    "hi": "hi",
    "marathi": "mr",
    "mr": "mr",
}


def get_nlp(language: str):
    code = LANGUAGE_MAP.get(language.lower(), "en")
    return spacy.blank(code)


TRANSLATION_HINTS = {
    "hindi": {
        "पानी": "water",
        "कचरा": "garbage",
        "सड़क": "road",
        "ट्रैफिक": "traffic",
        "आग": "fire",
        "अस्पताल": "hospital",
        "बिजली": "electricity",
        "समस्या": "issue",
    },
    "marathi": {
        "पाणी": "water",
        "कचरा": "garbage",
        "रस्ता": "road",
        "वाहतूक": "traffic",
        "आग": "fire",
        "रुग्णालय": "hospital",
        "वीज": "electricity",
        "समस्या": "issue",
    },
}

class Incident(BaseModel):
    id: str
    type: str
    severity: str
    lat: float
    lng: float

class AnalysisRequest(BaseModel):
    incidents: List[Incident]


class DemandZone(BaseModel):
    zone_id: str
    population_density: float = Field(ge=0)
    complaints_last_7d: float = Field(ge=0)
    weather_rain_mm: float = Field(ge=0)
    weather_temp_c: float
    event_factor: float = Field(ge=0)
    historical_daily_avg: float = Field(ge=0)


class DemandForecastRequest(BaseModel):
    zones: List[DemandZone]


class ResourceUnit(BaseModel):
    id: str
    type: str
    status: str
    lat: float
    lng: float


class AllocationRequest(BaseModel):
    zones: List[DemandZone]
    resources: List[ResourceUnit]


class NLPRequest(BaseModel):
    text: str
    language: str = "english"


def severity_score(severity: str):
    return {
        "critical": 1.0,
        "high": 0.7,
        "medium": 0.45,
        "low": 0.2,
    }.get(severity.lower(), 0.5)


def translate_to_english(text: str, language: str):
    lang = language.lower()
    if lang not in TRANSLATION_HINTS:
        return text

    translated = text
    for src, dst in TRANSLATION_HINTS[lang].items():
        translated = translated.replace(src, dst)

    return translated


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float):
    r = 6371.0
    p1 = np.radians(lat1)
    p2 = np.radians(lat2)
    dp = np.radians(lat2 - lat1)
    dl = np.radians(lng2 - lng1)
    a = np.sin(dp / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return float(2 * r * np.arctan2(np.sqrt(a), np.sqrt(1 - a)))


def zone_center(zone_id: str):
    try:
        lat_s, lng_s = zone_id.split("_", 1)
        return float(lat_s), float(lng_s)
    except Exception:
        return 19.076, 72.8777


def train_demand_models(zones: List[DemandZone]):
    x_train = []
    y_train = []
    for zone in zones:
        for day_factor in [0.8, 1.0, 1.2, 1.4]:
            x = [
                zone.population_density,
                zone.complaints_last_7d * day_factor,
                zone.weather_rain_mm,
                zone.weather_temp_c,
                zone.event_factor,
                zone.historical_daily_avg,
            ]
            demand = (
                0.00008 * zone.population_density
                + 0.7 * zone.complaints_last_7d * day_factor
                + 0.12 * zone.weather_rain_mm
                + 0.2 * zone.event_factor * zone.historical_daily_avg
                + max(0, (zone.weather_temp_c - 30) * 0.1)
            )
            x_train.append(x)
            y_train.append(demand)

    rf = RandomForestRegressor(n_estimators=120, random_state=42)
    gb = GradientBoostingRegressor(random_state=42, n_estimators=160, learning_rate=0.05)
    rf.fit(x_train, y_train)
    gb.fit(x_train, y_train)
    return rf, gb


def score_zones(zones: List[DemandZone]):
    if not zones:
        return []

    rf, gb = train_demand_models(zones)

    scored = []
    for zone in zones:
        x_live = [[
            zone.population_density,
            zone.complaints_last_7d,
            zone.weather_rain_mm,
            zone.weather_temp_c,
            zone.event_factor,
            zone.historical_daily_avg,
        ]]

        # Ensemble blend balances variance (RF) and trend sensitivity (GB).
        prediction_rf = float(rf.predict(x_live)[0])
        prediction_gb = float(gb.predict(x_live)[0])
        prediction = 0.55 * prediction_rf + 0.45 * prediction_gb

        urgency = (
            prediction * 0.55
            + zone.complaints_last_7d * 0.3
            + zone.event_factor * 8
            + max(0, zone.weather_rain_mm - 6) * 0.6
        )

        recommended_units = max(1, int(round(urgency / 8)))
        scored.append({
            "zone_id": zone.zone_id,
            "predicted_demand_score": round(prediction, 2),
            "urgency_score": round(urgency, 2),
            "recommended_units": recommended_units,
        })

    scored.sort(key=lambda z: z["urgency_score"], reverse=True)
    for idx, zone in enumerate(scored, start=1):
        zone["urgency_rank"] = idx

    return scored

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
    
    for inc in request.incidents:
        base_weight = severity_score(inc.severity)
        # In a real engine, we'd calculate local density here
        weights.append({
            "id": inc.id,
            "lat": inc.lat,
            "lng": inc.lng,
            "weight": base_weight
        })
    
    return {"data": weights}


@app.post("/analyze/demand-forecast")
async def demand_forecast(request: DemandForecastRequest):
    if not request.zones:
        return {"zones": [], "growth_trend": "+0.0%", "mitigation_efficiency": "0.0%"}

    scored = score_zones(request.zones)
    top = scored[0]["urgency_score"]
    bottom = scored[-1]["urgency_score"]
    growth = ((top - bottom) / max(1.0, bottom)) * 100
    mitigation_efficiency = max(55.0, min(98.5, 100.0 - growth * 0.4))

    return {
        "zones": scored,
        "growth_trend": f"+{growth:.1f}%",
        "mitigation_efficiency": f"{mitigation_efficiency:.1f}%",
    }


@app.post("/analyze/resource-allocation")
async def resource_allocation(request: AllocationRequest):
    if not request.zones:
        return {"allocations": [], "summary": {"allocated": 0, "unallocated_demand": 0}}

    scored_zones = score_zones(request.zones)
    available = [r for r in request.resources if r.status in ("patrol", "available")]
    remaining = {z["zone_id"]: z["recommended_units"] for z in scored_zones}

    allocations = []
    used_ids = set()

    for zone in scored_zones:
        if remaining[zone["zone_id"]] <= 0:
            continue

        z_lat, z_lng = zone_center(zone["zone_id"])
        candidates = [r for r in available if r.id not in used_ids]
        candidates.sort(key=lambda r: haversine_km(r.lat, r.lng, z_lat, z_lng))

        for resource in candidates[:remaining[zone["zone_id"]]]:
            distance = haversine_km(resource.lat, resource.lng, z_lat, z_lng)
            eta_minutes = max(3, int(round(distance / 0.45)))
            allocations.append({
                "zone_id": zone["zone_id"],
                "resource_id": resource.id,
                "resource_type": resource.type,
                "distance_km": round(distance, 2),
                "eta_minutes": eta_minutes,
                "urgency_rank": zone["urgency_rank"],
                "urgency_score": zone["urgency_score"],
            })
            used_ids.add(resource.id)
            remaining[zone["zone_id"]] -= 1
            if remaining[zone["zone_id"]] <= 0:
                break

    unallocated_demand = sum(v for v in remaining.values() if v > 0)

    return {
        "allocations": allocations,
        "summary": {
            "allocated": len(allocations),
            "unallocated_demand": int(unallocated_demand),
            "zones_covered": len({a["zone_id"] for a in allocations}),
        },
        "zones": scored_zones,
    }


@app.post("/nlp/normalize")
async def nlp_normalize(request: NLPRequest):
    language = request.language.lower()
    normalized_language = "english" if language in ("en", "english") else ("hindi" if language in ("hi", "hindi") else ("marathi" if language in ("mr", "marathi") else "english"))
    english_text = translate_to_english(request.text, normalized_language)

    nlp = get_nlp(normalized_language)
    doc = nlp(request.text)
    english_doc = get_nlp("english")(english_text)

    keywords = []
    for token in english_doc:
        cleaned = token.text.strip().lower()
        if token.is_alpha and len(cleaned) > 2 and cleaned not in keywords:
            keywords.append(cleaned)
        if len(keywords) >= 10:
            break

    return {
        "language": normalized_language,
        "original_text": request.text,
        "english_text": english_text,
        "token_count": len(doc),
        "keywords": keywords,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
