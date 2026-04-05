from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import List
from sklearn.cluster import DBSCAN
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, mean_absolute_error, r2_score
from sklearn.pipeline import Pipeline
import numpy as np
import pandas as pd
import spacy
import re
import os
import joblib

app = FastAPI(title="CivicFlow AI Engine")

MODEL_FEATURES = [
    "population_density",
    "complaints_last_7d",
    "weather_rain_mm",
    "weather_temp_c",
    "event_factor",
    "historical_daily_avg",
]

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
MODEL_PATH = os.path.join(MODEL_DIR, "demand_ensemble.joblib")
DATASET_PATH = os.path.join(os.path.dirname(__file__), "data", "historical_demand.csv")
TRIAGE_MODEL_PATH = os.path.join(MODEL_DIR, "complaint_triage.joblib")
TRIAGE_DATASET_PATH = os.path.join(os.path.dirname(__file__), "data", "complaint_triage.csv")
CLUSTER_MODEL_PATH = os.path.join(MODEL_DIR, "cluster_feasibility.joblib")
CLUSTER_DATASET_PATH = os.path.join(os.path.dirname(__file__), "data", "cluster_feasibility.csv")

rf_model = None
gb_model = None
triage_intent_model = None
triage_fake_model = None
cluster_feasibility_model = None
cluster_feasibility_meta = {
    "trained": False,
    "source": "fallback",
    "rows": 0,
    "mae": None,
    "r2": None,
}
model_meta = {
    "trained": False,
    "source": "fallback",
    "rows": 0,
    "mae": None,
    "r2": None,
}
triage_meta = {
    "trained": False,
    "source": "fallback",
    "rows": 0,
    "intent_accuracy": None,
    "fake_accuracy": None,
}


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
    dominant_need: str = "general"
    freshness_factor: float = 1.0


class DemandForecastRequest(BaseModel):
    zones: List[DemandZone]


class ResourceUnit(BaseModel):
    id: str
    name: str | None = None
    type: str
    status: str
    lat: float
    lng: float


class PersonnelUnit(BaseModel):
    id: str
    name: str
    type: str
    status: str
    lat: float
    lng: float
    current_task_eta_minutes: float = 0
    assigned_resource_id: str | None = None


class AllocationRequest(BaseModel):
    zones: List[DemandZone]
    resources: List[ResourceUnit]
    personnel: List[PersonnelUnit] | None = None
    traffic_index: float = 1.0
    road_condition_index: float = 1.0


class NLPRequest(BaseModel):
    text: str
    language: str = "english"


class ModelTrainRequest(BaseModel):
    dataset_path: str | None = None


class ComplaintTriageRequest(BaseModel):
    title: str = ""
    details: str = ""
    reported_type: str = "general"
    language: str = "english"
    location_address: str = ""
    reporter_phone_present: bool = False
    location_present: bool = True


class ClusterFeasibilityRecord(BaseModel):
    cluster_id: str
    service_family: str = "general"
    incident_count: int = Field(ge=1)
    capacity_units: float = Field(ge=0)
    demand_units: float = Field(ge=0)
    utilization_percent: float = Field(ge=0)
    avg_distance_km: float = Field(ge=0)
    avg_severity_score: float = Field(ge=0)
    mixed_family_ratio: float = Field(ge=0, le=1)
    available_personnel: int = Field(ge=0)
    resource_available: bool = True
    shift_remaining_minutes: float = Field(ge=0)
    refill_minutes: float = Field(ge=0)
    weather_rain_mm: float = Field(ge=0)
    traffic_index: float = Field(ge=0)
    road_condition_index: float = Field(ge=0)
    family_match_ratio: float = Field(ge=0, le=1)
    crew_size: int = Field(ge=0)
    radius_km: float = Field(ge=0)
    queue_pressure: float = Field(ge=0)


class ClusterFeasibilityRequest(BaseModel):
    clusters: List[ClusterFeasibilityRecord]


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


def normalize_need_label(value: str):
    text = str(value or "").strip().lower()
    if any(token in text for token in ("garbage", "trash", "waste", "sanitation", "litter", "dump")):
        return "garbage"
    if any(token in text for token in ("water", "tank", "tanker", "pipe", "leak", "hydrant")):
        return "water"
    if any(token in text for token in ("maintenance", "repair", "road", "street", "drain", "sewer", "electric", "infrastructure")):
        return "maintenance"
    return "general"


def resource_family(resource_type: str, resource_name: str = ""):
    return normalize_need_label(f"{resource_type} {resource_name}")


def infer_zone_dominant_need(zone: DemandZone):
    return normalize_need_label(zone.dominant_need)


def build_complaint_text(title: str, details: str, reported_type: str, location_address: str = ""):
    parts = [title, details, reported_type, location_address]
    return " ".join(str(part or "").strip() for part in parts if str(part or "").strip())


