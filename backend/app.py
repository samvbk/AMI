import json
import logging
import os
import re
import sys
import time
import traceback

# Fix Windows console emoji printing issues
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr.encoding.lower() != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8')
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import mysql.connector
import requests
from dotenv import load_dotenv
import jwt
from fastapi import Body, FastAPI, File, Form, HTTPException, UploadFile, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from mysql.connector import Error, pooling
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

load_dotenv()

from audio_simple import audio_handler
from conversation_memory import DBConversationMemory
from face_recognition import FaceRecognitionService
from gemini_simple import detect_emotion, get_health_response
from tts import tts_handler
from crypto import encrypt_data, decrypt_data


from pythonjsonlogger import jsonlogger

log_handler = logging.StreamHandler(sys.stdout)
formatter = jsonlogger.JsonFormatter('%(asctime)s %(levelname)s %(name)s %(message)s')
log_handler.setFormatter(formatter)

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
logger.addHandler(log_handler)
# Remove default handlers to avoid duplicate logs
logging.getLogger().handlers = [log_handler]

if not os.getenv("DB_PASSWORD"):
    logger.warning("WARNING: DB_PASSWORD env var is not set. Database login may fail.")

print("Starting Family Healthcare Assistant Backend")
print("=" * 50)

app = FastAPI(title="Family Healthcare Assistant API")

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "message": exc.detail}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "An unexpected server error occurred."}
    )

# Extract FRONTEND_URL from environment for production CORS
frontend_url = os.getenv("FRONTEND_URL", "")

cors_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

