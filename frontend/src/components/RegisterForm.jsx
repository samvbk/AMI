import { useState, useEffect } from 'react';
import { User, Users, Calendar, Stethoscope } from 'lucide-react';

export default function RegisterForm({ onSubmit, loading }) {
  const [formData, setFormData] = useState({
    family_name: '',
    member_name: '',
    role: '',
    age: ''
  });
  const [existingFamilies, setExistingFamilies] = useState([]);

  // Fetch existing families for the datalist
  useEffect(() => {
    const fetchFamilies = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const response = await fetch(`${API_BASE}/families`);
        const data = await response.json();
        if (data.success && data.families) {
          setExistingFamilies(data.families);
        }
      } catch (error) {
        console.error('Failed to fetch families:', error);
      }
    };
    fetchFamilies();
  }, []);

  const roles = [
    'Father', 'Mother', 'Son', 'Daughter', 
    'Grandfather', 'Grandmother', 'Guardian', 'Other'
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.family_name && formData.member_name && formData.role) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Register Family Member</h2>
        <p className="text-gray-600 mt-2">Please fill in the details below</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Users className="w-4 h-4" />
            Family Name
          </label>
          <input
            type="text"
            name="family_name"
            list="register-families"
            value={formData.family_name}
            onChange={handleChange}
            placeholder="Enter family name or select existing"
            className="w-full p-4 border-2 border-purple-100 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
            required
          />
          <datalist id="register-families">
            {existingFamilies.map((f) => (
              <option key={f.id} value={f.family_name} />
            ))}
          </datalist>
          {existingFamilies.length > 0 && (
            <p className="text-xs text-purple-400 mt-1">
              💡 Existing families: {existingFamilies.map(f => f.family_name).join(', ')}
            </p>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <User className="w-4 h-4" />
            Member Name
          </label>
          <input
            type="text"
            name="member_name"
            value={formData.member_name}
            onChange={handleChange}
            placeholder="Enter member's name"
            className="w-full p-4 border-2 border-purple-100 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
            required
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Stethoscope className="w-4 h-4" />
            Role in Family
          </label>
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="w-full p-4 border-2 border-purple-100 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white appearance-none"
            required
          >
            <option value="">Select role</option>
            {roles.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4" />
            Age (Optional)
          </label>
          <input
            type="number"
            name="age"
            value={formData.age}
            onChange={handleChange}
            placeholder="Enter age"
            min="0"
            max="120"
            className="w-full p-4 border-2 border-purple-100 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !formData.family_name || !formData.member_name || !formData.role}
        className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 ${
          loading || !formData.family_name || !formData.member_name || !formData.role
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Processing...
          </span>
        ) : (
          'Continue to Face Registration'
        )}
      </button>
    </form>
  );
}