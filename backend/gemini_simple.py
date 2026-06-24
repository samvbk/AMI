# backend/gemini_simple.py
# WITH MEMORY + REAL WEATHER + REAL NEWS + FREE TIER MODELS + AGE-BASED DOSAGE (COMPLETE)

import os
from typing import Optional, Dict, Any, List
import google.generativeai as genai

print("🤖 Initializing Gemini free-tier models...")

# --------------------------------------------------
# API KEY
# --------------------------------------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError(
        "❌ GEMINI_API_KEY not found. "
        "Run: export GEMINI_API_KEY='YOUR_API_KEY'"
    )

genai.configure(api_key=GEMINI_API_KEY)

# --------------------------------------------------
# FREE TIER MODEL OPTIONS (2.5 FLASH FIRST)
# --------------------------------------------------
FREE_TIER_MODELS = [
    "models/gemini-2.5-flash",           # BEST - Try this first
    "models/gemini-2.5-flash-lite",       # 2nd - Lite version of 2.5
    "models/gemini-2.0-flash-exp",        # 3rd - 2.0 experimental
    "models/gemini-2.0-flash",            # 4th - 2.0 stable
    "models/gemini-2.0-flash-lite-001",   # 5th - 2.0 lite version 1
    "models/gemini-2.0-flash-lite",       # 6th - 2.0 lite
    "models/gemini-1.5-flash",            # 7th - 1.5 flash
    "models/gemini-1.5-flash-lite",       # 8th - 1.5 lite
    "models/gemini-pro",                  # 9th - Legacy pro
    "models/gemini-1.0-pro"               # 10th - Legacy 1.0
]

model = None
selected_model_name = None

for MODEL_NAME in FREE_TIER_MODELS:
    try:
        print(f"🔄 Trying model: {MODEL_NAME}...")
        
        temp_model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            generation_config={
                "temperature": 0.8,
                "top_p": 0.95,
                "max_output_tokens": 512,
            },
        )

        test = temp_model.generate_content("Reply with: Gemini connected")
        if test and test.text:
            model = temp_model
            selected_model_name = MODEL_NAME
            print(f"✅ Gemini connected successfully using model: {MODEL_NAME}")
            break
        else:
            print(f"⚠️ Model {MODEL_NAME} returned empty response")

    except Exception as e:
        print(f"⚠️ Model {MODEL_NAME} failed: {e}")
        continue

if not model:
    raise RuntimeError("❌ All free-tier Gemini models failed. Check API key or quota.")

print(f"🎯 Active model: {selected_model_name}")

# --------------------------------------------------
# EMERGENCY DETECTION
# --------------------------------------------------
EMERGENCY_KEYWORDS = {
    "chest pain": "Have the person stop all activity, sit upright, and loosen tight clothing while help is called.",
    "can't breathe": "Help the person sit upright and keep their airway clear while help is called.",
    "cant breathe": "Help the person sit upright and keep their airway clear while help is called.",
    "cannot breathe": "Help the person sit upright and keep their airway clear while help is called.",
    "unconscious": "Check breathing; if they are breathing, place them on their side in the recovery position.",
    "stroke": "Note the time symptoms started and keep the person still with their head slightly raised.",
    "seizure": "Move hard objects away and do not put anything in the person's mouth.",
    "severe bleeding": "Apply firm, direct pressure to the wound with a clean cloth.",
    "poisoning": "Do not induce vomiting; keep the container or substance nearby for emergency responders.",
}


def get_emergency_response(message: str) -> Optional[str]:
    text = message.lower()
    for keyword, first_aid in EMERGENCY_KEYWORDS.items():
        if keyword in text:
            return (
                "This may be an emergency. Call 112 in India immediately. "
                f"{first_aid}"
            )
    return None

# --------------------------------------------------
# (MEDICINE_DOSAGE removed for safety)
# --------------------------------------------------

