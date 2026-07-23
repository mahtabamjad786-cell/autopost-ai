import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Layout from '../components/Layout';

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api.get('/admin/settings').then(({ data }) => setSettings(data.settings));
  }, []);

  function update(field, value) {
    setSettings((s) => ({ ...s, [field]: value }));
  }

  async function save() {
    const payload = {
      maxDailyPostsGlobal: +settings.maxDailyPostsGlobal,
      imageOrientation: settings.imageOrientation,
      watermarkEnabled: settings.watermarkEnabled,
      hashtagCount: +settings.hashtagCount,
      aiCreativityLevel: +settings.aiCreativityLevel,
      retryFailedPosts: settings.retryFailedPosts,
    };
    const { data } = await api.put('/admin/settings', payload);
    setSettings(data.settings);
    setNotice('Settings saved.');
    setTimeout(() => setNotice(''), 2000);
  }

  if (!settings) return <Layout><p>Loading...</p></Layout>;

  return (
    <Layout>
      <h1>Platform Settings</h1>
      <p className="subtitle">Global defaults applied across all users</p>
      {notice && <div className="card success-msg">{notice}</div>}

      <div className="card">
        <div className="grid grid-2">
          <div>
            <label>Maximum daily posts (hard cap, ≤3)</label>
            <input type="number" min="1" max="3" value={settings.maxDailyPostsGlobal} onChange={(e) => update('maxDailyPostsGlobal', e.target.value)} />
          </div>
          <div>
            <label>Image orientation</label>
            <select value={settings.imageOrientation} onChange={(e) => update('imageOrientation', e.target.value)}>
              <option value="portrait">Portrait (default)</option>
              <option value="landscape">Landscape</option>
              <option value="square">Square</option>
            </select>
          </div>
          <div>
            <label>Hashtags per post</label>
            <input type="number" min="0" max="15" value={settings.hashtagCount} onChange={(e) => update('hashtagCount', e.target.value)} />
          </div>
          <div>
            <label>AI creativity level ({settings.aiCreativityLevel})</label>
            <input type="range" min="0" max="1" step="0.1" value={settings.aiCreativityLevel} onChange={(e) => update('aiCreativityLevel', e.target.value)} />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={settings.watermarkEnabled} onChange={(e) => update('watermarkEnabled', e.target.checked)} />
          Add watermark to generated images
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={settings.retryFailedPosts} onChange={(e) => update('retryFailedPosts', e.target.checked)} />
          Automatically retry failed posts (every 30 min)
        </label>

        <button className="btn" style={{ marginTop: 20 }} onClick={save}>Save Settings</button>
      </div>
    </Layout>
  );
}
