import { useState, useEffect } from 'react';
import { User, Activity, AlertTriangle, Save, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { updateMember } from '../services/api';

export default function MemberDashboard({ member, onUpdate }) {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    emergency_contact: '',
    medical_history: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Fetch latest member info from the server to get unencrypted medical history
    const fetchMemberInfo = async () => {
      try {
        const token = localStorage.getItem('ami_token');
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const res = await fetch(`${API_BASE}/member/${member.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success && data.member) {
          setFormData({
            name: data.member.name || '',
            age: data.member.age || '',
            emergency_contact: data.member.emergency_contact || '',
            medical_history: data.member.medical_history || '',
          });
        }
      } catch (error) {
        console.error('Error fetching member info:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMemberInfo();
  }, [member.id]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    
    // Convert age to integer
    const updates = { ...formData, age: formData.age ? parseInt(formData.age, 10) : null };
    
    const res = await updateMember(member.id, updates);
    setSaving(false);
    
    if (res.success) {
      setMessage('Profile updated successfully!');
      if (onUpdate) onUpdate(); // Optional callback to refresh parent
      setTimeout(() => setMessage(''), 3000);
    } else {
      setMessage(`Error: ${res.message || res.error || 'Failed to update'}`);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-8 space-y-6">
        <div className="h-10 bg-gray-200 rounded w-1/3 animate-pulse"></div>
        <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
        <div className="grid grid-cols-2 gap-6">
          <div className="h-16 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-16 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-[#D6E2F0]"
    >
      <div className="flex items-center gap-3 mb-6 border-b border-[#EBF3FC] pb-4">
        <div className="p-3 bg-[#EBF3FC] rounded-2xl text-[#4A86CF]">
          <User size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#333333]">Member Profile</h2>
          <p className="text-sm text-[#7D7D7D]">Update your personal and medical information</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl mb-6 ${message.includes('Error') ? 'bg-[#FCE8E8] text-[#E8836A]' : 'bg-[#EBF3FC] text-[#4A86CF]'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-[#333333] mb-2">Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-[#f8f9fa] border-none rounded-xl focus:ring-2 focus:ring-[#4A86CF]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#333333] mb-2">Age</label>
            <input
              type="number"
              name="age"
              value={formData.age}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-[#f8f9fa] border-none rounded-xl focus:ring-2 focus:ring-[#4A86CF]"
              min="1"
              max="120"
            />
          </div>
        </div>

        <div>
          <label className="block flex items-center gap-2 text-sm font-semibold text-[#333333] mb-2">
            <AlertTriangle size={16} className="text-[#E8836A]" /> Emergency Contact (Phone)
          </label>
          <input
            type="tel"
            name="emergency_contact"
            value={formData.emergency_contact}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-[#f8f9fa] border-none rounded-xl focus:ring-2 focus:ring-[#4A86CF]"
            placeholder="+1 234 567 8900"
          />
        </div>

        <div>
          <label className="block flex items-center gap-2 text-sm font-semibold text-[#333333] mb-2">
            <Activity size={16} className="text-[#4A86CF]" /> Medical History & Conditions
          </label>
          <textarea
            name="medical_history"
            value={formData.medical_history}
            onChange={handleChange}
            rows="4"
            className="w-full px-4 py-3 bg-[#f8f9fa] border-none rounded-xl focus:ring-2 focus:ring-[#4A86CF]"
            placeholder="e.g. Asthma, Penicillin allergy, Type 2 Diabetes..."
          />
          <p className="text-xs text-[#7D7D7D] mt-2 flex items-center gap-1">
            * This information is encrypted securely and only accessed when you ask A.M.I. for health advice.
          </p>
        </div>

        <div className="pt-4 border-t border-[#EBF3FC] flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-[#4A86CF] hover:bg-[#3B72B5] text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
