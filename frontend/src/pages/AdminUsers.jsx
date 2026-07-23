import { Fragment, useEffect, useState } from 'react';
import { api } from '../api/client';
import Layout from '../components/Layout';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [expandedLogs, setExpandedLogs] = useState({});
  const [logs, setLogs] = useState({});

  async function load() {
    const [u, p] = await Promise.all([api.get('/admin/users'), api.get('/admin/plans')]);
    setUsers(u.data.users);
    setPlans(p.data.plans);
  }

  useEffect(() => { load(); }, []);

  async function activate(id) { await api.post(`/admin/users/${id}/activate`); load(); }
  async function suspend(id) { await api.post(`/admin/users/${id}/suspend`); load(); }
  async function changePlan(id, planId) { await api.post(`/admin/users/${id}/plan`, { planId }); load(); }
  async function resetApi(id) {
    if (!confirm('This disconnects all Facebook Pages for this user. Continue?')) return;
    await api.post(`/admin/users/${id}/reset-api`);
    load();
  }

  async function toggleLogs(id) {
    setExpandedLogs((e) => ({ ...e, [id]: !e[id] }));
    if (!logs[id]) {
      const { data } = await api.get(`/admin/users/${id}/activity`);
      setLogs((l) => ({ ...l, [id]: data.logs }));
    }
  }

  return (
    <Layout>
      <h1>User Management</h1>
      <p className="subtitle">Activate, suspend, upgrade, and monitor user accounts</p>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Status</th><th>Plan</th>
              <th>Pages</th><th>Posts</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <Fragment key={u.id}>
                <tr>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className={`badge ${u.status.toLowerCase()}`}>{u.status}</span></td>
                  <td>
                    <select value={u.planId || ''} onChange={(e) => changePlan(u.id, e.target.value)} style={{ width: 130 }}>
                      <option value="">No plan</option>
                      {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td>{u._count?.facebookPages ?? 0}</td>
                  <td>{u._count?.posts ?? 0}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {u.status !== 'ACTIVE' && <button className="btn success" onClick={() => activate(u.id)}>Activate</button>}
                      {u.status !== 'SUSPENDED' && <button className="btn danger" onClick={() => suspend(u.id)}>Suspend</button>}
                      <button className="btn secondary" onClick={() => resetApi(u.id)}>Reset API</button>
                      <button className="btn secondary" onClick={() => toggleLogs(u.id)}>Activity</button>
                    </div>
                  </td>
                </tr>
                {expandedLogs[u.id] && (
                  <tr>
                    <td colSpan={7} style={{ background: 'var(--panel-2)' }}>
                      {(logs[u.id] || []).map((log) => (
                        <div key={log.id} style={{ fontSize: '0.8rem', padding: '4px 0', color: 'var(--muted)' }}>
                          {new Date(log.createdAt).toLocaleString()} — <strong style={{ color: 'var(--text)' }}>{log.action}</strong> {log.detail}
                        </div>
                      ))}
                      {(logs[u.id] || []).length === 0 && <span style={{ color: 'var(--muted)' }}>No activity yet.</span>}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
