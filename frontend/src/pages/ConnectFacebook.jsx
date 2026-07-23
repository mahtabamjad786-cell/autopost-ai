import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import Layout from '../components/Layout';

export default function ConnectFacebook() {
  const [searchParams] = useSearchParams();
  const [availablePages, setAvailablePages] = useState([]);
  const [connectedPages, setConnectedPages] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const userToken = searchParams.get('userToken');
  const oauthError = searchParams.get('error');

  useEffect(() => {
    loadConnected();
    if (userToken) loadAvailablePages(userToken);
    if (oauthError) setError('Facebook login failed or was cancelled. Please try again.');
  }, [userToken]);

  async function loadConnected() {
    const { data } = await api.get('/facebook/connected');
    setConnectedPages(data.pages);
  }

  async function loadAvailablePages(token) {
    setLoading(true);
    try {
      const { data } = await api.get('/facebook/pages', { params: { userToken: token } });
      setAvailablePages(data.pages);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load your Facebook Pages');
    } finally {
      setLoading(false);
    }
  }

  async function startFacebookLogin() {
    const { data } = await api.get('/facebook/login-url');
    window.location.href = data.url;
  }

  async function connectPage(page) {
    setError('');
    try {
      await api.post('/facebook/connect', page);
      setAvailablePages((prev) => prev.filter((p) => p.pageId !== page.pageId));
      loadConnected();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not connect this page');
    }
  }

  async function disconnectPage(id) {
    await api.delete(`/facebook/${id}`);
    loadConnected();
  }

  return (
    <Layout>
      <h1>Connect Facebook</h1>
      <p className="subtitle">Link the Facebook Page(s) you want AutoPost AI to publish to.</p>

      {error && <div className="card error">{error}</div>}

      <div className="card">
        <h2>Connected Pages</h2>
        {connectedPages.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No pages connected yet.</p>
        ) : (
          connectedPages.map((p) => (
            <div key={p.id} className="chip">
              {p.pageName}
              <button onClick={() => disconnectPage(p.id)}>×</button>
            </div>
          ))
        )}
      </div>

      {availablePages.length > 0 ? (
        <div className="card">
          <h2>Choose Pages to Connect</h2>
          {availablePages.map((p) => (
            <div key={p.pageId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{p.name}</span>
              <button className="btn" onClick={() => connectPage(p)}>Connect</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <h2>Add a New Page</h2>
          <p style={{ color: 'var(--muted)' }}>
            You'll be redirected to Facebook to log in and approve access to your Page(s).
          </p>
          <button className="btn" onClick={startFacebookLogin} disabled={loading}>
            {loading ? 'Loading...' : 'Continue with Facebook'}
          </button>
        </div>
      )}
    </Layout>
  );
}
