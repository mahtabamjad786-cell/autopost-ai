import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Layout from '../components/Layout';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/admin/dashboard').then(({ data }) => setStats(data));
  }, []);

  if (!stats) return <Layout><p>Loading...</p></Layout>;

  const cards = [
    { label: 'Total Users', value: stats.totalUsers },
    { label: 'Active Users', value: stats.activeUsers },
    { label: "Today's Scheduled Posts", value: stats.scheduledToday },
    { label: 'Posts Published', value: stats.published },
    { label: 'Failed Posts', value: stats.failed },
    { label: 'Revenue (monthly)', value: `$${stats.revenue}` },
  ];

  return (
    <Layout>
      <h1>Admin Dashboard</h1>
      <p className="subtitle">Platform overview</p>
      <div className="grid grid-4">
        {cards.map((c) => (
          <div className="card" key={c.label}>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
