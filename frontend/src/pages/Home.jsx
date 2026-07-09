import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { linksAPI } from '../api/client';
import './Home.css';

export default function Home() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleShorten = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const { data } = await linksAPI.create(url.trim());
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      setResult({
        shortUrl: `${baseUrl}/${data.short_code}`,
        shortCode: data.short_code,
        original: data.original_url,
      });
      setUrl('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to shorten URL. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result.shortUrl);
  };

  return (
    <main className="home-page">
      {/* Hero */}
      <section className="home-hero">
        <div className="hero-badge">✦ Fast &amp; Free URL Shortener</div>
        <h1 className="hero-title">
          Shorten links,<br />
          <span className="gradient-text">track everything.</span>
        </h1>
        <p className="hero-sub">
          Paste your long URL below and get a clean, shareable link instantly —
          with built-in click analytics and QR codes.
        </p>

        {/* Shorten form */}
        <form className="shorten-form" onSubmit={handleShorten} id="shorten-form">
          <input
            id="url-input"
            type="url"
            className="url-input"
            placeholder="https://your-very-long-url.com/goes/here"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <button
            id="shorten-btn"
            type="submit"
            className="shorten-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="btn-spinner" />
            ) : (
              'Shorten →'
            )}
          </button>
        </form>

        {error && <p className="form-error">{error}</p>}

        {/* Result card */}
        {result && (
          <div className="result-card" id="result-card">
            <div className="result-label">Your short link is ready 🎉</div>
            <div className="result-row">
              <a
                className="result-link"
                href={result.shortUrl}
                target="_blank"
                rel="noreferrer"
              >
                {result.shortUrl}
              </a>
              <button id="copy-btn" className="copy-btn" onClick={copyToClipboard}>
                Copy
              </button>
            </div>
            <div className="result-original">
              ↳ <span>{result.original}</span>
            </div>
            <button
              id="view-analytics-btn"
              className="analytics-link-btn"
              onClick={() => navigate(`/analytics/${result.shortCode}`)}
            >
              View Analytics →
            </button>
          </div>
        )}
      </section>

      {/* Features strip */}
      <section className="features-strip">
        {[
          { icon: '⚡', title: 'Instant Redirect', desc: 'Redis-cached hot path, sub-millisecond response.' },
          { icon: '📊', title: 'Click Analytics', desc: 'Geo, device, browser breakdowns — updated in real time.' },
          { icon: '🔗', title: 'QR Codes', desc: 'Auto-generated QR for every link, no setup needed.' },
          { icon: '🔒', title: 'Google Auth', desc: 'Sign in once, manage all your links from a dashboard.' },
        ].map(({ icon, title, desc }) => (
          <div className="feature-card" key={title}>
            <span className="feature-icon">{icon}</span>
            <h3 className="feature-title">{title}</h3>
            <p className="feature-desc">{desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