# --------------------------------------------------
# MAIN RESPONSE FUNCTION WITH AGE CHECK
# --------------------------------------------------
def get_health_response(
    message: str,
    member_name: str,
    history: Optional[str] = None,
    weather_info: Optional[Dict[str, Any]] = None,
    clinics_info: Optional[List[Dict[str, Any]]] = None,
    news_articles: Optional[List[Dict[str, Any]]] = None,
    preferences: Optional[Dict[str, Any]] = None,
    current_time: str = "",
    is_morning: bool = False,
    user_age: Optional[int] = None
) -> str:
    """
    Generates response using free-tier Gemini models
    with memory, weather, and news context. (Medical dosage removed for safety)
    """
    emergency_response = get_emergency_response(message)
    if emergency_response:
        return emergency_response

    weather_context = ""
    if weather_info:
        weather_context = f"""
REAL WEATHER DATA:
- Location: {weather_info.get('city')}
- Temperature: {weather_info.get('temperature')}°C
- Conditions: {weather_info.get('description')}
- Humidity: {weather_info.get('humidity')}%
"""
        if weather_info.get('aqi'):
            weather_context += f"- Air Quality Index (AQI): {weather_info.get('aqi')}\n"

    clinics_context = ""
    if clinics_info:
        clinics_context = "NEARBY CLINICS & HOSPITALS:\n"
        for i, clinic in enumerate(clinics_info[:5], 1):
            clinics_context += f"{i}. {clinic.get('name')} ({clinic.get('type')})\n"


    news_context = ""
    if news_articles:
        news_context = "REAL NEWS HEADLINES:\n"
        for i, article in enumerate(news_articles[:3], 1):
            news_context += f"{i}. {article.get('title')}\n"

    time_context = f"Current time: {current_time}" if current_time else ""

    preferences_context = ""
    if preferences:
        if preferences.get("frequent_topics"):
            preferences_context += f"{member_name} often asks about: {', '.join(preferences['frequent_topics'])}\n"

    prompt = f"""
You are Amy — an emergency medical assistant AND a friendly young Indian family member (age 22).

PERSONALITY:
- Warm, casual, natural like family
- Slightly fun, not robotic
- Keep replies short (2-4 sentences)
- Use light emojis occasionally 😊

RULES:
- If it's morning and user greets, mention the REAL weather.
- If user asks about weather, use ONLY the location from REAL WEATHER DATA below. NEVER assume or say "Delhi" unless the weather data explicitly says Delhi. Always mention the correct city name from the weather data.
- If user asks for news, share REAL headlines.
- NEVER prescribe or suggest specific medical dosages or medications. This is extremely unsafe.
- ALWAYS recommend they consult a doctor or healthcare professional for any health concerns or symptoms.
- You can suggest very basic, safe home remedies (e.g. resting, drinking water, warm compress) but nothing that substitutes medical advice.
- Remember past conversations.
- Address the user by name: {member_name}
- IMPORTANT: The user's location is determined by their GPS coordinates. Use the city name from REAL WEATHER DATA.
- SPECIAL RULE: If the user explicitly asks you to set a reminder for a medicine, add a medicine, or track a medication, YOU MUST USE THE `add_medication` ACTION. You can remind them to follow their doctor's advice, but fulfill their request using the action.

{time_context}
{weather_context}
{clinics_context}
{news_context}
{preferences_context}

CONVERSATION HISTORY:
{history if history else "No previous messages"}

USER ({member_name}): {message}

IMPORTANT INSTRUCTIONS:
1. ALWAYS detect emergencies: if symptoms sound like stroke, heart attack, severe bleeding, tell them to call emergency services.
2. Keep response warm, caring, and family-like.
3. ALWAYS return your output as a raw JSON object with NO markdown formatting, NO backticks.

REQUIRED JSON FORMAT:
{{
  "response": "Your spoken conversational response here",
  "action": null // Or if the user asks to add a medication, output: {{"type": "add_medication", "name": "Medication Name", "time": "HH:MM"}}
}}
"""

    try:
        response = model.generate_content(prompt)

        if not response or not response.text:
            return '{"response": "Hi ' + member_name + '! 😊 How can I help you today?", "action": null}'

        cleaned = response.text.strip()
        # Ensure we don't accidentally return markdown blocks if gemini disobeys
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]

        return cleaned.strip()

    except Exception as e:
        print(f"❌ Gemini error: {e}")
        return '{"response": "Hi ' + member_name + '! 😊 How can I assist you today?", "action": null}'

# --------------------------------------------------
# EMOTION DETECTION
# --------------------------------------------------
def detect_emotion(text: str) -> str:
    t = text.lower()

    if get_emergency_response(text):
        return "emergency"

    if any(word in t for word in ["emergency", "help", "pain", "hurt", "urgent", "bleeding"]):
        return "concerned"

    if any(word in t for word in ["sad", "lonely", "depressed", "crying"]):
        return "sad"

    if any(word in t for word in ["happy", "great", "excited", "awesome", "😊", "😄"]):
        return "happy"

    if any(word in t for word in ["lol", "haha", "funny", "😂"]):
        return "playful"

    if any(word in t for word in ["angry", "mad", "upset", "frustrated"]):
        return "angry"

    if any(word in t for word in ["fever", "headache", "cough", "cold", "medicine", "doctor", "hospital"]):
        return "concerned"

    if any(word in t for word in ["how", "what", "why", "when", "where", "who", "?"]):
        return "thinking"

    return "neutral"


def generate_member_summary(existing_summary: str, transcript: str) -> str:
    prompt = f"""
Summarize this family healthcare assistant member history for future personalization.
Keep it concise and clinically cautious. Include recurring symptoms, medicines discussed,
preferences, age-related context, and safety concerns. Do not invent facts.

Existing summary:
{existing_summary or "No existing summary"}

Recent conversation transcript:
{transcript}

Updated rolling summary:
"""
    response = model.generate_content(prompt)
    if not response or not response.text:
        return existing_summary or ""
    return response.text.strip().replace("**", "").replace("*", "")

# --------------------------------------------------
# TEST MODE
# --------------------------------------------------
if __name__ == "__main__":
    print(f"🧪 Testing with active model: {selected_model_name}")
    
    # Test 1: Without age (should ask for age)
    test1 = get_health_response(
        message="I have fever",
        member_name="Test User",
        is_morning=False
    )
    print("\n🧪 Test 1 (No age):", test1)
    
    # Test 2: With age (8 years - child)
    test2 = get_health_response(
        message="I have fever and cold",
        member_name="Riya",
        is_morning=False,
        user_age=8
    )
    print("\n🧪 Test 2 (Age 8 - Child):", test2)
    
    # Test 3: With age (15 years - teen)
    test3 = get_health_response(
        message="I have body ache and headache",
        member_name="Aryan",
        is_morning=False,
        user_age=15
    )
    print("\n🧪 Test 3 (Age 15 - Teen):", test3)
    
    # Test 4: With age (35 years - adult)
    test4 = get_health_response(
        message="I have severe back pain",
        member_name="Priya",
        is_morning=False,
        user_age=35
    )
    print("\n🧪 Test 4 (Age 35 - Adult):", test4)
    
    # Test 5: Age below 5
    test5 = get_health_response(
        message="My child has fever",
        member_name="Parent",
        is_morning=False,
        user_age=3
    )
    print("\n🧪 Test 5 (Age 3 - Below 5):", test5)


