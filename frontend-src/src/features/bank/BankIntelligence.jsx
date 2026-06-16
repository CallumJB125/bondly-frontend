import { useEffect, useRef, useState, useCallback, useMemo, Fragment } from 'react';
import { LayoutGrid, MapPin, ShieldAlert, TrendingUp, Sparkles, ArrowUpRight, ArrowDownRight, ChevronRight, Circle, GitBranch, Lock, Flag, Eye, CheckCircle2, Settings } from 'lucide-react';
import { bankApi } from './bankApi.js';

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  bg:       '#090d12',
  bg1:      '#0d1520',
  card:     '#111a26',
  card2:    '#162030',
  border:   'rgba(255,255,255,0.07)',
  border2:  'rgba(255,255,255,0.12)',
  text:     '#e8edf2',
  body:     '#9aaab8',
  muted:    '#627080',
  faint:    '#3d4e5c',
  high:     '#e35d51',
  medium:   '#dca844',
  low:      '#4cbe82',
  gold:     '#c8a84b',
  goldGlow: 'rgba(200,168,75,0.25)',
};

// ── Typography ────────────────────────────────────────────────────────────────
const DISP = "'Fraunces',Georgia,serif";
const SANS = "'IBM Plex Sans',system-ui,sans-serif";
const MONO = "'IBM Plex Mono',Menlo,monospace";

// ── Risk colour helpers ───────────────────────────────────────────────────────
function hexMix(a, b, t) {
  const f = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
  const [r1,g1,b1] = f(a), [r2,g2,b2] = f(b);
  const p = (x,y) => Math.round(x+(y-x)*t);
  return `rgb(${p(r1,r2)},${p(g1,g2)},${p(b1,b2)})`;
}
function riskColor(v) {
  const t = Math.max(0, Math.min(1, (v ?? 0) / 100));
  return t < 0.5 ? hexMix(C.low, C.medium, t / 0.5) : hexMix(C.medium, C.high, (t - 0.5) / 0.5);
}

const SECTOR_COLORS = {
  government_public:   '#6366f1',
  financial_services:  '#3b82f6',
  retail_trade:        '#f59e0b',
  education:           '#10b981',
  healthcare:          '#ec4899',
  gig_platform:        '#8b5cf6',
  hospitality_tourism: '#f97316',
  construction:        '#84cc16',
  transport_logistics: '#06b6d4',
  ict_tech:            '#a78bfa',
  business_services:   '#fb923c',
  other:               '#4b5563',
};

const SECTOR_LABELS = {
  government_public:   'Government & Public',
  financial_services:  'Finance & Business',
  retail_trade:        'Trade & Retail',
  education:           'Education',
  healthcare:          'Healthcare',
  gig_platform:        'Gig Platform',
  hospitality_tourism: 'Hospitality & Tourism',
  construction:        'Construction',
  transport_logistics: 'Transport & Logistics',
  ict_tech:            'ICT / Tech',
  business_services:   'Business Services',
  other:               'Other Services',
};

function fdiColor(fdi) {
  if ((fdi ?? 0) >= 60) return C.high;
  if ((fdi ?? 0) >= 35) return C.medium;
  return C.low;
}
function fdiLabel(fdi) {
  if ((fdi ?? 0) >= 60) return 'High Distress';
  if ((fdi ?? 0) >= 35) return 'Medium Distress';
  return 'Low Distress';
}

// ── Shared Kpi card (new design) ──────────────────────────────────────────────
function Kpi({ label, value, sub, tone }) {
  return (
    <div style={{ background: C.card, padding: '18px 20px' }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: C.faint, marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: DISP, fontSize: 30, fontWeight: 500, color: tone || C.text, lineHeight: 0.95, letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontFamily: SANS, fontSize: 11, color: C.faint, marginTop: 8 }}>{sub}</div>}
    </div>
  );
}

function periodLabel(p) {
  if (!p) return '';
  if (p.match(/^\d{4}-W\d{2}$/)) {
    const [y, w] = p.split('-W');
    return `Week ${parseInt(w, 10)}, ${y}`;
  }
  const [y, m] = p.split('-');
  return new Date(+y, +m - 1, 1).toLocaleString('en-ZA', { month: 'long', year: 'numeric' });
}

function delta(curr, prev) {
  if (curr == null || prev == null) return null;
  return Math.round((curr - prev) * 10) / 10;
}

// ── SVG Donut chart ───────────────────────────────────────────────────────────
function DonutChart({ slices, size = 120, thick = 24 }) {
  const r    = (size - thick) / 2;
  const cx   = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  let   off  = 0;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      {slices.map((s, i) => {
        const dash = (s.pct / 100) * circ;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={s.color} strokeWidth={thick}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-off} />
        );
        off += dash;
        return el;
      })}
    </svg>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ values, color = '#c8a84b', width = 80, height = 28 }) {
  if (!values || values.length < 2) return null;
  const valid = values.map(v => v ?? 0);
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const pts = valid.map((v, i) => {
    const x = (i / (valid.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={pts.split(' ').pop().split(',')[0]} cy={pts.split(' ').pop().split(',')[1]} r="2.5" fill={color} />
    </svg>
  );
}

// ── Leaflet map ───────────────────────────────────────────────────────────────
const SA_PROVINCE_CENTROIDS = {
  'Western Cape':   { lat: -33.2, lng: 22.0 },
  'Eastern Cape':   { lat: -32.0, lng: 26.5 },
  'Northern Cape':  { lat: -29.0, lng: 22.0 },
  'Free State':     { lat: -29.0, lng: 26.5 },
  'KwaZulu-Natal':  { lat: -29.0, lng: 30.5 },
  'Mpumalanga':     { lat: -25.5, lng: 30.5 },
  'Limpopo':        { lat: -23.5, lng: 29.5 },
  'Gauteng':        { lat: -26.0, lng: 28.0 },
  'North West':     { lat: -26.5, lng: 25.5 },
};

function GeoMap({ points, prevPoints, center, zoom, choropleth, onSelect, heatMode, getIntensity }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const layerRef     = useRef(null);
  const heatLayerRef = useRef(null);
  const [ready, setReady]         = useState(!!window.L);
  const [heatReady, setHeatReady] = useState(!!window.L?.heatLayer);

  useEffect(() => {
    if (window.L) { setReady(true); return; }
    if (!document.getElementById('leaflet-css')) {
      const l = document.createElement('link');
      l.id = 'leaflet-css'; l.rel = 'stylesheet';
      l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(l);
    }
    if (!document.getElementById('leaflet-js')) {
      const s = document.createElement('script');
      s.id = 'leaflet-js';
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = () => {
        setReady(true);
        if (heatMode && !document.getElementById('leaflet-heat-js')) {
          const h = document.createElement('script');
          h.id = 'leaflet-heat-js';
          h.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
          h.onload = () => setHeatReady(true);
          document.head.appendChild(h);
        } else if (!heatMode) setHeatReady(true);
      };
      document.head.appendChild(s);
    } else if (ready && heatMode && !document.getElementById('leaflet-heat-js')) {
      const h = document.createElement('script');
      h.id = 'leaflet-heat-js';
      h.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
      h.onload = () => setHeatReady(true);
      document.head.appendChild(h);
    }
  }, []);

  // Also load heat plugin if heatMode becomes true after initial render
  useEffect(() => {
    if (!heatMode || heatReady) return;
    if (window.L?.heatLayer) { setHeatReady(true); return; }
    if (!document.getElementById('leaflet-heat-js')) {
      const h = document.createElement('script');
      h.id = 'leaflet-heat-js';
      h.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
      h.onload = () => setHeatReady(true);
      document.head.appendChild(h);
    } else {
      // Script tag exists but may still be loading — poll briefly
      const iv = setInterval(() => { if (window.L?.heatLayer) { setHeatReady(true); clearInterval(iv); } }, 100);
      return () => clearInterval(iv);
    }
  }, [heatMode]);

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;
    const L = window.L;
    const map = L.map(containerRef.current, { scrollWheelZoom: true, zoomControl: false })
      .setView(center || [-33.93, 18.55], zoom || 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
  }, [ready]);

  // Choropleth: filled province polygons from GeoJSON
  useEffect(() => {
    if (!ready || !mapRef.current || !window.L || !choropleth) return;
    const L = window.L;
    fetch('/sa-provinces.geojson')
      .then(r => r.json())
      .then(geojson => {
        const lookup = {};
        for (const p of (choropleth || [])) {
          lookup[(p.suburb || p.province || '').toLowerCase()] = p;
        }
        L.geoJSON(geojson, {
          style: feature => {
            const name = (feature.properties.name || '').toLowerCase();
            const p = lookup[name];
            const color = p ? fdiColor(p.fdi ?? p.distressShare) : '#1e3a5f';
            return { fillColor: color, fillOpacity: 0.65, color: '#0d1b2a', weight: 1.5 };
          },
          onEachFeature: (feature, layer) => {
            const name = feature.properties.name || '';
            const p = lookup[name.toLowerCase()];
            layer.bindPopup(
              `<div style="font-family:system-ui;min-width:140px"><strong>${name}</strong>` +
              (p ? `<br><span style="color:${fdiColor(p.fdi ?? p.distressShare)};font-weight:700">FDI ${p.fdi ?? p.distressShare ?? '—'}</span> — ${fdiLabel(p.fdi ?? p.distressShare)}<br><span style="color:#6b7280;font-size:0.8em">n=${p.count ?? '—'}</span>` : '<br>No data') +
              `</div>`
            );
            layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.85, weight: 2.5 }));
            layer.on('mouseout',  () => layer.setStyle({ fillOpacity: 0.65, weight: 1.5 }));
          },
        }).addTo(layerRef.current);
      })
      .catch(() => {});
  }, [ready, choropleth]);

  // Heat layer or circle markers
  useEffect(() => {
    if (!mapRef.current || !layerRef.current || !window.L || choropleth) return;
    if (heatMode && !heatReady) return;
    const L = window.L;
    layerRef.current.clearLayers();
    if (heatLayerRef.current) { mapRef.current.removeLayer(heatLayerRef.current); heatLayerRef.current = null; }

    const prevFdi = {};
    if (prevPoints) for (const p of prevPoints) if (p.suburb) prevFdi[p.suburb] = p.fdi;

    if (heatMode && L.heatLayer) {
      const intensity = getIntensity || (p => (p.fdi ?? 0) / 100);
      // Heat data: [lat, lng, intensity 0-1]
      const heatData = points.filter(p => p.lat && p.lng).map(p => [p.lat, p.lng, intensity(p)]);
      heatLayerRef.current = L.heatLayer(heatData, {
        radius: 35,
        blur: 25,
        maxZoom: 12,
        max: 1.0,
        gradient: { 0.0: '#1a4731', 0.25: '#2d7d46', 0.45: '#c8a84b', 0.65: '#e07b2a', 0.85: '#c0392b', 1.0: '#7b0000' },
      }).addTo(mapRef.current);

      // Invisible click targets
      for (const p of points) {
        if (!p.lat || !p.lng) continue;
        const color = fdiColor(p.fdi);
        const d = prevFdi[p.suburb] != null ? delta(p.fdi, prevFdi[p.suburb]) : null;
        const dStr = d != null ? `<br><span style="color:${d > 0 ? C.high : C.low};font-size:0.8em">${d > 0 ? '▲' : '▼'} ${Math.abs(d)} vs prev</span>` : '';
        L.circleMarker([p.lat, p.lng], { radius: 14, color: 'transparent', fillColor: 'transparent', fillOpacity: 0, weight: 0, opacity: 0 })
          .bindPopup(`<div style="font-family:system-ui;min-width:140px"><strong style="font-size:0.95em">${p.suburb}</strong>${p.town ? `<br><span style="color:#6b7280;font-size:0.8em">${p.town}</span>` : ''}<br><span style="color:${color};font-weight:700">${(intensity(p) * 100).toFixed(1)}</span>${dStr}<br><span style="color:#6b7280;font-size:0.8em">n=${p.count ?? '—'}</span></div>`)
          .on('click', () => onSelect && onSelect(p))
          .addTo(layerRef.current);
      }
    } else {
      for (const p of points) {
        if (!p.lat || !p.lng) continue;
        const color = fdiColor(p.fdi);
        const d = prevFdi[p.suburb] != null ? delta(p.fdi, prevFdi[p.suburb]) : null;
        const dStr = d != null ? `<br><span style="color:${d > 0 ? C.high : C.low};font-size:0.8em">${d > 0 ? '▲' : '▼'} ${Math.abs(d)} vs prev</span>` : '';
        L.circleMarker([p.lat, p.lng], {
          radius: Math.max(10, Math.min(32, (p.count ?? 20) / 7)),
          color, fillColor: color, fillOpacity: 0.72, weight: 1, opacity: 0.9,
        }).bindPopup(
          `<div style="font-family:system-ui;min-width:140px"><strong style="font-size:0.95em">${p.suburb}</strong>${p.town ? `<br><span style="color:#6b7280;font-size:0.8em">${p.town}</span>` : ''}<br><span style="color:${color};font-weight:700">FDI ${p.fdi ?? '—'}</span> — ${fdiLabel(p.fdi)}${dStr}<br><span style="color:#6b7280;font-size:0.8em">Distress: ${p.distressShare != null ? p.distressShare + '%' : '—'} · n=${p.count ?? '—'}</span></div>`
        ).on('click', () => onSelect && onSelect(p)).addTo(layerRef.current);
      }
    }
  }, [points, prevPoints, choropleth, heatMode, heatReady]);

  useEffect(() => () => {
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
  }, []);

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 480, borderRadius: 10, overflow: 'hidden', background: '#0d1520' }}>
      {/* Legend overlay */}
      <div style={{
        position: 'absolute', top: 14, left: 14, zIndex: 500,
        background: 'rgba(13,27,42,0.92)', border: `1px solid ${C.border}`,
        borderRadius: 8, padding: '12px 16px', backdropFilter: 'blur(8px)',
      }}>
        {heatMode ? (
          <>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontWeight: 700, marginBottom: 8 }}>Heat intensity</div>
            <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#1a4731,#2d7d46,#c8a84b,#e07b2a,#c0392b,#7b0000)', marginBottom: 5 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: C.muted }}><span>low</span><span>high</span></div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontWeight: 700, marginBottom: 8 }}>Financial Distress</div>
            {[['High', C.high], ['Medium', C.medium], ['Low', C.low]].map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, fontSize: '0.8rem', color: C.text }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />{label}
              </div>
            ))}
          </>
        )}
        <div style={{ fontSize: '0.7rem', color: C.muted, marginTop: 8 }}>Click suburb for details</div>
      </div>

      {!ready
        ? <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}>Loading map…</div>
        : <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
      }
    </div>
  );
}

