# backend/setup.py
import subprocess
import sys

def install_packages():
    """Install required packages"""
    packages = [
        "fastapi==0.104.1",
        "uvicorn==0.24.0",
        "python-multipart==0.0.6",
        "mysql-connector-python==8.2.0",
        "opencv-python==4.8.1.78",
        "numpy==1.24.3",
        "google-generativeai==0.3.0",
        "python-dotenv==1.0.0",
        "gtts==2.4.0",
        "SpeechRecognition==3.10.0",
        "Pillow==10.1.0",
        "pydub==0.25.1"
    ]
    
    print("📦 Installing packages...")
    for package in packages:
        print(f"  Installing {package}")
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
    
    print("✅ All packages installed!")

def create_directories():
    """Create necessary directories"""
    import os
    directories = ["faces", "audio"]
    
    for dir_name in directories:
        os.makedirs(dir_name, exist_ok=True)
        print(f"📁 Created directory: {dir_name}/")
    
    print("✅ Directories created!")

if __name__ == "__main__":
    print("🔧 Healthcare Assistant Setup")
    print("=" * 40)
    
    install_packages()
    create_directories()
    
    print("\n✅ Setup complete!")
    print("\nNext steps:")
    print("1. Make sure MySQL is running: brew services start mysql")
    print("2. Initialize database: python init_db.py")
    print("3. Start the server: python app.py")
    print("\n💡 Don't forget to:")
    print("   - Get a Gemini API key from: https://makersuite.google.com/app/apikey")
    print("   - Set GEMINI_API_KEY environment variable in your .env file")