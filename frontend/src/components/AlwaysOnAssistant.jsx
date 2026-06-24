import { useState, useEffect, useRef } from 'react';
import { LogOut, Home, Users, Volume2, VolumeX, Cloud, CloudOff, MessageCircle, Pill, Moon, Sun, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AiCard from './AiCard';
import AccessibilityToggle from './AccessibilityToggle';
import { getAudioUrl, sendMessage, deleteMember } from '../services/api';
import voiceService from '../services/voiceService';
import MedicationTracker from './MedicationTracker';
import MemberDashboard from './MemberDashboard';
import EmergencyOverlay from './EmergencyOverlay';
import ErrorBoundary from './ErrorBoundary';

export default function AlwaysOnAssistant({ member, onLogout }) {
  const [assistantState, setAssistantState] = useState('idle');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [weather, setWeather] = useState(null);
  const [morningGreeted, setMorningGreeted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [volume, setVolume] = useState(0);
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });
  const [userCoords, setUserCoords] = useState({ lat: null, lon: null });
  const [activeTab, setActiveTab] = useState('assistant');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [emergencyMessage, setEmergencyMessage] = useState('');

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const userCoordsRef = useRef({ lat: null, lon: null });
  const isProcessingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const lastSendAtRef = useRef(0);
  const backendAudioRef = useRef(null);
  // ─────────────────────────────────────────────────────────────
  // ✅ STEP 1: Fetch weather using device location
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchWeatherWithCoords = async (latitude, longitude) => {
      try {
        console.log(`Your coords: ${latitude}, ${longitude}`); // ← debug line
        const response = await fetch(`http://localhost:8000/weather?lat=${latitude}&lon=${longitude}`);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        
        const data = await response.json();
        if (data.success) {
          setWeather(data.weather);
          setUserCoords({ lat: latitude, lon: longitude });
          userCoordsRef.current = { lat: latitude, lon: longitude }; // keep ref in sync
        } else {
          console.error('API returned failure:', data); // ← see what backend says
        }
      } catch (error) {
        console.error('Weather fetch failed:', error);
      }
    };

    const attemptLocationFetch = () => {
      if (!navigator.geolocation) {
        console.warn('Geolocation not supported, falling back to cached DB coords');
        if (member.latitude && member.longitude) {
          fetchWeatherWithCoords(member.latitude, member.longitude);
        }
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeatherWithCoords(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.warn('Location permission denied or failed, falling back to cached DB coords:', error.message);
          if (member.latitude && member.longitude) {
            fetchWeatherWithCoords(member.latitude, member.longitude);
          }
        },
        { enableHighAccuracy: true, timeout: 10000 } // ← add geolocation options
      );
    };

    attemptLocationFetch();
  }, [member]);
  // ─────────────────────────────────────────────────────────────
  // ✅ STEP 3: Morning greeting builder
  // ─────────────────────────────────────────────────────────────
  const morningGreeting = () => {
    if (morningGreeted) return;

    const hour = new Date().getHours();
    let timeGreeting = '';
    if (hour < 12) timeGreeting = 'morning';
    else if (hour < 17) timeGreeting = 'afternoon';
    else timeGreeting = 'evening';

    let greeting = `Good ${timeGreeting}, ${member.name}! `;

    if (hour < 12 && weather) {
      // Avoid "°C" symbol — preprocessor handles numbers, but degree symbol
      // can confuse TTS. Write it out plainly.
      greeting += `It is ${weather.temperature} degrees Celsius with ${weather.description} in ${weather.city}. `;
      greeting += `Would you like me to tell you today's news? `;
    } else {
      greeting += `How are you doing today? `;
    }

    greeting += `So, what are you up to?`;

    setMorningGreeted(true);
    isProcessingRef.current = true;
    handleAssistantResponse(greeting, 'happy');

    setTimeout(() => {
      isProcessingRef.current = false;
    }, 4000);
  };

  // ─────────────────────────────────────────────────────────────
  // ✅ STEP 4: Initialize assistant
  //    Greeting delayed to 2000ms — safely after Gemini key effect
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    console.log('🌟 A.M.I. Activated for:', member.name);

    if (!voiceService.isSpeechAvailable()) {
      console.warn('Speech synthesis not available');
      setAudioEnabled(false);
    }

    // ✅ 2000ms gives the Gemini key effect (declared first) plenty of
    //    time to run, so Kore voice is definitely set before first speak()
    setTimeout(() => {
      morningGreeting();
    }, 2000);

    startListening();

    // Eye wander effect
    const wander = () => {
      setTimeout(() => {
        setEyePos({
          x: (Math.random() - 0.5) * 12,
          y: (Math.random() - 0.5) * 7,
        });
        wander();
      }, 900 + Math.random() * 2400);
    };
    wander();

    return () => {
      voiceService.stopListening();
      voiceService.stopSpeaking();
    };
  }, [weather]);

  // ─────────────────────────────────────────────────────────────
  // Listening
  // ─────────────────────────────────────────────────────────────
  const startListening = () => {
    if (isProcessingRef.current || isSleeping) return;
    const started = voiceService.startContinuousListening(handleUserSpeech);
    setIsListening(started);
    if (started) setAssistantState('idle');
  };

  const handleUserSpeech = async (text) => {
    if (isProcessingRef.current) return;
    if (!text || text.trim() === '') return;
    const now = Date.now();
    if (now - lastSendAtRef.current < 1000) return;
    lastSendAtRef.current = now;

    try {
      isProcessingRef.current = true;
      setIsListening(false);
      setAssistantState('thinking');
      setTranscript(`You said: "${text}"`);
      setCurrentSubtitle(`You said: "${text}"`);

      const lowerText = text.toLowerCase();

      if (lowerText.includes('first') || lowerText.includes('1st')) { fetchNewsDetail(0); return; }
      if (lowerText.includes('second') || lowerText.includes('2nd')) { fetchNewsDetail(1); return; }
      if (lowerText.includes('third') || lowerText.includes('3rd')) { fetchNewsDetail(2); return; }
      if (lowerText.includes('news')) { handleNewsRequest(); return; }

      console.log(`💬 Sending to backend: "${text}"`);
      const coords = userCoordsRef.current;
      console.log(`📍 Using coords: ${coords.lat}, ${coords.lon}`);
      const response = await sendMessage(member.id, text, audioEnabled, coords.lat, coords.lon);
      if (response.duplicate) {
        console.log('⏭️ Duplicate message ignored');
        isProcessingRef.current = false;
        startListening();
        return;
      }

      if (response?.response) {
        console.log(`✅ Got response: "${response.response.substring(0, 50)}..."`);
        if (response.action && response.action.type === 'add_medication') {
          console.log("💊 Medication added via voice action, refreshing tracker...");
          window.dispatchEvent(new Event('ami_refresh_medications'));
        }
        setTranscript('');
        handleAssistantResponse(response.response, response.emotion || 'neutral', response.audio_file);
      } else {
        throw new Error('Invalid response');
      }
    } catch (error) {
      console.error('Chat error:', error);
      handleAssistantResponse("Sorry, I am having trouble connecting.", 'concerned');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // News
  // ─────────────────────────────────────────────────────────────
  const handleNewsRequest = async () => {
    try {
      handleAssistantResponse("Fetching today's top headlines.", 'happy');

      const response = await fetch('http://localhost:8000/news');
      const data = await response.json();

      if (data.success && data.articles) {
        const numberWords = ['one', 'two', 'three', 'four', 'five'];
        let newsText = "Here are today's top headlines. ";
        data.articles.slice(0, 3).forEach((article, index) => {
          newsText += `Number ${numberWords[index]}. ${article.title}. `;
        });
        newsText += 'Would you like more details on any of these?';
        handleAssistantResponse(newsText, 'neutral');
      } else {
        handleAssistantResponse('I could not fetch the news right now.', 'concerned');
      }
    } catch (error) {
      handleAssistantResponse('I could not fetch the news right now.', 'concerned');
    }
  };

  const fetchNewsDetail = async (index) => {
    try {
      const response = await fetch(`http://localhost:8000/news-detail/${index}`);
      const data = await response.json();

      if (data.success) {
        handleAssistantResponse(`${data.title}. ${data.description || ''}`, 'neutral');
      } else {
        handleAssistantResponse('I could not find that article.', 'concerned');
      }
    } catch (error) {
      handleAssistantResponse('Something went wrong while fetching details.', 'concerned');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Response & speech
  // ─────────────────────────────────────────────────────────────
  const handleAssistantResponse = (text, emotion, audioFile = null) => {
    setLastResponse(text);
    setCurrentSubtitle(text);
    setAssistantState('speaking');
    if (emotion === 'emergency') {
      setEmergencyMessage(text);
    }

    if (audioEnabled && audioFile) {
      playBackendAudio(audioFile, text);
    } else if (audioEnabled) {
      speakResponse(text);
    } else {
      setTimeout(() => {
        setAssistantState(isSleeping ? 'sleeping' : 'idle');
        isProcessingRef.current = false;
        if (!isSleeping) startListening();
      }, 3000);
    }
  };

  const playBackendAudio = (audioFile, fallbackText) => {
    const url = getAudioUrl(audioFile);
    if (!url) {
      setAssistantState(isSleeping ? 'sleeping' : 'idle');
      isProcessingRef.current = false;
      if (!isSleeping) startListening();
      return;
    }

    if (backendAudioRef.current) {
      backendAudioRef.current.pause();
    }

    const audio = new Audio(url);
    backendAudioRef.current = audio;
    setIsSpeaking(true);
    setAssistantState('speaking');
    setIsListening(false);

    audio.play().catch(() => {
      setIsSpeaking(false);
      speakResponse(fallbackText);
    });
    audio.onended = () => {
      setIsSpeaking(false);
      setAssistantState(isSleeping ? 'sleeping' : 'idle');
      setTranscript('');
      setTimeout(() => {
        isProcessingRef.current = false;
        if (!isSleeping && !isProcessingRef.current) startListening();
      }, 800);
    };
  };

  const speakResponse = (text) => {
    if (!audioEnabled) return;

    setIsSpeaking(true);
    setAssistantState('speaking');
    setIsListening(false);

    voiceService.speak(text, () => {
      setIsSpeaking(false);
      setAssistantState(isSleeping ? 'sleeping' : 'idle');
      setTranscript('');

      setTimeout(() => {
        isProcessingRef.current = false;
        if (!isSleeping && !isProcessingRef.current) startListening();
      }, 1500);
    });
  };

  const toggleAudio = () => {
    const newState = !audioEnabled;
    setAudioEnabled(newState);

    if (newState) {
      handleAssistantResponse('Audio is back on!', 'happy');
    } else {
      voiceService.stopSpeaking();
      if (backendAudioRef.current) backendAudioRef.current.pause();
      setIsSpeaking(false);
      setAssistantState(isSleeping ? 'sleeping' : 'idle');
      isProcessingRef.current = false;
      if (!isSleeping) startListening();
    }
  };

  const toggleSleepMode = () => {
    if (isSleeping) {
      setIsSleeping(false);
      setAssistantState('idle');
      startListening();
    } else {
      voiceService.stopListening();
      voiceService.stopSpeaking();
      if (backendAudioRef.current) backendAudioRef.current.pause();
      setIsListening(false);
      setIsSpeaking(false);
      setIsSleeping(true);
      setAssistantState('sleeping');
    }
  };

  const getStatusMessage = () => {
    if (isSleeping) return 'A.M.I. is sleeping';
    if (isSpeaking) return 'A.M.I. is talking...';
    if (isListening) return 'Listening...';
    if (assistantState === 'thinking') return 'Thinking...';
    return 'Ready';
  };

  // ─────────────────────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0" style={{ backgroundColor: '#f8f9fa' }}>
      <EmergencyOverlay message={emergencyMessage} onClose={() => setEmergencyMessage('')} />
      <div
        className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center"
        style={{
          background: 'rgba(74, 134, 207, 0.1)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(74, 134, 207, 0.2)',
          zIndex: 50,
        }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => (window.location.href = '/')}
            className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background: '#4A86CF', color: '#FFFFFF' }}
          >
            <Home size={20} />
            <span>Home</span>
          </button>

          <div className="flex items-center gap-2" style={{ color: '#4A86CF' }}>
            <Users size={20} />
            <span>{member.family_name} Family</span>
          </div>

          <div style={{ color: '#333333' }}>👋 {member.name}</div>

          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full font-semibold text-[#4A86CF] shadow-sm">
            {isOffline ? <CloudOff size={20} className="text-[#E8836A]" /> : <Cloud size={20} />}
            <span>{isOffline ? 'Offline Mode' : weather?.temperature ? `${weather.temperature}°C` : 'Connecting...'}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 p-1 rounded-full" style={{ background: '#FFFFFF' }}>
            <button
              onClick={() => setActiveTab('assistant')}
              className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-bold"
              style={{
                background: activeTab === 'assistant' ? '#4A86CF' : 'transparent',
                color: activeTab === 'assistant' ? '#FFFFFF' : '#4A86CF',
              }}
            >
              <MessageCircle size={16} />
              <span>Assistant</span>
            </button>
            <button
              onClick={() => setActiveTab('medications')}
              className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-bold"
              style={{
                background: activeTab === 'medications' ? '#4A86CF' : 'transparent',
                color: activeTab === 'medications' ? '#FFFFFF' : '#4A86CF',
              }}
            >
              <Pill size={16} />
              <span>Medications</span>
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-bold"
              style={{
                background: activeTab === 'profile' ? '#4A86CF' : 'transparent',
                color: activeTab === 'profile' ? '#FFFFFF' : '#4A86CF',
              }}
            >
              <User size={16} />
              <span>Profile</span>
            </button>
          </div>

          <div
            className="px-3 py-1 rounded-full text-sm"
            style={{ background: '#FFFFFF', color: '#4A86CF' }}
          >
            {getStatusMessage()}
          </div>

          <button
            onClick={toggleAudio}
            className="p-2 rounded-full"
            style={{
              background: audioEnabled ? '#4A86CF' : '#D6E2F0',
              color: '#FFFFFF',
            }}
          >
            {audioEnabled ? <Volume2 /> : <VolumeX />}
          </button>

          <button
            onClick={toggleSleepMode}
            className="p-2 rounded-full"
            style={{
              background: isSleeping ? '#E8836A' : '#4A86CF',
              color: '#FFFFFF',
            }}
            title={isSleeping ? "Wake up A.M.I." : "Put A.M.I. to Sleep"}
          >
            {isSleeping ? <Moon /> : <Sun />}
          </button>

          <AccessibilityToggle />

          <button
            onClick={() => setEmergencyMessage('Manual Emergency Triggered. Please stand by while we contact emergency services and your emergency contact.')}
            className="flex items-center gap-2 px-4 py-2 rounded-full font-bold"
            style={{ background: '#E8836A', color: '#FFFFFF' }}
            title="Trigger Emergency Mode"
          >
            <span>Emergency</span>
          </button>

          <button
            onClick={async () => {
              if (window.confirm("Are you sure you want to delete your profile? This cannot be undone.")) {
                const res = await deleteMember(member.id);
                if (res.success) {
                  onLogout();
                } else {
                  alert(res.message || "Failed to delete profile");
                }
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background: '#D6E2F0', color: '#E8836A' }}
          >
            <span>Delete Profile</span>
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background: '#82ACE0', color: '#FFFFFF' }}
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      <div className="absolute inset-0 pt-16 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'assistant' ? (
            <motion.div
              key="assistant"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <ErrorBoundary fallback="The assistant panel had trouble loading.">
                <div className="min-h-full flex flex-col items-center justify-center">
                  <AiCard
                    mode={assistantState}
                    isSpeaking={isSpeaking}
                    isListening={isListening}
                    transcript={transcript}
                    response={lastResponse}
                    volume={volume}
                    eyePos={eyePos}
                  />
                  {assistantState === 'thinking' && (
                    <div className="mt-5 w-full max-w-md rounded-2xl border border-[#D6E2F0] bg-white p-5 shadow-sm">
                      <div className="h-4 w-2/3 rounded bg-[#D6E2F0] animate-pulse mb-3" />
                      <div className="h-4 w-full rounded bg-[#EBF3FC] animate-pulse mb-2" />
                      <div className="h-4 w-4/5 rounded bg-[#EBF3FC] animate-pulse" />
                    </div>
                  )}
                </div>
              </ErrorBoundary>
            </motion.div>
          ) : activeTab === 'medications' ? (
            <motion.div
              key="medications"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <ErrorBoundary fallback="The medication tracker had trouble loading.">
                <MedicationTracker member={member} />
              </ErrorBoundary>
            </motion.div>
          ) : (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <ErrorBoundary fallback="The profile dashboard had trouble loading.">
                <MemberDashboard member={member} onUpdate={() => console.log('Profile updated!')} />
              </ErrorBoundary>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
