import { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { linksAPI, authAPI } from '../api/client';
import { AuthContext } from '../App';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [links, setLinks] = useState([]);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  // Load user's links on mount
  useEffect(() => {
    const fetchLinks = async () => {
      try {
        const { data } = await linksAPI.getAll();
        setLinks(data);
      } catch {
        setError('Failed to load links.');
      } finally {
        setLoading(false);
      }
    };
    fetchLinks();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setCreating(true);
    setError('');
    try {
      const { data } = await linksAPI.create(url.trim());
      setLinks((prev) => [data, ...prev]);
      setUrl('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create link.');
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch {
      // Session may already be gone; proceed to login regardless
    }
    navigate('/login');
  };

  const copyLink = (shortCode) => {
    navigator.clipboard.writeText(`${BASE_URL}/${shortCode}`);
  };

  return (
    <main className="dashboard-page">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <span className="logo-icon">🔗</span>
          <span className="logo-text">Sniply</span>
        </div>
        <nav className="sidebar-nav">
          <span className="nav-item active">📋 My Links</span>
        </nav>
        <div className="sidebar-footer">
          {user && (
            <div className="user-info">
              {user.profile_image_url && (
                <img src={user.profile_image_url} alt="avatar" className="user-avatar" />
              )}
              <div>
                <div className="user-name">{user.display_name}</div>
                <div className="user-email">{user.email}</div>
              </div>
            </div>
          )}
          <button id="logout-btn" className="logout-btn" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h1 className="dashboard-title">My Links</h1>
            <p className="dashboard-sub">{links.length} link{links.length !== 1 ? 's' : ''} created</p>
          </div>
        </header>

        {/* Create link form */}
        <section className="create-section">
          <form className="create-form" onSubmit={handleCreate} id="create-form">
            <input
              id="dashboard-url-input"
              type="url"
              className="create-input"
              placeholder="Paste a long URL to shorten…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            <button
              id="dashboard-create-btn"
              type="submit"
              className="create-btn"
              disabled={creating}
            >
              {creating ? <span className="btn-spinner" /> : '+ Create Link'}
            </button>
          </form>
          {error && <p className="form-error">{error}</p>}
        </section>

        {/* Links table */}
        <section className="links-section">
          {loading ? (
            <div className="loading-state">
              <span className="spinner" />
              Loading your links…
            </div>
          ) : links.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🔗</span>
              <p>No links yet. Create your first one above!</p>
            </div>
          ) : (
            <div className="links-table-wrapper">
              <table className="links-table">
                <thead>
                  <tr>
                    <th>Short Link</th>
                    <th>Original URL</th>
                    <th>Clicks</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => (
                    <tr key={link.id} className="link-row">
                      <td>
                        <a
                          href={`${BASE_URL}/${link.short_code}`}
                          target="_blank"
                          rel="noreferrer"
                          className="short-link"
                        >
                          {link.short_code}
                        </a>
                      </td>
                      <td className="original-url" title={link.original_url}>
                        {link.original_url.length > 50
                          ? link.original_url.slice(0, 50) + '…'
                          : link.original_url}
                      </td>
                      <td className="click-count">{link.clicks_count ?? 0}</td>
                      <td className="created-at">
                        {new Date(link.created_at).toLocaleDateString()}
                      </td>
                      <td className="action-cell">
                        <button
                          className="action-btn copy-action"
                          onClick={() => copyLink(link.short_code)}
                          title="Copy link"
                        >
                          Copy
                        </button>
                        <Link
                          to={`/analytics/${link.short_code}`}
                          className="action-btn analytics-action"
                        >
                          Analytics
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