def extract_keywords(text: str, limit: int = 8):
    tokens = re.findall(r"[a-zA-Z]+", str(text or "").lower())
    keywords = []
    for token in tokens:
        if len(token) < 3 or token in keywords:
            continue
        keywords.append(token)
        if len(keywords) >= limit:
            break
    return keywords


def civic_keyword_hits(text: str):
    keywords = {
        "garbage": ["garbage", "trash", "waste", "sanitation", "bin", "dump", "litter"],
        "water": ["water", "tank", "tanker", "pipe", "leak", "hydrant", "shortage", "pressure", "supply"],
        "maintenance": ["maintenance", "repair", "drain", "sewer", "road", "pothole", "streetlight", "infrastructure", "electric", "power"],
        "safety": ["unsafe", "assault", "crime", "theft", "fight", "danger", "threat", "fire", "emergency"],
        "traffic": ["traffic", "jam", "signal", "accident", "congestion", "diversion"],
    }

    lowered = str(text or "").lower()
    counts = {label: sum(1 for term in terms if term in lowered) for label, terms in keywords.items()}
    strongest_label = max(counts, key=counts.get) if counts else "general"
    return strongest_label if counts.get(strongest_label, 0) > 0 else "general", counts


def heuristic_fake_score(title: str, details: str, reported_type: str, location_present: bool, reporter_phone_present: bool):
    text = build_complaint_text(title, details, reported_type)
    tokens = re.findall(r"[a-zA-Z0-9]+", text.lower())
    token_count = len(tokens)
    unique_ratio = len(set(tokens)) / max(1, token_count)
    strongest_label, hit_counts = civic_keyword_hits(text)
    reported_family = normalize_need_label(reported_type)
    placeholder_pattern = re.search(r"\b(test|spam|dummy|fake|ignore|asdf|lorem|hello world|sample data)\b", text.lower())
    repeated_token_ratio = (token_count - len(set(tokens))) / max(1, token_count)

    score = 0.0
    if token_count < 6:
        score += 0.25
    if len(text.strip()) < 24:
        score += 0.2
    if strongest_label == "general":
        score += 0.25
    if unique_ratio < 0.45:
        score += 0.15
    if repeated_token_ratio >= 0.5 and strongest_label == "general":
        score += 0.3
    if not location_present:
        score += 0.15
    if not reporter_phone_present:
        score += 0.08
    if reported_family != "general" and hit_counts.get(reported_family, 0) == 0 and strongest_label != reported_family:
        score += 0.1
    if placeholder_pattern:
        score += 0.45

    return min(1.0, score)


def train_complaint_triage_models(dataset_path: str = TRIAGE_DATASET_PATH):
    global triage_intent_model, triage_fake_model, triage_meta

    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Complaint triage dataset not found: {dataset_path}")

    data = pd.read_csv(dataset_path)
    required_cols = ["text", "intent", "is_fake"]
    missing_cols = [col for col in required_cols if col not in data.columns]
    if missing_cols:
        raise ValueError(f"Dataset missing required columns: {', '.join(missing_cols)}")

    texts = data["text"].fillna("").astype(str)
    intent_labels = data["intent"].fillna("general").astype(str)
    fake_labels = data["is_fake"].fillna(0).astype(int)

    intent_test_size = max(0.3, (intent_labels.nunique() + 1) / max(len(data), 1))
    intent_test_size = min(0.45, intent_test_size)
    fake_test_size = max(0.3, 0.25)

    intent_stratify = intent_labels if intent_labels.nunique() <= int(len(data) * intent_test_size) else None
    fake_stratify = fake_labels if fake_labels.nunique() <= int(len(data) * fake_test_size) else None

    intent_train_x, intent_test_x, intent_train_y, intent_test_y = train_test_split(
        texts, intent_labels, test_size=intent_test_size, random_state=42, stratify=intent_stratify
    )
    fake_train_x, fake_test_x, fake_train_y, fake_test_y = train_test_split(
        texts, fake_labels, test_size=fake_test_size, random_state=42, stratify=fake_stratify
    )

    def build_pipeline():
        return Pipeline([
            ("vectorizer", TfidfVectorizer(ngram_range=(1, 2), min_df=1, stop_words="english")),
            ("classifier", LogisticRegression(max_iter=2000, class_weight="balanced")),
        ])

    intent_model = build_pipeline()
    fake_model = build_pipeline()
    intent_model.fit(intent_train_x, intent_train_y)
    fake_model.fit(fake_train_x, fake_train_y)

    intent_accuracy = float(accuracy_score(intent_test_y, intent_model.predict(intent_test_x)))
    fake_accuracy = float(accuracy_score(fake_test_y, fake_model.predict(fake_test_x)))

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(
        {
            "intent_model": intent_model,
            "fake_model": fake_model,
            "meta": {
                "rows": int(len(data)),
                "intent_accuracy": intent_accuracy,
                "fake_accuracy": fake_accuracy,
                "dataset_path": dataset_path,
            },
        },
        TRIAGE_MODEL_PATH,
    )

    triage_intent_model = intent_model
    triage_fake_model = fake_model
    triage_meta = {
        "trained": True,
        "source": "synthetic-triage-dataset",
        "rows": int(len(data)),
        "intent_accuracy": round(intent_accuracy, 4),
        "fake_accuracy": round(fake_accuracy, 4),
    }

    return triage_meta


