import { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Check, Clock, Plus, Trash2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { createMedication, deleteMedication, getMedications, logMedication } from '../services/api';

const todayIso = new Date().toISOString().slice(0, 10);

export default function MedicationTracker({ member }) {
  const [medications, setMedications] = useState([]);
  const [logs, setLogs] = useState([]);
  const [adherence, setAdherence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    dosage: '',
    frequency: 'Daily',
    times: '08:00',
    start_date: todayIso,
    end_date: '',
    notes: '',
  });

  const refresh = async () => {
    if (!member?.id) return;
    setLoading(true);
    const data = await getMedications(member.id);
    if (data.success) {
      setMedications(data.medications || []);
      setLogs(data.logs || []);
      setAdherence(data.adherence || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();

    const handleRefreshEvent = () => {
      console.log('🔄 Received refresh event, reloading medications...');
      refresh();
    };

    window.addEventListener('ami_refresh_medications', handleRefreshEvent);
    return () => window.removeEventListener('ami_refresh_medications', handleRefreshEvent);
  }, [member?.id]);

  const todaySchedule = useMemo(() => {
    const today = todayIso;
    return medications
      .filter((med) => med.start_date <= today && (!med.end_date || med.end_date >= today))
      .flatMap((med) => (med.times || []).map((time) => ({ ...med, scheduledTime: time })))
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  }, [medications]);

  const takenToday = useMemo(() => {
    const set = new Set();
    logs.forEach((log) => {
      if (log.status === 'taken' && log.taken_at?.startsWith(todayIso)) {
        set.add(log.medication_id);
      }
    });
    return set;
  }, [logs]);

  const triggeredToday = useMemo(() => {
    const set = new Set();
    logs.forEach((log) => {
      if ((log.status === 'triggered' || log.status === 'snoozed') && log.taken_at?.startsWith(todayIso)) {
        set.add(log.medication_id);
      }
    });
    return set;
  }, [logs]);

  const triggeredLocalRef = useRef(new Set());

  useEffect(() => {
    const checkReminders = () => {
      if (!member?.name) return;
      const today = new Date();
      const currentIso = today.toISOString().slice(0, 10);
      const currentHourMin = today.getHours().toString().padStart(2, '0') + ':' + today.getMinutes().toString().padStart(2, '0');

      todaySchedule.forEach((med) => {
        if (med.scheduledTime === currentHourMin) {
          const triggerKey = `${med.id}-${currentIso}-${med.scheduledTime}`;
          const isTaken = takenToday.has(med.id);

          // We also check logs to see if it was already marked as triggered or snoozed today at this time
          const alreadyLogged = logs.some(
            (log) => log.medication_id === med.id && 
                     log.taken_at?.startsWith(currentIso) && 
                     (log.status === 'triggered' || log.status === 'snoozed')
          );

          if (!triggeredLocalRef.current.has(triggerKey) && !isTaken && !alreadyLogged) {
            triggeredLocalRef.current.add(triggerKey);
            // Dynamic import or global access for voiceService to avoid circular dependency if any
            import('../services/voiceService').then((module) => {
              const voiceService = module.default;
              voiceService.speak(`Reminder: It is time to take your medication, ${med.name}, ${med.dosage}.`);
            });
            // Log as triggered
            logMedication(med.id, 'triggered', { taken_at: today.toISOString() }).then(() => {
                refresh();
            });
          }
        }
      });
    };

    const intervalId = setInterval(checkReminders, 30000);
    // run once on mount/update just in case
    checkReminders();
    return () => clearInterval(intervalId);
  }, [todaySchedule, takenToday, logs, member]);

  const handleAdd = async (event) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      member_id: member.id,
      name: form.name.trim(),
      dosage: form.dosage.trim(),
      frequency: form.frequency.trim(),
      times: form.times.split(',').map((item) => item.trim()).filter(Boolean),
      start_date: form.start_date,
      end_date: form.end_date || null,
      notes: form.notes.trim() || null,
    };
    await createMedication(payload);
    setForm({ name: '', dosage: '', frequency: 'Daily', times: '08:00', start_date: todayIso, end_date: '', notes: '' });
    setSaving(false);
    refresh();
  };

  const markTaken = async (medicationId) => {
    await logMedication(medicationId, 'taken');
    refresh();
  };

  const removeMedication = async (id) => {
    await deleteMedication(id);
    refresh();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="w-full max-w-6xl mx-auto px-5 pb-8 pt-24"
    >
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="bg-white border border-[#D6E2F0] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-black text-[#2C5F9E]">Today's Medication Schedule</h2>
              <p className="text-sm text-[#5A85B0]">{member?.name}'s active reminders</p>
            </div>
            <Clock className="text-[#4A86CF]" />
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-16 rounded-xl bg-[#EBF3FC] animate-pulse" />
              ))}
            </div>
          ) : todaySchedule.length === 0 ? (
            <div className="rounded-xl bg-[#F4F6F8] border border-[#D6E2F0] p-5 text-[#5A85B0]">
              No medications scheduled for today.
            </div>
          ) : (
            <div className="space-y-3">
              {todaySchedule.map((item) => {
                const checked = takenToday.has(item.id);
                const isTriggered = !checked && triggeredToday.has(item.id);
                
                return (
                  <div key={`${item.id}-${item.scheduledTime}`} className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${isTriggered ? 'bg-[#FFF9E6] border-[#F2C94C] ring-2 ring-[#F2C94C] shadow-md' : 'border-[#D6E2F0]'}`}>
                    <button
                      onClick={() => markTaken(item.id)}
                      disabled={checked}
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                        checked ? 'bg-[#3AAFA9] border-[#3AAFA9] text-white' : 'border-[#4A86CF] text-[#4A86CF]'
                      }`}
                      aria-label={`Mark ${item.name} as taken`}
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <div className="flex-1">
                      <div className="font-black text-[#2C5F9E]">{item.name}</div>
                      <div className="text-sm text-[#5A85B0]">{item.dosage} at {item.scheduledTime}</div>
                    </div>
                    <button onClick={() => removeMedication(item.id)} className="p-2 text-[#E8836A] hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white border border-[#D6E2F0] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Plus className="text-[#4A86CF]" />
            <h2 className="text-xl font-black text-[#2C5F9E]">Add Medication</h2>
          </div>
          <form onSubmit={handleAdd} className="space-y-3">
            <input className="w-full p-3 rounded-xl border border-[#D6E2F0]" placeholder="Medication name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="w-full p-3 rounded-xl border border-[#D6E2F0]" placeholder="Dosage" value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} required />
            <div className="grid grid-cols-2 gap-3">
              <input className="w-full p-3 rounded-xl border border-[#D6E2F0]" placeholder="Frequency" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} required />
              <input className="w-full p-3 rounded-xl border border-[#D6E2F0]" placeholder="Times: 08:00,20:00" value={form.times} onChange={(e) => setForm({ ...form, times: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" className="w-full p-3 rounded-xl border border-[#D6E2F0]" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
              <input type="date" className="w-full p-3 rounded-xl border border-[#D6E2F0]" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <textarea className="w-full p-3 rounded-xl border border-[#D6E2F0]" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="2" />
            <button disabled={saving} className="w-full py-3 rounded-xl bg-[#4A86CF] text-white font-black hover:bg-[#2C5F9E] disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Medication'}
            </button>
          </form>
        </section>
      </div>

      <section className="mt-5 bg-white border border-[#D6E2F0] rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="text-[#4A86CF]" />
          <h2 className="text-xl font-black text-[#2C5F9E]">Weekly Adherence</h2>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={adherence}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D6E2F0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Bar dataKey="adherence" fill="#4A86CF" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </motion.div>
  );
}
