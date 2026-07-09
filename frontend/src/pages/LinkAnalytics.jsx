import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { analyticsAPI } from '../api/client';
import './LinkAnalytics.css';

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'];

export default function LinkAnalytics() {
  const { shortCode } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const { data: res } = await analyticsAPI.getByCode(shortCode);
        setData(res);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load analytics.');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [shortCode]);

  if (loading) {
    return (
      <div className="analytics-loading">
        <span className="spinner" />
        Loading analytics…
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-error">
        <p>{error}</p>
        <Link to="/dashboard" className="back-link">← Back to Dashboard</Link>
      </div>
    );
  }

  const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const shortUrl = `${BASE_URL}/${shortCode}`;

  return (
    <main className="analytics-page">
      <header className="analytics-header">
        <Link to="/dashboard" className="back-link" id="back-to-dashboard">
          ← Dashboard
        </Link>
        <div>
          <h1 className="analytics-title">
            Analytics for <span className="code-chip">{shortCode}</span>
          </h1>
          <a href={shortUrl} className="analytics-url" target="_blank" rel="noreferrer">
            {shortUrl}
          </a>
        </div>
      </header>

      {/* KPI cards */}
      <section className="kpi-grid">
        <div className="kpi-card" id="kpi-total-clicks">
          <span className="kpi-label">Total Clicks</span>
          <span className="kpi-value">{data.totalClicks?.toLocaleString() ?? 0}</span>
        </div>
        <div className="kpi-card" id="kpi-countries">
          <span className="kpi-label">Countries Reached</span>
          <span className="kpi-value">{data.topCountries?.length ?? 0}</span>
        </div>
        <div className="kpi-card" id="kpi-top-browser">
          <span className="kpi-label">Top Browser</span>
          <span className="kpi-value">{data.browsers?.[0]?.browser ?? '—'}</span>
        </div>
        <div className="kpi-card" id="kpi-top-device">
          <span className="kpi-label">Top Device</span>
          <span className="kpi-value">{data.devices?.[0]?.device_type ?? '—'}</span>
        </div>
      </section>

      {/* Charts grid */}
      <div className="charts-grid">
        {/* Time series line chart */}
        <section className="chart-card chart-wide" id="chart-time-series">
          <h2 className="chart-title">Clicks Over Time (last 30 days)</h2>
          {data.timeSeries?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8' }}
                  itemStyle={{ color: '#a78bfa' }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', r: 3 }}
                  activeDot={{ r: 5, fill: '#a78bfa' }}
                  name="Clicks"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">No time-series data yet.</div>
          )}
        </section>

        {/* Top countries bar chart */}
        <section className="chart-card" id="chart-countries">
          <h2 className="chart-title">Top Countries</h2>
          {data.topCountries?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.topCountries} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis dataKey="country" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={30} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  itemStyle={{ color: '#a78bfa' }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} name="Clicks" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">No country data yet.</div>
          )}
        </section>

        {/* Device pie chart */}
        <section className="chart-card" id="chart-devices">
          <h2 className="chart-title">Device Types</h2>
          {data.devices?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data.devices}
                  dataKey="count"
                  nameKey="device_type"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ device_type, percent }) =>
                    `${device_type} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {data.devices.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  itemStyle={{ color: '#a78bfa' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">No device data yet.</div>
          )}
        </section>

        {/* Browsers bar chart */}
        <section className="chart-card" id="chart-browsers">
          <h2 className="chart-title">Browsers</h2>
          {data.browsers?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.browsers}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="browser" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  itemStyle={{ color: '#a78bfa' }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Clicks" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">No browser data yet.</div>
          )}
        </section>
      </div>
    </main>
  );
}
