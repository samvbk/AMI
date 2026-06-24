# backend/config.py
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    # Database connection
    DATABASE_URL = os.getenv("DATABASE_URL", "mysql://root@localhost:3306/healthcare")
    
    # Gemini API Key
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    
    # Validate API key
    @property
    def is_valid_gemini_key(self):
    
    # Validate API key
    @property
    def is_valid_gemini_key(self):
        if not self.GEMINI_API_KEY:
            return False
        if not self.GEMINI_API_KEY.startswith("AIza"):
            return False
        return True
    
    # App settings
    SECRET_KEY = os.getenv("SECRET_KEY")
    ALGORITHM = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    
    # Directories
    FACES_DIR = "faces"
    AUDIO_DIR = "audio"
    
    # Create directories
    os.makedirs(FACES_DIR, exist_ok=True)
    os.makedirs(AUDIO_DIR, exist_ok=True)
    
config = Config()

# Print configuration (mask sensitive data)
def print_config():
    print(f"🔧 A.M.I. Configuration:")
    print("   Database: configured" if config.DATABASE_URL else "   Database: not configured")
    print_config()
