import os
import requests
import time
import logging

logger = logging.getLogger(__name__)

class TTSHandler:
    def __init__(self):
        self.keys = []
        # Support up to 3 keys for rotation
        for k in ["GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3"]:
            val = os.getenv(k)
            if val and val.startswith("AIza"):
                self.keys.append(val)
        
        self.current_key_index = 0
        self.key_exhausted_at = {}

    def rotate_key(self, exhausted_index):
        now = time.time()
        cooldown_s = 5 * 60  # 5 minutes
        
        self.key_exhausted_at[exhausted_index] = now
        logger.warning(f"TTS Key {exhausted_index + 1} hit rate limit. Trying next key...")
        
        for i in range(1, len(self.keys) + 1):
            next_idx = (exhausted_index + i) % len(self.keys)
            exhausted_time = self.key_exhausted_at.get(next_idx)
            
            if not exhausted_time or (now - exhausted_time) > cooldown_s:
                self.current_key_index = next_idx
                logger.info(f"Switched to TTS key {next_idx + 1}")
                return True
                
        logger.error("All TTS keys exhausted.")
        return False

    def generate_speech(self, text, language="en-IN", voice_name="Kore", retry_count=0):
        if not self.keys:
            return {"success": False, "error": "No Gemini API keys configured"}
            
        current_idx = self.current_key_index
        current_key = self.keys[current_idx]
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key={current_key}"
        
        payload = {
            "contents": [{"parts": [{"text": f"[SPEAK] {text}"}]}],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 8192,
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {"voiceName": voice_name}
                    },
                    "languageCode": language
                }
            }
        }
        
        try:
            resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=15)
            
            if resp.status_code == 429:
                if self.rotate_key(current_idx) and retry_count < len(self.keys):
                    return self.generate_speech(text, language, voice_name, retry_count + 1)
                return {"success": False, "error": "Rate limit exceeded on all keys"}
                
            if not resp.ok:
                logger.error(f"Gemini TTS HTTP {resp.status_code}: {resp.text}")
                return {"success": False, "error": f"API error: {resp.status_code}"}
                
            data = resp.json()
            parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            
            audio_data = None
            mime_type = "audio/wav"
            
            for part in parts:
                if "inlineData" in part and "data" in part["inlineData"]:
                    audio_data = part["inlineData"]["data"]
                    mime_type = part["inlineData"].get("mimeType", "audio/wav")
                    break
                    
            if not audio_data:
                return {"success": False, "error": "No audio returned"}
                
            return {
                "success": True,
                "audioData": audio_data,
                "mimeType": mime_type
            }
            
        except Exception as e:
            logger.error(f"Gemini TTS Exception: {e}")
            return {"success": False, "error": str(e)}

tts_handler = TTSHandler()
