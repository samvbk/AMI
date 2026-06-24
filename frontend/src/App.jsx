// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import { Users, Shield, Sparkles, Mic, Home, UserPlus, ArrowRight, Heart, Clock } from 'lucide-react';
import CameraComponent from './components/Camera';
import RegisterForm from './components/RegisterForm';
import AlwaysOnAssistant from './components/AlwaysOnAssistant';
import VideoCharacter from './components/VideoCharacter';
import FamilyRegistrationForm from './components/FamilyRegistrationForm';
import { recognizeFace, registerMember, loginOverride } from './services/api';
import './App.css';

/* ─── Global styles + keyframes injected once ─── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Lora:ital,wght@0,600;1,500&display=swap');

  :root {
    --blue:   #4A86CF;
    --light:  #82ACE0;
    --soft:   #D6E2F0;
    --offwht: #F4F6F8;
    --white:  #FFFFFF;
    --teal:   #3AAFA9;
    --coral:  #E8836A;
    --amber:  #F5C06A;
    --sage:   #7EC8A4;
  }

  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Nunito', sans-serif; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-10px); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgba(74,134,207,0.5); }
    70%  { box-shadow: 0 0 0 10px rgba(74,134,207,0); }
    100% { box-shadow: 0 0 0 0 rgba(74,134,207,0); }
  }
  @keyframes orb-drift {
    0%,100% { transform: translate(0,0) scale(1); }
    33%      { transform: translate(30px,-20px) scale(1.05); }
    66%      { transform: translate(-20px,15px) scale(0.97); }
  }
  @keyframes card-idle {
    0%,100% { transform: translateY(0) rotate(0deg); }
    25%      { transform: translateY(-4px) rotate(0.4deg); }
    75%      { transform: translateY(3px) rotate(-0.4deg); }
  }
  @keyframes badge-bounce {
    0%,100% { transform: scale(1); }
    50%      { transform: scale(1.08); }
  }
  @keyframes step-glow {
    0%,100% { box-shadow: 0 0 0 0 rgba(74,134,207,0.3); }
    50%      { box-shadow: 0 0 0 12px rgba(74,134,207,0); }
  }
  @keyframes dot-pulse {
    0%,100% { transform: scale(1); opacity: 1; }
    50%      { transform: scale(1.4); opacity: 0.6; }
  }

  .card-hover {
    transition: transform 0.25s ease, box-shadow 0.25s ease !important;
  }
  .card-hover:hover {
    transform: translateY(-7px) scale(1.02) !important;
    box-shadow: 0 22px 52px rgba(74,134,207,0.16) !important;
  }
`;

/* ─── Floating background orbs ─── */
function FloatingOrbs() {
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <div style={{ position:'absolute', width:500, height:500, background:'radial-gradient(circle, rgba(130,172,224,0.18) 0%, transparent 70%)', top:'-120px', left:'-100px', animation:'orb-drift 14s ease-in-out infinite' }} />
      <div style={{ position:'absolute', width:380, height:380, background:'radial-gradient(circle, rgba(214,226,240,0.25) 0%, transparent 70%)', bottom:'60px', right:'-80px', animation:'orb-drift 17s ease-in-out infinite reverse' }} />
      <div style={{ position:'absolute', width:300, height:300, background:'radial-gradient(circle, rgba(74,134,207,0.1) 0%, transparent 70%)', top:'45%', left:'58%', animation:'orb-drift 20s ease-in-out infinite 4s' }} />
    </div>
  );
}

