import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Layout from '../components/Layout';

const TEXT_PROVIDERS = ['OPENAI', 'CLAUDE', 'GEMINI', 'GROK'];
const IMAGE_PROVIDERS = ['OPENAI_IMAGES', 'IMAGEN', 'FLUX', 'STABILITY'];

export default function AdminApiKeys() {
  const [keys, setKeys] = useState([]);
  const [settings, setSettings] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [notice, setNotice] = useState('');

  async function load() {
    const [k, s] = await Promise.all([api.get('/admin/api-keys'), api.get('/admin/settings')]);
    setKeys(k.data.keys);
    setSettings(s.data.settings);
  }
  useEffect(() => { load(); }, []);

  async function saveKey(provider) {
    const keyValue = drafts[provider];
    if (!keyValue) return;
    await api.put('/admin/api-keys', { provider, keyValue, isActive: true });
    setDrafts((d) => ({ ...d, [provider]: '' }));
    setNotice(`${provider} key saved.`);
    load();
  }

  async function toggleActive(provider, isActive) {
    await api.put('/admin/api-keys', { provider, keyValue: existingKeyValue(provider), isActive });
    load();
  }

  function existingKeyValue(provider) {
    // We never fetch the raw key back for security; toggling active/inactive
    // re-sends a placeholder only if a key was never set (edge case for scaffold).
    return drafts[provider] || undefined;
  }

  async function setActiveProvider(field, value) {
    await api.put('/admin/settings', { [field]: value });
    load();
  }

  function statusFor(provider) {
    return keys.find((k) => k.provider === provider);
  }

  if (!settings) return <Layout><p>Loading...</p></Layout>;

  return (
    <Layout>
      <h1>AI API Management</h1>
      <p className="subtitle">Choose which provider generates text and images — switch anytime without code changes.</p>
      {notice && <div className="card success-msg">{notice}</div>}

      <div className="card">
        <h2>Text Generation</h2>
        <label>Active provider</label>
        <select value={settings.textProvider} onChange={(e) => setActiveProvider('textProvider', e.target.value)}>
          {TEXT_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        {TEXT_PROVIDERS.map((p) => {
          const status = statusFor(p);
          return (
            <div key={p} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ width: 100 }}>{p}</span>
              <input
                type="password"
                placeholder={status?.hasKey ? '•••••••• (key set)' : 'Enter API key'}
                value={drafts[p] || ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [p]: e.target.value }))}
              />
              <button className="btn secondary" onClick={() => saveKey(p)}>Save</button>
              <span className={`badge ${status?.isActive ? 'active' : 'pending'}`}>{status?.isActive ? 'Enabled' : 'Disabled'}</span>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2>Image Generation</h2>
        <label>Active provider</label>
        <select value={settings.imageProvider} onChange={(e) => setActiveProvider('imageProvider', e.target.value)}>
          {IMAGE_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        {IMAGE_PROVIDERS.map((p) => {
          const status = statusFor(p);
          return (
            <div key={p} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ width: 130 }}>{p}</span>
              <input
                type="password"
                placeholder={status?.hasKey ? '•••••••• (key set)' : 'Enter API key'}
                value={drafts[p] || ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [p]: e.target.value }))}
              />
              <button className="btn secondary" onClick={() => saveKey(p)}>Save</button>
              <span className={`badge ${status?.isActive ? 'active' : 'pending'}`}>{status?.isActive ? 'Enabled' : 'Disabled'}</span>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