def load_persisted_triage_models():
    global triage_intent_model, triage_fake_model, triage_meta

    if not os.path.exists(TRIAGE_MODEL_PATH):
        return False

    bundle = joblib.load(TRIAGE_MODEL_PATH)
    triage_intent_model = bundle.get("intent_model")
    triage_fake_model = bundle.get("fake_model")
    bundle_meta = bundle.get("meta", {})
    triage_meta = {
        "trained": True,
        "source": "persisted-model",
        "rows": int(bundle_meta.get("rows", 0)),
        "intent_accuracy": bundle_meta.get("intent_accuracy"),
        "fake_accuracy": bundle_meta.get("fake_accuracy"),
    }
    return triage_intent_model is not None and triage_fake_model is not None


def analyze_complaint_intake(payload: ComplaintTriageRequest):
    combined_text = build_complaint_text(payload.title, payload.details, payload.reported_type, payload.location_address)
    normalized_family = normalize_need_label(payload.reported_type)
    strongest_label, hit_counts = civic_keyword_hits(combined_text)
    keywords = extract_keywords(combined_text)

    predicted_intent = strongest_label if strongest_label != "general" else normalized_family
    intent_confidence = 0.5
    fake_probability = heuristic_fake_score(
        payload.title,
        payload.details,
        payload.reported_type,
        payload.location_present,
        payload.reporter_phone_present,
    )

    if triage_intent_model is not None:
        try:
            model_prediction = str(triage_intent_model.predict([combined_text])[0])
            predicted_intent = normalize_need_label(model_prediction)
            if hasattr(triage_intent_model, "predict_proba"):
                probabilities = triage_intent_model.predict_proba([combined_text])[0]
                intent_confidence = float(np.max(probabilities))
        except Exception:
            pass

    if triage_fake_model is not None:
        try:
            if hasattr(triage_fake_model, "predict_proba"):
                fake_probability = max(
                    fake_probability,
                    float(triage_fake_model.predict_proba([combined_text])[0][1]),
                )
            else:
                fake_probability = max(fake_probability, float(triage_fake_model.predict([combined_text])[0]))
        except Exception:
            pass

    if predicted_intent == "general" and strongest_label != "general":
        predicted_intent = strongest_label

    if predicted_intent == "general" and normalized_family != "general":
        predicted_intent = normalized_family

    civic_hits = sum(hit_counts.values())
    if civic_hits > 0 and intent_confidence < 0.55:
        intent_confidence = min(0.92, 0.55 + civic_hits * 0.08)

    if strongest_label != "general" and predicted_intent != strongest_label:
        fake_probability = min(1.0, fake_probability + 0.08)

    if token_count := len(re.findall(r"[a-zA-Z0-9]+", combined_text.lower())):
        unique_ratio = len(set(re.findall(r"[a-zA-Z0-9]+", combined_text.lower()))) / max(1, token_count)
        repeated_token_ratio = (token_count - len(set(re.findall(r"[a-zA-Z0-9]+", combined_text.lower())))) / max(1, token_count)
        if repeated_token_ratio >= 0.5 and strongest_label == "general":
            fake_probability = max(fake_probability, 0.8)
        if unique_ratio < 0.4 and strongest_label == "general":
            fake_probability = max(fake_probability, 0.75)

    fake_probability = min(1.0, max(0.0, fake_probability))
    confidence = round((1.0 - fake_probability) * 100, 1)
    fake_score = round(fake_probability * 100, 1)
    intent_confidence_percent = round(max(intent_confidence, 0.4) * 100, 1)
    is_fake = fake_probability >= 0.72 or (civic_hits == 0 and len(combined_text.strip()) < 30)

    reason = "Complaint accepted for triage"
    if is_fake:
        if re.search(r"\b(test|spam|dummy|fake|ignore|asdf|lorem)\b", combined_text.lower()):
            reason = "Complaint looks like test or spam content"
        elif civic_hits == 0:
            reason = "Complaint text does not contain a clear civic issue"
        elif len(combined_text.strip()) < 24:
            reason = "Complaint text is too short to verify"
        else:
            reason = "Complaint confidence is too low and was flagged as likely fake"

    return {
        "is_fake": bool(is_fake),
        "fake_score": fake_score,
        "confidence": confidence,
        "intent_confidence": intent_confidence_percent,
        "predicted_type": predicted_intent,
        "resource_family": predicted_intent,
        "keywords": keywords,
        "reason": reason,
        "signals": {
            "strongest_label": strongest_label,
            "reported_family": normalized_family,
            "civic_hits": civic_hits,
            "location_present": bool(payload.location_present),
            "reporter_phone_present": bool(payload.reporter_phone_present),
        },
    }


