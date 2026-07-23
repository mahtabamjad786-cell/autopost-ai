import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

const TONES = ['Professional', 'Islamic', 'Friendly', 'Casual', 'Persuasive'];
const LANGUAGES = ['English', 'Urdu'];

export default function Automation() {
  const { plan } = useAuth();
  const [pages, setPages] = useState([]);
  const [form, setForm] = useState({
    topic: '',
    language: 'English',
    tone: 'Professional',
    postingTimes: ['09:00'],
    activePageIds: [],
  });
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const maxTimes = Math.min(plan?.maxPostsPerDay ?? 1, 3);
  const maxPages = plan?.maxPages ?? 1;

  useEffect(() => {
    api.get('/facebook/connected').then(({ data }) => setPages(data.pages));
    api.get('/automation').then(({ data }) => {
      if (data.automation) {
        setForm({
          topic: data.automation.topic,
          language: data.automation.language,
          tone: data.automation.tone,
          postingTimes: data.automation.postingTimes,
          activePageIds: data.automation.activePageIds,
        });
        setIsActive(data.automation.isActive);
      }
    });
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function updateTime(index, value) {
    const times = [...form.postingTimes];
    times[index] = value;
    update('postingTimes', times);
  }

  function addTimeSlot() {
    if (form.postingTimes.length >= maxTimes) return;
    update('postingTimes', [...form.postingTimes, '12:00']);
  }

  function removeTimeSlot(index) {
    update('postingTimes', form.postingTimes.filter((_, i) => i !== index));
  }

  function togglePage(pageId) {
    const selected = form.activePageIds.includes(pageId);
    if (selected) {
      update('activePageIds', form.activePageIds.filter((id) => id !== pageId));
    } else {
      if (form.activePageIds.length >= maxPages) {
        setError(`Your plan allows a maximum of ${maxPages} page(s).`);
        return;
      }
      update('activePageIds', [...form.activePageIds, pageId]);
    }
  }

  async function saveConfig() {
    setError(''); setNotice(''); setSaving(true);
    try {
      await api.put('/automation', form);
      setNotice('Automation settings saved.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  async function toggleAutomation() {
    setError('');
    try {
      await saveConfig();
      const { data } = await api.post(isActive ? '/automation/stop' : '/automation/start');
      setIsActive(data.automation.isActive);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update automation status');
    }
  }

  return (
    <Layout>
      <h1>Automation Setup</h1>
      <p className="subtitle">Set your topic once — AI generates fresh posts every day, automatically.</p>

      {error && <div className="card error">{error}</div>}
      {notice && <div className="card success-msg">{notice}</div>}

      <div className="card">
        <h2>Content Settings</h2>
        <label>Main topic (e.g. Solar Panels)</label>
        <input value={form.topic} onChange={(e) => update('topic', e.target.value)} placeholder="Solar Panels" />

        <div className="grid grid-2">
          <div>
            <label>Language</label>
            <select value={form.language} onChange={(e) => update('language', e.target.value)}>
              {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label>Tone</label>
            <select value={form.tone} onChange={(e) => update('tone', e.target.value)}>
              {TONES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <label>Posting times (max {maxTimes} daily on your plan)</label>
        {form.postingTimes.map((t, i) => (
          <div key={i} className="time-row">
            <input type="time" value={t} onChange={(e) => updateTime(i, e.target.value)} style={{ maxWidth: 140 }} />
            <button className="btn secondary" onClick={() => removeTimeSlot(i)}>Remove</button>
          </div>
        ))}
        {form.postingTimes.length < maxTimes && (
          <button className="btn secondary" onClick={addTimeSlot}>+ Add posting time</button>
        )}

        <label style={{ marginTop: 20 }}>Publish to Facebook Page(s)</label>
        {pages.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No pages connected — go to "Connect Facebook" first.</p>
        ) : (
          pages.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={form.activePageIds.includes(p.id)}
                onChange={() => togglePage(p.id)}
              />
              <span>{p.pageName}</span>
            </div>
          ))
        )}

        <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
          <button className="btn secondary" onClick={saveConfig} disabled={saving}>Save Settings</button>
          <button className={`btn ${isActive ? 'danger' : 'success'}`} onClick={toggleAutomation}>
            {isActive ? 'Stop Automation' : 'Start Automation'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