function App() {
  const [mode, setMode] = useState('landing');
  const [showCamera, setShowCamera] = useState(false);
  const [member, setMember] = useState(null);
  const [registrationData, setRegistrationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [familyData, setFamilyData] = useState(null);
  const [topMatches, setTopMatches] = useState([]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setMember(null);
      setMode('landing');
      setMessage('Session expired. Please log in again.');
    };
    window.addEventListener('ami_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('ami_unauthorized', handleUnauthorized);
  }, []);

  const handleExistingMember = () => { setMode('recognize'); setShowCamera(true); setMessage(''); setTopMatches([]); };
  const handleNewFamily      = () => setMode('register-family');

  const handleFaceRecognition = async (imageBase64) => {
    setLoading(true); setMessage(''); setTopMatches([]);
    try {
      const result = await recognizeFace(imageBase64);
      if (result.success && result.recognized) {
        setMember(result.member); setMode('assistant');
        setMessage(`Welcome back, ${result.member.name}! Assistant is activating...`);
      } else {
        setMessage(result.message || 'Face not recognized. Please register.');
        if (result.top_matches && result.top_matches.length > 0) {
          setTopMatches(result.top_matches);
        } else {
          if (mode === 'recognize') setMode('register-member');
        }
      }
    } catch(e) { setMessage('❌ Error recognizing face. Please try again.'); }
    finally { setLoading(false); setShowCamera(false); }
  };

  const handleRegistrationSubmit = (data) => {
    if (!data?.family_name || !data?.member_name || !data?.role) { setMessage('❌ Please fill in all required fields'); return; }
    setRegistrationData(data); setShowCamera(true);
  };

  const handleRegistrationCapture = async (imageBase64) => {
    setLoading(true); setMessage('');
    try {
      if (!registrationData) throw new Error('Registration data is missing');
      const result = await registerMember(registrationData, imageBase64);
      if (result.success) {
        setMember({ id:result.member_id, name:registrationData.member_name, role:registrationData.role, family_name:registrationData.family_name });
        setMode('assistant'); setMessage(`✅ Welcome, ${registrationData.member_name}! Assistant is activating...`);
      } else { setMessage(`❌ ${result.message || 'Registration failed.'}`); }
    } catch(e) { setMessage(`❌ Error: ${e.message}`); }
    finally { setLoading(false); setShowCamera(false); setRegistrationData(null); }
  };

  const handleFamilyRegistrationSubmit = async (fd) => {
    setLoading(true); setMessage('');
    try {
      if (fd.members?.length > 0) {
        const fm = fd.members[0];
        setMember({ id:1, name:fm.name, role:fm.role, family_name:fd.family_name });
        setMode('assistant'); setMessage(`✅ Welcome ${fm.name}! Your family "${fd.family_name}" has been registered.`);
      }
    } catch(e) { setMessage(`❌ Error: ${e.message}`); }
    finally { setLoading(false); }
  };

  const handleLogout       = () => { setMember(null); setMode('landing'); setMessage(''); setRegistrationData(null); setFamilyData(null); setTopMatches([]); };
  const handleBackToLanding = () => { setMode('landing'); setMessage(''); setRegistrationData(null); setTopMatches([]); };

  const handleManualLogin = async (memberId) => {
    setLoading(true);
    try {
      const result = await loginOverride(memberId);
      if (result.success) {
        setMember(result.member);
        setMode('assistant');
      } else {
        setMessage('❌ Login bypass failed.');
      }
    } catch(e) {
      setMessage('❌ Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'assistant' && member) return <AlwaysOnAssistant member={member} onLogout={handleLogout} />;

  /* ══════════════════════════════════════════════════
     LANDING PAGE
  ══════════════════════════════════════════════════ */
  if (mode === 'landing') {

    const loginCards = [
      {
        icon: <Users className="w-8 h-8" />,
        title: 'Existing Family Member',
        desc: "I'm already registered in the family",
        cta: 'Face Recognition Login',
        accent: '#4A86CF',
        iconBg: 'rgba(74,134,207,0.1)',
        cardBg: 'linear-gradient(145deg, #FFFFFF 0%, #EBF3FC 100%)',
        border: 'rgba(74,134,207,0.2)',
        onClick: handleExistingMember,
        delay: '0.3s', idleDelay: '1s',
      },
      {
        icon: <Home className="w-8 h-8" />,
        title: 'Register New Family',
        desc: "We're new here. Set up our family profile",
        cta: 'Create Family Profile',
        accent: '#3AAFA9',
        iconBg: 'rgba(58,175,169,0.1)',
        cardBg: 'linear-gradient(145deg, #FFFFFF 0%, #E5F5F4 100%)',
        border: 'rgba(58,175,169,0.2)',
        onClick: () => { setMode('register'); setMessage(''); },
        delay: '0.45s', idleDelay: '2.2s',
      },
      {
        icon: <UserPlus className="w-8 h-8" />,
        title: 'Add Family Member',
        desc: 'Add a new member to an existing family',
        cta: 'Register New Member',
        accent: '#E8836A',
        iconBg: 'rgba(232,131,106,0.1)',
        cardBg: 'linear-gradient(145deg, #FFFFFF 0%, #FDEEE9 100%)',
        border: 'rgba(232,131,106,0.2)',
        onClick: () => { setMode('register'); setMessage(''); },
        delay: '0.6s', idleDelay: '3.4s',
      },
    ];

    const features = [
      { icon:<Shield className="w-6 h-6"/>,   title:'Secure & Private',      desc:'Face recognition ensures only family members access personal health data.',    color:'#4A86CF', bg:'rgba(74,134,207,0.08)'   },
      { icon:<Sparkles className="w-6 h-6"/>,  title:'AI-Powered Insights',   desc:'Personalized recommendations and symptom analysis, powered by smart AI.',      color:'#3AAFA9', bg:'rgba(58,175,169,0.08)'   },
      { icon:<Mic className="w-6 h-6"/>,       title:'Voice Interaction',     desc:'Speak naturally for hands-free queries, reminders, and wellness check-ins.',    color:'#E8836A', bg:'rgba(232,131,106,0.08)'  },
      { icon:<Users className="w-6 h-6"/>,     title:'Whole Family Coverage', desc:'Manage profiles for every member — from toddlers to grandparents.',            color:'#7EC8A4', bg:'rgba(126,200,164,0.08)'  },
      { icon:<Clock className="w-6 h-6"/>,     title:'24 / 7 Availability',   desc:'Instant guidance any time of day or night, right from home.',                  color:'#F5C06A', bg:'rgba(245,192,106,0.08)'  },
      { icon:<Heart className="w-6 h-6"/>,     title:'Compassionate Care',    desc:'A.M.I. listens, remembers, and responds with warmth every single time.',       color:'#E8836A', bg:'rgba(232,131,106,0.08)'  },
    ];

    return (
      <>
        <style>{STYLES}</style>

        {/* Page wrapper — scrollable, single seamless gradient */}
        <div style={{ background: 'linear-gradient(180deg, #C2D8F0 0%, #BACED8 18%, #D6E2F0 38%, #EBF3FC 55%, #D6E2F0 72%, #9BBDE0 88%, #2C5F9E 100%)', minHeight: '100vh', position: 'relative', overflowX: 'hidden' }}>          <FloatingOrbs />

          {showCamera && <CameraComponent onCapture={handleFaceRecognition} onClose={() => setShowCamera(false)} mode="recognize" />}

          {/* ─── HERO ─── */}
          <section style={{ position:'relative', zIndex:1, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'48px 24px' }}>
            <div style={{ maxWidth:920, width:'100%', textAlign:'center' }}>

              {/* Live badge */}
              <div style={{ animation:'fadeUp 0.6s ease 0.05s both', display:'inline-flex', alignItems:'center', gap:8, background:'#FFFFFF', border:'1.5px solid #D6E2F0', borderRadius:40, padding:'8px 22px', marginBottom:36, boxShadow:'0 2px 16px rgba(74,134,207,0.1)' }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:'#4A86CF', display:'inline-block', animation:'dot-pulse 2s ease-in-out infinite' }} />
                <span style={{ color:'#4A86CF', fontWeight:800, fontSize:12, letterSpacing:'0.07em', textTransform:'uppercase' }}>Family Healthcare Assistant</span>
              </div>

              {/* Headline */}
              <h1 style={{ animation:'fadeUp 0.7s ease 0.15s both', fontFamily:"'Lora', serif", fontSize:'clamp(2.2rem,6vw,3.8rem)', fontWeight:600, color:'#2C5F9E', marginBottom:18, lineHeight:1.2 }}>
                Welcome to{' '}
                <span style={{ background:'linear-gradient(90deg, #4A86CF 0%, #82ACE0 50%, #4A86CF 100%)', backgroundSize:'200% auto', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', animation:'shimmer 3s linear infinite' }}>
                  A.M.I.
                </span>
              </h1>

              <p style={{ animation:'fadeUp 0.7s ease 0.25s both', fontSize:'1.1rem', color:'#5A85B0', maxWidth:520, margin:'0 auto 52px', lineHeight:1.75 }}>
                Your family's 24/7 <strong style={{ color:'#4A86CF' }}>Artificial Medical Intelligence</strong> companion — always listening, always caring.
              </p>

              {/* Login cards */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px,1fr))', gap:20, marginBottom:52 }}>
                {loginCards.map((c,i) => (
                  <button
                    key={i}
                    onClick={c.onClick}
                    className="card-hover"
                    style={{
                      animation:`fadeUp 0.7s ease ${c.delay} both, card-idle 6s ease-in-out ${c.idleDelay} infinite`,
                      background: c.cardBg,
                      border: `1.5px solid ${c.border}`,
                      borderRadius: 22,
                      padding: '32px 24px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: '0 4px 20px rgba(74,134,207,0.07)',
                    }}
                  >
                    <div style={{ width:56, height:56, borderRadius:14, background:c.iconBg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20, color:c.accent, animation:`badge-bounce ${4+i*0.5}s ease-in-out ${i*0.7}s infinite` }}>
                      {c.icon}
                    </div>
                    <h3 style={{ color:'#2C5F9E', fontWeight:800, fontSize:'1.05rem', marginBottom:8 }}>{c.title}</h3>
                    <p style={{ color:'#7A9DBF', fontSize:'0.88rem', marginBottom:22, lineHeight:1.65 }}>{c.desc}</p>
                    <div style={{ display:'flex', alignItems:'center', gap:6, color:c.accent, fontWeight:800, fontSize:'0.87rem' }}>
                      {c.cta} <ArrowRight style={{ width:15, height:15 }} />
                    </div>
                  </button>
                ))}
              </div>

              {/* AMI character */}
              <div style={{ animation:'fadeUp 0.7s ease 0.75s both', maxWidth:340, margin:'0 auto 28px' }}>
                <h3 style={{ color:'#2C5F9E', fontWeight:800, fontSize:'1.1rem', marginBottom:6 }}>Meet A.M.I.</h3>
                <p style={{ color:'#7A9DBF', fontSize:'0.9rem', marginBottom:16 }}>Your video-based healthcare companion</p>
                <div ref={el => { if (el) { const v = el.querySelector('video'); if (v) { v.muted = true; v.play().catch(()=>{}); } } }}>
                  <VideoCharacter state="idle" autoPlay muted />
                </div>
              </div>

              {message && (
                <div style={{ maxWidth:480, margin:'0 auto', padding:'14px 22px', borderRadius:14, background:'#FFFFFF', border:'1px solid #D6E2F0', color:'#4A86CF', fontWeight:700, boxShadow:'0 2px 14px rgba(74,134,207,0.1)', fontSize:'0.92rem', marginBottom: '20px' }}>
                  {message}
                </div>
              )}

              {topMatches && topMatches.length > 0 && (
                <div style={{ maxWidth:480, margin:'0 auto 20px', padding:'20px', borderRadius:14, background:'#FFFFFF', border:'1px solid #D6E2F0', boxShadow:'0 2px 14px rgba(74,134,207,0.1)' }}>
                  <h3 style={{ color:'#2C5F9E', fontWeight:800, fontSize:'1.05rem', marginBottom:12 }}>Did you mean one of these?</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {topMatches.map((match) => (
                      <button
                        key={match.member_id}
                        onClick={() => handleManualLogin(match.member_id)}
                        className="card-hover"
                        style={{
                          background: '#EBF3FC',
                          border: '1px solid #D6E2F0',
                          borderRadius: 12,
                          padding: '12px 16px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          color: '#2C5F9E',
                          fontWeight: 700
                        }}
                      >
                        <span>{match.name} {match.family_name ? `(${match.family_name})` : ''}</span>
                        <span style={{ fontSize: '0.8rem', color: '#7A9DBF' }}>{Math.round(match.confidence * 100)}% match</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Scroll cue */}
              <div style={{ marginTop:40, color:'#82ACE0', fontSize:'0.85rem', animation:'fadeUp 0.7s ease 1s both' }}>
                <div style={{ animation:'float 2.2s ease-in-out infinite', display:'inline-block', fontSize:'1.3rem' }}>↓</div>
                <p style={{ margin:'4px 0 0', letterSpacing:'0.04em' }}>Scroll to discover more</p>
              </div>
            </div>
          </section>

          {/* ─── FEATURES ─── */}
          <section style={{ position:'relative', zIndex:1, padding:'88px 24px', background:'transparent' }}>

            <div style={{ maxWidth:1020, margin:'0 auto' }}>
              <div style={{ textAlign:'center', marginBottom:58 }}>
                <span style={{ display:'inline-block', background:'rgba(74,134,207,0.08)', color:'#4A86CF', fontWeight:800, fontSize:11, letterSpacing:'0.09em', textTransform:'uppercase', padding:'5px 14px', borderRadius:20, marginBottom:18, border:'1px solid rgba(74,134,207,0.15)' }}>Why A.M.I.</span>
                <h2 style={{ fontFamily:"'Lora', serif", fontSize:'clamp(1.8rem,4vw,2.5rem)', color:'#2C5F9E', marginBottom:12, fontWeight:600 }}>Why Families Choose A.M.I.</h2>
                <p style={{ color:'#7A9DBF', maxWidth:480, margin:'0 auto', lineHeight:1.7 }}>Intelligent healthcare support built around every member of your family</p>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(285px,1fr))', gap:22 }}>
                {features.map((f,i) => (
                  <div
                    key={i}
                    className="card-hover"
                    style={{
                      background:'rgba(235,243,252,0.82)',
                      borderRadius:20,
                      padding:'28px 26px',
                      border:'1.5px solid rgba(130,172,224,0.3)',
                      backdropFilter:'blur(10px)',
                      animation:`card-idle ${5.5+i*0.6}s ease-in-out ${i*0.5}s infinite`,
                    }}
                  >
                    <div style={{ width:48, height:48, borderRadius:13, background:f.bg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16, color:f.color, animation:`badge-bounce ${3.5+i*0.4}s ease-in-out ${i*0.6}s infinite` }}>
                      {f.icon}
                    </div>
                    <h4 style={{ color:'#2C5F9E', fontWeight:800, fontSize:'0.98rem', marginBottom:8 }}>{f.title}</h4>
                    <p style={{ color:'#7A9DBF', fontSize:'0.87rem', lineHeight:1.72 }}>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── HOW IT WORKS ─── */}
          <section style={{ position:'relative', zIndex:1, padding:'88px 24px', background:'transparent' }}>
            <div style={{ maxWidth:860, margin:'0 auto', textAlign:'center' }}>
              <span style={{ display:'inline-block', background:'rgba(74,134,207,0.08)', color:'#4A86CF', fontWeight:800, fontSize:11, letterSpacing:'0.09em', textTransform:'uppercase', padding:'5px 14px', borderRadius:20, marginBottom:18, border:'1px solid rgba(74,134,207,0.15)' }}>Simple Setup</span>
              <h2 style={{ fontFamily:"'Lora', serif", fontSize:'clamp(1.8rem,4vw,2.5rem)', color:'#2C5F9E', marginBottom:12, fontWeight:600 }}>How It Works</h2>
              <p style={{ color:'#7A9DBF', marginBottom:60 }}>Getting started takes less than 5 minutes</p>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px,1fr))', gap:24 }}>
                {[
                  { step:'01', title:'Register Your Family',  desc:'Create a family profile and add each member with a quick face scan. Takes under 2 minutes.', color:'#4A86CF', rgb:'74,134,207',   icon:'👨‍👩‍👧‍👦' },
                  { step:'02', title:'Log In Instantly',       desc:'Returning users simply look at the camera — A.M.I. recognises you automatically, every time.', color:'#3AAFA9', rgb:'58,175,169',   icon:'🔓' },
                  { step:'03', title:'Get Health Support',     desc:'Ask A.M.I. anything about health, medications, symptoms, or wellness goals — day or night.', color:'#E8836A', rgb:'232,131,106', icon:'💬' },
                ].map((s,i) => (
                  <div
                    key={i}
                    className="card-hover"
                    style={{
                      background:`linear-gradient(145deg, rgba(255,255,255,0.72) 0%, rgba(${s.rgb},0.1) 100%)`,
                      border:`1.5px solid rgba(${s.rgb},0.3)`,
                      borderRadius:22,
                      padding:'32px 26px',
                      backdropFilter:'blur(10px)',
                      boxShadow:`0 4px 24px rgba(${s.rgb},0.1)`,
                      animation:`card-idle ${7+i}s ease-in-out ${i*1}s infinite`,
                      textAlign:'left',
                    }}
                  >
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                      <div style={{ width:52, height:52, borderRadius:'50%', background:`rgba(${s.rgb},0.12)`, border:`2.5px solid ${s.color}`, display:'flex', alignItems:'center', justifyContent:'center', color:s.color, fontWeight:900, fontSize:'1rem', fontFamily:"'Nunito',sans-serif", animation:`step-glow 3s ease-in-out ${i*1.2}s infinite`, flexShrink:0 }}>
                        {s.step}
                      </div>
                      <span style={{ fontSize:'2rem', lineHeight:1 }}>{s.icon}</span>
                    </div>
                    <h4 style={{ color:'#2C5F9E', fontWeight:800, fontSize:'1.05rem', marginBottom:10 }}>{s.title}</h4>
                    <p style={{ color:'#5A85B0', fontSize:'0.88rem', lineHeight:1.72, margin:0 }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── FOOTER ─── */}
          <footer style={{ background:'transparent', position:'relative', zIndex:1 }}>

            <div style={{ maxWidth:1020, margin:'0 auto', padding:'60px 24px 36px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:44, marginBottom:52 }}>

                {/* Brand */}
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
                    <div style={{ width:42, height:42, borderRadius:11, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', animation:'pulse-ring 3s ease-in-out infinite' }}>
                      <Shield style={{ width:20, height:20, color:'#D6E2F0' }} />
                    </div>
                    <span style={{ fontFamily:"'Lora', serif", fontSize:'1.3rem', fontWeight:600, color:'#FFFFFF' }}>A.M.I.</span>
                  </div>
                  <p style={{ color:'rgba(214,226,240,0.82)', fontSize:'0.88rem', lineHeight:1.85 }}>
                    Artificial Medical Intelligence — trusted, personalised health support for families, around the clock.
                  </p>
                </div>

                {/* Contact */}
                <div>
                  <h5 style={{ color:'#D6E2F0', fontWeight:800, fontSize:'0.75rem', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:18 }}>Contact Us</h5>
                  <ul style={{ listStyle:'none', padding:0, margin:0 }}>
                    {['📧  support@ami-health.com','📞  +91 (800) 264-7890','🕐  Available 24 / 7'].map((t,i)=>(
                      <li key={i} style={{ color:'rgba(214,226,240,0.78)', fontSize:'0.88rem', marginBottom:11 }}>{t}</li>
                    ))}
                  </ul>
                </div>

                {/* Address */}
                <div>
                  <h5 style={{ color:'#D6E2F0', fontWeight:800, fontSize:'0.75rem', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:18 }}>Our Address</h5>
                  <address style={{ fontStyle:'normal', color:'rgba(214,226,240,0.78)', fontSize:'0.88rem', lineHeight:1.9 }}>
                    A.M.I. Healthcare Technologies<br />
                    Suite 400, 1200 Health Sciences Blvd<br />
                    Pune, Maharashtra 411001<br />
                    India
                  </address>
                </div>
              </div>

              {/* Bottom bar */}
              <div style={{ borderTop:'1px solid rgba(255,255,255,0.15)', paddingTop:26, display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                <p style={{ color:'rgba(214,226,240,0.55)', fontSize:'0.82rem', margin:0 }}>
                  © {new Date().getFullYear()} A.M.I. Healthcare Technologies, Inc. All rights reserved.
                </p>
                <div style={{ display:'flex', gap:22 }}>
                  {['Privacy Policy','Terms of Service','HIPAA Compliance'].map(l=>(
                    <a key={l} href="#" style={{ color:'rgba(214,226,240,0.55)', fontSize:'0.82rem', textDecoration:'none', transition:'color 0.2s' }}
                       onMouseEnter={e=>e.target.style.color='#FFFFFF'} onMouseLeave={e=>e.target.style.color='rgba(214,226,240,0.55)'}>{l}</a>
                  ))}
                </div>
              </div>
            </div>
          </footer>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════════════════════
     FAMILY REGISTRATION PAGE
  ══════════════════════════════════════════════════ */
  if (mode === 'register-family') {
    return (
      <>
        <style>{STYLES}</style>
        <div style={{ minHeight:'100vh', background:'linear-gradient(160deg, #EBF3FC 0%, #D6E2F0 60%, #F4F6F8 100%)', padding:'32px 24px', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ maxWidth:960, width:'100%' }}>
            <button onClick={handleBackToLanding} style={{ display:'flex', alignItems:'center', gap:8, background:'#FFFFFF', border:'1.5px solid #D6E2F0', borderRadius:10, padding:'8px 18px', cursor:'pointer', color:'#4A86CF', fontWeight:800, marginBottom:28, boxShadow:'0 2px 12px rgba(74,134,207,0.09)', fontFamily:"'Nunito',sans-serif", fontSize:'0.9rem' }}>
              <ArrowRight style={{ width:16, height:16, transform:'rotate(180deg)' }} /> Back to Home
            </button>
            <FamilyRegistrationForm onSubmit={handleFamilyRegistrationSubmit} onCancel={handleBackToLanding} />
            {loading && <div style={{ textAlign:'center', marginTop:24, color:'#4A86CF', fontWeight:700 }}>Registering family…</div>}
            {message && <div style={{ maxWidth:480, margin:'20px auto 0', padding:'14px 22px', borderRadius:14, background:'#FFFFFF', border:'1px solid #D6E2F0', color:'#4A86CF', fontWeight:700, textAlign:'center', boxShadow:'0 2px 14px rgba(74,134,207,0.1)' }}>{message}</div>}
          </div>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════════════════════
     INDIVIDUAL REGISTRATION PAGE
  ══════════════════════════════════════════════════ */
  return (
    <>
      <style>{STYLES}</style>
      <div style={{ minHeight:'100vh', background:'linear-gradient(160deg, #EBF3FC 0%, #D6E2F0 60%, #F4F6F8 100%)', padding:'32px 24px' }}>
        {showCamera && <CameraComponent onCapture={mode==='recognize'?handleFaceRecognition:handleRegistrationCapture} onClose={()=>setShowCamera(false)} mode={mode} />}

        {(mode==='register'||mode==='register-member') && (
          <button onClick={handleBackToLanding} style={{ display:'flex', alignItems:'center', gap:8, background:'#FFFFFF', border:'1.5px solid #D6E2F0', borderRadius:10, padding:'8px 18px', cursor:'pointer', color:'#4A86CF', fontWeight:800, marginBottom:28, boxShadow:'0 2px 12px rgba(74,134,207,0.09)', fontFamily:"'Nunito',sans-serif", fontSize:'0.9rem' }}>
            <ArrowRight style={{ width:16, height:16, transform:'rotate(180deg)' }} /> Back to Home
          </button>
        )}

        <div style={{ maxWidth:960, margin:'0 auto' }}>
          {(mode==='register'||mode==='register-member') && (
            <div style={{ textAlign:'center', paddingTop:32, marginBottom:40, animation:'fadeUp 0.7s ease both' }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#FFFFFF', border:'1.5px solid #D6E2F0', borderRadius:40, padding:'8px 22px', marginBottom:26, boxShadow:'0 2px 14px rgba(74,134,207,0.1)' }}>
                <UserPlus style={{ width:16, height:16, color:'#4A86CF' }} />
                <span style={{ color:'#4A86CF', fontWeight:800, fontSize:12, letterSpacing:'0.06em', textTransform:'uppercase' }}>{mode==='register-member'?'Register New Family Member':'Register New User'}</span>
              </div>
              <h1 style={{ fontFamily:"'Lora',serif", fontSize:'clamp(1.8rem,4vw,2.5rem)', color:'#2C5F9E', marginBottom:12, fontWeight:600 }}>
                Register as a <span style={{ color:'#4A86CF' }}>Family Member</span>
              </h1>
              <p style={{ color:'#7A9DBF', fontSize:'1rem' }}>Fill in your details to register with A.M.I.</p>
            </div>
          )}

          {(mode==='register'||mode==='register-member') && !showCamera && (
            <div style={{ maxWidth:560, margin:'0 auto', background:'#FFFFFF', borderRadius:24, padding:36, border:'1.5px solid #D6E2F0', boxShadow:'0 8px 44px rgba(74,134,207,0.11)', animation:'fadeUp 0.7s ease 0.1s both' }}>
              <RegisterForm onSubmit={handleRegistrationSubmit} loading={loading} isFamilyMember={mode==='register-member'} />
            </div>
          )}

          {message && <div style={{ maxWidth:480, margin:'24px auto 0', padding:'14px 22px', borderRadius:14, background:'#FFFFFF', border:'1px solid #D6E2F0', color:'#4A86CF', fontWeight:700, textAlign:'center', boxShadow:'0 2px 14px rgba(74,134,207,0.1)' }}>{message}</div>}
          {loading && <div style={{ textAlign:'center', marginTop:24, color:'#4A86CF', fontWeight:700 }}>Processing…</div>}
        </div>
      </div>
    </>
  );
}

export default App;