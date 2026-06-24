// frontend/src/components/FamilyRegistrationForm.jsx
import { useState, useEffect } from 'react';
import { UserPlus, Trash2, Save, Users } from 'lucide-react';

export default function FamilyRegistrationForm({ onSubmit, onCancel }) {
  const [familyName, setFamilyName] = useState('');
  const [members, setMembers] = useState([{ name: '', role: '', age: '' }]);
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

  const addMember = () => {
    setMembers([...members, { name: '', role: '', age: '' }]);
  };

  const removeMember = (index) => {
    if (members.length > 1) {
      const newMembers = [...members];
      newMembers.splice(index, 1);
      setMembers(newMembers);
    }
  };

  const updateMember = (index, field, value) => {
    const newMembers = [...members];
    newMembers[index][field] = value;
    setMembers(newMembers);
  };

  const handleSubmit = () => {
    if (!familyName.trim()) {
      alert('Please enter family name');
      return;
    }

    const validMembers = members.filter(m => m.name.trim() !== '');
    if (validMembers.length === 0) {
      alert('Please add at least one family member');
      return;
    }

    onSubmit({
      family_name: familyName,
      members: validMembers
    });
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    background: '#FFFFFF',
    border: '1.5px solid #D6E2F0',
    borderRadius: 12,
    color: '#2C5F9E',
    fontSize: '0.95rem',
    fontFamily: "'Nunito', sans-serif",
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  const labelStyle = {
    display: 'block',
    color: '#4A86CF',
    fontWeight: 700,
    fontSize: '0.85rem',
    marginBottom: 6,
    letterSpacing: '0.02em',
  };

  return (
    <div style={{
      maxWidth: 820,
      margin: '0 auto',
      padding: 36,
      background: '#FFFFFF',
      borderRadius: 24,
      border: '1.5px solid #D6E2F0',
      boxShadow: '0 8px 44px rgba(74,134,207,0.11)',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'linear-gradient(135deg, #4A86CF, #82ACE0)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <Users style={{ width: 30, height: 30, color: '#FFFFFF' }} />
        </div>
        <h2 style={{ color: '#2C5F9E', fontWeight: 800, fontSize: '1.6rem', margin: 0 }}>
          Register New Family
        </h2>
        <p style={{ color: '#7A9DBF', fontSize: '0.95rem', marginTop: 8 }}>
          Set up your family profile to get started with A.M.I.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Family Name */}
        <div>
          <label style={labelStyle}>Family Name</label>
          <input
            type="text"
            list="existing-families"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            style={inputStyle}
            placeholder="Enter family name or select existing (e.g., Sharma)"
            onFocus={(e) => { e.target.style.borderColor = '#4A86CF'; e.target.style.boxShadow = '0 0 0 3px rgba(74,134,207,0.15)'; }}
            onBlur={(e) => { e.target.style.borderColor = '#D6E2F0'; e.target.style.boxShadow = 'none'; }}
          />
          <datalist id="existing-families">
            {existingFamilies.map((f) => (
              <option key={f.id} value={f.family_name} />
            ))}
          </datalist>
          {existingFamilies.length > 0 && (
            <p style={{ color: '#82ACE0', fontSize: '0.78rem', marginTop: 4 }}>
              💡 Existing families: {existingFamilies.map(f => f.family_name).join(', ')}
            </p>
          )}
        </div>

        {/* Members */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ color: '#2C5F9E', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>Family Members</h3>
            <button
              onClick={addMember}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 10,
                background: 'linear-gradient(135deg, #4A86CF, #82ACE0)',
                color: '#FFFFFF', fontWeight: 700, fontSize: '0.85rem',
                border: 'none', cursor: 'pointer',
                fontFamily: "'Nunito', sans-serif",
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 4px 12px rgba(74,134,207,0.3)'; }}
              onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = 'none'; }}
            >
              <UserPlus style={{ width: 16, height: 16 }} />
              Add Member
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {members.map((member, index) => (
              <div key={index} style={{
                padding: 20, borderRadius: 16,
                background: '#F4F6F8',
                border: '1.5px solid #D6E2F0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h4 style={{ color: '#4A86CF', fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>
                    Member {index + 1}
                  </h4>
                  {members.length > 1 && (
                    <button
                      onClick={() => removeMember(index)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#E8836A', padding: 4, borderRadius: 6,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => e.target.style.background = 'rgba(232,131,106,0.1)'}
                      onMouseLeave={(e) => e.target.style.background = 'none'}
                    >
                      <Trash2 style={{ width: 16, height: 16 }} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Name</label>
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => updateMember(index, 'name', e.target.value)}
                      style={inputStyle}
                      placeholder="Full name"
                      onFocus={(e) => { e.target.style.borderColor = '#4A86CF'; e.target.style.boxShadow = '0 0 0 3px rgba(74,134,207,0.15)'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#D6E2F0'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Role</label>
                    <select
                      value={member.role}
                      onChange={(e) => updateMember(index, 'role', e.target.value)}
                      style={{ ...inputStyle, appearance: 'auto' }}
                      onFocus={(e) => { e.target.style.borderColor = '#4A86CF'; e.target.style.boxShadow = '0 0 0 3px rgba(74,134,207,0.15)'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#D6E2F0'; e.target.style.boxShadow = 'none'; }}
                    >
                      <option value="">Select Role</option>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Son">Son</option>
                      <option value="Daughter">Daughter</option>
                      <option value="Grandfather">Grandfather</option>
                      <option value="Grandmother">Grandmother</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Age</label>
                    <input
                      type="number"
                      value={member.age}
                      onChange={(e) => updateMember(index, 'age', e.target.value)}
                      style={inputStyle}
                      placeholder="Age"
                      min="0"
                      max="120"
                      onFocus={(e) => { e.target.style.borderColor = '#4A86CF'; e.target.style.boxShadow = '0 0 0 3px rgba(74,134,207,0.15)'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#D6E2F0'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 12,
          paddingTop: 24, borderTop: '1.5px solid #D6E2F0',
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '12px 24px', borderRadius: 12,
              border: '1.5px solid #D6E2F0', background: '#FFFFFF',
              color: '#4A86CF', fontWeight: 700, fontSize: '0.9rem',
              cursor: 'pointer', fontFamily: "'Nunito', sans-serif",
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => e.target.style.background = '#F4F6F8'}
            onMouseLeave={(e) => e.target.style.background = '#FFFFFF'}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 28px', borderRadius: 12,
              background: 'linear-gradient(135deg, #3AAFA9, #2D8F8A)',
              color: '#FFFFFF', fontWeight: 700, fontSize: '0.9rem',
              border: 'none', cursor: 'pointer',
              fontFamily: "'Nunito', sans-serif",
              boxShadow: '0 4px 16px rgba(58,175,169,0.3)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 6px 20px rgba(58,175,169,0.4)'; }}
            onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 16px rgba(58,175,169,0.3)'; }}
          >
            <Save style={{ width: 18, height: 18 }} />
            Register Family
          </button>
        </div>
      </div>
    </div>
  );
}