def cluster_family_priority(service_family: str):
    return {
        "water": 0.95,
        "garbage": 0.9,
        "maintenance": 0.82,
        "general": 0.68,
        "safety": 0.78,
    }.get(normalize_need_label(service_family), 0.7)


def build_cluster_feature_row(record: ClusterFeasibilityRecord):
    family = normalize_need_label(record.service_family)
    radius = max(0.1, float(record.radius_km or 0.1))
    capacity_units = max(0.1, float(record.capacity_units or 0.1))
    demand_units = max(0.0, float(record.demand_units or 0.0))
    utilization = max(0.0, float(record.utilization_percent or 0.0))
    return {
        "incident_count": max(1, int(record.incident_count or 1)),
        "capacity_units": capacity_units,
        "demand_units": demand_units,
        "utilization_percent": utilization,
        "avg_distance_km": max(0.0, float(record.avg_distance_km or 0.0)),
        "avg_severity_score": max(0.0, float(record.avg_severity_score or 0.0)),
        "mixed_family_ratio": max(0.0, min(1.0, float(record.mixed_family_ratio or 0.0))),
        "available_personnel": max(0, int(record.available_personnel or 0)),
        "resource_available": 1.0 if record.resource_available else 0.0,
        "shift_remaining_minutes": max(0.0, float(record.shift_remaining_minutes or 0.0)),
        "refill_minutes": max(0.0, float(record.refill_minutes or 0.0)),
        "weather_rain_mm": max(0.0, float(record.weather_rain_mm or 0.0)),
        "traffic_index": max(0.0, float(record.traffic_index or 0.0)),
        "road_condition_index": max(0.0, float(record.road_condition_index or 0.0)),
        "family_match_ratio": max(0.0, min(1.0, float(record.family_match_ratio or 0.0))),
        "crew_size": max(0, int(record.crew_size or 0)),
        "radius_km": radius,
        "queue_pressure": max(0.0, float(record.queue_pressure or 0.0)),
        "stop_density": max(0.0, float(record.incident_count or 1) / radius),
        "family_priority_score": cluster_family_priority(family),
    }


def cluster_feasibility_target(row: dict):
    capacity_units = max(0.1, float(row["capacity_units"]))
    demand_units = max(0.0, float(row["demand_units"]))
    utilization = max(0.0, float(row["utilization_percent"]))
    utilization_gap = max(0.0, 100.0 - utilization)
    under_capacity_bonus = max(0.0, min(1.0, utilization_gap / 100.0))
    cap_ratio = min(1.8, demand_units / capacity_units)
    severity = max(0.0, float(row["avg_severity_score"])) / 100.0
    resource_bonus = 8.0 if float(row["resource_available"]) > 0 else -12.0
    personnel_bonus = min(14.0, float(row["available_personnel"]) * 3.8)
    family_bonus = float(row["family_priority_score"]) * 12.0
    match_bonus = float(row["family_match_ratio"]) * 14.0
    distance_penalty = float(row["avg_distance_km"]) * 4.2
    crowd_penalty = max(0.0, float(row["mixed_family_ratio"]) - 0.2) * 22.0
    queue_penalty = float(row["queue_pressure"]) * 10.0
    weather_penalty = float(row["weather_rain_mm"]) * 0.2
    traffic_penalty = max(0.0, float(row["traffic_index"]) - 1.0) * 10.0
    road_penalty = max(0.0, float(row["road_condition_index"]) - 1.0) * 8.0
    refill_penalty = max(0.0, float(row["refill_minutes"]) - 15.0) * 0.2
    shift_bonus = min(10.0, float(row["shift_remaining_minutes"]) / 45.0)
    crew_bonus = min(8.0, float(row["crew_size"]) * 1.6)
    stop_pressure = max(0.0, float(row["stop_density"]) - 0.5) * 8.0
    overload_penalty = max(0.0, (cap_ratio - 1.0) * 35.0)

    raw_score = (
        52.0
        + family_bonus
        + match_bonus
        + under_capacity_bonus * 18.0
        + resource_bonus
        + personnel_bonus
        + shift_bonus
        + crew_bonus
        + severity * 12.0
        - distance_penalty
        - crowd_penalty
        - queue_penalty
        - weather_penalty
        - traffic_penalty
        - road_penalty
        - refill_penalty
        - stop_pressure
        - overload_penalty
    )
    return float(max(0.0, min(100.0, raw_score)))


