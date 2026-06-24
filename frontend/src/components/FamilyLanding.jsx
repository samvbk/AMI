// frontend/src/components/FamilyLanding.jsx
import { useState } from 'react';
import { Users, UserPlus, Home, ArrowRight } from 'lucide-react';
import CameraComponent from './Camera';
import { registerMember, recognizeFace, loginOverride } from '../services/api';

export default function FamilyLanding({ onLogin, onRegisterFamily }) {
  const [mode, setMode] = useState(null); // 'existing', 'new-family', 'new-member'
  const [showCamera, setShowCamera] = useState(false);
  const [message, setMessage] = useState('');
  const [topMatches, setTopMatches] = useState([]);

  const handleExistingMember = () => {
    setMode('existing');
    setTopMatches([]);
    setMessage('');
    setShowCamera(true);
  };

  const handleNewFamily = () => {
    setMode('new-family');
    onRegisterFamily();
  };

  const handleNewMember = () => {
    setMode('new-member');
    setShowCamera(true);
  };

  const handleCameraCapture = async (imageBase64) => {
    if (mode === 'existing') {
      // Face recognition for existing member
      setMessage('Analyzing face...');
      const result = await recognizeFace(imageBase64);
      if (result.success && result.recognized) {
        onLogin(result.member);
      } else {
        if (result.top_matches && result.top_matches.length > 0) {
          setTopMatches(result.top_matches);
          setMessage('Face not perfectly matched. Are you one of these members?');
        } else {
          setMessage('Member not recognized. Please register first.');
        }
      }
    }
    setShowCamera(false);
  };

  const handleManualLogin = async (memberId) => {
    setMessage('Logging in...');
    const result = await loginOverride(memberId);
    if (result.success && result.member) {
      onLogin(result.member);
    } else {
      setMessage(result.message || 'Login override failed.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 p-8 flex items-center justify-center">
      {showCamera && (
        <CameraComponent
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
          mode="recognize"
        />
      )}
      
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 px-4 py-2 rounded-full mb-6">
            <Home className="w-5 h-5 text-blue-300" />
            <span className="text-blue-300 font-medium">Family Healthcare Assistant</span>
          </div>
          
          <h1 className="text-5xl font-bold text-white mb-4">
            Welcome to <span className="text-cyan-300">A.M.I.</span>
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Your family's 24/7 healthcare companion
          </p>
        </div>

        {/* Options Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Existing Family Member */}
          <button
            onClick={handleExistingMember}
            className="p-8 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 hover:border-blue-400 transition-all group hover:scale-105"
          >
            <div className="w-16 h-16 bg-blue-500/20 rounded-xl flex items-center justify-center mb-6 mx-auto">
              <Users className="w-8 h-8 text-blue-300 group-hover:text-blue-200" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Existing Family Member</h3>
            <p className="text-gray-300 mb-4">I'm already registered in the family</p>
            <div className="flex items-center justify-center text-blue-300">
              <span className="mr-2">Face Recognition Login</span>
              <ArrowRight className="w-5 h-5" />
            </div>
          </button>

          {/* New Family */}
          <button
            onClick={handleNewFamily}
            className="p-8 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 hover:border-purple-400 transition-all group hover:scale-105"
          >
            <div className="w-16 h-16 bg-purple-500/20 rounded-xl flex items-center justify-center mb-6 mx-auto">
              <Home className="w-8 h-8 text-purple-300 group-hover:text-purple-200" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Register New Family</h3>
            <p className="text-gray-300 mb-4">We're new here. Set up our family profile</p>
            <div className="flex items-center justify-center text-purple-300">
              <span className="mr-2">Create Family Profile</span>
              <ArrowRight className="w-5 h-5" />
            </div>
          </button>

          {/* New Member in Existing Family */}
          <button
            onClick={handleNewMember}
            className="p-8 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 hover:border-green-400 transition-all group hover:scale-105"
          >
            <div className="w-16 h-16 bg-green-500/20 rounded-xl flex items-center justify-center mb-6 mx-auto">
              <UserPlus className="w-8 h-8 text-green-300 group-hover:text-green-200" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Add Family Member</h3>
            <p className="text-gray-300 mb-4">Add a new member to existing family</p>
            <div className="flex items-center justify-center text-green-300">
              <span className="mr-2">Register New Member</span>
              <ArrowRight className="w-5 h-5" />
            </div>
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className="max-w-2xl mx-auto p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 mb-6">
            <p className="text-white text-center">{message}</p>
          </div>
        )}

        {/* Top Matches (Manual Selection Override) */}
        {topMatches.length > 0 && (
          <div className="max-w-2xl mx-auto space-y-4">
            {topMatches.map((match) => (
              <button
                key={match.id}
                onClick={() => handleManualLogin(match.id)}
                className="w-full flex items-center justify-between p-4 bg-blue-900/40 hover:bg-blue-800/60 backdrop-blur-md rounded-xl border border-blue-400/30 transition-all"
              >
                <div className="flex flex-col text-left">
                  <span className="text-white font-bold text-xl">{match.name}</span>
                  <span className="text-blue-200">Family: {match.family_name}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm text-blue-300">Match Confidence</span>
                  <span className="text-white font-medium">{match.confidence}%</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Footer Note */}
        <div className="text-center text-gray-400 text-sm mt-8">
          <p>A.M.I. - Artificial Medical Intelligence • Always Listening • Always Caring</p>
        </div>
      </div>
    </div>
  );
}