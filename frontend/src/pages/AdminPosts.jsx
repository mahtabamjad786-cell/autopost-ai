import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Layout from '../components/Layout';

export default function AdminPosts() {
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState('');

  async function load() {
    const { data } = await api.get('/admin/posts', { params: filter ? { status: filter } : {} });
    setPosts(data.posts);
  }
  useEffect(() => { load(); }, [filter]);

  return (
    <Layout>
      <h1>All Posts</h1>
      <p className="subtitle">Every post generated across all users</p>

      <div className="card">
        <label>Filter by status</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">All</option>
          <option value="PENDING">Pending</option>
          <option value="PUBLISHED">Published</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>User</th><th>Page</th><th>Subtopic</th><th>Scheduled</th><th>Status</th><th>Error</th></tr></thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td>{p.user?.name}<br /><span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{p.user?.email}</span></td>
                <td>{p.facebookPage?.pageName}</td>
                <td>{p.subtopic}</td>
                <td>{new Date(p.scheduledFor).toLocaleString()}</td>
                <td><span className={`badge ${p.status.toLowerCase()}`}>{p.status}</span></td>
                <td style={{ color: 'var(--red)', fontSize: '0.8rem' }}>{p.errorMessage || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
