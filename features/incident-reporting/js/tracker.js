// tracker.js
// Incident Report Tracker
// Reads saved reports from localStorage, computes live status,
// renders animated status timeline card

const Tracker = (() => {

  // ── STATUS SIMULATION ───────────────────────────
  // Makes the demo feel live without a backend
  // PENDING     → first 30 minutes after submission
  // UNDER_REVIEW → 30 minutes → 3 days
  // RESOLVED    → 3 days → 7 days
  // CLOSED      → beyond 7 days

  const STATUS_STAGES = [
    {
      key:   'PENDING',
      label: 'Report Received',
      sub:   'Your report has been logged and assigned to the queue.',
      icon:  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
      color: 'var(--green)'
    },
    {
      key:   'UNDER_REVIEW',
      label: 'Security Team Analysis',
      sub:   'Our analysts are actively investigating your report.',
      icon:  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
      color: 'var(--amber)'
    },
    {
      key:   'RESOLVED',
      label: 'Incident Resolved',
      sub:   'The threat has been assessed and action taken.',
      icon:  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
      color: 'var(--cyan)'
    }
  ];

  function _computeStatus(report) {
    const submitted = new Date(report.submittedAt).getTime();
    const now       = Date.now();
    const mins      = (now - submitted) / 60000;
    const days      = mins / 1440;

    if (mins < 30)   return 'PENDING';
    if (days < 3)    return 'UNDER_REVIEW';
    if (days < 7)    return 'RESOLVED';
    return 'CLOSED';
  }

  function _stageIndex(status) {
    const map = { PENDING:0, UNDER_REVIEW:1, RESOLVED:2, CLOSED:2 };
    return map[status] ?? 0;
  }

  // ── SEARCH ──────────────────────────────────────
  function search() {
    const input = document.getElementById('trackerInput');
    const err   = document.getElementById('trackerError');
    if (!input) return;

    const id = input.value.trim().toUpperCase();
    if (!id) {
      _showError('Please enter a Report ID.');
      return;
    }
    if (!/^ZT-\d{4}-[A-Z0-9]{4}$/.test(id)) {
      _showError('Invalid format. Example: ZT-2025-A9F3');
      return;
    }

    _showError('');
    _showSearching();

    // Small artificial delay makes it feel like a real lookup
    setTimeout(() => {
      const report = getReport(id);
      if (!report) {
        _showNotFound(id);
      } else {
        const liveStatus = _computeStatus(report);
        report.status = liveStatus;            // update in-memory for display
        saveReport(report);                    // persist updated status
        _renderResult(report, liveStatus);
      }
    }, 680);
  }

  function _showSearching() {
    const result = document.getElementById('trackerResult');
    result.innerHTML = `
      <div class="tracker-searching">
        <div class="search-spinner"></div>
        <span>Looking up report…</span>
      </div>`;
    result.style.display = 'block';
  }

  function _showNotFound(id) {
    const result = document.getElementById('trackerResult');
    result.innerHTML = `
      <div class="tracker-not-found">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none"
             stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <p class="nf-title">Report not found</p>
        <p class="nf-sub">No report matching <span class="nf-id">${id}</span> was found in this browser.<br>Check the ID and try again, or submit a new report above.</p>
      </div>`;
    result.style.display = 'block';
  }

  function _showError(msg) {
    const el = document.getElementById('trackerError');
    if (el) el.textContent = msg;
  }

  // ── RENDER RESULT ───────────────────────────────
  function _renderResult(report, status) {
    const result    = document.getElementById('trackerResult');
    const activeIdx = _stageIndex(status);

    const sevClass = {
      LOW:'sev-low', MEDIUM:'sev-medium', HIGH:'sev-high', CRITICAL:'sev-critical'
    }[report.severity] || '';

    const submittedDate = new Date(report.submittedAt).toLocaleString('en-IN', {
      day:'2-digit', month:'short', year:'numeric',
      hour:'2-digit', minute:'2-digit'
    });

    // Build timeline stages
    const timeline = STATUS_STAGES.map((stage, i) => {
      const done    = i < activeIdx;
      const current = i === activeIdx;
      const pending = i > activeIdx;

      const stateClass  = done ? 'done' : current ? 'current' : 'pending';
      const lineClass   = done ? 'tl-line done' : 'tl-line';

      return `
        <div class="tl-stage ${stateClass}" style="--delay:${i * 0.18}s">
          <div class="tl-left">
            <div class="tl-dot" style="--dot-color:${done ? 'var(--green)' : current ? stage.color : 'var(--surface3)'}">
              ${done
                ? `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--green)" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`
                : current
                  ? `<div class="tl-pulse" style="background:${stage.color}"></div>`
                  : ''}
            </div>
            ${i < STATUS_STAGES.length - 1 ? `<div class="${lineClass}"></div>` : ''}
          </div>
          <div class="tl-body">
            <div class="tl-stage-label" style="color:${pending ? 'var(--muted)' : 'var(--text)'}">
              ${stage.label}
              ${current ? `<span class="tl-active-badge" style="border-color:${stage.color};color:${stage.color}">Active</span>` : ''}
              ${done    ? `<span class="tl-done-badge">Done</span>` : ''}
            </div>
            <div class="tl-stage-sub" style="opacity:${pending ? 0.4 : 0.75}">
              ${current ? stage.sub : done ? `Completed` : 'Pending verification'}
            </div>
          </div>
        </div>`;
    }).join('');

    result.innerHTML = `
      <div class="tracker-card">

        <div class="tc-header">
          <div class="tc-id-block">
            <span class="tc-id-label">Report ID</span>
            <span class="tc-id-value">${report.reportId}</span>
          </div>
          <span class="tc-status-badge status-${status.toLowerCase().replace('_','-')}">
            <span class="tc-status-dot"></span>
            ${_statusLabel(status)}
          </span>
        </div>

        <div class="tc-meta">
          <div class="tc-meta-item">
            <span class="tc-meta-key">Type</span>
            <span class="type-badge">${report.incidentTypeLabel || 'Unknown'}</span>
          </div>
          <div class="tc-meta-item">
            <span class="tc-meta-key">Severity</span>
            <span class="sev-badge ${sevClass}">${report.severity || '—'}</span>
          </div>
          <div class="tc-meta-item">
            <span class="tc-meta-key">Submitted</span>
            <span class="tc-meta-val">${submittedDate}</span>
          </div>
          <div class="tc-meta-item">
            <span class="tc-meta-key">Title</span>
            <span class="tc-meta-val" style="font-style:italic">${_esc(report.title)}</span>
          </div>
        </div>

        <div class="tc-timeline">
          ${timeline}
        </div>

        <button class="tc-expand-btn" onclick="Tracker.toggleDetails(this)">
          Show full report details
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <div class="tc-details" style="display:none">
          <div class="tc-details-grid">
            <div class="tc-detail-row"><span class="tc-meta-key">Platform</span><span class="tc-meta-val">${report.platform || '—'}</span></div>
            <div class="tc-detail-row"><span class="tc-meta-key">Suspect URL</span><span class="tc-meta-val" style="font-family:var(--font-mono);font-size:11px;color:var(--red);word-break:break-all">${report.suspectUrl || '—'}</span></div>
            <div class="tc-detail-row full"><span class="tc-meta-key">Description</span><span class="tc-meta-val" style="white-space:pre-wrap">${_esc(report.description)}</span></div>
            <div class="tc-detail-row"><span class="tc-meta-key">Evidence</span><span class="tc-meta-val">${report.evidenceFiles?.length ? report.evidenceFiles.length + ' file(s)' : 'None'}</span></div>
            ${report.fromPhishScan ? `<div class="tc-detail-row"><span class="tc-meta-key">Source</span><span class="type-badge" style="font-size:10px">Via PhishScan</span></div>` : ''}
          </div>
        </div>

      </div>`;

    result.style.display = 'block';

    // Animate timeline lines after render
    requestAnimationFrame(() => {
      result.querySelectorAll('.tl-line.done').forEach((line, i) => {
        line.style.setProperty('--line-delay', `${i * 0.22 + 0.3}s`);
        line.classList.add('animate');
      });
    });
  }

  function _statusLabel(s) {
    return { PENDING:'Pending', UNDER_REVIEW:'Under Review', RESOLVED:'Resolved', CLOSED:'Closed' }[s] || s;
  }

  function _esc(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── TOGGLE DETAILS ──────────────────────────────
  function toggleDetails(btn) {
    const details = btn.nextElementSibling;
    const open    = details.style.display !== 'none';
    details.style.display = open ? 'none' : 'block';
    btn.innerHTML = open
      ? `Show full report details <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>`
      : `Hide details <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>`;
  }

  // ── KEYBOARD SUPPORT ────────────────────────────
  function onKeydown(e) {
    if (e.key === 'Enter') search();
  }

  // ── CLEAR ───────────────────────────────────────
  function clear() {
    const input  = document.getElementById('trackerInput');
    const result = document.getElementById('trackerResult');
    if (input)  { input.value = ''; }
    if (result) { result.style.display = 'none'; result.innerHTML = ''; }
    _showError('');
  }

  return { search, toggleDetails, onKeydown, clear };
})();