def build_synthetic_cluster_dataset(sample_count: int = 1200):
    rng = np.random.default_rng(42)
    families = ["water", "garbage", "maintenance", "general", "safety"]
    rows = []

    for _ in range(sample_count):
        family = str(rng.choice(families))
        incident_count = int(rng.integers(1, 8))
        radius_km = float(rng.uniform(1.0, 8.0))
        capacity_units = float(rng.uniform(500.0, 12000.0) if family == "water" else rng.uniform(250.0, 9000.0) if family == "garbage" else rng.uniform(1.0, 6.0))
        family_match_ratio = float(rng.uniform(0.45, 1.0) if family != "general" else rng.uniform(0.2, 0.85))
        mixed_family_ratio = float(rng.uniform(0.0, 0.75 if family == "general" else 0.45))
        available_personnel = int(rng.integers(0, 5))
        resource_available = bool(rng.integers(0, 2))
        shift_remaining_minutes = float(rng.uniform(30.0, 360.0))
        refill_minutes = float(rng.uniform(10.0, 45.0))
        weather_rain_mm = float(rng.uniform(0.0, 45.0))
        traffic_index = float(rng.uniform(0.85, 1.8))
        road_condition_index = float(rng.uniform(0.8, 1.5))
        crew_size = int(rng.integers(1, 7))
        avg_distance_km = float(rng.uniform(0.15, radius_km))
        avg_severity_score = float(rng.uniform(20.0, 100.0))
        queue_pressure = float(rng.uniform(0.0, 2.2))

        demand_units = float(
            capacity_units
            * rng.uniform(0.35, 1.55)
            * (1.0 + mixed_family_ratio * 0.4)
            * (1.0 + max(0.0, traffic_index - 1.0) * 0.15)
        )
        utilization_percent = float((demand_units / max(1.0, capacity_units)) * 100.0)

        row = {
            "incident_count": incident_count,
            "capacity_units": capacity_units,
            "demand_units": demand_units,
            "utilization_percent": utilization_percent,
            "avg_distance_km": avg_distance_km,
            "avg_severity_score": avg_severity_score,
            "mixed_family_ratio": mixed_family_ratio,
            "available_personnel": available_personnel,
            "resource_available": resource_available,
            "shift_remaining_minutes": shift_remaining_minutes,
            "refill_minutes": refill_minutes,
            "weather_rain_mm": weather_rain_mm,
            "traffic_index": traffic_index,
            "road_condition_index": road_condition_index,
            "family_match_ratio": family_match_ratio,
            "crew_size": crew_size,
            "radius_km": radius_km,
            "queue_pressure": queue_pressure,
            "stop_density": incident_count / max(0.1, radius_km),
            "family_priority_score": cluster_family_priority(family),
        }
        row["feasibility_score"] = cluster_feasibility_target(row) + float(rng.normal(0, 4.5))
        row["feasibility_score"] = max(0.0, min(100.0, row["feasibility_score"]))
        rows.append(row)

    return pd.DataFrame(rows)


def train_grouping_feasibility_model(dataset_path: str | None = None):
    global cluster_feasibility_model, cluster_feasibility_meta

    data = None
    resolved_dataset_path = dataset_path or CLUSTER_DATASET_PATH
    training_source = 'synthetic-cluster-dataset'
    if resolved_dataset_path and os.path.exists(resolved_dataset_path):
        candidate = pd.read_csv(resolved_dataset_path)
        required_cols = [
            "incident_count",
            "capacity_units",
            "demand_units",
            "utilization_percent",
            "avg_distance_km",
            "avg_severity_score",
            "mixed_family_ratio",
            "available_personnel",
            "resource_available",
            "shift_remaining_minutes",
            "refill_minutes",
            "weather_rain_mm",
            "traffic_index",
            "road_condition_index",
            "family_match_ratio",
            "crew_size",
            "radius_km",
            "queue_pressure",
            "stop_density",
            "family_priority_score",
            "feasibility_score",
        ]
        if all(col in candidate.columns for col in required_cols):
            data = candidate[required_cols].copy()
            training_source = 'cluster-dataset'

    if data is None:
        data = build_synthetic_cluster_dataset()

    x = data.drop(columns=["feasibility_score"])
    y = data["feasibility_score"]
    x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=42)

    rf = RandomForestRegressor(n_estimators=220, random_state=42)
    gb = GradientBoostingRegressor(random_state=42, n_estimators=260, learning_rate=0.04)
    rf.fit(x_train, y_train)
    gb.fit(x_train, y_train)

    predictions = 0.58 * rf.predict(x_test) + 0.42 * gb.predict(x_test)
    mae = float(mean_absolute_error(y_test, predictions))
    r2 = float(r2_score(y_test, predictions))

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(
        {
            "rf": rf,
            "gb": gb,
            "features": list(x.columns),
            "meta": {
                "rows": int(len(data)),
                "mae": mae,
                "r2": r2,
                "dataset_path": resolved_dataset_path if os.path.exists(resolved_dataset_path) else "synthetic",
            },
        },
        CLUSTER_MODEL_PATH,
    )

    cluster_feasibility_model = {"rf": rf, "gb": gb, "features": list(x.columns)}
    cluster_feasibility_meta = {
        "trained": True,
        "source": training_source,
        "rows": int(len(data)),
        "mae": round(mae, 4),
        "r2": round(r2, 4),
        "dataset_path": resolved_dataset_path if training_source == 'cluster-dataset' else 'synthetic',
    }
    return cluster_feasibility_meta


