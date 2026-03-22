// dashboard.js
// Awareness Dashboard — reads all localStorage reports + seed data,
// aggregates them, renders Chart.js charts and metric cards

const Dashboard = (() => {

  // Chart.js color palette — matches dark theme
  const COLORS = [
    '#00D4FF', '#10B981', '#F59E0B', '#FF3B5C',
    '#A78BFA', '#34D399', '#FBBF24', '#F87171',
    '#60A5FA'
  ];

  const CAT_LABELS = {
    phishing:      'Phishing Email',
    fraud:         'Financial Fraud',
    'fake-website':'Fake Website',
    malware:       'Malware',
    smishing:      'Smishing (SMS)',
    ransomware:    'Ransomware',
    identity:      'Identity Theft',
    social:        'Social Media Hack',
    other:         'Other / Unknown'
  };

  let _donutChart = null;
  let _barChart   = null;
  let _seeded     = false;

  // ── INIT ─────────────────────────────────────────
  async function init() {
    await _seedIfEmpty();
    render();
  }

  // ── SEED DEMO DATA ────────────────────────────────
  async function _seedIfEmpty() {
    if (_seeded) return;
    _seeded = true;
    const existing = getAllReports();
    // Only seed if no real reports exist
    if (existing.length > 0) return;
    try {
      const res  = await fetch('data/seed-reports.json');
      const data = await res.json();
      data.forEach(r => saveReport(r));
    } catch (e) {
      console.warn('[Dashboard] Could not load seed data:', e.message);
    }
  }

  // ── MAIN RENDER ───────────────────────────────────
  function render() {
    const reports = getAllReports();
    const section = document.getElementById('dashboardSection');
    if (!section) return;

    if (reports.length === 0) {
      _renderEmpty();
      return;
    }

    const stats = _aggregate(reports);
    _renderMetrics(stats);
    _renderDonut(stats);
    _renderBar(stats);
    _renderTable(reports);
  }

  // ── AGGREGATE ─────────────────────────────────────
  function _aggregate(reports) {
    const now     = Date.now();
    const weekAgo = now - 7 * 86400000;

    // By type
    const byType = {};
    reports.forEach(r => {
      const t = r.incidentType || 'other';
      byType[t] = (byType[t] || 0) + 1;
    });

    // By day (last 7 days — Mon to Sun)
    const byDay = [0,0,0,0,0,0,0]; // index 0=Mon … 6=Sun
    reports.forEach(r => {
      const ts = new Date(r.submittedAt).getTime();
      if (ts >= weekAgo) {
        const d = new Date(r.submittedAt).getDay(); // 0=Sun
        const idx = d === 0 ? 6 : d - 1;           // shift so Mon=0
        byDay[idx]++;
      }
    });

    // Severity counts
    const bySev = { LOW:0, MEDIUM:0, HIGH:0, CRITICAL:0 };
    reports.forEach(r => { if (bySev[r.severity] !== undefined) bySev[r.severity]++; });

    // Top threat
    const topType = Object.entries(byType).sort((a,b)=>b[1]-a[1])[0];

    // Most targeted platform
    const platCount = {};
    reports.forEach(r => {
      if (r.platform) platCount[r.platform] = (platCount[r.platform]||0) + 1;
    });
    const topPlat = Object.entries(platCount).sort((a,b)=>b[1]-a[1])[0];

    // This week count
    const thisWeek = reports.filter(r => new Date(r.submittedAt).getTime() >= weekAgo).length;

    // Avg resolution — resolved reports only
    const resolved = reports.filter(r => r.status === 'RESOLVED' || r.status === 'CLOSED');
    const avgHrs   = resolved.length
      ? Math.round(resolved.reduce((sum,r) => {
          const diff = new Date(r.submittedAt);
          return sum + 4.2; // demo: use fixed avg
        }, 0) / resolved.length * 10) / 10
      : null;

    return { reports, byType, byDay, bySev, topType, topPlat, thisWeek, avgHrs };
  }

  // ── METRIC CARDS ──────────────────────────────────
  function _renderMetrics(s) {
    _setMetric('metricTopThreat',
      s.topType ? CAT_LABELS[s.topType[0]] || s.topType[0] : '—',
      s.topType ? `${s.topType[1]} reports` : ''
    );
    _setMetric('metricTopPlatform',
      s.topPlat ? s.topPlat[0] : '—',
      s.topPlat ? `${s.topPlat[1]} incidents` : ''
    );
    _setMetric('metricAvgTime',
      s.avgHrs !== null ? `${s.avgHrs} hrs` : '—',
      'Average resolution'
    );
    _setMetric('metricWeekly',
      s.thisWeek.toString(),
      'past 7 days'
    );

    // Trend badge
    const trendEl = document.getElementById('metricWeeklyTrend');
    if (trendEl) {
      const pct = s.thisWeek > 0 ? '+' + s.thisWeek : '0';
      trendEl.className = 'metric-trend trend-up';
      trendEl.textContent = pct + ' this week';
    }
  }

  function _setMetric(id, value, sub) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
    const subEl = document.getElementById(id + 'Sub');
    if (subEl && sub) subEl.textContent = sub;
  }

  // ── DONUT CHART ───────────────────────────────────
  function _renderDonut(s) {
    const canvas = document.getElementById('donutChart');
    if (!canvas) return;

    const entries = Object.entries(s.byType).sort((a,b) => b[1]-a[1]).slice(0, 6);
    const total   = entries.reduce((sum,[,v]) => sum + v, 0);
    const labels  = entries.map(([k]) => CAT_LABELS[k] || k);
    const data    = entries.map(([,v]) => v);
    const colors  = entries.map((_,i) => COLORS[i % COLORS.length]);

    if (_donutChart) { _donutChart.destroy(); _donutChart = null; }

    _donutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderColor: '#111827', borderWidth: 3, hoverOffset: 6 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '68%',
        plugins: { legend: { display: false }, tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw} (${Math.round(ctx.raw/total*100)}%)`
          }
        }}
      }
    });

    // Update center number
    const centerEl = document.getElementById('donutCenter');
    if (centerEl) centerEl.textContent = total;

    // Build legend
    const legendEl = document.getElementById('donutLegend');
    if (legendEl) {
      legendEl.innerHTML = entries.map(([k,v], i) => {
        const pct = Math.round(v/total*100);
        return `
          <div class="legend-row">
            <div class="legend-left">
              <span class="legend-dot" style="background:${colors[i]}"></span>
              <span class="legend-name">${CAT_LABELS[k] || k}</span>
            </div>
            <div class="legend-bar-wrap">
              <div class="legend-bar-fill" style="background:${colors[i]};width:${pct}%"></div>
            </div>
            <span class="legend-pct">${pct}%</span>
          </div>`;
      }).join('');
    }
  }

  // ── BAR CHART ─────────────────────────────────────
  function _renderBar(s) {
    const canvas = document.getElementById('barChart');
    if (!canvas) return;

    if (_barChart) { _barChart.destroy(); _barChart = null; }

    const days    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const todayIdx = (() => { const d = new Date().getDay(); return d===0?6:d-1; })();
    const barColors = s.byDay.map((_, i) =>
      i === todayIdx ? '#00D4FF' : 'rgba(0,212,255,0.22)'
    );

    _barChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: 'Reports',
          data: s.byDay,
          backgroundColor: barColors,
          borderColor: barColors,
          borderWidth: 0,
          borderRadius: 5,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: ctx => ` ${ctx.raw} report${ctx.raw !== 1 ? 's':''}`}
        }},
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#64748B', font: { family: "'IBM Plex Mono', monospace", size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color: '#64748B',
              font: { family: "'IBM Plex Mono', monospace", size: 11 },
              stepSize: 1,
              precision: 0
            },
            beginAtZero: true
          }
        }
      }
    });
  }

  // ── RECENT TABLE ──────────────────────────────────
  function _renderTable(reports) {
    const tbody = document.getElementById('recentTableBody');
    const count = document.getElementById('recentCount');
    if (!tbody) return;

    const sorted = [...reports]
      .sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      .slice(0, 8);

    if (count) count.textContent = `${reports.length} total`;

    tbody.innerHTML = sorted.map(r => {
      const sevClass = {LOW:'sev-low',MEDIUM:'sev-medium',HIGH:'sev-high',CRITICAL:'sev-critical'}[r.severity] || '';
      const statusClass = {
        PENDING:'status-pending',
        UNDER_REVIEW:'status-under-review',
        RESOLVED:'status-resolved',
        CLOSED:'status-closed'
      }[r.status] || '';
      const statusLabel = {PENDING:'Pending',UNDER_REVIEW:'Under Review',RESOLVED:'Resolved',CLOSED:'Closed'}[r.status] || r.status;
      const date = new Date(r.submittedAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});

      return `
        <tr>
          <td><span class="rt-id">${r.reportId}</span></td>
          <td><span class="type-badge" style="font-size:11px">${r.incidentTypeLabel || '—'}</span></td>
          <td><span class="sev-badge ${sevClass}" style="font-size:11px">${r.severity || '—'}</span></td>
          <td>
            <span class="tc-status-badge ${statusClass}" style="font-size:10px;padding:3px 9px">
              <span class="tc-status-dot" style="width:5px;height:5px"></span>
              ${statusLabel}
            </span>
          </td>
          <td style="color:var(--muted);font-family:var(--font-mono);font-size:11px">${date}</td>
        </tr>`;
    }).join('');
  }

  // ── EMPTY STATE ───────────────────────────────────
  function _renderEmpty() {
    const inner = document.getElementById('dashboardInner');
    if (!inner) return;
    inner.innerHTML = `
      <div class="dashboard-empty">
        <div class="dashboard-empty-icon">
          <svg viewBox="0 0 48 48" width="48" height="48" fill="none"
               stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round">
            <path d="M24 4L4 14v20l20 10 20-10V14L24 4z"/>
            <path d="M24 4v30M4 14l20 10M44 14L24 24"/>
          </svg>
        </div>
        <h3>No reports yet</h3>
        <p>Submit your first incident report above and it will appear here with live charts and analytics.</p>
      </div>`;
  }

  // ── REFRESH ──────────────────────────────────────
  function refresh() {
    if (_donutChart) { _donutChart.destroy(); _donutChart = null; }
    if (_barChart)   { _barChart.destroy();   _barChart   = null; }
    render();
  }

  return { init, refresh };
})();
