# CivicFlow AI Engine 🧠🏛️

The **CivicFlow AI Engine** is a high-performance, FastAPI-based predictive intelligence service designed to power the next generation of urban management and government operations. It provides real-time analytics, demand forecasting, and automated complaint triage for the CivicResource.ai platform.

## 🚀 Core Capabilities

### 1. Urban Demand Forecasting
Uses an **ensemble learning model** (Random Forest + Gradient Boosting) to predict infrastructure and service demand across city zones.
- **Features Analyzed**: Population density, 7-day complaint history, weather (rain/temp), event factors, and historical daily averages.
- **Outputs**: Urgency scores, predicted demand levels, and recommended resource unit counts per zone.

### 2. Intelligent Complaint Triage
Automates the classification and validation of citizen reports using Natural Language Processing (NLP).
- **Categorization**: Automatically sorts reports into `Garbage`, `Water`, `Maintenance`, `Safety`, and `Traffic`.
- **Integrity Check**: Heuristic and model-based "Fake Score" detection to flag spam or dummy reports.
- **Multi-language Support**: Basic normalization and keyword extraction for English, Hindi, and Marathi.

### 3. Dynamic Resource Allocation
Optimizes the deployment of government resources (Fire, Police, Sanitation, Medical) based on real-time urgency.
- **Spatial Optimization**: Uses Haversine distance calculations to minimize ETA.
- **Priority Intelligence**: Matches resource families (e.g., Water Tankers) to specific zonal needs.

### 4. Tactical Analytics
- **Hotspot Clustering**: Uses **DBSCAN** to identify geographic clusters of incidents.
- **Heatmap Generation**: Calculates intensity weights for geospatial visualizations based on incident severity.

## 🛠️ Technology Stack

- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Asynchronous Python)
- **Machine Learning**: `scikit-learn` (Random Forest, Gradient Boosting, Logistic Regression)
- **NLP**: `spaCy` (Language processing and normalization)
- **Data Handling**: `pandas`, `numpy`
- **Persistence**: `joblib` for serialized model storage

## 🛣️ API Endpoints Overview

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/analyze/demand-forecast` | `POST` | Predicts demand and urgency for a list of urban zones. |
| `/analyze/complaint-intake` | `POST` | Triages a report: predicts type, extracts keywords, and scores reliability. |
| `/analyze/resource-allocation`| `POST` | Recommends the best dispatch plan for available units. |
| `/analyze/clustering` | `POST` | Identifies incident hotspots using spatial clustering. |
| `/model/status` | `GET` | Returns current training metrics and model metadata. |
| `/model/train` | `POST` | Retrains demand models using the latest historical data. |

## 📦 Setup & Installation

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the Engine**:
   ```bash
   python main.py
   ```
   The engine will start on `http://localhost:8000`.

3. **Bootstrap Models**:
   On the first run, if pre-trained models (`.joblib` files) are not found in the `models/` directory, the engine will automatically train them using the datasets in `data/`.

## 📊 Data Structures

### Demand Prediction Features
- `population_density`: People per sq km.
- `complaints_last_7d`: Rolling count of local reports.
- `weather_rain_mm`: Precipitation impact.
- `event_factor`: Multiplier based on local festivals or public gatherings.

### Resource Families
The engine maps heterogeneous units into unified "Needs" categories:
- **Garbage**: Trash trucks, sanitation inspectors.
- **Water**: Tankers, plumbing teams.
- **Maintenance**: Road repair, electrical crews.
- **Safety**: Police, Fire, Emergency services.

---
*Built with ❤️ for Civic Excellence.*