def load_persisted_cluster_model():
    global cluster_feasibility_model, cluster_feasibility_meta

    if not os.path.exists(CLUSTER_MODEL_PATH):
        return False

    bundle = joblib.load(CLUSTER_MODEL_PATH)
    rf = bundle.get("rf")
    gb = bundle.get("gb")
    bundle_meta = bundle.get("meta", {})
    cluster_feasibility_model = {"rf": rf, "gb": gb, "features": bundle.get("features", [])}
    cluster_feasibility_meta = {
        "trained": True,
        "source": "persisted-model",
        "rows": int(bundle_meta.get("rows", 0)),
        "mae": bundle_meta.get("mae"),
        "r2": bundle_meta.get("r2"),
    }
    return rf is not None and gb is not None


def predict_cluster_feasibility(record: ClusterFeasibilityRecord):
    feature_row = build_cluster_feature_row(record)
    model_bundle = cluster_feasibility_model

    if model_bundle is None or model_bundle.get("rf") is None or model_bundle.get("gb") is None:
        fallback_score = cluster_feasibility_target(feature_row)
        return {
            "cluster_id": record.cluster_id,
            "feasibility_score": round(fallback_score, 1),
            "feasibility_probability": round(max(0.0, min(1.0, fallback_score / 100.0)), 3),
            "source": "heuristic-fallback",
        }

    x = pd.DataFrame([feature_row], columns=model_bundle.get("features") or list(feature_row.keys()))
    rf_score = float(model_bundle["rf"].predict(x)[0])
    gb_score = float(model_bundle["gb"].predict(x)[0])
    blended = 0.58 * rf_score + 0.42 * gb_score
    blended = max(0.0, min(100.0, blended))
    return {
        "cluster_id": record.cluster_id,
        "feasibility_score": round(blended, 1),
        "feasibility_probability": round(blended / 100.0, 3),
        "source": "trained-model",
        "signals": {
            "utilization_percent": round(feature_row["utilization_percent"], 1),
            "avg_distance_km": round(feature_row["avg_distance_km"], 2),
            "family_priority_score": round(feature_row["family_priority_score"], 2),
            "family_match_ratio": round(feature_row["family_match_ratio"], 2),
            "queue_pressure": round(feature_row["queue_pressure"], 2),
        },
    }


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


def train_models_from_historical_dataset(dataset_path: str = DATASET_PATH):
    global rf_model, gb_model, model_meta

    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Historical dataset not found: {dataset_path}")

    data = pd.read_csv(dataset_path)
    required_cols = MODEL_FEATURES + ["demand_score"]
    missing_cols = [col for col in required_cols if col not in data.columns]
    if missing_cols:
        raise ValueError(f"Dataset missing required columns: {', '.join(missing_cols)}")

    x = data[MODEL_FEATURES]
    y = data["demand_score"]

    x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=42)

    rf = RandomForestRegressor(n_estimators=180, random_state=42)
    gb = GradientBoostingRegressor(random_state=42, n_estimators=240, learning_rate=0.05)
    rf.fit(x_train, y_train)
    gb.fit(x_train, y_train)

    ensemble_predictions = 0.55 * rf.predict(x_test) + 0.45 * gb.predict(x_test)
    mae = float(mean_absolute_error(y_test, ensemble_predictions))
    r2 = float(r2_score(y_test, ensemble_predictions))

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(
        {
            "rf": rf,
            "gb": gb,
            "features": MODEL_FEATURES,
            "meta": {
                "rows": int(len(data)),
                "mae": mae,
                "r2": r2,
                "dataset_path": dataset_path,
            },
        },
        MODEL_PATH,
    )

    rf_model = rf
    gb_model = gb
    model_meta = {
        "trained": True,
        "source": "historical-dataset",
        "rows": int(len(data)),
        "mae": round(mae, 4),
        "r2": round(r2, 4),
    }

    return model_meta


def load_persisted_models():
    global rf_model, gb_model, model_meta

    if not os.path.exists(MODEL_PATH):
        return False

    bundle = joblib.load(MODEL_PATH)
    rf_model = bundle.get("rf")
    gb_model = bundle.get("gb")
    bundle_meta = bundle.get("meta", {})
    model_meta = {
        "trained": True,
        "source": "persisted-model",
        "rows": int(bundle_meta.get("rows", 0)),
        "mae": bundle_meta.get("mae"),
        "r2": bundle_meta.get("r2"),
    }
    return rf_model is not None and gb_model is not None


try:
    if not load_persisted_models() and os.path.exists(DATASET_PATH):
        train_models_from_historical_dataset(DATASET_PATH)
