# Ami - Family Healthcare Assistant 🏥🤖

Ami is a full-stack AI-powered family healthcare assistant built to provide personalized health advice, seamless daily interaction, and multi-user support via face recognition.

## 🌟 Key Features
- **Face Recognition Login**: Built-in OpenCV facial recognition to automatically identify family members and fetch their specific medical history.
- **AI Brain**: Powered by Google's Gemini for conversational health assistance, empathetic responses, and emotion detection.
- **Live Widgets**: Real-time integrations with WeatherAPI and NewsAPI to give context to daily conversations.
- **Persistent Conversation Memory**: Learns frequent topics and tracks the history of individual members automatically.
- **Voice Support**: Integrated speech-to-text and text-to-speech for accessible communication.

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Frontend [React + Vite Frontend]
        UI[User Interface]
        Webcam[React Webcam]
        Audio[Audio/Voice Interface]
    end

    subgraph Backend [FastAPI Backend]
        API[FastAPI Router]
        Auth[Face Recognition Module]
        Memory[Conversation Memory Manager]
        Gemini[Gemini AI Handler]
    end

    subgraph External Services
        MySQL[(MySQL Database)]
        Google[Google Gemini API]
        Weather[WeatherAPI]
        News[NewsAPI]
    end

    UI <-->|JSON/REST| API
    Webcam -->|Image Bytes (UploadFile)| Auth
    
    API <--> Memory
    Memory <--> MySQL
    Auth <--> MySQL
    
    API <--> Gemini
    Gemini <--> Google
    API --> Weather
    API --> News
```

## 🔄 Face Recognition Workflow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant FastAPI
    participant OpenCV
    participant MySQL

    User->>Frontend: Steps in front of camera
    Frontend->>FastAPI: POST /recognize (Image Bytes)
    FastAPI->>OpenCV: Extract features (Grayscale -> Haarcascade -> LBP Histogram)
    FastAPI->>MySQL: Fetch stored member encodings
    MySQL-->>FastAPI: Return encoded face features
    FastAPI->>FastAPI: Calculate Euclidean distance
    FastAPI-->>Frontend: Return Authentication Success (Member Data)
    Frontend-->>User: "Welcome back!" & Load Healthcare Profile
```

## 💻 Technology Stack

### Frontend
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS
- **Icons & UI**: Lucide React, modern component styling
- **Hardware Integrations**: `react-webcam`

### Backend
- **Framework**: FastAPI (Python)
- **AI / ML**: OpenCV Haarcascade, Google Generative AI (`gemini-pro/vision`)
- **Database**: MySQL with Python Connector Pooling
- **Audio Processing**: Google Text-to-Speech (gTTS), SpeechRecognition, PyDub

## 🚀 Getting Started

### 1. Database Configuration
1. Create a MySQL database named `healthcare`.
2. Run the `backend/database.sql` script to set up the necessary `members` and `families` tables.

### 2. Configure Environment Variables
Inside the `backend/` folder, create a `.env` file containing the following:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=healthcare
DB_PORT=3306

GOOGLE_API_KEY=your_gemini_api_key
WEATHER_API_KEY=your_weatherapi_key
NEWS_API_KEY=your_newsapi_key
```

### 3. Start the Backend Server
Open your terminal and run:
```bash
cd backend
python -m venv venv
venv\Scripts\activate   # (or source venv/bin/activate on Mac/Linux)
pip install -r requirements.txt
python app.py
```

### 4. Start the Frontend App
Open a second terminal window and run:
```bash
cd frontend
npm install
npm run dev
```

Your app should now be running locally at `http://localhost:5173`!
