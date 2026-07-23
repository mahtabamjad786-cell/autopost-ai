import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="layout">
      <div className="sidebar">
        <div className="brand">AutoPost AI</div>
        {isAdmin ? (
          <>
            <NavLink to="/admin" end className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
            <NavLink to="/admin/users" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>User Management</NavLink>
            <NavLink to="/admin/plans" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Plans</NavLink>
            <NavLink to="/admin/api-keys" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>AI API Management</NavLink>
            <NavLink to="/admin/settings" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Settings</NavLink>
            <NavLink to="/admin/posts" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>All Posts / Logs</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/dashboard" end className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
            <NavLink to="/connect-facebook" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Connect Facebook</NavLink>
            <NavLink to="/automation" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Automation</NavLink>
          </>
        )}
        <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', padding: '0 12px' }}>{user?.name}</div>
          <div className="nav-link" onClick={logout}>Log out</div>
        </div>
      </div>
      <div className="main">{children}</div>
    </div>
  );
}