except Exception as bootstrap_error:
    print(f"Model bootstrap warning: {bootstrap_error}")

try:
    if not load_persisted_triage_models() and os.path.exists(TRIAGE_DATASET_PATH):
        train_complaint_triage_models(TRIAGE_DATASET_PATH)
except Exception as triage_bootstrap_error:
    print(f"Complaint triage bootstrap warning: {triage_bootstrap_error}")

try:
    if not load_persisted_cluster_model():
        train_grouping_feasibility_model(CLUSTER_DATASET_PATH)
except Exception as cluster_bootstrap_error:
    print(f"Cluster feasibility bootstrap warning: {cluster_bootstrap_error}")


def score_zones(zones: List[DemandZone]):
    if not zones:
        return []

    rf, gb = rf_model, gb_model
    if rf is None or gb is None:
        rf, gb = train_demand_models(zones)

    scored = []
    for zone in zones:
        x_live = pd.DataFrame(
            [[
                zone.population_density,
                zone.complaints_last_7d,
                zone.weather_rain_mm,
                zone.weather_temp_c,
                zone.event_factor,
                zone.historical_daily_avg,
            ]],
            columns=MODEL_FEATURES,
        )

        # Ensemble blend balances variance (RF) and trend sensitivity (GB).
        prediction_rf = float(rf.predict(x_live)[0])
        prediction_gb = float(gb.predict(x_live)[0])
        prediction = 0.55 * prediction_rf + 0.45 * prediction_gb

        urgency = (
            prediction * 0.55
            + zone.complaints_last_7d * 0.3
            + zone.event_factor * 8
            + max(0, zone.weather_rain_mm - 6) * 0.6
            + max(0.85, min(1.4, getattr(zone, "freshness_factor", 1.0))) * 5.5
        )

        recommended_units = max(1, int(round(urgency / 8)))
        scored.append({
            "zone_id": zone.zone_id,
            "predicted_demand_score": round(prediction, 2),
            "urgency_score": round(urgency, 2),
            "recommended_units": recommended_units,
            "dominant_need": infer_zone_dominant_need(zone),
        })

    scored.sort(key=lambda z: z["urgency_score"], reverse=True)
    for idx, zone in enumerate(scored, start=1):
        zone["urgency_rank"] = idx

    return scored

@app.get("/")
async def root():
    return {
        "status": "online",
        "engine": "CivicFlow-AI-v3",
        "model": model_meta,
        "triage_model": triage_meta,
        "cluster_model": cluster_feasibility_meta,
    }


@app.get("/model/status")
async def model_status():
    return {
        "model_path": MODEL_PATH,
        "dataset_path": DATASET_PATH,
        "model": model_meta,
    }


@app.post("/model/train")
async def train_model(request: ModelTrainRequest):
    dataset_path = request.dataset_path or DATASET_PATH
    meta = train_models_from_historical_dataset(dataset_path)
    return {
        "message": "Demand model trained successfully",
        "dataset_path": dataset_path,
        "model": meta,
    }


@app.get("/model/triage-status")
async def triage_status():
    return {
        "model_path": TRIAGE_MODEL_PATH,
        "dataset_path": TRIAGE_DATASET_PATH,
        "model": triage_meta,
    }


@app.post("/model/train-triage")
async def train_triage_model(request: ModelTrainRequest):
    dataset_path = request.dataset_path or TRIAGE_DATASET_PATH
    meta = train_complaint_triage_models(dataset_path)
    return {
        "message": "Complaint triage model trained successfully",
        "dataset_path": dataset_path,
        "model": meta,
    }


@app.get("/model/cluster-status")
async def cluster_status():
    return {
        "model_path": CLUSTER_MODEL_PATH,
        "dataset_path": CLUSTER_DATASET_PATH,
        "model": cluster_feasibility_meta,
    }


@app.post("/model/train-clustering")
async def train_cluster_model(request: ModelTrainRequest):
    dataset_path = request.dataset_path or CLUSTER_DATASET_PATH
    meta = train_grouping_feasibility_model(dataset_path)
    return {
        "message": "Cluster feasibility model trained successfully",
        "dataset_path": dataset_path,
        "model": meta,
    }

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