if frontend_url:
    cors_origins.append(frontend_url.rstrip('/'))

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# JWT configuration
SECRET_KEY = os.getenv("SECRET_KEY", "ami_secret_key_change_in_production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days for convenience

security = HTTPBearer()

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_member(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        member_id: int = payload.get("sub")
        if member_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return member_id
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")


class DatabaseManager:
    def __init__(self):
        self.config = {
            "host": os.getenv("DB_HOST", "localhost"),
            "user": os.getenv("DB_USER", "root"),
            "password": os.getenv("DB_PASSWORD", ""),
            "database": os.getenv("DB_NAME", "healthcare"),
            "port": int(os.getenv("DB_PORT", 3306)),
            "autocommit": False,
            "use_pure": True,
            "connection_timeout": 30,
            "pool_name": "mypool",
            "pool_size": 5,
            "pool_reset_session": True,
        }
        self.pool = None
        self.init_pool()

    def init_pool(self) -> bool:
        try:
            conn = mysql.connector.connect(
                host=self.config["host"],
                user=self.config["user"],
                password=self.config["password"],
                database=self.config["database"],
                port=self.config["port"],
                connection_timeout=10,
            )
            conn.close()
            logger.info("Database connection test successful")
            self.pool = mysql.connector.pooling.MySQLConnectionPool(**self.config)
            logger.info("Connection pool created with size %s", self.config["pool_size"])
            return True
        except Error as exc:
            logger.error("Database connection failed: %s", exc)
            logger.error("Check that MySQL is running, credentials are correct, and database exists.")
            return False

    def get_connection(self):
        if not self.pool and not self.init_pool():
            return None
        try:
            conn = self.pool.get_connection()
            conn.ping(reconnect=True, attempts=3, delay=1)
            return conn
        except Error as exc:
            logger.error("Failed to get database connection: %s", exc)
            self.pool = None
            time.sleep(1)
            return None

    def execute_query(self, query, params=None, fetch_one=False, fetch_all=False, commit=False):
        conn = None
        cursor = None
        try:
            conn = self.get_connection()
            if not conn:
                raise RuntimeError("No database connection available")

            cursor = conn.cursor(dictionary=True)
            cursor.execute(query, params or ())

            result = None
            if fetch_one:
                result = cursor.fetchone()
            elif fetch_all:
                result = cursor.fetchall()

            if commit:
                conn.commit()
                result = cursor.lastrowid

            return result
        except Exception as exc:
            logger.error("Query error: %s", exc)
            if conn and commit:
                try:
                    conn.rollback()
                except Exception:
                    pass
            return None
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()


db = DatabaseManager()


def ensure_application_tables() -> None:
    statements = [
        """
        CREATE TABLE IF NOT EXISTS member_summaries (
            member_id INT PRIMARY KEY,
            summary TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """,
        """
        CREATE TABLE IF NOT EXISTS medications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            member_id INT NOT NULL,
            name VARCHAR(150) NOT NULL,
            dosage VARCHAR(150) NOT NULL,
            frequency VARCHAR(100) NOT NULL,
            times JSON NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NULL,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
            INDEX idx_member_medications (member_id),
            INDEX idx_medication_dates (start_date, end_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """,
        """
        CREATE TABLE IF NOT EXISTS medication_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            medication_id INT NOT NULL,
            taken_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            status ENUM('pending', 'triggered', 'snoozed', 'taken', 'missed', 'cancelled', 'skipped') NOT NULL,
            snoozed_until DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
            INDEX idx_medication_logs (medication_id, taken_at),
            INDEX idx_medication_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """,
        """
        CREATE TABLE IF NOT EXISTS face_metrics (
            id INT AUTO_INCREMENT PRIMARY KEY,
            member_id INT NOT NULL,
            recognition_attempts INT DEFAULT 0,
            successful_recognitions INT DEFAULT 0,
            average_confidence DECIMAL(5,4) DEFAULT 0,
            last_recognition TIMESTAMP NULL,
            face_quality_score DECIMAL(5,2) DEFAULT 0,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
            INDEX idx_member_metrics (member_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """,
    ]

    for statement in statements:
        db.execute_query(statement, commit=True)

    logger.info("Application tables are ready")


ensure_application_tables()
face_service = FaceRecognitionService(db, logger)
memory_system = DBConversationMemory(db, logger)

os.makedirs("faces", exist_ok=True)

WEATHER_API_KEY = os.getenv("WEATHER_API_KEY") or os.getenv("OPENWEATHER_API_KEY")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
weather_cache: Dict[str, Any] = {}
news_cache: Dict[str, Any] = {}
last_fetched_news: List[Dict[str, Any]] = []
member_age_cache: Dict[int, int] = {}


class MedicationPayload(BaseModel):
    member_id: int
    name: str = Field(..., min_length=1)
    dosage: str = Field(..., min_length=1)
    frequency: str = Field(..., min_length=1)
    times: List[str] = Field(..., min_length=1)
    start_date: date
    end_date: Optional[date] = None
    notes: Optional[str] = None


class MedicationUpdatePayload(BaseModel):
    name: str = Field(..., min_length=1)
    dosage: str = Field(..., min_length=1)
    frequency: str = Field(..., min_length=1)
    times: List[str] = Field(..., min_length=1)
    start_date: date
    end_date: Optional[date] = None
    notes: Optional[str] = None


class MedicationLogPayload(BaseModel):
    status: str = Field(..., pattern="^(pending|triggered|snoozed|taken|missed|cancelled|skipped)$")
    taken_at: Optional[datetime] = None
    snoozed_until: Optional[datetime] = None


def _json_safe(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def get_weather_info(city="Delhi", lat=None, lon=None):
    if not WEATHER_API_KEY:
        logger.warning("WEATHER_API_KEY not set")
        return None

    if lat is not None and lon is not None:
        query = f"{lat},{lon}"
        cache_key = f"{lat:.2f},{lon:.2f}"
    else:
        query = city
        cache_key = city.lower()

    if cache_key in weather_cache:
        cached_time, cached_data = weather_cache[cache_key]
        if time.time() - cached_time < 300:
            return cached_data

    try:
        # Check if the key looks like an OpenWeatherMap key (32 hex characters)
        if len(WEATHER_API_KEY) == 32:
            if lat is not None and lon is not None:
                url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={WEATHER_API_KEY}&units=metric"
            else:
                url = f"https://api.openweathermap.org/data/2.5/weather?q={query}&appid={WEATHER_API_KEY}&units=metric"
                
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            weather_info = {
                "temperature": data["main"]["temp"],
                "description": data["weather"][0]["description"].title(),
                "city": data["name"],
                "humidity": data["main"]["humidity"],
                "wind_speed": data["wind"]["speed"] * 3.6, # m/s to kph
                "feels_like": data["main"]["feels_like"],
            }
            
            if lat is not None and lon is not None:
                try:
                    aqi_url = f"http://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={WEATHER_API_KEY}"
                    aqi_res = requests.get(aqi_url, timeout=5)
                    if aqi_res.ok:
                        weather_info["aqi"] = aqi_res.json()["list"][0]["main"]["aqi"]
                except Exception:
                    pass
        else:
            # Fallback to WeatherAPI if the key is different
            response = requests.get(
                "http://api.weatherapi.com/v1/current.json",
                params={"key": WEATHER_API_KEY, "q": query, "aqi": "yes"},
                timeout=10,
            )
            response.raise_for_status()
            data = response.json()
            weather_info = {
                "temperature": data["current"]["temp_c"],
                "description": data["current"]["condition"]["text"],
                "city": data["location"]["name"],
                "humidity": data["current"]["humidity"],
                "wind_speed": data["current"]["wind_kph"],
                "feels_like": data["current"]["feelslike_c"],
            }
            if "air_quality" in data["current"]:
                weather_info["aqi"] = data["current"]["air_quality"].get("us-epa-index")
        
        weather_cache[cache_key] = (time.time(), weather_info)
        return weather_info
    except Exception as exc:
        logger.error("Weather API error: %s", exc)
        return None


def get_news(category="general", country="in"):
    if not NEWS_API_KEY:
        logger.warning("NEWS_API_KEY not set")
        return None

    cache_key = f"{category}_{country}"
    if cache_key in news_cache:
        cached_time, cached_data = news_cache[cache_key]
        if time.time() - cached_time < 300:
            return cached_data

    try:
        response = requests.get(
            "https://newsapi.org/v2/everything",
            params={"q": "india", "language": "en", "apiKey": NEWS_API_KEY, "pageSize": 5},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()

        articles = [
            {
                "title": article.get("title", "No title"),
                "description": article.get("description", "No description"),
                "source": article.get("source", {}).get("name", "Unknown"),
                "url": article.get("url", "#"),
            }
            for article in data.get("articles", [])[:3]
        ]
        if articles:
            news_cache[cache_key] = (time.time(), articles)
            return articles
        return None
    except Exception as exc:
        logger.error("News API error: %s", exc)
        return None


def parse_age_from_message(member_id: int, message: str, member_info: Optional[Dict[str, Any]]) -> Optional[int]:
    msg_lower = message.lower().strip()
    age_patterns = [
        r"(?:i am|i'm|my age is|age is|age)\s*(\d{1,3})",
        r"(\d{1,3})\s*(?:years?\s*old|yrs?\s*old|years?|yrs?)",
        r"^\s*(\d{1,3})\s*\+?\s*(?:years?)?\s*$",
        r"(\d{1,3})\s*\+",
    ]
    for pattern in age_patterns:
        match = re.search(pattern, msg_lower)
        if match:
            parsed_age = int(match.group(1))
            if 1 <= parsed_age <= 120:
                member_age_cache[member_id] = parsed_age
                return parsed_age

    if member_id in member_age_cache:
        return member_age_cache[member_id]

    if member_info and member_info.get("age"):
        age = int(member_info["age"])
        member_age_cache[member_id] = age
        return age

    return None


def _format_medication(row: Dict[str, Any]) -> Dict[str, Any]:
    item = {key: _json_safe(value) for key, value in row.items()}
    times = item.get("times")
    if isinstance(times, str):
        try:
            item["times"] = json.loads(times)
        except json.JSONDecodeError:
            item["times"] = []
    return item


def _weekly_adherence(member_id: int) -> List[Dict[str, Any]]:
    today = date.today()
    start = today - timedelta(days=6)
    rows = db.execute_query(
        """
        SELECT DATE(ml.taken_at) AS log_date, ml.status, COUNT(*) AS count
        FROM medication_logs ml
        JOIN medications m ON ml.medication_id = m.id
        WHERE m.member_id = %s AND DATE(ml.taken_at) BETWEEN %s AND %s
        GROUP BY DATE(ml.taken_at), ml.status
        """,
        (member_id, start, today),
        fetch_all=True,
    ) or []

    by_day: Dict[str, Dict[str, int]] = {
        (start + timedelta(days=i)).isoformat(): {"taken": 0, "missed": 0, "skipped": 0}
        for i in range(7)
    }
    for row in rows:
        day = row["log_date"].isoformat() if hasattr(row["log_date"], "isoformat") else str(row["log_date"])
        if day in by_day:
            by_day[day][row["status"]] = int(row["count"])

    result = []
    for day, counts in by_day.items():
        total = counts["taken"] + counts["missed"] + counts["skipped"]
        adherence = round((counts["taken"] / total) * 100) if total else 0
        result.append({"date": day, "adherence": adherence, **counts})
    return result


@app.get("/")
def root():
    return {
        "status": "running",
        "message": "Family Healthcare Assistant API",
        "database": "connected" if db.pool else "disconnected",
    }


@app.get("/health")
def health_check():
    db_status = "disconnected"
    if db.pool:
        conn = db.get_connection()
        if conn:
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                cursor.fetchone()
                cursor.close()
                db_status = "connected"
            except Exception:
                pass
            finally:
                conn.close()

    return {
        "status": "healthy",
        "database": db_status,
        "timestamp": datetime.now().isoformat(),
        "apis": {
            "weather": "active" if WEATHER_API_KEY else "inactive",
            "news": "active" if NEWS_API_KEY else "inactive",
        },
    }

@app.get("/favicon.ico")
async def favicon():
    return Response(status_code=204)


@app.post("/check-face")
async def check_face(image: UploadFile = File(...)):
    image_bytes = await image.read()
    quality = face_service.check_quality(image_bytes)
    return JSONResponse(
        {
            "success": quality.success,
            "quality": quality.quality,
            "message": quality.message,
            "metrics": quality.metrics,
        }
    )


@app.post("/recognize")
@limiter.limit("5/minute")
async def recognize_face_endpoint(
    request: Request, 
    image: UploadFile = File(...),
    latitude: float = Form(None),
    longitude: float = Form(None),
):
    try:
        image_bytes = await image.read()
        if len(image_bytes) < 1000:
            return JSONResponse(
                {"success": False, "message": "Image too small. Please take a clearer photo."}
            )

        recognition_result, quality, top_matches = face_service.recognize(image_bytes)
        if recognition_result:
            member_id = recognition_result["member_id"]
            
            # Update location if provided
            if latitude is not None and longitude is not None:
                db.execute_query(
                    "UPDATE members SET latitude = %s, longitude = %s, last_seen = NOW() WHERE id = %s",
                    (latitude, longitude, member_id),
                    commit=True
                )
            else:
                db.execute_query(
                    "UPDATE members SET last_seen = NOW() WHERE id = %s",
                    (member_id,),
                    commit=True
                )
            
            token = create_access_token({"sub": str(member_id)})
            return JSONResponse(
                {
                    "success": True,
                    "recognized": True,
                    "token": token,
                    "member": {
                        "id": member_id,
                        "name": recognition_result["name"],
                        "family_name": recognition_result["family_name"],
                    },
                    "confidence": float(recognition_result["confidence"]),
                    "quality": quality.quality,
                    "message": f"Welcome back, {recognition_result['name']}!",
                    "top_matches": top_matches,
                }
            )

        message = (
            "Face not recognized. Would you like to register?"
            if quality.success
            else quality.message
        )
        return JSONResponse(
            {
                "success": True,
                "recognized": False,
                "quality": quality.quality,
                "message": message,
                "top_matches": top_matches,
            }
        )
    except Exception as exc:
        logger.error("Face recognition error: %s", exc)
        traceback.print_exc()
        return JSONResponse({"success": False, "error": str(exc)}, status_code=500)


class LoginOverridePayload(BaseModel):
    member_id: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None

@app.post("/login-override")
@limiter.limit("5/minute")
async def login_override(request: Request, payload: LoginOverridePayload):
    member = db.execute_query(
        """
        SELECT m.id, m.name, f.family_name 
        FROM members m 
        JOIN families f ON m.family_id = f.id 
        WHERE m.id = %s
        """, 
        (payload.member_id,), 
        fetch_one=True
    )
    if not member:
        return JSONResponse({"success": False, "message": "Member not found"}, status_code=404)
    
    # Update location if provided
    if payload.latitude is not None and payload.longitude is not None:
        db.execute_query(
            "UPDATE members SET latitude = %s, longitude = %s, last_seen = NOW() WHERE id = %s",
            (payload.latitude, payload.longitude, member["id"]),
            commit=True
        )
    else:
        db.execute_query(
            "UPDATE members SET last_seen = NOW() WHERE id = %s",
            (member["id"],),
            commit=True
        )

    token = create_access_token({"sub": str(member["id"])})
    return JSONResponse({
        "success": True,
        "token": token,
        "member": {
            "id": member["id"],
            "name": member["name"],
            "family_name": member["family_name"],
        }
    })


@app.post("/register")
@limiter.limit("5/minute")
async def register_member(
    request: Request,
    image: UploadFile = File(...),
    family_name: str = Form(...),
    member_name: str = Form(...),
    role: str = Form(...),
    age: str = Form(None),
    medical_history: str = Form(None),
    emergency_contact: str = Form(None),
    latitude: float = Form(None),
    longitude: float = Form(None),
):
    try:
        image_bytes = await image.read()
        embedding_bytes, quality = face_service.extract_embedding(image_bytes)
        if embedding_bytes is None:
            return JSONResponse(
                {
                    "success": False,
                    "quality": quality.quality,
                    "message": quality.message,
                    "metrics": quality.metrics,
                }
            )

        family = db.execute_query(
            "SELECT id FROM families WHERE family_name = %s",
            (family_name,),
            fetch_one=True,
        )
        if family:
            family_id = family["id"]
        else:
            family_id = db.execute_query(
                "INSERT INTO families (family_name) VALUES (%s)",
                (family_name,),
                commit=True,
            )

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = re.sub(r"[^A-Za-z0-9_-]+", "_", member_name).strip("_") or "member"
        image_path = f"faces/{family_id}_{safe_name}_{timestamp}.jpg"
        with open(image_path, "wb") as file:
            file.write(image_bytes)

        encrypted_embedding = encrypt_data(embedding_bytes)
        encrypted_history = encrypt_data(medical_history)

        member_id = db.execute_query(
            """
            INSERT INTO members
            (family_id, name, role, age, face_encoding, face_image_path, medical_history, emergency_contact, latitude, longitude, last_seen)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """,
            (
                family_id,
                member_name,
                role,
                int(age) if age and age.isdigit() else None,
                encrypted_embedding,
                image_path,
                encrypted_history,
                emergency_contact,
                latitude,
                longitude,
            ),
            commit=True,
        )

        return JSONResponse(
            {
                "success": True,
                "member_id": member_id,
                "family_id": family_id,
                "token": create_access_token({"sub": str(member_id)}),
                "quality": quality.quality,
                "message": f"Successfully registered {member_name}!",
            }
        )
    except Exception as exc:
        logger.error("Registration error: %s", exc)
        traceback.print_exc()
        return JSONResponse({"success": False, "error": str(exc)}, status_code=500)


class TTSRequest(BaseModel):
    text: str
    language: str = "en-IN"
    voice: str = "Kore"

@app.post("/tts")
@limiter.limit("20/minute")
async def process_tts(request: Request, req: TTSRequest):
    result = tts_handler.generate_speech(req.text, req.language, req.voice)
    if result.get("success"):
        return JSONResponse(result)
    else:
        # Return 200 with success: false to gracefully trigger frontend fallback
        # rather than throwing a 500 error in the browser console.
        return JSONResponse(result)


@app.post("/chat")
@limiter.limit("20/minute")
async def chat(
    request: Request,
    message: str = Form(...),
    use_voice: str = Form("false"),
    lat: float = Form(None),
    lon: float = Form(None),
    member_id: int = Depends(get_current_member),
):
    try:
        logger.info("Chat from member %s: %s...", member_id, message[:50])
        member_info = db.execute_query(
            """
            SELECT m.name, m.age, m.latitude, m.longitude, f.family_name
            FROM members m
            JOIN families f ON m.family_id = f.id
            WHERE m.id = %s
            """,
            (member_id,),
            fetch_one=True,
        )

        member_name = member_info["name"] if member_info else "Guest"
        family_name = member_info["family_name"] if member_info else "Family"
        user_age = parse_age_from_message(member_id, message, member_info)

        # Fallback to stored location if frontend didn't provide it
        if lat is None and member_info and member_info.get("latitude"):
            lat = member_info["latitude"]
        if lon is None and member_info and member_info.get("longitude"):
            lon = member_info["longitude"]

        memory_history = memory_system.get_prompt_context(member_id)
        preferences = memory_system.get_member_preferences(member_id)

        current_hour = datetime.now().hour
        current_time_str = datetime.now().strftime("%I:%M %p")
        is_morning = current_hour < 12

        weather_info = None
        if lat is not None and lon is not None:
            weather_info = get_weather_info(lat=lat, lon=lon)
        elif any(word in message.lower() for word in ["weather", "temperature", "hot", "cold", "rain", "aqi", "air"]):
            weather_info = get_weather_info()

        clinics_info = None
        if any(word in message.lower() for word in ["clinic", "hospital", "doctor"]):
            if lat is not None and lon is not None:
                clinics_info = get_clinics_info(lat, lon)

        news_articles = None
        if any(word in message.lower() for word in ["news", "headlines", "update"]):
            news_articles = get_news()

        raw_llm_output = get_health_response(
            message=message,
            member_name=member_name,
            history=memory_history,
            weather_info=weather_info,
            clinics_info=clinics_info,
            news_articles=news_articles,
            preferences=preferences,
            current_time=current_time_str,
            is_morning=is_morning,
            user_age=user_age,
        )

        try:
            llm_json = json.loads(raw_llm_output)
            response = llm_json.get("response", raw_llm_output)
            action = llm_json.get("action")
        except json.JSONDecodeError:
            response = raw_llm_output
            action = None

        if action and isinstance(action, dict) and action.get("type") == "add_medication":
            try:
                db.execute_query(
                    """
                    INSERT INTO medications
                    (member_id, name, dosage, frequency, times, start_date, end_date, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        member_id,
                        action.get("name", "Unknown"),
                        action.get("dosage", ""),
                        action.get("frequency", "Daily"),
                        json.dumps([action.get("time", "08:00")]),
                        datetime.now().strftime("%Y-%m-%d"),
                        None,
                        "Added via Voice Command",
                    ),
                    commit=True,
                )
            except Exception as e:
                logger.error("Failed to add medication via voice: %s", e)

        emotion = detect_emotion(message)
        memory_system.add_conversation(member_id, message, response, emotion)

        audio_file = None
        if use_voice.lower() == "true" and response:
            audio_file = audio_handler.text_to_speech(response)

        return JSONResponse(
            {
                "success": True,
                "response": response,
                "action": action,
                "emotion": emotion,
                "member_name": member_name,
                "family_name": family_name,
                "timestamp": datetime.now().isoformat(),
                "weather": weather_info,
                "has_news": news_articles is not None,
                "audio_file": audio_file,
                "duplicate": False,
            }
        )
    except Exception as exc:
        logger.error("Chat error: %s", exc)
        traceback.print_exc()
        return JSONResponse(
            {
                "success": False,
                "response": "I'm having trouble connecting right now. Please try again.",
                "emotion": "concerned",
            },
            status_code=500,
        )


@app.get("/audio/{filename}")
async def get_audio(filename: str):
    audio_dir = Path("audio").resolve()
    requested = (audio_dir / filename).resolve()

    if requested.parent != audio_dir or requested.suffix.lower() != ".mp3":
        raise HTTPException(status_code=400, detail="Invalid audio filename")
    if not requested.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    return FileResponse(str(requested), media_type="audio/mpeg")


@app.post("/medications")
async def create_medication(
    payload: MedicationPayload = Body(...),
    current_member: int = Depends(get_current_member)
):
    medication_id = db.execute_query(
        """
        INSERT INTO medications
        (member_id, name, dosage, frequency, times, start_date, end_date, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            payload.member_id,
            payload.name,
            payload.dosage,
            payload.frequency,
            json.dumps(payload.times),
            payload.start_date,
            payload.end_date,
            payload.notes,
        ),
        commit=True,
    )
    if medication_id is None:
        raise HTTPException(status_code=500, detail="Could not create medication")
    return {"success": True, "id": medication_id}


@app.get("/medications/{member_id}")
async def list_medications(
    member_id: int,
    current_member: int = Depends(get_current_member)
):
    rows = db.execute_query(
        """
        SELECT *
        FROM medications
        WHERE member_id = %s
        ORDER BY name
        """,
        (member_id,),
        fetch_all=True,
    ) or []
    medications = [_format_medication(row) for row in rows]

    medication_ids = [item["id"] for item in medications]
    logs: List[Dict[str, Any]] = []
    if medication_ids:
        placeholders = ",".join(["%s"] * len(medication_ids))
        logs = db.execute_query(
            f"""
            SELECT id, medication_id, taken_at, status
            FROM medication_logs
            WHERE medication_id IN ({placeholders})
              AND taken_at >= %s
            ORDER BY taken_at DESC
            """,
            (*medication_ids, datetime.now() - timedelta(days=7)),
            fetch_all=True,
        ) or []

    return {
        "success": True,
        "medications": medications,
        "logs": [{key: _json_safe(value) for key, value in row.items()} for row in logs],
        "adherence": _weekly_adherence(member_id),
    }


@app.put("/medications/{medication_id}")
async def update_medication(
    medication_id: int, 
    payload: MedicationUpdatePayload = Body(...),
    current_member: int = Depends(get_current_member)
):
    updated = db.execute_query(
        """
        UPDATE medications
        SET name = %s, dosage = %s, frequency = %s, times = %s,
            start_date = %s, end_date = %s, notes = %s, updated_at = NOW()
        WHERE id = %s
        """,
        (
            payload.name,
            payload.dosage,
            payload.frequency,
            json.dumps(payload.times),
            payload.start_date,
            payload.end_date,
            payload.notes,
            medication_id,
        ),
        commit=True,
    )
    if updated is None:
        raise HTTPException(status_code=500, detail="Could not update medication")
    return {"success": True}


@app.delete("/medications/{medication_id}")
async def delete_medication(
    medication_id: int,
    current_member: int = Depends(get_current_member)
):
    deleted = db.execute_query(
        "DELETE FROM medications WHERE id = %s",
        (medication_id,),
        commit=True,
    )
    if deleted is None:
        raise HTTPException(status_code=500, detail="Could not delete medication")
    return {"success": True}


@app.post("/medications/{medication_id}/log")
async def log_medication(
    medication_id: int, 
    payload: MedicationLogPayload = Body(...),
    current_member: int = Depends(get_current_member)
):
    taken_at = payload.taken_at or datetime.now()
    log_id = db.execute_query(
        """
        INSERT INTO medication_logs (medication_id, taken_at, status, snoozed_until)
        VALUES (%s, %s, %s, %s)
        """,
        (medication_id, taken_at, payload.status, payload.snoozed_until),
        commit=True,
    )
    if log_id is None:
        raise HTTPException(status_code=500, detail="Could not log medication")
    return {"success": True, "id": log_id}


@app.get("/weather")
async def get_weather_endpoint(
    lat: float = None, 
    lon: float = None, 
    city: str = None
):
    try:
        weather = get_weather_info(lat=lat, lon=lon) if lat is not None and lon is not None else get_weather_info(city=city or "Delhi")
        if weather:
            return JSONResponse({"success": True, "weather": weather})
        return JSONResponse({"success": False, "message": "Weather fetch failed"})
    except Exception as exc:
        logger.error("Weather error: %s", exc)
        return JSONResponse({"success": False, "error": str(exc)})

def get_clinics_info(lat: float, lon: float):
    try:
        overpass_url = "http://overpass-api.de/api/interpreter"
        overpass_query = f"""
        [out:json][timeout:10];
        (
          node["amenity"="clinic"](around:5000,{lat},{lon});
          node["amenity"="hospital"](around:5000,{lat},{lon});
          node["amenity"="doctors"](around:5000,{lat},{lon});
        );
        out body 5;
        """
        response = requests.post(overpass_url, data={"data": overpass_query}, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        clinics = []
        for element in data.get("elements", []):
            tags = element.get("tags", {})
            name = tags.get("name")
            if name:
                clinics.append({
                    "name": name,
                    "type": tags.get("amenity", "clinic"),
                })
        return clinics
    except Exception as exc:
        logger.error("get_clinics_info error: %s", exc)
        return None

@app.get("/clinics")
async def get_nearby_clinics(lat: float, lon: float):
    clinics = get_clinics_info(lat, lon)
    if clinics is not None:
        return JSONResponse({"success": True, "clinics": clinics})
    return JSONResponse({"success": False, "error": "Could not fetch clinics"})


@app.get("/news")
async def get_news_endpoint():
    global last_fetched_news
    try:
        articles = get_news()
        if articles:
            last_fetched_news = articles
            return JSONResponse({"success": True, "articles": articles})
        return JSONResponse({"success": False, "message": "No articles found"})
    except Exception as exc:
        logger.error("News error: %s", exc)
        return JSONResponse({"success": False, "message": str(exc)})


@app.get("/news-detail/{index}")
async def get_news_detail(index: int, current_member: int = Depends(get_current_member)):
    try:
        if not last_fetched_news:
            return JSONResponse({"success": False, "message": "No news loaded"})
        if index < 0 or index >= len(last_fetched_news):
            return JSONResponse({"success": False, "message": "Invalid article number"})
        article = last_fetched_news[index]
        return JSONResponse(
            {
                "success": True,
                "title": article["title"],
                "description": article.get("description"),
                "url": article.get("url"),
            }
        )
    except Exception as exc:
        logger.error("News detail error: %s", exc)
        return JSONResponse({"success": False, "message": str(exc)})


@app.get("/member/{member_id}")
async def get_member_info(member_id: int, current_member: int = Depends(get_current_member)):
    try:
        member = db.execute_query(
            """
            SELECT m.id, m.name, m.role, m.age, m.medical_history, 
                   m.emergency_contact, m.last_seen, f.family_name,
                   m.latitude, m.longitude
            FROM members m
            JOIN families f ON m.family_id = f.id
            WHERE m.id = %s
            """,
            (member_id,),
            fetch_one=True,
        )
        if member:
            if member.get("medical_history"):
                member["medical_history"] = decrypt_data(member["medical_history"], as_str=True)
            return JSONResponse({"success": True, "member": {key: _json_safe(value) for key, value in member.items()}})
        return JSONResponse({"success": False, "message": "Member not found"})
    except Exception as exc:
        logger.error("Member info error: %s", exc)
        return JSONResponse({"success": False, "error": str(exc)})

@app.get("/health")
async def health_check():
    return JSONResponse({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    })

# Pydantic models for request bodies
class RegisterFamilyModel(BaseModel):
    family_name: str
class MemberUpdateModel(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    medical_history: Optional[str] = None
    emergency_contact: Optional[str] = None

@app.put("/member/{member_id}")
async def update_member(member_id: int, updates: MemberUpdateModel, current_member: int = Depends(get_current_member)):
    if member_id != current_member:
        raise HTTPException(status_code=403, detail="Not authorized to update this member")
    
    try:
        set_clauses = []
        values = []
        
        if updates.name is not None:
            set_clauses.append("name = %s")
            values.append(updates.name)
            
        if updates.age is not None:
            set_clauses.append("age = %s")
            values.append(updates.age)
            
        if updates.medical_history is not None:
            set_clauses.append("medical_history = %s")
            # Encrypt if we are adding medical history encryption, otherwise just store it
            encrypted_history = encrypt_data(updates.medical_history)
            values.append(encrypted_history)
            
        if updates.emergency_contact is not None:
            set_clauses.append("emergency_contact = %s")
            values.append(updates.emergency_contact)
            
        if not set_clauses:
            return {"success": True, "message": "No fields to update"}
            
        values.append(member_id)
        
        query = f"UPDATE members SET {', '.join(set_clauses)} WHERE id = %s"
        db.execute_query(query, tuple(values), commit=True)
        
        return {"success": True, "message": "Profile updated successfully"}
    except Exception as exc:
        logger.error("Update member error: %s", exc)
        return JSONResponse({"success": False, "error": str(exc)}, status_code=500)


@app.delete("/member/{member_id}")
async def delete_member(member_id: int, current_member: int = Depends(get_current_member)):
    if member_id != current_member:
        raise HTTPException(status_code=403, detail="Not authorized to delete this member")
    
    deleted = db.execute_query("DELETE FROM members WHERE id = %s", (member_id,), commit=True)
    if deleted is None:
        raise HTTPException(status_code=500, detail="Could not delete member")
    
    return {"success": True, "message": "Member deleted successfully"}


@app.get("/families")
async def get_families():
    try:
        families = db.execute_query(
            "SELECT id, family_name FROM families ORDER BY family_name",
            fetch_all=True,
        )
        return JSONResponse({"success": True, "families": families or []})
    except Exception as exc:
        logger.error("Families list error: %s", exc)
        return JSONResponse({"success": False, "families": [], "error": str(exc)})


@app.get("/families/{family_id}/members")
async def get_family_members(family_id: int):
    try:
        members = db.execute_query(
            "SELECT id, name, role, face_image_path FROM members WHERE family_id = %s ORDER BY name",
            (family_id,),
            fetch_all=True,
        )
        # Ensure image paths are fully qualified URLs if needed, or frontend handles them.
        return JSONResponse({"success": True, "members": members or []})
    except Exception as exc:
        logger.error("Family members list error: %s", exc)
        return JSONResponse({"success": False, "members": [], "error": str(exc)})


if __name__ == "__main__":
    import uvicorn

    print("=" * 50)
    print("Family Healthcare Assistant Backend")
    print("=" * 50)
    print(f"Database Pool: {'Ready' if db.pool else 'Not Connected'}")
    print(f"Face Recognition: {face_service._engine}")
    print(f"Weather API: {'Ready' if WEATHER_API_KEY else 'Not Configured'}")
    print(f"News API: {'Ready' if NEWS_API_KEY else 'Not Configured'}")
    print("Conversation Memory: MySQL-backed")
    print("=" * 50)
    print("Server starting on http://localhost:8000")
    print("API Docs: http://localhost:8000/docs")
    print("=" * 50)
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
