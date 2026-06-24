// frontend/src/components/ChatInterface.jsx - COMPLETE WORKING VERSION
import { useState, useRef, useEffect } from 'react';
import { Send, Mic, Volume2, FileText, User, Bot, Clock } from 'lucide-react';
import AssistantAvatar from './AnimeAvatar';
import { sendMessage, getAudio } from '../services/api';

export default function ChatInterface({ member }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentAudio, setCurrentAudio] = useState(null);
  const messagesEndRef = useRef(null);
  const lastSendAtRef = useRef(0);

  useEffect(() => {
    // Load initial message
    if (member) {
      setMessages([
        {
          id: 1,
          text: `Hello ${member.name}! I'm your healthcare assistant. How can I help you today?`,
          sender: 'assistant',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: 'neutral'
        }
      ]);
    }
  }, [member]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading || !member) return;
    const now = Date.now();
    if (now - lastSendAtRef.current < 1000) return;
    lastSendAtRef.current = now;

    const userMessage = {
      id: messages.length + 1,
      text: input,
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    
    try {
      const response = await sendMessage(member.id, input, false);
      
      if (response.success) {
        const assistantMessage = {
          id: messages.length + 2,
          text: response.response,
          sender: 'assistant',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: response.emotion
        };

        setMessages(prev => [...prev, assistantMessage]);
        
        // Play audio response if available
        if (response.audio_file) {
          const audio = new Audio(getAudio(response.audio_file));
          setCurrentAudio(audio);
          audio.play();
          setIsPlaying(true);
          audio.onended = () => setIsPlaying(false);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const startRecording = async () => {
    alert('Voice recording is temporarily disabled. Please use text input.');
    setIsRecording(false);
  };

  const stopRecording = () => {
    setIsRecording(false);
  };

  const toggleAudio = () => {
    if (currentAudio) {
      if (isPlaying) {
        currentAudio.pause();
        setIsPlaying(false);
      } else {
        currentAudio.play();
        setIsPlaying(true);
        currentAudio.onended = () => setIsPlaying(false);
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto">
      {/* Assistant Avatar */}
      <div className="mb-8">
        <AssistantAvatar 
          emotion={messages[messages.length - 1]?.emotion || 'neutral'}
          isSpeaking={isPlaying || loading}
          message={loading ? 'Thinking...' : messages[messages.length - 1]?.sender === 'assistant' ? messages[messages.length - 1]?.text : ''}
        />
      </div>

      {/* Chat Container */}
      <div className="flex-1 flex flex-col bg-gradient-to-b from-white to-gray-50 rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Chat Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Chat with Assistant</h2>
                <p className="text-white/80 text-sm">
                  {member ? `Speaking with ${member.name} (${member.role})` : 'Please login first'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
              <Clock className="w-4 h-4 text-white" />
              <span className="text-white text-sm">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl p-5 ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-br-none'
                    : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-bl-none'
                } shadow-lg`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    msg.sender === 'user' 
                      ? 'bg-white/20' 
                      : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                  }`}>
                    {msg.sender === 'user' ? (
                      <User className="w-5 h-5" />
                    ) : (
                      <Bot className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-lg leading-relaxed">{msg.text}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className={`text-xs ${
                        msg.sender === 'user' ? 'text-white/80' : 'text-gray-500'
                      }`}>
                        {msg.time}
                      </span>
                      {msg.emotion && msg.sender === 'assistant' && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          msg.emotion === 'positive' 
                            ? 'bg-green-100 text-green-800'
                            : msg.emotion === 'concerned'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {msg.emotion}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl rounded-bl-none p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 p-6 bg-white">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your health concern or question..."
                className="w-full p-4 pr-12 border-2 border-purple-100 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all resize-none"
                rows="2"
                disabled={loading || !member}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim() || !member}
                className={`absolute right-3 bottom-3 p-2 rounded-lg ${
                  loading || !input.trim() || !member
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg transition-all'
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={startRecording}
                disabled={loading || !member}
                className={`p-4 rounded-xl ${
                  isRecording
                    ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white animate-pulse'
                    : loading || !member
                    ? 'bg-gray-200 text-gray-400'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white'
                } transition-all shadow-lg hover:shadow-xl`}
              >
                <Mic className="w-6 h-6" />
              </button>
              
              <button
                onClick={toggleAudio}
                disabled={!currentAudio || loading}
                className={`p-4 rounded-xl ${
                  !currentAudio || loading
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                } transition-all shadow-lg hover:shadow-xl`}
              >
                {isPlaying ? (
                  <Volume2 className="w-6 h-6" />
                ) : (
                  <FileText className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Press Enter to send • Shift+Enter for new line</span>
            </div>
            <div className="text-xs text-gray-500">
              {isRecording ? 'Recording...' : 'Click mic for voice input'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