@app.post("/analyze/grouping-feasibility")
async def analyze_grouping_feasibility(request: ClusterFeasibilityRequest):
    if not request.clusters:
        return {"clusters": []}

    try:
        model_bundle = cluster_feasibility_model or {}
        if model_bundle.get("rf") is None or model_bundle.get("gb") is None:
            loaded = load_persisted_cluster_model()
            if not loaded:
                train_grouping_feasibility_model(CLUSTER_DATASET_PATH)
    except Exception:
        # Keep request resilient; per-cluster predictor will still return fallback.
        pass

    results = [predict_cluster_feasibility(cluster) for cluster in request.clusters]
    results.sort(key=lambda row: row["feasibility_score"], reverse=True)
    for index, row in enumerate(results, start=1):
        row["feasibility_rank"] = index

    return {
        "clusters": results,
        "model": cluster_feasibility_meta,
    }

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
    
    # Filter available resources (vehicles) and personnel
    available_resources = [r for r in request.resources if r.status in ("patrol", "available")]
    available_personnel = [p for p in (request.personnel or []) if p.status == "available"]
    busy_personnel = [p for p in (request.personnel or []) if p.status == "busy"]
    
    traffic_factor = max(0.7, request.traffic_index * request.road_condition_index)
    remaining_demand = {z["zone_id"]: z["recommended_units"] for z in scored_zones}

    allocations = []
    used_resource_ids = set()
    used_personnel_ids = set()

    for zone in scored_zones:
        if remaining_demand[zone["zone_id"]] <= 0:
            continue

        z_lat, z_lng = zone_center(zone["zone_id"])
        preferred_family = normalize_need_label(zone.get("dominant_need", "general"))
        
        # 1. Primary Assignment: Find Available Personnel + Nearest Resource
        # We prioritize available personnel who can take a resource and move immediately
        candidates_p = [p for p in available_personnel if p.id not in used_personnel_ids]
        candidates_p.sort(key=lambda p: haversine_km(p.lat, p.lng, z_lat, z_lng))

        for p in candidates_p:
            if remaining_demand[zone["zone_id"]] <= 0:
                break
                
            # Find nearest available resource for this personnel
            candidates_r = [r for r in available_resources if r.id not in used_resource_ids]
            if not candidates_r:
                break
                
            candidates_r.sort(key=lambda r: (
                0 if resource_family(r.type, getattr(r, "name", "")) == preferred_family else 1,
                haversine_km(r.lat, r.lng, p.lat, p.lng) # Resource closest to personnel
            ))
            
            chosen_r = candidates_r[0]
            distance = haversine_km(p.lat, p.lng, z_lat, z_lng)
            # Adjusted ETA logic with traffic factor (0.45 km/min is ~27km/h base)
            eta_minutes = max(3, int(round((distance / (0.45 / traffic_factor)))))
            
            allocations.append({
                "zone_id": zone["zone_id"],
                "personnel_id": p.id,
                "personnel_name": p.name,
                "resource_id": chosen_r.id,
                "resource_type": chosen_r.type,
                "resource_name": chosen_r.name,
                "resource_family": resource_family(chosen_r.type, chosen_r.name or ""),
                "assignment_type": "primary",
                "distance_km": round(distance, 2),
                "eta_minutes": eta_minutes,
                "urgency_rank": zone["urgency_rank"],
                "urgency_score": zone["urgency_score"],
            })
            
            used_personnel_ids.add(p.id)
            used_resource_ids.add(chosen_r.id)
            remaining_demand[zone["zone_id"]] -= 1

        # 2. Queue Assignment: Check Busy Personnel
        # If demand still exists, check if busy personnel can reach it after current task before SLA expires
        if remaining_demand[zone["zone_id"]] > 0:
            candidates_busy = [p for p in busy_personnel if p.id not in used_personnel_ids]
            
            for p in candidates_busy:
                if remaining_demand[zone["zone_id"]] <= 0:
                    break
                
                distance = haversine_km(p.lat, p.lng, z_lat, z_lng)
                travel_minutes = max(3, int(round((distance / (0.45 / traffic_factor)))))
                total_wait_minutes = p.current_task_eta_minutes + travel_minutes
                
                # Check if this fits within a reasonable window (e.g. 90% of SLA or max 120 mins)
                # In a real system, we'd compare against incident.sla.targetMinutes
                if total_wait_minutes < 90: # SLA Threshold heuristic
                    allocations.append({
                        "zone_id": zone["zone_id"],
                        "personnel_id": p.id,
                        "personnel_name": p.name,
                        "assignment_type": "queue",
                        "wait_minutes": total_wait_minutes,
                        "travel_minutes": travel_minutes,
                        "current_task_eta": p.current_task_eta_minutes,
                        "distance_km": round(distance, 2),
                        "urgency_rank": zone["urgency_rank"],
                    })
                    used_personnel_ids.add(p.id)
                    remaining_demand[zone["zone_id"]] -= 1
                    
    unallocated_demand = sum(v for v in remaining_demand.values() if v > 0)

    return {
        "allocations": allocations,
        "summary": {
            "allocated": len(allocations),
            "unallocated_demand": int(unallocated_demand),
            "zones_covered": len({a["zone_id"] for a in allocations}),
        },
        "zones": scored_zones,
    }


@app.post("/analyze/complaint-intake")
async def analyze_complaint_intake_endpoint(request: ComplaintTriageRequest):
    return analyze_complaint_intake(request)


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
    import asyncio
    import sys
    import uvicorn

    # Windows Proactor loop can emit noisy WinError 64 accept warnings on transient disconnects.
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    uvicorn.run(app, host="0.0.0.0", port=8000, timeout_keep_alive=10)
