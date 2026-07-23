import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

export default function Dashboard() {
  const { user, plan } = useAuth();
  const [automation, setAutomation] = useState(null);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    api.get('/automation').then(({ data }) => setAutomation(data.automation));
    api.get('/automation/posts').then(({ data }) => setPosts(data.posts));
  }, []);

  return (
    <Layout>
      <h1>Welcome, {user?.name}</h1>
      <p className="subtitle">Here's what's happening with your account</p>

      {user?.status === 'PENDING' && (
        <div className="card" style={{ borderColor: 'var(--amber)' }}>
          <strong style={{ color: 'var(--amber)' }}>Subscription pending activation.</strong>
          <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
            Complete your payment and it will be activated by the admin shortly.
          </p>
        </div>
      )}

      <div className="grid grid-4">
        <div className="card">
          <div className="stat-value">
            <span className={`badge ${user?.status?.toLowerCase()}`}>{user?.status}</span>
          </div>
          <div className="stat-label">Account status</div>
        </div>
        <div className="card">
          <div className="stat-value">{plan?.name || '—'}</div>
          <div className="stat-label">Current plan</div>
        </div>
        <div className="card">
          <div className="stat-value">
            <span className={`badge ${automation?.isActive ? 'active' : 'pending'}`}>
              {automation?.isActive ? 'Running' : 'Stopped'}
            </span>
          </div>
          <div className="stat-label">Automation</div>
        </div>
        <div className="card">
          <div className="stat-value">{posts.filter(p => p.status === 'PUBLISHED').length}</div>
          <div className="stat-label">Posts published</div>
        </div>
      </div>

      {!automation && (
        <div className="card">
          <h2>Get started</h2>
          <p style={{ color: 'var(--muted)' }}>
            1. Connect your Facebook Page &nbsp;→&nbsp; 2. Set your topic, tone & posting times &nbsp;→&nbsp; 3. Start automation.
          </p>
          <Link to="/connect-facebook" className="btn">Connect Facebook</Link>
        </div>
      )}

      <div className="card">
        <h2>Recent posts</h2>
        {posts.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No posts yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Subtopic</th><th>Page</th><th>Scheduled</th><th>Status</th></tr>
            </thead>
            <tbody>
              {posts.slice(0, 8).map((p) => (
                <tr key={p.id}>
                  <td>{p.subtopic}</td>
                  <td>{p.facebookPage?.pageName}</td>
                  <td>{new Date(p.scheduledFor).toLocaleString()}</td>
                  <td><span className={`badge ${p.status.toLowerCase()}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