// ── Province distress colour ──────────────────────────────────────────────────
function distressColor(share) {
  if ((share ?? 0) >= 50) return '#ef4444';
  if ((share ?? 0) >= 30) return '#f59e0b';
  return '#22c55e';
}

// ── Geo Risk Map tab ──────────────────────────────────────────────────────────
const PROVINCE_PATHS = {
  'Western Cape':   'M 120,520 L 200,480 L 280,530 L 320,600 L 220,640 L 140,590 Z',
  'Eastern Cape':   'M 280,440 L 380,420 L 460,460 L 480,540 L 380,580 L 280,560 L 240,520 Z',
  'Northern Cape':  'M 100,320 L 280,280 L 340,360 L 320,460 L 200,480 L 120,440 Z',
  'Free State':     'M 320,340 L 440,320 L 500,380 L 480,460 L 380,480 L 320,460 Z',
  'KwaZulu-Natal':  'M 460,380 L 540,340 L 580,400 L 560,480 L 480,500 L 440,460 Z',
  'Mpumalanga':     'M 460,260 L 540,240 L 580,300 L 560,360 L 480,360 L 440,320 Z',
  'Limpopo':        'M 380,160 L 520,140 L 580,220 L 540,280 L 440,280 L 380,240 Z',
  'Gauteng':        'M 420,300 L 480,290 L 500,330 L 460,345 L 420,335 Z',
  'North West':     'M 280,240 L 420,220 L 440,300 L 380,320 L 300,320 L 260,280 Z',
};

// Province name → code map for climate API
const PROVINCE_CODE = {
  'western cape': 'WC', 'eastern cape': 'EC', 'northern cape': 'NC',
  'free state': 'FS', 'kwazulu-natal': 'KZN', 'mpumalanga': 'MP',
  'limpopo': 'LP', 'gauteng': 'GP', 'north west': 'NW',
};

function climateBadges(climate) {
  if (!climate) return null;
  const badges = [];
  if (climate.flood_risk === 'high' || climate.flood_risk === 'medium') badges.push({ emoji: '🌊', label: `Flood: ${climate.flood_risk}` });
  if (climate.fire_risk === 'high') badges.push({ emoji: '🔥', label: 'Fire: high' });
  if (climate.drought_risk === 'high') badges.push({ emoji: '🏜️', label: 'Drought: high' });
  return badges;
}

// SVG approximate positions for SA metros (viewBox 0 0 420 500)
const METRO_SVG = {
  'Cape Town':      { x: 108, y: 418 },
  'Port Elizabeth': { x: 248, y: 388 },
  'East London':    { x: 282, y: 358 },
  'Bloemfontein':   { x: 228, y: 298 },
  'Durban':         { x: 318, y: 300 },
  'Johannesburg':   { x: 240, y: 218 },
  'Pretoria':       { x: 252, y: 200 },
  'Nelspruit':      { x: 306, y: 195 },
};

// Simplified SA outline path (approximate)
const SA_PATH = 'M 108,418 C 90,400 72,370 78,340 C 84,310 96,290 108,270 C 96,255 88,240 92,218 C 96,196 112,185 130,178 C 148,170 168,168 188,162 C 208,156 224,148 244,142 C 264,136 284,134 304,138 C 324,142 338,154 348,168 C 358,182 360,200 356,218 C 360,230 368,242 370,258 C 372,274 364,288 354,298 C 364,312 372,328 368,344 C 364,360 350,372 334,380 C 318,388 298,390 278,390 C 260,396 244,404 228,410 C 212,416 190,420 172,422 C 152,424 130,424 108,418 Z';

