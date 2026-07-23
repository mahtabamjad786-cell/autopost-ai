import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/signup', form);
      login(data.token, data.user);
      setNotice(data.notice);
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>Create your account</h1>
        <p className="subtitle">Start automating your Facebook Page content</p>
        <label>Name</label>
        <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
        <label>Email</label>
        <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
        <label>Password</label>
        <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required minLength={6} />
        {error && <div className="error">{error}</div>}
        {notice && <div className="success-msg">{notice}</div>}
        <button className="btn" style={{ width: '100%', marginTop: 18 }} disabled={loading}>
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>
        <p style={{ marginTop: 16, fontSize: '0.85rem', color: 'var(--muted)' }}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
