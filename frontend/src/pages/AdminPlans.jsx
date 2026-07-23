import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Layout from '../components/Layout';

const BLANK = { name: '', maxPages: 1, maxPostsPerDay: 1, aiTier: 'STANDARD', priceMonthly: 0 };

export default function AdminPlans() {
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    const { data } = await api.get('/admin/plans');
    setPlans(data.plans);
  }
  useEffect(() => { load(); }, []);

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  function edit(plan) {
    setEditingId(plan.id);
    setForm({ name: plan.name, maxPages: plan.maxPages, maxPostsPerDay: plan.maxPostsPerDay, aiTier: plan.aiTier, priceMonthly: plan.priceMonthly });
  }

  function resetForm() { setEditingId(null); setForm(BLANK); }

  async function save() {
    setError('');
    try {
      const payload = { ...form, maxPages: +form.maxPages, maxPostsPerDay: +form.maxPostsPerDay, priceMonthly: +form.priceMonthly };
      if (editingId) await api.put(`/admin/plans/${editingId}`, payload);
      else await api.post('/admin/plans', payload);
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save plan');
    }
  }

  return (
    <Layout>
      <h1>Plans</h1>
      <p className="subtitle">Define subscription tiers and their limits</p>

      <div className="card">
        <h2>{editingId ? 'Edit Plan' : 'New Plan'}</h2>
        {error && <div className="error">{error}</div>}
        <div className="grid grid-2">
          <div><label>Name</label><input value={form.name} onChange={(e) => update('name', e.target.value)} /></div>
          <div>
            <label>AI Tier</label>
            <select value={form.aiTier} onChange={(e) => update('aiTier', e.target.value)}>
              <option value="STANDARD">Standard</option>
              <option value="PREMIUM">Premium</option>
            </select>
          </div>
          <div><label>Max Facebook Pages</label><input type="number" min="1" value={form.maxPages} onChange={(e) => update('maxPages', e.target.value)} /></div>
          <div><label>Max Posts / Day (≤3)</label><input type="number" min="1" max="3" value={form.maxPostsPerDay} onChange={(e) => update('maxPostsPerDay', e.target.value)} /></div>
          <div><label>Price / Month ($)</label><input type="number" min="0" value={form.priceMonthly} onChange={(e) => update('priceMonthly', e.target.value)} /></div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button className="btn" onClick={save}>{editingId ? 'Update Plan' : 'Create Plan'}</button>
          {editingId && <button className="btn secondary" onClick={resetForm}>Cancel</button>}
        </div>
      </div>

      <div className="card">
        <h2>Existing Plans</h2>
        <table>
          <thead><tr><th>Name</th><th>Pages</th><th>Posts/Day</th><th>AI Tier</th><th>Price</th><th></th></tr></thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.maxPages}</td>
                <td>{p.maxPostsPerDay}</td>
                <td>{p.aiTier}</td>
                <td>${p.priceMonthly}</td>
                <td><button className="btn secondary" onClick={() => edit(p)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