function GeoRiskMap({ heatmaps, monthlyPanels, periods, suburbPanel }) {
  const [pick, setPick] = useState(null); // selected suburb point object
  const [metric, setMetric] = useState('distress');
  const [search, setSearch] = useState('');

  const areas = heatmaps?.areas || [];

  // Current period suburb points (from suburbPanel, same as Overview)
  const points = suburbPanel || [];

  // Build area lookup by suburb name for enriching clicked point
  const areaLookup = {};
  for (const a of areas) if (a.suburb) areaLookup[a.suburb] = a;

  // Sparkline per suburb across monthlyPanels
  const suburbSpark = (suburb) => (monthlyPanels || []).map(panel => {
    const row = panel.find(r => r.suburb === suburb);
    return row ? (row.fdi ?? null) : null;
  });

  // Prev period delta
  const prevPanel = monthlyPanels && monthlyPanels.length >= 2 ? monthlyPanels[monthlyPanels.length - 2] : [];
  const prevFdiMap = {};
  for (const r of (prevPanel || [])) if (r.suburb) prevFdiMap[r.suburb] = r.fdi;

  // Enrich picked point with heatmaps area data
  const enriched = pick ? { ...areaLookup[pick.suburb], ...pick } : null;
  const pickedSpark = pick ? suburbSpark(pick.suburb) : [];
  const prevFdi = pick ? prevFdiMap[pick.suburb] : null;
  const delta = (prevFdi != null && pick) ? Math.round((pick.fdi - prevFdi) * 10) / 10 : null;

  const q = search.trim().toLowerCase();
  const filteredPoints = q ? points.filter(p => (p.suburb || '').toLowerCase().includes(q) || (p.town || '').toLowerCase().includes(q)) : points;
  const filteredAreas  = q ? areas.filter(a => (a.suburb || '').toLowerCase().includes(q) || (a.town || '').toLowerCase().includes(q)) : areas;

  // Suburb-level ranked table (top 20 by distress)
  const ranked = [...filteredAreas].sort((a, b) => (b.distressShare ?? 0) - (a.distressShare ?? 0)).slice(0, 20);

  const metricLabel = { distress: 'Distress %', fraud: 'Fraud Rate', credit: 'Credit Reliance' }[metric];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px 12px', flexShrink: 0, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.gold, fontWeight: 500, marginBottom: 3 }}>Geographic Intelligence</div>
            <h3 style={{ margin: 0, fontFamily: DISP, fontSize: '1.2rem', fontWeight: 500, color: C.text, letterSpacing: -0.3 }}>Suburb-level Risk Map</h3>
          </div>
          <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 9, padding: 3 }}>
            {[['distress','Distress'],['fraud','Fraud Rate'],['credit','Credit']].map(([k,l]) => {
              const a = metric === k;
              return <button key={k} onClick={() => setMetric(k)} style={{ fontFamily: SANS, fontSize: 11, fontWeight: a?600:500, padding: '5px 11px', borderRadius: 6, cursor: 'pointer', border: 'none', background: a ? C.gold : 'transparent', color: a ? '#0a0d12' : C.muted }}>{l}</button>;
            })}
          </div>
        </div>
        {/* Search bar */}
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <MapPin size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.faint, pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search suburbs or towns… (${points.length} tracked)`}
            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 12px 7px 30px', fontFamily: SANS, fontSize: 12.5, color: C.text, outline: 'none' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>✕</button>
          )}
        </div>
      </div>

      {/* Map + drill-down side-by-side */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Leaflet map */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <GeoMap
            points={filteredPoints}
            prevPoints={prevPanel}
            center={[-29, 25]}
            zoom={6}
            heatMode
            getIntensity={p => metric === 'fraud' ? (p.fraudRate ?? 0) / 15 : metric === 'credit' ? (p.creditReliance ?? 0) / 100 : (p.distressShare ?? p.fdi ?? 0) / 100}
            onSelect={p => setPick(prev => prev?.suburb === p.suburb ? null : p)}
          />
        </div>

        {/* Right panel: drill-down or ranked table */}
        <div style={{ width: 320, flexShrink: 0, borderLeft: `1px solid ${C.border}`, overflowY: 'auto', background: C.bg1 }}>
          {enriched ? (
            /* Drill-down */
            <div style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: DISP, fontSize: 20, fontWeight: 500, color: C.text, letterSpacing: -0.3 }}>{enriched.suburb}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: C.faint, marginTop: 2 }}>
                    {enriched.town}{enriched.province ? ` · ${enriched.province.replace('KwaZulu-Natal','KZN').replace('Western Cape','WC').replace('Eastern Cape','EC').replace('Free State','FS').replace('Gauteng','GP')}` : ''}
                  </div>
                </div>
                <button onClick={() => setPick(null)} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 8px', color: C.muted, cursor: 'pointer', fontSize: 11 }}>✕</button>
              </div>

              {/* FDI score */}
              <div style={{ background: C.card, borderRadius: 10, padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 9.5, textTransform: 'uppercase', color: C.faint, marginBottom: 4 }}>FDI Score</div>
                  <div style={{ fontFamily: DISP, fontSize: 28, fontWeight: 500, color: riskColor(enriched.fdi ?? 50) }}>{(enriched.fdi ?? 0).toFixed(1)}</div>
                </div>
                {delta != null && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: MONO, fontSize: 9.5, textTransform: 'uppercase', color: C.faint, marginBottom: 4 }}>vs prev</div>
                    <div style={{ fontFamily: MONO, fontSize: 15, color: delta > 0 ? C.high : C.low, display: 'flex', alignItems: 'center', gap: 3 }}>
                      {delta > 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}{Math.abs(delta)}
                    </div>
                  </div>
                )}
              </div>

              {/* 3-stat grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[
                  ['Distress', enriched.distressShare, '%'],
                  ['Fraud Rate', enriched.fraudRate, '%'],
                  ['Credit Dep.', enriched.creditReliance, '%'],
                  ['Borrowers', enriched.count, ''],
                ].map(([l, v, suf]) => (
                  <div key={l} style={{ background: C.card, borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: C.faint, textTransform: 'uppercase', marginBottom: 5 }}>{l}</div>
                    <div style={{ fontFamily: DISP, fontSize: 20, fontWeight: 500, color: typeof v === 'number' && suf === '%' ? riskColor(v) : C.text }}>
                      {v != null ? (suf === '%' ? v.toFixed(1) : v) : '—'}<span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{suf}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sparkline trend */}
              {pickedSpark.filter(Boolean).length > 1 && (
                <div style={{ background: C.card, borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.faint, textTransform: 'uppercase', marginBottom: 8 }}>FDI Trend · {periods?.length || 0} periods</div>
                  <Sparkline values={pickedSpark} color={riskColor(enriched.fdi ?? 50)} width={260} height={44} />
                  {periods?.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: C.faint }}>{periods[0]}</span>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: C.faint }}>{periods[periods.length - 1]}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Ranked suburb table */
            <div style={{ padding: '16px 0' }}>
              <div style={{ fontFamily: MONO, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.faint, padding: '0 18px', marginBottom: 10 }}>Top suburbs by distress</div>
              {ranked.map((a, i) => {
                const val = metric === 'fraud' ? a.fraudRate : metric === 'credit' ? a.creditReliance : a.distressShare;
                const spark = suburbSpark(a.suburb);
                return (
                  <div key={a.suburb + i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
                    onClick={() => {
                      const pt = points.find(p => p.suburb === a.suburb);
                      if (pt) setPick(pt); else setPick({ suburb: a.suburb, town: a.town, fdi: a.fdi, ...a });
                    }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint, width: 16, flexShrink: 0 }}>{i+1}</span>
                    <span style={{ width: 7, height: 7, borderRadius: 7, background: riskColor(val ?? 0), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.suburb || a.town}</div>
                      <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.faint }}>{a.town}</div>
                    </div>
                    <Sparkline values={spark} color={riskColor(val ?? 0)} width={44} height={16} />
                    <span style={{ fontFamily: MONO, fontSize: 12, color: riskColor(val ?? 0), minWidth: 36, textAlign: 'right' }}>{(val ?? 0).toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sector Heatmap tab ────────────────────────────────────────────────────────
function lerp(t, lo, hi) {
  return Math.round(lo + t * (hi - lo));
}

function cellBg(val, min, max) {
  if (max === min) return 'rgba(34,197,94,0.13)';
  const t = (val - min) / (max - min);
  // green (#22c55e22) → red (#ef444422) subtle tint
  const r = lerp(t, 0x22, 0xef);
  const g = lerp(t, 0xc5, 0x44);
  const b = lerp(t, 0x5e, 0x44);
  return `rgba(${r},${g},${b},0.18)`;
}

function SectorHeatmap({ heatmaps }) {
  const [ncrData, setNcrData] = useState(null);

  useEffect(() => {
    // Fetch ML models endpoint for NCR calibration data
    fetch('/api/bank/ml-models', {
      headers: { Authorization: localStorage.getItem('bondly_bank_token') ? `Bearer ${localStorage.getItem('bondly_bank_token')}` : '' },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.success ? setNcrData(d.data) : null)
      .catch(() => null);
  }, []);

  if (!heatmaps) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
        No heatmap data available
      </div>
    );
  }

  const sectors = (heatmaps.sectors || []).slice().sort((a, b) => (b.distressShare ?? 0) - (a.distressShare ?? 0));

  const minAvgD = Math.min(...sectors.map(s => s.avgDistress ?? 0));
  const maxAvgD = Math.max(...sectors.map(s => s.avgDistress ?? 0));
  const minDS   = Math.min(...sectors.map(s => s.distressShare ?? 0));
  const maxDS   = Math.max(...sectors.map(s => s.distressShare ?? 0));
  const minFR   = Math.min(...sectors.map(s => s.fraudRate ?? 0));
  const maxFR   = Math.max(...sectors.map(s => s.fraudRate ?? 0));
  const minN    = Math.min(...sectors.map(s => s.count ?? 0));
  const maxN    = Math.max(...sectors.map(s => s.count ?? 0));

  const COLS = [
    { label: 'Avg Distress', key: 'avgDistress', min: minAvgD, max: maxAvgD, fmt: v => v?.toFixed(1) + '%' },
    { label: 'Distress Share', key: 'distressShare', min: minDS, max: maxDS, fmt: v => v?.toFixed(1) + '%' },
    { label: 'Fraud Rate', key: 'fraudRate', min: minFR, max: maxFR, fmt: v => v?.toFixed(1) + '%' },
    { label: 'Borrowers', key: 'count', min: minN, max: maxN, fmt: v => v?.toLocaleString() },
  ];

  // Max distress share for bar chart scaling
  const maxBar = maxDS || 1;

  return (
    <div style={{ padding: '20px 28px' }}>
      <h3 style={{ margin: '0 0 4px', color: C.text, fontSize: '1.1rem', fontWeight: 700 }}>
        Sector Heatmap
      </h3>
      <p style={{ margin: '0 0 16px', color: C.muted, fontSize: '0.82rem' }}>
        Risk metrics by employment sector — cells shaded green (low) → red (high)
      </p>

      {/* Grid heatmap */}
      <div style={{ overflowX: 'auto', marginBottom: 32 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: C.muted, fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${C.border}` }}>
                Sector
              </th>
              {COLS.map(c => (
                <th key={c.key} style={{ textAlign: 'right', padding: '8px 12px', color: C.muted, fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${C.border}` }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sectors.map((s) => (
              <tr key={s.sector}>
                <td style={{ padding: '7px 12px', color: C.text, fontWeight: 600, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                  {SECTOR_LABELS[s.sector] || s.sector}
                </td>
                {COLS.map(c => {
                  const val = s[c.key] ?? 0;
                  return (
                    <td key={c.key} style={{
                      padding: '7px 12px', textAlign: 'right', color: C.text, fontWeight: 600,
                      background: cellBg(val, c.min, c.max),
                      borderBottom: `1px solid ${C.border}`,
                    }}>
                      {c.fmt(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bar chart */}
      <h3 style={{ margin: '0 0 12px', color: C.text, fontSize: '1rem', fontWeight: 700 }}>
        Distress Share by Sector
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
        {sectors.map((s) => {
          const pct = ((s.distressShare ?? 0) / maxBar) * 100;
          return (
            <div key={s.sector} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 160, fontSize: '0.76rem', color: C.muted, textAlign: 'right', flexShrink: 0 }}>
                {SECTOR_LABELS[s.sector] || s.sector}
              </div>
              <div style={{ flex: 1, height: 18, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  width: pct + '%', height: '100%',
                  background: distressColor(s.distressShare),
                  opacity: 0.8,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <div style={{ width: 48, fontSize: '0.76rem', color: C.text, fontWeight: 700, flexShrink: 0 }}>
                {s.distressShare?.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>

      {/* NCR calibration table */}
      <h3 style={{ margin: '0 0 4px', color: C.text, fontSize: '1rem', fontWeight: 700 }}>
        NCR Calibration Comparison
      </h3>
      <p style={{ margin: '0 0 12px', color: C.muted, fontSize: '0.82rem' }}>
        Our sector default rates vs NCR targets from the backtest report
      </p>
      {ncrData?.sectorCalibration ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr>
                {['Sector', 'NCR Target', 'Our Model', 'Calibration Error'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Sector' ? 'left' : 'right', padding: '8px 12px', color: C.muted, fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${C.border}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ncrData.sectorCalibration.map((row) => {
                const err = Math.abs((row.ourModel ?? 0) - (row.ncrTarget ?? 0));
                const errColor = err < 5 ? '#22c55e' : err < 15 ? '#f59e0b' : '#ef4444';
                return (
                  <tr key={row.sector}>
                    <td style={{ padding: '7px 12px', color: C.text, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>
                      {SECTOR_LABELS[row.sector] || row.sector}
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: C.muted, borderBottom: `1px solid ${C.border}` }}>
                      {row.ncrTarget?.toFixed(1)}%
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: C.text, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>
                      {row.ourModel?.toFixed(1)}%
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: errColor, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>
                      {err.toFixed(1)}pp
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontSize: '0.82rem' }}>
          NCR calibration data not available — run backend/scripts/run-intelligence.mjs to generate model health data.
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
// ── Borrower Risk Reasons (SHAP adverse-action) ───────────────────────────────
function ExplainPanel() {
  const [userId, setUserId]   = useState('');
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const lookup = async () => {
    if (!userId.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const token = localStorage.getItem('bondly_token') || sessionStorage.getItem('bondly_token') || '';
      const res = await fetch(`/api/bank/borrower/${encodeURIComponent(userId.trim())}/explain`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 503) { setError('ML server unavailable'); return; }
      if (!res.ok) { setError(`Error ${res.status}`); return; }
      setResult(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const riskBandColor = (band) => {
    if (!band) return C.muted;
    const b = band.toLowerCase();
    if (b === 'high') return C.high;
    if (b === 'medium' || b === 'moderate') return C.medium;
    return C.low;
  };

  return (
    <div style={{ padding: '16px 28px', borderTop: `1px solid ${C.border}` }}>
      <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontWeight: 700, marginBottom: 4 }}>
        Borrower Risk Reasons
      </div>
      <div style={{ fontFamily: SANS, fontSize: '0.7rem', color: C.faint, marginBottom: 10 }}>
        Paste a borrower's application ID (e.g. <span style={{ fontFamily: MONO, color: C.muted }}>capp_abc123</span>) from Open Mortgages to see the model's top risk factors for that individual.
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={userId}
          onChange={e => setUserId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && lookup()}
          placeholder="e.g. capp_abc123 or user_xyz…"
          style={{
            flex: 1, background: '#0d1520', border: `1px solid ${C.border}`, borderRadius: 6,
            color: C.text, padding: '7px 12px', fontSize: '0.83rem', outline: 'none',
          }}
        />
        <button
          onClick={lookup}
          disabled={loading}
          style={{
            padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: C.gold, color: '#0b1e2d', fontWeight: 700, fontSize: '0.83rem',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '…' : 'Explain'}
        </button>
      </div>
      {error && (
        <div style={{ color: C.high, fontSize: '0.8rem', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
          {error}
        </div>
      )}
      {result && (
        <div style={{ background: '#0d1520', border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: C.muted, marginBottom: 2 }}>Risk Score</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: C.text, lineHeight: 1 }}>
                {result.score != null ? Math.round(result.score * 100) / 100 : '—'}
              </div>
            </div>
            {result.risk_band && (
              <div style={{
                padding: '4px 12px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700,
                background: riskBandColor(result.risk_band) + '22',
                color: riskBandColor(result.risk_band),
                border: `1px solid ${riskBandColor(result.risk_band)}44`,
              }}>
                {result.risk_band}
              </div>
            )}
          </div>
          {Array.isArray(result.reasons) && result.reasons.length > 0 && (
            <div>
              <div style={{ fontSize: '0.7rem', color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Adverse Action Reasons
              </div>
              {result.reasons.slice(0, 3).map((r, i) => {
                const increases = r.direction === 'increase' || (r.shap_value ?? r.impact ?? 0) > 0;
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 0', borderBottom: i < 2 ? `1px solid ${C.border}` : 'none',
                  }}>
                    <span style={{ fontSize: '1rem', color: increases ? C.high : C.low, flexShrink: 0 }}>
                      {increases ? '↑' : '↓'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', color: C.text, fontWeight: 600 }}>
                        {r.feature || r.reason || r.code || `Factor ${i + 1}`}
                      </div>
                      {r.description && (
                        <div style={{ fontSize: '0.75rem', color: C.muted, marginTop: 2 }}>{r.description}</div>
                      )}
                    </div>
                    {(r.shap_value ?? r.impact) != null && (
                      <span style={{ fontSize: '0.78rem', color: increases ? C.high : C.low, fontWeight: 700, flexShrink: 0 }}>
                        {increases ? '+' : ''}{(+(r.shap_value ?? r.impact)).toFixed(3)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Contagion / systemic-risk tab ─────────────────────────────────────────────
const CONTAGION_SECTOR_COLORS = {
  Retail:       '#f59e0b',
  Government:   '#6366f1',
  Construction: '#84cc16',
  Finance:      '#3b82f6',
  Mining:       '#a855f7',
  Healthcare:   '#ec4899',
};

function StatCard({ label, value, accent, sub }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontWeight: 700, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: accent || C.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.68rem', color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ContagionTab() {
  const [report, setReport]   = useState(null);
  const [loadErr, setLoadErr] = useState(null);

  // Shock simulator state
  const [shockProvince, setShockProvince] = useState('');
  const [severity, setSeverity]           = useState(0.3);
  const [simResult, setSimResult]         = useState(null);
  const [simLoading, setSimLoading]       = useState(false);
  const [simError, setSimError]           = useState(null);

  useEffect(() => {
    bankApi.contagionReport()
      .then(d => {
        setReport(d);
        const provs = Object.keys(d?.portfolio_systemic_risk?.breakdown?.province_counts || {});
        setShockProvince(d?.contagion_simulation?.shock_province || provs[0] || '');
        setSimResult(d?.contagion_simulation || null);
      })
      .catch(e => setLoadErr(e.message));
  }, []);

  const simulate = async () => {
    if (!shockProvince) return;
    setSimLoading(true);
    setSimError(null);
    try {
      const r = await bankApi.simulateShock({ province: shockProvince, severity });
      setSimResult(r);
    } catch (e) {
      setSimError(e.message);
    } finally {
      setSimLoading(false);
    }
  };

  if (loadErr) {
    return (
      <div style={{ padding: '60px 40px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <GitBranch size={36} color={C.border} style={{ marginBottom: 16 }} />
        <div style={{ fontFamily: DISP, fontSize: '1.2rem', fontWeight: 500, color: C.text, marginBottom: 8 }}>Portfolio Risk Analysis</div>
        <p style={{ fontFamily: SANS, fontSize: '0.82rem', color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>
          Province shock propagation, correlated-default analysis, and sector contagion modelling require your live portfolio data to be ingested. This becomes available once your bank has active bids on the platform.
        </p>
        <button style={{ padding: '9px 20px', background: 'rgba(200,168,75,0.12)', border: `1px solid rgba(200,168,75,0.3)`, borderRadius: 8, color: C.gold, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
          Contact your account manager →
        </button>
      </div>
    );
  }
  if (!report) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${C.border}`, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const psr        = report.portfolio_systemic_risk || {};
  const provCounts = psr.breakdown?.province_counts || {};
  const secCounts  = psr.breakdown?.sector_counts || {};
  const provKeys   = Object.keys(provCounts);
  const provTotal  = provKeys.reduce((s, k) => s + (provCounts[k] || 0), 0) || 1;
  const maxProv    = Math.max(...provKeys.map(k => provCounts[k] || 0), 1);

  const secKeys   = Object.keys(secCounts);
  const secTotal  = secKeys.reduce((s, k) => s + (secCounts[k] || 0), 0) || 1;
  const maxSec    = Math.max(...secKeys.map(k => secCounts[k] || 0), 1);

  const adjacentSet = new Set(Object.keys(simResult?.adjacent_provinces || {}));
  const shockProv   = simResult?.shock_province;

  const pctFmt = (n) => (Math.round((n || 0) * 1000) / 10).toFixed(1) + '%';

  return (
    <div style={{ padding: '20px 28px' }}>
      <h3 style={{ margin: '0 0 4px', color: C.text, fontSize: '1.1rem', fontWeight: 700 }}>
        Contagion & Systemic Risk
      </h3>
      <p style={{ margin: '0 0 18px', color: C.muted, fontSize: '0.82rem' }}>
        Portfolio-level concentration, correlated-default risk, and province shock propagation
      </p>

      {/* Top stat row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
        <StatCard
          label="Systemic Risk Score"
          value={pctFmt(psr.systemic_risk_score)}
          accent={(psr.systemic_risk_score ?? 0) > 0.4 ? C.high : C.text}
          sub={(psr.systemic_risk_score ?? 0) > 0.4 ? 'Elevated' : 'Within bounds'}
        />
        <StatCard label="Correlated Default Prob" value={pctFmt(psr.correlated_default_prob)} />
        <StatCard
          label="Province HHI"
          value={(psr.province_hhi ?? 0).toFixed(4)}
          accent={(psr.province_hhi ?? 0) > 0.25 ? C.medium : C.text}
          sub={(psr.province_hhi ?? 0) > 0.25 ? 'Concentration warning' : 'Diversified'}
        />
        <StatCard label="Avg Hazard Score" value={(psr.avg_hazard_score ?? 0).toFixed(4)} />
      </div>

      {/* Middle: simulator + exposure */}
      <div style={{ display: 'flex', gap: 18, marginBottom: 24, flexWrap: 'wrap' }}>
        {/* Shock simulator */}
        <div style={{ flex: '1 1 380px', minWidth: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontWeight: 700, marginBottom: 14 }}>
            Shock Simulator
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: '0.72rem', color: C.muted, display: 'block', marginBottom: 5 }}>Shock province</label>
            <select value={shockProvince} onChange={e => setShockProvince(e.target.value)}
              style={{ width: '100%', background: '#0d1520', border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: '7px 10px', fontSize: '0.83rem', outline: 'none' }}>
              {provKeys.map(p => <option key={p} value={p}>{p} ({provCounts[p]} loans)</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.72rem', color: C.muted, display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span>Shock severity</span>
              <span style={{ color: C.text, fontWeight: 700 }}>{severity.toFixed(2)}</span>
            </label>
            <input type="range" min={0.1} max={0.9} step={0.05} value={severity}
              onChange={e => setSeverity(Number(e.target.value))}
              style={{ width: '100%', accentColor: C.gold, height: 4 }} />
          </div>

          <button onClick={simulate} disabled={simLoading}
            style={{ padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', background: C.gold, color: '#0b1e2d', fontWeight: 700, fontSize: '0.83rem', opacity: simLoading ? 0.6 : 1, marginBottom: 14 }}>
            {simLoading ? 'Simulating…' : 'Simulate'}
          </button>

          {simLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted, fontSize: '0.8rem' }}>
              <div style={{ width: 16, height: 16, border: `2px solid ${C.border}`, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Running propagation…
            </div>
          )}
          {simError && (
            <div style={{ color: C.high, fontSize: '0.8rem', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
              {simError}
            </div>
          )}

          {!simLoading && simResult && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {[
                  ['Directly affected', simResult.directly_affected, C.high],
                  ['Indirectly affected', simResult.indirectly_affected, C.medium],
                  ['Total exp. defaults', simResult.total_expected_defaults, C.text],
                  ['Systemic risk', pctFmt(simResult.systemic_risk_score), (simResult.systemic_risk_score ?? 0) > 0.4 ? C.high : C.low],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ textAlign: 'center', padding: '8px 4px', background: '#0d1520', borderRadius: 6 }}>
                    <div style={{ fontSize: '0.6rem', color: C.muted, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '0.62rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Adjacent provinces</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(simResult.adjacent_provinces || {}).map(([prov, d]) => (
                  <div key={prov} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: '#0d1520', borderRadius: 6 }}>
                    <span style={{ fontWeight: 700, color: C.text, fontSize: '0.82rem', width: 36 }}>{prov}</span>
                    <span style={{ flex: 1, fontSize: '0.72rem', color: C.muted }}>
                      spillover {pctFmt(d.spillover_rate)}
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: d.expected_defaults > 0 ? C.high : C.low }}>
                      {d.expected_defaults} def.
                    </span>
                  </div>
                ))}
                {Object.keys(simResult.adjacent_provinces || {}).length === 0 && (
                  <div style={{ fontSize: '0.74rem', color: C.muted }}>No adjacent exposure</div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Province exposure bars */}
        <div style={{ flex: '1 1 380px', minWidth: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontWeight: 700, marginBottom: 14 }}>
            Province Exposure
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {provKeys.sort((a, b) => provCounts[b] - provCounts[a]).map(p => {
              const count = provCounts[p] || 0;
              const isShock = p === shockProv;
              const isAdj   = adjacentSet.has(p);
              const color   = isShock ? C.high : isAdj ? C.medium : C.low;
              return (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 36, fontSize: '0.78rem', color: C.text, fontWeight: 700, flexShrink: 0 }}>{p}</span>
                  <div style={{ flex: 1, height: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: (count / maxProv * 100) + '%', height: '100%', background: color, opacity: 0.82, transition: 'width 0.4s ease' }} />
                  </div>
                  <span style={{ width: 78, fontSize: '0.72rem', color: C.muted, textAlign: 'right', flexShrink: 0 }}>
                    {count} · {Math.round(count / provTotal * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 14, fontSize: '0.7rem', color: C.muted }}>
            {[[C.high, 'Shock'], [C.medium, 'Adjacent'], [C.low, 'Other']].map(([col, lbl]) => (
              <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: col, opacity: 0.82 }} />{lbl}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Sector concentration */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontWeight: 700, marginBottom: 14 }}>
          Sector Concentration
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {secKeys.sort((a, b) => secCounts[b] - secCounts[a]).map(s => {
            const count = secCounts[s] || 0;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 110, fontSize: '0.76rem', color: C.text, fontWeight: 600, textAlign: 'right', flexShrink: 0 }}>{s}</span>
                <div style={{ flex: 1, height: 18, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: (count / maxSec * 100) + '%', height: '100%', background: CONTAGION_SECTOR_COLORS[s] || C.muted, opacity: 0.85, transition: 'width 0.4s ease' }} />
                </div>
                <span style={{ width: 90, fontSize: '0.72rem', color: C.muted, textAlign: 'right', flexShrink: 0 }}>
                  {count} · {Math.round(count / secTotal * 100)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Risk Settings tab ─────────────────────────────────────────────────────────
const PREMIUM_KEY     = 'bondly_bank_rate_premiums';
const MONITOR_KEY     = 'bondly_bank_monitor_prefs';

function RiskSettingsTab() {
  // Section 1 — thresholds
  const [greenAmber, setGreenAmber]   = useState(0.25);
  const [amberRed, setAmberRed]       = useState(0.50);
  const [redCritical, setRedCritical] = useState(0.65);
  const [savingT, setSavingT]         = useState(false);
  const [savedT, setSavedT]           = useState(false);
  const [errT, setErrT]               = useState(null);

  // Section 2 — premiums (localStorage)
  const [premiums, setPremiums] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PREMIUM_KEY)) || null; } catch { return null; }
  } );
  const prem = premiums || { green: 0, amber: 25, red: 75, critical: 150 };
  const [savedP, setSavedP] = useState(false);

  // Section 3 — monitoring prefs (localStorage)
  const [prefs, setPrefs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(MONITOR_KEY)) || null;
    } catch { return null; }
  });
  const monitor = prefs || { emailRed: true, weeklyDigest: true, contagionWarnings: true };

  const saveThresholds = async () => {
    setSavingT(true); setErrT(null); setSavedT(false);
    try {
      await bankApi.saveThresholds({ green_amber: greenAmber, amber_red: amberRed, red_critical: redCritical });
      setSavedT(true);
      setTimeout(() => setSavedT(false), 2500);
    } catch (e) {
      setErrT(e.message);
    } finally {
      setSavingT(false);
    }
  };

  const setPrem = (tier, val) => {
    const next = { ...prem, [tier]: val };
    setPremiums(next);
  };
  const savePremiums = () => {
    localStorage.setItem(PREMIUM_KEY, JSON.stringify(prem));
    setSavedP(true);
    setTimeout(() => setSavedP(false), 2500);
  };

  const toggle = (key) => {
    const next = { ...monitor, [key]: !monitor[key] };
    setPrefs(next);
    localStorage.setItem(MONITOR_KEY, JSON.stringify(next));
  };

  // Estimated interest impact: avg loan R1.8m over 20yr, premium in bps
  const AVG_LOAN = 1_800_000;
  const TERM_YRS = 20;
  const premiumInterest = (bps) => {
    const annual = AVG_LOAN * (bps / 10000);
    return Math.round(annual * TERM_YRS);
  };
  const randFmt = (n) => 'R ' + Math.round(n || 0).toLocaleString('en-ZA');

  // Tier preview bands (as % of 0..1 axis)
  const ga = Math.round(greenAmber * 100);
  const ar = Math.round(amberRed * 100);
  const rc = Math.round(redCritical * 100);

  const Slider = ({ label, value, onChange, color }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: '0.78rem', color: C.muted, display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />{label}
        </span>
        <span style={{ color: C.text, fontWeight: 700 }}>{value.toFixed(2)}</span>
      </label>
      <input type="range" min={0} max={1} step={0.01} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: color, height: 4 }} />
    </div>
  );

  const Toggle = ({ label, on, onClick }) => (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', cursor: 'pointer', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: '0.82rem', color: C.text }}>{label}</span>
      <div style={{ width: 40, height: 22, borderRadius: 11, background: on ? C.low : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: on ? 20 : 2, transition: 'left 0.2s' }} />
      </div>
    </div>
  );

  return (
    <div style={{ padding: '20px 28px', maxWidth: 760 }}>
      <h3 style={{ margin: '0 0 4px', color: C.text, fontSize: '1.1rem', fontWeight: 700 }}>
        Risk Settings
      </h3>
      <p style={{ margin: '0 0 22px', color: C.muted, fontSize: '0.82rem' }}>
        Configure alert thresholds, risk-based rate premiums, and monitoring preferences
      </p>

      {/* Section 1 — Alert Thresholds */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px', marginBottom: 18 }}>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontWeight: 700, marginBottom: 16 }}>
          Alert Thresholds
        </div>
        <Slider label="Green → Amber"    value={greenAmber}  onChange={setGreenAmber}  color={C.low} />
        <Slider label="Amber → Red"      value={amberRed}    onChange={setAmberRed}    color={C.medium} />
        <Slider label="Red → Critical"   value={redCritical} onChange={setRedCritical} color={C.high} />

        {/* Tier preview bar */}
        <div style={{ marginTop: 4, marginBottom: 14 }}>
          <div style={{ fontSize: '0.65rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Tier preview</div>
          <div style={{ height: 22, borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: ga + '%', background: C.low, transition: 'width 0.2s' }} />
            <div style={{ width: Math.max(0, ar - ga) + '%', background: C.medium, transition: 'width 0.2s' }} />
            <div style={{ width: Math.max(0, rc - ar) + '%', background: C.high, transition: 'width 0.2s' }} />
            <div style={{ width: Math.max(0, 100 - rc) + '%', background: '#7f1d1d', transition: 'width 0.2s' }} />
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: '0.68rem', color: C.muted, flexWrap: 'wrap' }}>
            {[['Green', C.low], ['Amber', C.medium], ['Red', C.high], ['Critical', '#7f1d1d']].map(([l, col]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: col }} />{l}
              </span>
            ))}
          </div>

          {/* Live portfolio impact estimate */}
          <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 8 }}>
            <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: C.faint, fontWeight: 700, marginBottom: 10 }}>Projected tier split at current thresholds</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
              {[
                ['Green', C.low, ga],
                ['Amber', C.medium, Math.max(0, ar - ga)],
                ['Red', C.high, Math.max(0, rc - ar)],
                ['Critical', '#7f1d1d', Math.max(0, 100 - rc)],
              ].map(([label, color, width]) => (
                <div key={label} style={{ textAlign: 'center', padding: '8px 4px', background: '#0d1520', borderRadius: 6 }}>
                  <div style={{ fontSize: '0.6rem', color: C.muted, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color }}>{width}%</div>
                  <div style={{ fontSize: '0.6rem', color: C.faint, marginTop: 2 }}>of score range</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '0.68rem', color: C.faint, marginTop: 8 }}>
              Move sliders to see how threshold changes redistribute your portfolio across tiers.
            </div>
          </div>
        </div>

        <button onClick={saveThresholds} disabled={savingT}
          style={{ padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', background: C.gold, color: '#0b1e2d', fontWeight: 700, fontSize: '0.83rem', opacity: savingT ? 0.6 : 1 }}>
          {savingT ? 'Saving…' : 'Save thresholds'}
        </button>
        {savedT && <span style={{ marginLeft: 12, color: C.low, fontSize: '0.8rem', fontWeight: 600 }}>✓ Saved</span>}
        {errT && <span style={{ marginLeft: 12, color: C.high, fontSize: '0.8rem' }}>{errT}</span>}
      </div>

      {/* Section 2 — Rate Premiums */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px', marginBottom: 18 }}>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontWeight: 700, marginBottom: 16 }}>
          Rate Premium by Risk Tier
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 14 }}>
          {[
            ['Green', 'green', C.low],
            ['Amber', 'amber', C.medium],
            ['Red', 'red', C.high],
            ['Critical', 'critical', '#7f1d1d'],
          ].map(([label, key, color]) => (
            <div key={key} style={{ background: '#0d1520', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: C.muted, marginBottom: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />{label} tier
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="number" min={0} value={prem[key]}
                  onChange={e => setPrem(key, Number(e.target.value))}
                  style={{ width: 70, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: '6px 8px', fontSize: '0.85rem', outline: 'none', fontWeight: 700 }} />
                <span style={{ fontSize: '0.72rem', color: C.muted }}>bps</span>
              </div>
              <div style={{ fontSize: '0.66rem', color: C.muted, marginTop: 8 }}>
                +{randFmt(premiumInterest(prem[key]))} interest income
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.7rem', color: C.muted, marginBottom: 12 }}>
          Estimated impact over an avg R1.8m loan across a 20-year term.
        </div>
        <button onClick={savePremiums}
          style={{ padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', background: C.gold, color: '#0b1e2d', fontWeight: 700, fontSize: '0.83rem' }}>
          Save rate premiums
        </button>
        {savedP && <span style={{ marginLeft: 12, color: C.low, fontSize: '0.8rem', fontWeight: 600 }}>✓ Saved</span>}
      </div>

      {/* Section 3 — Monitoring Preferences */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontWeight: 700, marginBottom: 8 }}>
          Monitoring Preferences
        </div>
        <Toggle label="Email alerts when accounts move to Red" on={monitor.emailRed}          onClick={() => toggle('emailRed')} />
        <Toggle label="Weekly portfolio digest"               on={monitor.weeklyDigest}       onClick={() => toggle('weeklyDigest')} />
        <Toggle label="Show contagion warnings on dashboard"  on={monitor.contagionWarnings}  onClick={() => toggle('contagionWarnings')} />
      </div>
    </div>
  );
}

// ── Trends Tab ────────────────────────────────────────────────────────────────
function TrendsTab({ data }) {
  const [compareMode, setCompareMode] = useState(false);
  const [periodA, setPeriodA] = useState(0);
  const [periodB, setPeriodB] = useState(1);
  const [moversFilter, setMoversFilter] = useState('all');

  const periods = data.periods?.monthly || [];
  const panels  = data.monthlyPanels || [];

  // Build per-period aggregate metrics
  const timeline = periods.map((p, i) => {
    const panel = panels[i] || [];
    if (!panel.length) return { period: p, avgFdi: 0, highPct: 0, medPct: 0, count: 0 };
    const total   = panel.length;
    const high    = panel.filter(r => (r.fdi ?? 0) >= 60).length;
    const med     = panel.filter(r => (r.fdi ?? 0) >= 35 && (r.fdi ?? 0) < 60).length;
    const avgFdi  = Math.round(panel.reduce((s, r) => s + (r.fdi ?? 0), 0) / total * 10) / 10;
    return { period: p, avgFdi, highPct: Math.round(high / total * 100), medPct: Math.round(med / total * 100), count: total };
  });

  // Sector trends across periods
  const allSectors = [...new Set((panels.flat()).map(r => r.sector).filter(Boolean))];
  const sectorTrend = allSectors.slice(0, 6).map(sector => ({
    sector,
    label: ({
      government_public:'Government', financial_services:'Finance', retail_trade:'Retail',
      education:'Education', healthcare:'Healthcare', gig_platform:'Gig',
      hospitality_tourism:'Hospitality', construction:'Construction',
      transport_logistics:'Transport', ict_tech:'ICT/Tech',
    })[sector] || sector,
    color: ({
      government_public:'#6366f1', financial_services:'#3b82f6', retail_trade:'#f59e0b',
      education:'#10b981', healthcare:'#ec4899', gig_platform:'#8b5cf6',
      hospitality_tourism:'#f97316', construction:'#84cc16',
      transport_logistics:'#06b6d4', ict_tech:'#a78bfa',
    })[sector] || '#4b5563',
    values: periods.map((_, i) => {
      const panel = panels[i] || [];
      const sRows = panel.filter(r => r.sector === sector);
      if (!sRows.length) return null;
      return Math.round(sRows.reduce((s, r) => s + (r.fdi ?? 0), 0) / sRows.length * 10) / 10;
    }),
  }));

  // Suburb movers: biggest change between first and last period
  const firstPanel = panels[0] || [];
  const lastPanel  = panels[panels.length - 1] || [];
  const allMovers = firstPanel.map(r => {
    const last = lastPanel.find(l => l.suburb === r.suburb);
    if (!last) return null;
    return { suburb: r.suburb, first: r.fdi ?? 0, last: last.fdi ?? 0, delta: Math.round(((last.fdi ?? 0) - (r.fdi ?? 0)) * 10) / 10 };
  }).filter(Boolean).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  // "My bids" filter: use suburbs from the most recent panel that have inBids flag, else show all
  const bidSuburbs = new Set((data.activeBids || []).map(b => b.suburb).filter(Boolean));
  const movers = moversFilter === 'bids' && bidSuburbs.size > 0
    ? allMovers.filter(r => bidSuburbs.has(r.suburb)).slice(0, 10)
    : allMovers.slice(0, 10);

  // Compare mode: diff two periods
  const panelA = panels[periodA] || [];
  const panelB = panels[periodB] || [];
  const compareDiff = panelA.map(r => {
    const b = panelB.find(l => l.suburb === r.suburb);
    if (!b) return null;
    return { suburb: r.suburb, a: r.fdi ?? 0, b: b.fdi ?? 0, delta: (b.fdi ?? 0) - (r.fdi ?? 0) };
  }).filter(Boolean).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  if (timeline.length < 2) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#7c8fa6' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>📈</div>
        <div>Need at least 2 periods of data for trend analysis.</div>
        <div style={{ fontSize: '0.78rem', marginTop: 6 }}>Run the pipeline monthly to build up trend history.</div>
      </div>
    );
  }

  // SVG multi-line chart helper
  function LineChart({ series, labels, height = 140, yLabel = '' }) {
    const allVals = series.flatMap(s => s.values.filter(v => v != null));
    const min = Math.min(...allVals, 0);
    const max = Math.max(...allVals, 1);
    const range = max - min || 1;
    const W = 600, H = height, PAD = { top: 12, right: 16, bottom: 24, left: 44 };
    const iW = W - PAD.left - PAD.right;
    const iH = H - PAD.top - PAD.bottom;
    const n = labels.length;
    const x = i => PAD.left + (i / Math.max(n - 1, 1)) * iW;
    const y = v => PAD.top + iH - ((v - min) / range) * iH;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: height, display: 'block' }}>
        {yLabel && (
          <text x={10} y={H / 2} textAnchor="middle" fontSize="8.5" fill="#4a6080"
            transform={`rotate(-90, 10, ${H / 2})`} letterSpacing="0.5">{yLabel}</text>
        )}
        {[0, 25, 50, 75, 100].filter(v => v >= min && v <= max).map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={PAD.left - 4} y={y(v) + 4} textAnchor="end" fontSize="9" fill="#4a6080">{v}</text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={i} x={x(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#4a6080">
            {l.slice(5)}
          </text>
        ))}
        {series.map((s, si) => {
          let d = '';
          s.values.forEach((v, i) => {
            if (v == null) return;
            const cmd = (i === 0 || s.values[i-1] == null) ? 'M' : 'L';
            d += `${cmd}${x(i)},${y(v)} `;
          });
          return (
            <g key={si}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
              {s.values.map((v, i) => v != null && (
                <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={s.color} />
              ))}
            </g>
          );
        })}
      </svg>
    );
  }

  const periodShort = p => p ? p.slice(5) : '';

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#c8a84b', fontWeight: 700, marginBottom: 4 }}>Historical Analysis</div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#e2e8f0' }}>Trends & Period Analysis</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#7c8fa6' }}>{timeline.length} periods · {periodShort(periods[0])} → {periodShort(periods[periods.length - 1])}</p>
        </div>
        <button onClick={() => setCompareMode(m => !m)} style={{
          padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
          background: compareMode ? '#c8a84b' : 'rgba(255,255,255,0.06)',
          color: compareMode ? '#0b1e2d' : '#e2e8f0', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
        }}>
          {compareMode ? '✕ Exit compare' : '⇄ Compare periods'}
        </button>
      </div>

      {/* Compare mode */}
      {compareMode && (
        <div style={{ background: '#0f2236', border: '1px solid rgba(200,168,75,0.3)', borderRadius: 12, padding: '18px 22px', marginBottom: 24 }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#c8a84b', fontWeight: 700, marginBottom: 14, letterSpacing: '0.08em' }}>Period Comparison</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {[['Period A', periodA, setPeriodA], ['Period B', periodB, setPeriodB]].map(([label, val, setter]) => (
              <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '0.72rem', color: '#7c8fa6', fontWeight: 700 }}>{label}</span>
                <select value={val} onChange={e => setter(Number(e.target.value))}
                  style={{ padding: '7px 10px', background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, color: '#e2e8f0', fontSize: '0.85rem' }}>
                  {periods.map((p, i) => <option key={p} value={i}>{p}</option>)}
                </select>
              </label>
            ))}
          </div>
          {(() => {
            const tA = timeline[periodA], tB = timeline[periodB];
            if (!tA || !tB) return null;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Avg Distress', a: tA.avgFdi, b: tB.avgFdi, suffix: '' },
                  { label: 'High Distress %', a: tA.highPct, b: tB.highPct, suffix: '%' },
                  { label: 'Medium Distress %', a: tA.medPct, b: tB.medPct, suffix: '%' },
                ].map(m => {
                  const d = Math.round((m.b - m.a) * 10) / 10;
                  return (
                    <div key={m.label} style={{ background: '#091420', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ fontSize: '0.65rem', color: '#7c8fa6', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>{m.label}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#e2e8f0' }}>{m.b}{m.suffix}</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: d > 0 ? '#ef4444' : d < 0 ? '#22c55e' : '#7c8fa6' }}>
                          {d > 0 ? '▲' : d < 0 ? '▼' : '='}{Math.abs(d)}{m.suffix}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#4a6080', marginTop: 2 }}>was {m.a}{m.suffix} in {periods[periodA]}</div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#7c8fa6', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 10 }}>
            Biggest Movers ({periods[periodA]} → {periods[periodB]})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0 12px', fontSize: '0.78rem' }}>
            {['Suburb', periods[periodA], periods[periodB], 'Change'].map(h => (
              <div key={h} style={{ color: '#4a6080', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</div>
            ))}
            {compareDiff.slice(0, 8).map(r => (
              <>
                <div key={r.suburb + 'n'} style={{ color: '#e2e8f0', fontWeight: 600, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{r.suburb}</div>
                <div key={r.suburb + 'a'} style={{ color: '#7c8fa6', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{r.a}</div>
                <div key={r.suburb + 'b'} style={{ color: '#7c8fa6', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{r.b}</div>
                <div key={r.suburb + 'd'} style={{ color: r.delta > 0 ? '#ef4444' : '#22c55e', fontWeight: 700, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {r.delta > 0 ? '+' : ''}{r.delta}
                </div>
              </>
            ))}
          </div>
        </div>
      )}

      {/* Main trend charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: '#0f2236', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#7c8fa6', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }}>Avg Distress Index Over Time</div>
          <div style={{ fontSize: '0.75rem', color: '#7c8fa6', marginBottom: 12 }}>Monthly average FDI score across all tracked suburbs</div>
          <LineChart series={[{ values: timeline.map(t => t.avgFdi), color: '#c8a84b' }]} labels={periods} height={130} yLabel="FDI score" />
        </div>
        <div style={{ background: '#0f2236', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#7c8fa6', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }}>High Distress Suburbs (%)</div>
          <div style={{ fontSize: '0.75rem', color: '#7c8fa6', marginBottom: 12 }}>Share of suburbs with FDI ≥ 60 (critical threshold)</div>
          <LineChart
            series={[
              { values: timeline.map(t => t.highPct), color: '#ef4444' },
              { values: timeline.map(t => t.medPct),  color: '#f59e0b' },
            ]}
            labels={periods}
            height={130}
            yLabel="% suburbs"
          />
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: '0.68rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 10, height: 3, background: '#ef4444', borderRadius: 2 }} /> High distress</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 10, height: 3, background: '#f59e0b', borderRadius: 2 }} /> Medium distress</span>
          </div>
        </div>
      </div>

      {/* Sector trend chart */}
      {sectorTrend.length > 0 && (
        <div style={{ background: '#0f2236', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#7c8fa6', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }}>Sector Distress Trends</div>
          <div style={{ fontSize: '0.75rem', color: '#7c8fa6', marginBottom: 12 }}>Average FDI by employment sector — which sectors are deteriorating?</div>
          <LineChart series={sectorTrend} labels={periods} height={160} yLabel="Avg FDI" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
            {sectorTrend.map(s => (
              <span key={s.sector} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: '#7c8fa6' }}>
                <span style={{ display: 'inline-block', width: 10, height: 3, background: s.color, borderRadius: 2 }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suburb movers table */}
      {movers.length > 0 && (
        <div style={{ background: '#0f2236', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#7c8fa6', fontWeight: 700, letterSpacing: '0.08em' }}>Biggest Suburb Movers</div>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 2, gap: 2 }}>
              {[['all','All suburbs'],['bids','My bids only']].map(([k,l]) => (
                <button key={k} onClick={() => setMoversFilter(k)} style={{ fontFamily: MONO, fontSize: 10, padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', background: moversFilter===k ? '#1e3a5f' : 'transparent', color: moversFilter===k ? '#fff' : '#7c8fa6' }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#7c8fa6', marginBottom: 14 }}>
            Largest FDI change from {periods[0]} to {periods[periods.length - 1]}{moversFilter === 'bids' ? ' · filtered to your active bids' : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '0 16px', fontSize: '0.78rem' }}>
            {['Suburb', 'Start', 'End', 'Δ Change', 'Trend'].map(h => (
              <div key={h} style={{ color: '#4a6080', fontWeight: 700, fontSize: '0.63rem', textTransform: 'uppercase', letterSpacing: '0.06em', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</div>
            ))}
            {movers.map(r => {
              const seriesForSuburb = periods.map((_, i) => {
                const row = (panels[i] || []).find(p => p.suburb === r.suburb);
                return row ? (row.fdi ?? 0) : null;
              });
              return (
                <Fragment key={r.suburb}>
                  <div style={{ color: '#e2e8f0', fontWeight: 600, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{r.suburb}</div>
                  <div style={{ color: '#7c8fa6', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{r.first}</div>
                  <div style={{ color: '#7c8fa6', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{r.last}</div>
                  <div style={{ color: r.delta > 0 ? '#ef4444' : '#22c55e', fontWeight: 700, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {r.delta > 0 ? '▲ +' : '▼ '}{r.delta}
                  </div>
                  <div style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <Sparkline values={seriesForSuburb} color={r.delta > 0 ? '#ef4444' : '#22c55e'} width={70} height={22} />
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Fraud network graph shapes ────────────────────────────────────────────────
const CX = 270, CY = 178;
function buildFanio() {
  const mY = [58,118,178,238,298];
  return { nodes:[{id:'SRC',x:80,y:178,r:20,lab:'SRC'},...mY.map((y,i)=>({id:'M'+i,x:270,y,r:13,lab:'M·'+(i+1)})),{id:'COL',x:470,y:178,r:20,lab:'COL'}], edges:[...mY.map((_,i)=>({a:'SRC',b:'M'+i,w:2})),...mY.map((_,i)=>({a:'M'+i,b:'COL',w:2}))] };
}
function buildCycle() {
  const n=6,R=110,nodes=[],edges=[];
  for(let i=0;i<n;i++){const ang=(-90+i*360/n)*Math.PI/180;nodes.push({id:'S'+i,x:CX+R*Math.cos(ang),y:CY+R*Math.sin(ang),r:15,lab:'E·'+(i+1)});edges.push({a:'S'+i,b:'S'+((i+1)%n),w:2.2});}
  return {nodes,edges};
}
function buildStar() {
  const n=6,R=120,nodes=[{id:'DEV',x:CX,y:CY,r:19,lab:'HUB'}],edges=[];
  for(let i=0;i<n;i++){const ang=(-90+i*360/n)*Math.PI/180;nodes.push({id:'A'+i,x:CX+R*Math.cos(ang),y:CY+R*Math.sin(ang),r:13,lab:'ID·'+(i+1)});edges.push({a:'DEV',b:'A'+i,w:1.8});}
  return {nodes,edges};
}
function buildLoose() {
  const pts=[[120,90],[210,60],[300,110],[400,80],[150,250],[260,280],[380,250],[300,178]];
  return { nodes:pts.map((p,i)=>({id:'L'+i,x:p[0],y:p[1],r:i===7?17:12,lab:i===7?'AGT':'C·'+(i+1)})), edges:[0,1,2,3,4,5,6].map(i=>({a:'L7',b:'L'+i,w:1.4})) };
}

const FRAUD_NETS = [
  { id:'mule',   label:'Mule consolidation network', typ:'Mule network',        risk:88, status:'Open',          exp:4.2, apps:2, fatf:'Layering · mule network',      why:'Funds fan out from one source to 5 pass-through accounts and reconsolidate to a single collector within 72 h. Retention ≈ 0 — textbook layering.',                   action:'Hold bids · enhanced due diligence · STR review', g:buildFanio() },
  { id:'shell',  label:'Round-trip / shell chain',   typ:'Shell & round-tripping',risk:74,status:'Open',         exp:6.8, apps:0, fatf:'Integration · round-tripping',  why:'Value cycles through 6 entities with no operational footprint and returns to origin — a closed money cycle.',                                                           action:'Refer · verify beneficial ownership',            g:buildCycle() },
  { id:'synth',  label:'Synthetic-identity cluster', typ:'Synthetic identity',   risk:69, status:'Open',         exp:3.1, apps:4, fatf:'Fraud · synthetic ID',          why:'6 applications share one device fingerprint, address and employer string while presenting distinct identities.',                                                            action:'Manual KYC · biometric verification',            g:buildStar()  },
  { id:'legit',  label:'Normal referral cluster',    typ:'No typology detected', risk:18, status:'Cleared',      exp:5.4, apps:7, fatf:'—',                             why:'Organic cluster from one estate-agent branch; relationships explained by a shared broker, not illicit linkage.',                                                        action:'No action — monitor only',                       g:buildLoose() },
];
const ST_COLOR = { Open: C.high, Investigating: C.medium, Cleared: C.low };

function FraudNetworksTab({ heatmaps }) {
  const [sel, setSel]         = useState(FRAUD_NETS[0]);
  const [gnode, setGnode]     = useState(null);
  const [stFilter, setStFilter] = useState('All');
  const [, forceRender]       = useState(0);

  const nodeMap = Object.fromEntries(sel.g.nodes.map(n => [n.id, n]));
  const adj     = gnode ? new Set(sel.g.edges.filter(e=>e.a===gnode||e.b===gnode).flatMap(e=>[e.a,e.b])) : null;

  const activeNets = FRAUD_NETS.filter(n => n.status !== 'Cleared').length;
  const totExp     = FRAUD_NETS.filter(n => n.status !== 'Cleared').reduce((s,n) => s+n.exp, 0).toFixed(1);
  const nList      = FRAUD_NETS.filter(n => stFilter==='All' || n.status===stFilter);

  // Real counts from heatmaps if available
  const typo = heatmaps?.fraudTypologies || {};

  return (
    <div style={{ padding: '20px 28px', overflowY: 'auto', flex: 1 }}>
      {/* Urgent alert — live bids exposed to flagged networks */}
      {(() => { const urgentApps = FRAUD_NETS.filter(n => n.status !== 'Cleared').reduce((s,n) => s + n.apps, 0); return urgentApps > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
          <Flag size={15} color={C.high} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 13, color: C.high }}>{urgentApps} live application{urgentApps > 1 ? 's' : ''} in your active bids</span>
            <span style={{ fontFamily: SANS, fontSize: 12, color: '#e07070', marginLeft: 6 }}>are linked to flagged fraud networks — review before bidding closes.</span>
          </div>
          <button style={{ flexShrink: 0, padding: '5px 12px', background: C.high, border: 'none', borderRadius: 6, color: '#fff', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}>Review now</button>
        </div>
      ) : null; })()}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(70,197,146,0.05)', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 18 }}>
        <Lock size={14} color={C.low} />
        <span style={{ fontFamily: SANS, fontSize: 12, color: C.body }}>Anonymised network intelligence. Node colours = risk score (green low → red high). Arrows show fund flow direction. Identities resolve only inside <strong style={{ color: C.text }}>your own bid review</strong>; cross-market stays k-anonymised (POPIA/FIC compliant).</span>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: C.border, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
        <Kpi label="Active networks"   value={activeNets}        sub="open or investigating" />
        <Kpi label="Flagged exposure"  value={`R${totExp}m`}     sub="across active cases"   tone={C.medium} />
        <Kpi label="Highest risk"      value={Math.max(...FRAUD_NETS.map(n=>n.risk))} sub="risk score" tone={C.high} />
        <Kpi label="In your bids"      value={FRAUD_NETS.filter(n=>n.status!=='Cleared').reduce((s,n)=>s+n.apps,0)} sub="live applications" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 280px', gap: 16 }}>
        {/* Network list */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', alignSelf: 'start' }}>
          <div style={{ padding: '13px 16px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 13, color: C.text, marginBottom: 10 }}>Detected networks</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {['All','Open','Cleared'].map(s => (
                <button key={s} onClick={() => setStFilter(s)} style={{ fontFamily: MONO, fontSize: 10, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${stFilter===s ? C.low : C.border}`, background: stFilter===s ? 'rgba(76,190,130,0.1)' : 'transparent', color: stFilter===s ? C.low : C.muted }}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            {nList.map(n => {
              const a = sel.id === n.id;
              return (
                <div key={n.id} onClick={() => { setSel(n); setGnode(null); }} style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', background: a ? 'rgba(200,168,75,0.07)' : 'transparent', borderLeft: `2px solid ${a ? C.gold : 'transparent'}`, transition: 'background .15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontFamily: SANS, fontSize: 12.5, color: C.text, fontWeight: a ? 600 : 500 }}>{n.typ}</span>
                    <span style={{ fontFamily: DISP, fontSize: 18, color: riskColor(n.risk), lineHeight: 1 }}>{n.risk}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 10, color: C.faint }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: ST_COLOR[n.status] }}><Circle size={6} fill={ST_COLOR[n.status]} color={ST_COLOR[n.status]} />{n.status}</span>
                    <span>R{n.exp}m</span>
                    {n.apps > 0 && <span>· {n.apps} bids</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SVG graph */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 14, color: C.text }}>{sel.label}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10.5, color: C.muted }}>
              <GitBranch size={12} />{sel.g.nodes.length} entities · {sel.g.edges.length} links
            </span>
          </div>
          <div style={{ fontFamily: SANS, fontSize: 11.5, color: C.faint, marginBottom: 6 }}>tap a node to inspect · arrows show flow direction</div>
          <svg viewBox="0 0 560 360" style={{ width: '100%', height: 'auto' }}>
            <defs>
              <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M1 1L9 5L1 9" fill="none" stroke={C.muted} strokeWidth="1.4" strokeLinecap="round" />
              </marker>
            </defs>
            {sel.g.edges.map((e,i) => {
              const A = nodeMap[e.a], B = nodeMap[e.b];
              if (!A || !B) return null;
              const dim = adj && !(adj.has(e.a) && adj.has(e.b));
              const ang = Math.atan2(B.y-A.y, B.x-A.x);
              return <line key={i} x1={A.x+Math.cos(ang)*(A.r+3)} y1={A.y+Math.sin(ang)*(A.r+3)} x2={B.x-Math.cos(ang)*(B.r+5)} y2={B.y-Math.sin(ang)*(B.r+5)} stroke={dim ? C.border : C.border2} strokeWidth={dim ? 1 : e.w} markerEnd="url(#ah)" opacity={dim ? 0.4 : 1} />;
            })}
            {sel.g.nodes.map(n => {
              const dim = adj && !adj.has(n.id);
              const col = riskColor(sel.risk);
              const active = gnode === n.id;
              return (
                <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => setGnode(active ? null : n.id)} opacity={dim ? 0.3 : 1}>
                  {active && <circle cx={n.x} cy={n.y} r={n.r+6} fill="none" stroke={C.gold} strokeWidth="1.3" />}
                  <circle cx={n.x} cy={n.y} r={n.r} fill={col} opacity="0.9" style={{ filter: `drop-shadow(0 0 7px ${col})` }} />
                  <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central" fontFamily={MONO} fontSize={n.r>15?10:8.5} fill="#06120c" fontWeight="500">{n.lab}</text>
                </g>
              );
            })}
          </svg>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, fontFamily: MONO, fontSize: 10, color: C.faint }}>
            {[[C.high,'high'],[C.medium,'watch'],[C.low,'clear']].map(([c,l]) => (
              <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 9, background: c }} />{l}</span>
            ))}
            <span style={{ marginLeft: 'auto' }}>node size = exposure</span>
          </div>
        </div>

        {/* Detail panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignSelf: 'start' }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: C.faint, marginBottom: 8 }}>Risk score</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
              <span style={{ fontFamily: DISP, fontSize: 44, fontWeight: 600, color: riskColor(sel.risk), lineHeight: 0.9 }}>{sel.risk}</span>
              <span style={{ fontFamily: SANS, fontSize: 13, color: C.body }}>{sel.typ}</span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.muted, marginBottom: 14 }}>FATF: {sel.fatf}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: C.faint, marginBottom: 6 }}>Why it flagged</div>
            <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.body, lineHeight: 1.55, marginBottom: 14 }}>{sel.why}</div>
            <div style={{ display: 'flex', gap: 18, marginBottom: 14 }}>
              <div><div style={{ fontFamily: DISP, fontSize: 19, color: C.text }}>R{sel.exp}m</div><div style={{ fontFamily: MONO, fontSize: 9.5, color: C.faint }}>exposure</div></div>
              <div><div style={{ fontFamily: DISP, fontSize: 19, color: C.text }}>{sel.apps}</div><div style={{ fontFamily: MONO, fontSize: 9.5, color: C.faint }}>in your bids</div></div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: C.faint, marginBottom: 6 }}>Recommended action</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(200,168,75,0.07)', border: `1px solid ${C.border}`, borderRadius: 9, padding: '9px 12px', fontFamily: SANS, fontSize: 12.5, color: C.text }}>
              <ChevronRight size={14} color={C.gold} />{sel.action}
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: C.faint, marginBottom: 10 }}>Case status</div>
            <div style={{ display: 'flex', gap: 7 }}>
              {[['Open', Flag], ['Investigating', Eye], ['Cleared', CheckCircle2]].map(([s, Ico]) => {
                const active = sel.status === s;
                return (
                  <button key={s} onClick={() => { const i = FRAUD_NETS.findIndex(x=>x.id===sel.id); FRAUD_NETS[i].status=s; setSel({...FRAUD_NETS[i]}); forceRender(v=>v+1); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '9px 4px', borderRadius: 9, cursor: 'pointer', border: `1px solid ${active ? ST_COLOR[s] : C.border}`, background: active ? 'rgba(255,255,255,0.04)' : 'transparent', color: active ? ST_COLOR[s] : C.muted, fontFamily: SANS, fontSize: 11 }}>
                    <Ico size={15} />{s}
                  </button>
                );
              })}
            </div>
            {gnode && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, fontFamily: MONO, fontSize: 11, color: C.body }}>
                Inspecting <strong style={{ color: C.gold }}>{nodeMap[gnode]?.lab}</strong> · {sel.g.edges.filter(e=>e.a===gnode||e.b===gnode).length} links
              </div>
            )}
          </div>

          {/* Live counts from heatmaps */}
          {Object.keys(typo).length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: C.faint, marginBottom: 10 }}>Live typology counts</div>
              {Object.entries(typo).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 12, color: C.body, marginBottom: 6 }}>
                  <span>{k.replace(/_/g,' ')}</span>
                  <span style={{ fontFamily: MONO, color: C.text, fontWeight: 600 }}>{v.count ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: C.faint, paddingTop: 20, textAlign: 'center', letterSpacing: 0.4 }}>
        synthetic demo data · k-anonymised (k≥20 in production) · cross-market intelligence — never individual decisions
      </div>
    </div>
  );
}

export default function BankIntelligence() {
  const [data,        setData]        = useState(null);
  const [err,         setErr]         = useState(null);
  const [generating,  setGenerating]  = useState(false);
  const [granularity, setGranularity] = useState('monthly');
  const [periodIdx,   setPeriodIdx]   = useState(null);
  const [activeTab,   setActiveTab]   = useState('overview');
  const pollRef = useRef(null);

  useEffect(() => {
    const load = () =>
      bankApi.intelligence().then(d => {
        if (d.generating) {
          setGenerating(true);
          pollRef.current = setTimeout(load, 10000);
          return;
        }
        setGenerating(false);
        setData(d);
        const periods = d.periods?.monthly || [];
        setPeriodIdx(periods.length ? periods.length - 1 : null);
      }).catch(e => setErr(e.message));
    load();
    return () => clearTimeout(pollRef.current);
  }, []);

  const handleGranularity = useCallback((g) => {
    setGranularity(g);
    if (!data) return;
    const p = data.periods?.[g === 'monthly' ? 'monthly' : 'weekly'] || [];
    setPeriodIdx(p.length ? p.length - 1 : null);
  }, [data]);

  // Break out of bank-content padding for full dark treatment
  const fullBleed = {
    margin: '-28px -32px -60px',
    background: C.bg,
    color: C.text,
    fontFamily: SANS,
    minHeight: 'calc(100vh - 60px)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  };

  if (err) return (
    <div style={{ ...fullBleed, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>📡</div>
        <h3 style={{ color: C.text, marginBottom: 8 }}>Intelligence data not available</h3>
        <p style={{ color: C.muted, fontSize: '0.85rem', marginBottom: 16 }}>Generate it by running the pipeline:</p>
        <code style={{ background: '#1e293b', color: '#94a3b8', padding: '8px 16px', borderRadius: 8, fontSize: '0.82rem', display: 'block' }}>
          CATEGORISATION_LLM_DISABLED=1 node scripts/run-pipeline-500.js
        </code>
      </div>
    </div>
  );

  if (generating || !data) return (
    <div style={{ ...fullBleed, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, border: `3px solid ${C.border}`, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ color: C.text, fontWeight: 600, marginBottom: 6 }}>
          {generating ? 'Generating intelligence pipeline…' : 'Loading intelligence data…'}
        </div>
        {generating && <div style={{ color: C.muted, fontSize: '0.83rem' }}>First-run takes ~90 seconds. This page will update automatically.</div>}
      </div>
    </div>
  );

  const { meta, suburbPanel, sectorBreakdown, accuracy, periods, monthlyPanels, weeklyPanels, analytics } = data;

  const randFmt = (n) => 'R ' + Math.round(n || 0).toLocaleString('en-ZA');

  const activePanels  = granularity === 'monthly' ? (monthlyPanels || []) : (weeklyPanels || []);
  const activePeriods = periods?.[granularity === 'monthly' ? 'monthly' : 'weekly'] || [];
  const safeIdx       = periodIdx != null ? Math.min(periodIdx, activePanels.length - 1) : activePanels.length - 1;
  const currentPanel  = activePanels[safeIdx]?.panel || suburbPanel || [];
  const prevPanel     = safeIdx > 0 ? activePanels[safeIdx - 1]?.panel : null;
  const currentPeriod = activePeriods[safeIdx] || '';

  // Compute period metrics
  const panelFdis  = currentPanel.map(r => r.fdi ?? 0);
  const prevFdiMap = prevPanel ? Object.fromEntries(prevPanel.map(r => [r.suburb, r.fdi])) : {};
  const avgFdi     = panelFdis.length ? Math.round(panelFdis.reduce((s, v) => s + v, 0) / panelFdis.length) : 0;
  const highPct    = panelFdis.length ? Math.round(panelFdis.filter(v => v >= 60).length / panelFdis.length * 100) : 0;
  const medPct     = panelFdis.length ? Math.round(panelFdis.filter(v => v >= 35 && v < 60).length / panelFdis.length * 100) : 0;
  const lowPct     = 100 - highPct - medPct;

  // Sparkline series across all periods
  const sparkAvgFdi  = activePanels.map(panel => panel.length ? Math.round(panel.reduce((s, r) => s + (r.fdi ?? 0), 0) / panel.length * 10) / 10 : 0);
  const sparkHighPct = activePanels.map(panel => panel.length ? Math.round(panel.filter(r => (r.fdi ?? 0) >= 60).length / panel.length * 100) : 0);

  const prevAvgFdi   = prevPanel ? Math.round(prevPanel.map(r => r.fdi ?? 0).reduce((s, v) => s + v, 0) / prevPanel.length) : null;
  const prevHighPct  = prevPanel ? Math.round(prevPanel.filter(r => (r.fdi ?? 0) >= 60).length / prevPanel.length * 100) : null;
  const avgFdiDelta  = prevAvgFdi  != null ? avgFdi  - prevAvgFdi  : null;
  const highPctDelta = prevHighPct != null ? highPct - prevHighPct : null;

  // Sector donut data
  const totalSector = (sectorBreakdown || []).reduce((s, r) => s + r.count, 0);
  const donutSlices = (sectorBreakdown || []).slice(0, 8).map(s => ({
    label: SECTOR_LABELS[s.sector] || s.sector,
    color: SECTOR_COLORS[s.sector] || C.muted,
    pct:   s.pct,
    count: s.count,
  }));

  // Top high-distress suburbs
  const topHigh = [...currentPanel].sort((a, b) => (b.fdi ?? 0) - (a.fdi ?? 0)).slice(0, 5);

  function DeltaTag({ val, flip }) {
    if (val == null) return null;
    const isBad = flip ? val > 0 : val < 0;
    const color = isBad ? C.high : C.low;
    return (
      <span style={{ fontSize: '0.75rem', color, fontWeight: 600, marginLeft: 6 }}>
        {val > 0 ? '▲' : '▼'} {Math.abs(val)}pp
      </span>
    );
  }

  const TABS = [
    { id: 'overview',  label: 'Overview',       icon: <Sparkles   size={13} /> },
    { id: 'trends',    label: 'Trends',          icon: <TrendingUp size={13} /> },
    { id: 'networks',  label: 'Networks',        icon: <ShieldAlert size={13} />, badge: FRAUD_NETS.filter(n=>n.status!=='Cleared').length },
    { id: 'geo',       label: 'Geo Risk',        icon: <MapPin     size={13} /> },
    { id: 'sector',    label: 'Sector Heatmap',  icon: <LayoutGrid size={13} /> },
    { id: 'contagion', label: 'Contagion',       icon: <GitBranch  size={13} /> },
    { id: 'settings',  label: 'Risk Settings',   icon: <Settings   size={13} /> },
  ];

  return (
    <div style={fullBleed}>
      {/* ── Font loading + animations ────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        @keyframes bi-spin { to { transform: rotate(360deg); } }
        @keyframes bi-fade-up { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
        .bi-tab-btn { transition: all .15s; }
        .bi-tab-btn:hover { color: #e8edf2 !important; }
      `}</style>

      {/* ── Ambient glow ────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 600, height: 260, background: `radial-gradient(ellipse,${C.goldGlow},transparent 70%)`, opacity: 0.5, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: `linear-gradient(${C.border} 1px,transparent 1px),linear-gradient(90deg,${C.border} 1px,transparent 1px)`, backgroundSize: '44px 44px', opacity: 0.18, maskImage: 'radial-gradient(ellipse 80% 40% at 50% 0%,#000,transparent)', zIndex: 0 }} />

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 1, padding: '18px 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: -1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(140deg,${C.gold},#a07830)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 20px ${C.goldGlow}` }}>
            <Sparkles size={17} color="#0a0d12" />
          </div>
          <div>
            <div style={{ fontFamily: DISP, fontWeight: 600, fontSize: 18, color: C.text, lineHeight: 1 }}>Bondly Intelligence</div>
            <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.faint, letterSpacing: 1, marginTop: 3 }}>CROSS-MARKET LENDER INTELLIGENCE</div>
          </div>
        </div>
        {meta?.pipelineRun && (
          <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, padding: '5px 10px', borderRadius: 7 }}>
            Updated {new Date(meta.pipelineRun).toLocaleDateString('en-ZA', { day:'numeric', month:'short' })}
          </span>
        )}
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 1, padding: '0 28px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 2, marginTop: 14 }}>
        {TABS.map(t => {
          const a = activeTab === t.id;
          return (
            <button key={t.id} className="bi-tab-btn" onClick={() => setActiveTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: SANS, fontSize: 13, fontWeight: a ? 600 : 500,
              color: a ? C.text : C.muted,
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${a ? C.gold : 'transparent'}`,
              padding: '9px 14px', marginBottom: -1, cursor: 'pointer',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{t.icon}{t.label}</span>
              {t.badge > 0 && <span style={{ fontFamily: MONO, fontSize: 9.5, color: '#0a0d12', background: C.high, borderRadius: 10, padding: '1px 5px', lineHeight: 1.4 }}>{t.badge}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Networks ────────────────────────────────────────────────── */}
      {activeTab === 'networks' && (
        <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
          <FraudNetworksTab heatmaps={data?.heatmaps} />
        </div>
      )}

      {/* ── Geo Risk Map ────────────────────────────────────────────── */}
      {activeTab === 'geo' && (
        <div style={{ overflowY: 'auto', flex: 1, position: 'relative', zIndex: 1 }}>
          <GeoRiskMap heatmaps={data?.heatmaps} monthlyPanels={monthlyPanels} periods={activePeriods} suburbPanel={suburbPanel} />
        </div>
      )}

      {/* ── Sector Heatmap ──────────────────────────────────────────── */}
      {activeTab === 'sector' && (
        <div style={{ overflowY: 'auto', flex: 1, position: 'relative', zIndex: 1 }}>
          <SectorHeatmap heatmaps={data?.heatmaps} />
        </div>
      )}

      {/* ── Trends ──────────────────────────────────────────────────── */}
      {activeTab === 'trends' && (
        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TrendsTab data={data} />
        </div>
      )}

      {/* ── Contagion ───────────────────────────────────────────────── */}
      {activeTab === 'contagion' && (
        <div style={{ overflowY: 'auto', flex: 1, position: 'relative', zIndex: 1 }}>
          <ContagionTab />
        </div>
      )}

      {/* ── Risk Settings ───────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div style={{ overflowY: 'auto', flex: 1, position: 'relative', zIndex: 1 }}>
          <RiskSettingsTab />
        </div>
      )}

      {/* ── Overview (existing content) ─────────────────────────────── */}
      {activeTab === 'overview' && <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Overview sub-header ─────────────────────────────────────── */}
      <div style={{ padding: '18px 28px 14px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.gold, fontWeight: 500, marginBottom: 4 }}>
              Geography Insights
            </div>
            <h2 style={{ margin: '0 0 4px', fontFamily: DISP, fontSize: '1.5rem', fontWeight: 500, color: C.text, letterSpacing: -0.3 }}>
              South Africa · Financial Distress Intelligence
            </h2>
            <p style={{ margin: 0, fontFamily: SANS, fontSize: '0.82rem', color: C.muted }}>
              Financial distress across all tracked suburbs — composite score of spend ratio, credit reliance, failed debits &amp; income stability.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Period display */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 14px', fontSize: '0.82rem', color: C.text, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.85em' }}>📅</span>
              {periodLabel(currentPeriod) || 'All time'}
            </div>
            {/* Granularity toggle */}
            <div style={{ display: 'flex', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 2, gap: 2 }}>
              {['monthly', 'weekly'].map(g => (
                <button key={g} onClick={() => handleGranularity(g)} style={{
                  padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 700,
                  background: granularity === g ? '#1e3a5f' : 'transparent',
                  color: granularity === g ? '#fff' : C.muted,
                }}>
                  {g === 'monthly' ? 'Monthly' : 'Weekly'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main body ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden' }}>

        {/* Left: map + slider */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 16px 16px 28px', minWidth: 0 }}>
          <div style={{ flex: 1 }}>
            <GeoMap points={currentPanel} prevPoints={prevPanel} />
          </div>

          {/* Slider */}
          {activePanels.length > 1 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <button onClick={() => setPeriodIdx(i => Math.max(0, (i ?? safeIdx) - 1))}
                  disabled={safeIdx <= 0}
                  style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: 'pointer', fontSize: '1rem', opacity: safeIdx <= 0 ? 0.3 : 1 }}>
                  ‹
                </button>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.text, minWidth: 160, textAlign: 'center' }}>
                  {periodLabel(currentPeriod)}
                </span>
                <button onClick={() => setPeriodIdx(i => Math.min(activePanels.length - 1, (i ?? safeIdx) + 1))}
                  disabled={safeIdx >= activePanels.length - 1}
                  style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: 'pointer', fontSize: '1rem', opacity: safeIdx >= activePanels.length - 1 ? 0.3 : 1 }}>
                  ›
                </button>
              </div>
              <input type="range" min={0} max={activePanels.length - 1} value={safeIdx}
                onChange={e => setPeriodIdx(Number(e.target.value))}
                style={{ width: '100%', accentColor: C.gold, height: 4 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: C.muted, marginTop: 4 }}>
                <span>{periodLabel(activePeriods[0])}</span>
                <span>{activePanels.length} periods</span>
                <span>{periodLabel(activePeriods[activePeriods.length - 1])}</span>
              </div>
            </div>
          )}

          {/* Data source footer */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.low }} />
            <span style={{ fontSize: '0.72rem', color: C.muted, fontWeight: 600 }}>Bondly Synthetic Data Network</span>
            <span style={{ fontSize: '0.68rem', color: '#3d5166', marginLeft: 8 }}>
              Last updated: {meta?.pipelineRun ? new Date(meta.pipelineRun).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
            </span>
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 28px 16px 0', overflowY: 'auto' }}>

          {/* Key Metrics */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ fontFamily: MONO, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.faint, fontWeight: 500, padding: '14px 18px 10px' }}>
              Key Metrics
            </div>
            {[
              { label: 'Avg Distress Index',   value: avgFdi,                           prev: avgFdiDelta,  flip: true, spark: sparkAvgFdi,  tone: riskColor(avgFdi) },
              { label: 'High Distress Suburbs', value: highPct + '%',                   prev: highPctDelta, flip: true, spark: sparkHighPct, tone: C.high },
              { label: 'Population at risk',    value: (meta?.distressPct ?? '—') + '%', prev: null,        flip: true, spark: null,         tone: C.text },
            ].map((m, i, arr) => (
              <div key={m.label} style={{ padding: '12px 18px', borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: MONO, fontSize: '0.68rem', color: C.faint, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>{m.label}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <span style={{ fontFamily: DISP, fontSize: '1.8rem', fontWeight: 500, color: m.tone, lineHeight: 1, letterSpacing: -0.5 }}>{m.value}</span>
                    {m.prev != null && <DeltaTag val={m.prev} flip={m.flip} />}
                    {m.prev != null && <div style={{ fontFamily: MONO, fontSize: '0.62rem', color: C.faint, marginTop: 3 }}>vs prev period</div>}
                  </div>
                  {m.spark && m.spark.length > 1 && (
                    <Sparkline values={m.spark} color={m.tone} width={80} height={28} />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Sector breakdown */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontWeight: 700, marginBottom: 14 }}>
              Job Sector Breakdown <span style={{ color: '#2a4060', marginLeft: 4 }}>ⓘ</span>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <DonutChart slices={donutSlices} size={110} thick={22} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {donutSlices.slice(0, 6).map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.72rem', color: C.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                    <span style={{ fontSize: '0.72rem', color: C.text, fontWeight: 700 }}>{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: C.muted }}>
              <span>Total</span><span style={{ color: C.text, fontWeight: 700 }}>100%</span>
            </div>
          </div>

          {/* Top high-distress suburbs */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontWeight: 700, marginBottom: 12 }}>
              Top High Distress Suburbs <span style={{ color: '#2a4060', marginLeft: 4 }}>ⓘ</span>
            </div>
            {topHigh.map((r, i) => (
              <div key={r.suburb} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ width: 18, fontSize: '0.72rem', color: C.muted, fontWeight: 700 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.suburb}</div>
                  {r.province && <div style={{ fontSize: '0.65rem', color: C.faint }}>{r.province}</div>}
                </div>
                <span style={{
                  fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4, flexShrink: 0,
                  background: (r.fdi ?? 0) >= 60 ? 'rgba(239,68,68,0.15)' : (r.fdi ?? 0) >= 35 ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                  color: fdiColor(r.fdi),
                }}>
                  {(r.fdi ?? 0).toFixed(0)}
                </span>
              </div>
            ))}
            <button style={{ marginTop: 4, background: 'none', border: 'none', color: C.gold, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
              View full list →
            </button>
          </div>

          {/* Accuracy (if available) */}
          {accuracy && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontWeight: 700, marginBottom: 4 }}>
                Engine Accuracy
              </div>
              <div style={{ fontFamily: SANS, fontSize: '0.68rem', color: C.faint, marginBottom: 10, lineHeight: 1.4 }}>
                F1 = harmonic mean of precision &amp; recall. 70%+ is production-grade for fraud detection.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Categorisation', accuracy.categorisation],
                  ['Geo', accuracy.geoSuburb],
                  ['Sector', accuracy.sector],
                  ['Fraud F1 ⓘ', accuracy.fraudF1],
                ].map(([label, val]) => val != null && (
                  <div key={label} style={{ textAlign: 'center', padding: '8px 6px', background: '#0d1b2a', borderRadius: 6 }}>
                    <div style={{ fontSize: '0.62rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: val >= 90 ? C.low : val >= 70 ? C.medium : C.high }}>{val}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Analytics modules (19-module wiring) ──────────────────── */}
          {analytics && (() => {
            const sc = analytics.scenario || {};
            const db = analytics.distress?.bands || {};
            const dTotal = analytics.distress?.total || 1;
            const dPct = b => Math.round((db[b] || 0) / dTotal * 100);
            const roi = analytics.roi || {};
            const fair = analytics.fairness || {};
            const emp = analytics.employerRisk?.topRisky || [];
            return (
              <>
                {/* Stress Test */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontWeight: 700, marginBottom: 12 }}>
                    Rate Shock Stress Test
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                    {[
                      ['Base', sc.base?.distressShare, C.low],
                      ['+200bps', sc.plus200bps?.distressShare, C.medium],
                      ['+500bps', sc.plus500bps?.distressShare, C.high],
                    ].map(([label, val, color]) => (
                      <div key={label} style={{ textAlign: 'center', padding: '8px 4px', background: '#0d1b2a', borderRadius: 6 }}>
                        <div style={{ fontSize: '0.6rem', color: C.muted, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color }}>{val != null ? val + '%' : '—'}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: C.muted, marginBottom: 8 }}>
                    Newly distressed at +500bps: <strong style={{ color: C.high }}>{sc.plus500bps?.newlyDistressed ?? '—'}</strong>
                  </div>
                  <div style={{ fontSize: '0.62rem', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Sectors worst hit (+500bps)</div>
                  {(sc.plus500bps?.sectorsWorstHit || []).slice(0, 3).map(s => (
                    <div key={s.sector} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: 4 }}>
                      <span style={{ color: C.text }}>{SECTOR_LABELS[s.sector] || s.sector}</span>
                      <span style={{ color: C.high, fontWeight: 700 }}>+{s.delta}pp</span>
                    </div>
                  ))}
                </div>

                {/* Portfolio breakdown */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontWeight: 700, marginBottom: 12 }}>
                    Portfolio Distress Bands
                  </div>
                  <div style={{ height: 18, borderRadius: 5, overflow: 'hidden', display: 'flex', marginBottom: 10 }}>
                    <div style={{ width: dPct('safe') + '%', background: C.low }} />
                    <div style={{ width: dPct('watch') + '%', background: '#84cc16' }} />
                    <div style={{ width: dPct('strained') + '%', background: C.medium }} />
                    <div style={{ width: dPct('critical') + '%', background: C.high }} />
                  </div>
                  {[
                    ['Safe', 'safe', C.low],
                    ['Watch', 'watch', '#84cc16'],
                    ['Strained', 'strained', C.medium],
                    ['Critical', 'critical', C.high],
                  ].map(([label, key, color]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: '0.74rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                      <span style={{ color: C.muted, flex: 1 }}>{label}</span>
                      <span style={{ color: C.text, fontWeight: 700 }}>{db[key] || 0} · {dPct(key)}%</span>
                    </div>
                  ))}
                </div>

                {/* Business Case — surfaced first for exec visibility */}
                <div style={{ background: `linear-gradient(135deg,${C.card},#0f1e2e)`, border: `1px solid rgba(200,168,75,0.2)`, borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.gold, fontWeight: 700, marginBottom: 12 }}>
                    Business Case
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: C.gold, lineHeight: 1 }}>
                      {roi.roiMultiple != null ? roi.roiMultiple + '×' : '—'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: C.muted }}>return on<br/>intervention</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: 5, marginTop: 10 }}>
                    <span style={{ color: C.muted }}>Prevented loss</span>
                    <span style={{ color: C.low, fontWeight: 700 }}>{randFmt(roi.preventedLoss)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                    <span style={{ color: C.muted }}>Net benefit</span>
                    <span style={{ color: C.text, fontWeight: 700 }}>{randFmt(roi.netBenefit)}</span>
                  </div>
                </div>

                {/* Employer Risk */}
                {emp.length > 0 && (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px' }}>
                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontWeight: 700, marginBottom: 12 }}>
                      Top Employer Risk
                    </div>
                    {emp.slice(0, 5).map((e, i) => (
                      <div key={e.employer} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ width: 16, fontSize: '0.7rem', color: C.muted, fontWeight: 700 }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.78rem', color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.employer}</div>
                          <div style={{ fontSize: '0.66rem', color: C.muted }}>{e.employees} borrowers{e.flag ? ' · ⚠ sector stress flagged' : ''}</div>
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: (e.distressShare >= 60) ? C.high : (e.distressShare >= 35) ? C.medium : C.low }}>
                          {e.distressShare}%
                        </span>
                      </div>
                    ))}
                    <button style={{ width: '100%', marginTop: 4, padding: '6px 0', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, color: C.gold, fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}>
                      Review portfolio exposure →
                    </button>
                  </div>
                )}

                {/* Fairness */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontWeight: 700, marginBottom: 12 }}>
                    Fair-Lending Screen
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: 6 }}>
                    <span style={{ color: C.muted }}>Groups tested</span>
                    <span style={{ color: C.text, fontWeight: 700 }}>{(fair.groups || []).length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: 6 }}>
                    <span style={{ color: C.muted }}>Violations (four-fifths)</span>
                    <span style={{ color: fair.violations > 0 ? C.high : C.low, fontWeight: 700 }}>
                      {fair.violations || 0}{fair.violations > 0 ? ' · REVIEW' : ' · PASS'}
                    </span>
                  </div>
                  {fair.runDate && (
                    <div style={{ fontFamily: MONO, fontSize: '0.62rem', color: C.faint, marginBottom: 4 }}>
                      Last run: {fair.runDate} · {fair.methodology || 'Four-fifths rule (EEOC)'}
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          {/* Live Graph Intelligence CTA */}
          <div style={{ background: 'linear-gradient(135deg,#091420,#0d1b2a)', border: `1px solid rgba(200,168,75,0.25)`, borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <GitBranch size={15} color={C.gold} />
              <span style={{ color: C.gold, fontWeight: 700, fontSize: '0.82rem' }}>Live Network Graph Intelligence</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: C.muted, margin: '0 0 12px', lineHeight: 1.5 }}>
              Real-time contagion tracing, mule-network mapping and cross-bank fraud signal sharing — available on Enterprise.
            </p>
            <button style={{ width: '100%', padding: '8px 14px', background: 'rgba(200,168,75,0.12)', border: `1px solid rgba(200,168,75,0.3)`, borderRadius: 7, color: C.gold, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
              Request access →
            </button>
          </div>
        </div>
      </div>

      {/* ── Borrower Risk Reasons (SHAP explain) ───────────────────── */}
      <ExplainPanel />

      {/* ── Bottom: Distress distribution bar ──────────────────────── */}
      <div style={{ padding: '16px 28px 28px', borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontFamily: MONO, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.faint, fontWeight: 500, marginBottom: 12 }}>
          Distress Level Distribution
        </div>
        <div style={{ height: 20, borderRadius: 6, overflow: 'hidden', display: 'flex', gap: 1 }}>
          <div style={{ width: highPct + '%', background: C.high, transition: 'width 0.4s ease', borderRadius: 4 }} />
          <div style={{ width: medPct  + '%', background: C.medium, transition: 'width 0.4s ease' }} />
          <div style={{ width: lowPct  + '%', background: C.low, transition: 'width 0.4s ease', borderRadius: 4 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 12 }}>
          {[[highPct, 'High Distress', C.high], [medPct, 'Medium Distress', C.medium], [lowPct, 'Low Distress', C.low]].map(([pct, label, color]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: DISP, fontSize: '1.4rem', fontWeight: 500, color, letterSpacing: -0.5 }}>{pct}%</div>
              <div style={{ fontFamily: MONO, fontSize: '0.68rem', color: C.faint, marginTop: 4, letterSpacing: 0.3 }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(200,168,75,0.04)', border: `1px solid ${C.border}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.82em', color: C.gold }}>ⓘ</span>
          <span style={{ fontFamily: SANS, fontSize: '0.75rem', color: C.muted }}>
            Financial distress is a composite score based on spend ratio, credit reliance, failed debits, and income stability.
            {accuracy && <span> · Categorisation accuracy: <strong style={{ color: C.text }}>{accuracy.categorisation}%</strong></span>}
          </span>
        </div>
      </div>
      </div>}
    </div>
  );
}
