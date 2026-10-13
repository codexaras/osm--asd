import { useEffect, useState } from 'react';
import { ExternalLink, Gauge, HeartPulse, LineChart, Server } from 'lucide-react';
import { PageHeader } from '../components/ui';

const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const GRAFANA = import.meta.env.VITE_GRAFANA_URL || `http://${host}:3000`;
const PROMETHEUS = import.meta.env.VITE_PROMETHEUS_URL || `http://${host}:9090`;
const DASHBOARD = `${GRAFANA}/d/resourcehub-overview/resourcehub-application-overview`;

export default function Monitoring() {
  const [health, setHealth] = useState(null);
  const [embed, setEmbed] = useState(true);

  useEffect(() => {
    const load = () =>
      fetch('/api/health')
        .then((r) => r.json())
        .then(setHealth)
        .catch(() => setHealth({ status: 'DOWN' }));
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const links = [
    { label: 'Grafana — Application overview', href: DASHBOARD, icon: LineChart, desc: 'Traffic, latency, errors and business KPIs' },
    { label: 'Grafana — Infrastructure', href: `${GRAFANA}/d/resourcehub-infra/resourcehub-infrastructure-and-containers`, icon: Server, desc: 'Host CPU/memory and per-container usage (cAdvisor)' },
    { label: 'Prometheus — Targets', href: `${PROMETHEUS}/targets`, icon: Gauge, desc: 'Scrape health of every exporter' },
    { label: 'Prometheus — Alerts', href: `${PROMETHEUS}/alerts`, icon: HeartPulse, desc: 'Alert rules: API down, high error rate, slow p95 …' }
  ];

  return (
    <div>
      <PageHeader title="Monitoring" subtitle="Observability stack: Prometheus scrapes /api/metrics every 5s, Grafana visualises it" />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-slate-500">API health</p>
          <p className={`mt-1 text-2xl font-semibold ${health?.status === 'UP' ? 'text-emerald-600' : 'text-rose-600'}`}>{health?.status || '…'}</p>
          <p className="text-xs text-slate-400">Database: {health?.database || '—'}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">API uptime</p>
          <p className="mt-1 text-2xl font-semibold">{health?.uptimeSeconds !== undefined ? `${Math.floor(health.uptimeSeconds / 60)} min` : '—'}</p>
          <p className="text-xs text-slate-400">Version {health?.version || '—'}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">Metrics endpoint</p>
          <a className="mt-1 inline-flex items-center gap-1 text-lg font-semibold text-brand-600 hover:underline" href="/api/metrics" target="_blank" rel="noreferrer">
            /api/metrics <ExternalLink className="h-4 w-4" />
          </a>
          <p className="text-xs text-slate-400">Prometheus text exposition format</p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {links.map(({ label, href, icon: Icon, desc }) => (
          <a key={label} href={href} target="_blank" rel="noreferrer" className="card flex items-start gap-4 p-5 transition hover:border-brand-300 hover:shadow">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="flex items-center gap-1 font-medium text-slate-900">
                {label} <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
              </p>
              <p className="text-sm text-slate-500">{desc}</p>
            </div>
          </a>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold">Live Grafana dashboard</h3>
          <button className="btn-ghost text-xs" onClick={() => setEmbed((e) => !e)}>
            {embed ? 'Hide' : 'Show'}
          </button>
        </div>
        {embed && (
          <iframe
            title="Grafana"
            src={`${DASHBOARD}?orgId=1&refresh=10s&kiosk&theme=light`}
            className="h-[900px] w-full border-0"
          />
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Embedding works because the compose stack enables Grafana anonymous viewer access and iframe embedding. If it is blank, open Grafana directly ({GRAFANA}).
      </p>
    </div>
  );
}
