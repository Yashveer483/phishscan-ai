// wizard.js
// 4-Step Incident Report Wizard controller
// Manages state, navigation, validation, and submission

const CATEGORIES = [
  { id:'phishing',     label:'Phishing Email',     icon:`<svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>` },
  { id:'fraud',        label:'Financial Fraud',    icon:`<svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>` },
  { id:'fake-website', label:'Fake Website',       icon:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>` },
  { id:'malware',      label:'Malware',            icon:`<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>` },
  { id:'smishing',     label:'Smishing (SMS)',     icon:`<svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>` },
  { id:'ransomware',   label:'Ransomware',         icon:`<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>` },
  { id:'identity',     label:'Identity Theft',     icon:`<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>` },
  { id:'social',       label:'Social Media Hack',  icon:`<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>` },
  { id:'other',        label:'Other / Unknown',    icon:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>` }
];

const wizard = (() => {
  let currentStep = 1;

  // In-memory report object — matches the schema from Phase 1 planning
  let report = _freshReport();

  function _freshReport() {
    return {
      reportId: null, incidentType: null, incidentTypeLabel: null,
      title: '', dateOfIncident: '', platform: '', description: '',
      severity: null, suspectUrl: '', evidenceFiles: [],
      submittedAt: null, status: 'PENDING', fromPhishScan: false
    };
  }

  // ── INIT ──────────────────────────────────────
  function init() {
    _renderCategories();
    _initCounters();
    _initCharCounters();
    _checkPhishScanPrefill();

    Uploader.init('uploadZone', 'fileInput', files => {
      report.evidenceFiles = files;
      _renderPreviews(files);
    });

    // Attach AI classifier to description textarea
    if (typeof Classifier !== 'undefined') {
      Classifier.attach('incidentDesc');
    }
  }

  // ── CATEGORY GRID ─────────────────────────────
  function _renderCategories() {
    const grid = document.getElementById('categoryGrid');
    if (!grid) return;
    grid.innerHTML = CATEGORIES.map(cat => `
      <div class="category-card" data-id="${cat.id}"
           onclick="wizard.selectCategory('${cat.id}','${cat.label}',this)">
        <div class="cat-icon">${cat.icon}</div>
        <span class="cat-label">${cat.label}</span>
      </div>
    `).join('');
  }

  function selectCategory(id, label, el) {
    document.querySelectorAll('.category-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    report.incidentType      = id;
    report.incidentTypeLabel = label;
    document.getElementById('nextBtn1').disabled = false;
  }

  // ── STAT COUNTERS ─────────────────────────────
  function _initCounters() {
    document.querySelectorAll('.stat-num').forEach(el => {
      const raw     = parseInt(el.dataset.target, 10);
      const suffix  = el.dataset.suffix || '';
      const isFloat = el.dataset.float === 'true';
      let current   = 0;
      const step    = raw / (1400 / 16);

      const tick = () => {
        current = Math.min(current + step, raw);
        if (isFloat) {
          el.textContent = (current / 10).toFixed(1) + suffix;
        } else {
          el.textContent = Math.floor(current).toLocaleString() + suffix;
        }
        if (current < raw) requestAnimationFrame(tick);
      };
      setTimeout(tick, 500 + Math.random() * 200);
    });
  }

  // ── CHAR COUNTERS ─────────────────────────────
  function _initCharCounters() {
    _bindCounter('incidentTitle', 'titleCounter', 80, v => { report.title = v; });
    _bindCounter('incidentDesc',  'descCounter', 1000, v => { report.description = v; });
  }

  function _bindCounter(inputId, counterId, max, onUpdate) {
    const el      = document.getElementById(inputId);
    const counter = document.getElementById(counterId);
    if (!el || !counter) return;
    el.addEventListener('input', () => {
      const len = el.value.length;
      counter.textContent = `${len}/${max}`;
      counter.classList.toggle('warn', len > max * 0.88);
      onUpdate(el.value);
    });
  }

  // ── PHISHSCAN PREFILL ─────────────────────────
  function _checkPhishScanPrefill() {
    try {
      const raw = localStorage.getItem('ZT_PREFILL');
      if (!raw) return;
      const data = JSON.parse(raw);
      localStorage.removeItem('ZT_PREFILL');

      report.fromPhishScan = true;

      // Pre-select Phishing Email category
      const card = document.querySelector('[data-id="phishing"]');
      if (card) selectCategory('phishing', 'Phishing Email', card);

      // Pre-fill step 2 fields
      const titleEl = document.getElementById('incidentTitle');
      if (titleEl && data.subject) {
        titleEl.value   = `Phishing: ${data.subject}`.slice(0, 80);
        report.title    = titleEl.value;
        document.getElementById('titleCounter').textContent = `${titleEl.value.length}/80`;
      }

      const platformEl = document.getElementById('incidentPlatform');
      if (platformEl && data.sender) {
        platformEl.value = data.sender;
        report.platform  = data.sender;
      }

      const descEl = document.getElementById('incidentDesc');
      if (descEl && data.flags) {
        const desc = `Detected by PhishScan.\nThreats: ${data.flags.join(', ')}`;
        descEl.value        = desc;
        report.description  = desc;
        document.getElementById('descCounter').textContent = `${desc.length}/1000`;
      }
    } catch (_) {}
  }

  // ── SEVERITY ──────────────────────────────────
  function setSeverity(btn) {
    document.querySelectorAll('.severity-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    report.severity = btn.dataset.severity;
    document.getElementById('severityError').textContent = '';
  }

  // ── EVIDENCE PREVIEWS ─────────────────────────
  function _renderPreviews(files) {
    const container = document.getElementById('uploadPreviews');
    if (!container) return;
    container.innerHTML = files.map((f, i) => `
      <div class="preview-card">
        ${f.previewUrl
          ? `<img class="preview-thumb" src="${f.previewUrl}" alt="${f.name}">`
          : `<div class="preview-thumb-icon">📄</div>`}
        <div class="preview-info">
          <div class="preview-name">${f.name}</div>
          <div class="preview-size">${Uploader.formatBytes(f.size)}</div>
        </div>
        <button class="preview-remove" onclick="wizard.removeFile(${i})" title="Remove">×</button>
      </div>
    `).join('');
  }

  function removeFile(index) {
    Uploader.removeFile(index);
    _renderPreviews(Uploader.getFiles());
    report.evidenceFiles = Uploader.getFiles();
  }

  // ── VALIDATION ────────────────────────────────
  function _validateStep2() {
    let ok = true;

    const title = document.getElementById('incidentTitle').value.trim();
    if (!title || title.length < 5) {
      _err('titleError', 'Title must be at least 5 characters.'); ok = false;
    } else { _err('titleError', ''); }

    const date = document.getElementById('incidentDate').value;
    if (!date) {
      _err('dateError', 'Please select the date and time.'); ok = false;
    } else if (new Date(date) > new Date()) {
      _err('dateError', 'Date cannot be in the future.'); ok = false;
    } else { _err('dateError', ''); }

    const desc = document.getElementById('incidentDesc').value.trim();
    if (!desc || desc.length < 20) {
      _err('descError', 'Description must be at least 20 characters.'); ok = false;
    } else { _err('descError', ''); }

    if (!report.severity) {
      _err('severityError', 'Please select a severity level.'); ok = false;
    } else { _err('severityError', ''); }

    if (ok) {
      report.title         = title;
      report.dateOfIncident = date;
      report.platform       = document.getElementById('incidentPlatform').value.trim();
      report.description    = desc;
    }
    return ok;
  }

  function _validateStep3() {
    const url = document.getElementById('suspectUrl').value.trim();
    if (url) {
      const ok = /^(https?:\/\/[^\s]+|[^\s]+@[^\s]+\.[^\s]+)$/i.test(url);
      if (!ok) { _err('urlError', 'Enter a valid URL or email address.'); return false; }
    }
    _err('urlError', '');
    report.suspectUrl = url;
    return true;
  }

  function _err(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
  }

  // ── NAVIGATION ────────────────────────────────
  function next() {
    if (currentStep === 1 && !report.incidentType) return;
    if (currentStep === 2 && !_validateStep2()) return;
    if (currentStep === 3 && !_validateStep3()) return;
    if (currentStep < 4) _goTo(currentStep + 1, 'forward');
  }

  function back() {
    if (currentStep > 1) _goTo(currentStep - 1, 'backward');
  }

  function _goTo(next, dir) {
    const cur  = document.getElementById(`panel-${currentStep}`);
    const dest = document.getElementById(`panel-${next}`);
    if (!cur || !dest) return;

    const exitCls  = dir === 'forward' ? 'slide-out-left'  : 'slide-out-right';
    const enterCls = dir === 'forward' ? 'slide-in-right'  : 'slide-in-left';

    cur.classList.add(exitCls);
    cur.addEventListener('animationend', () => {
      cur.classList.remove('active', exitCls);
      dest.classList.add('active', enterCls);
      dest.addEventListener('animationend', () => dest.classList.remove(enterCls), { once: true });
      currentStep = next;
      _updateProgressBar();
      if (next === 4) _buildReview();
      if (typeof Integration !== 'undefined') Integration.updateTitle(next);
    }, { once: true });
  }

  function _updateProgressBar() {
    document.querySelectorAll('.progress-step').forEach((el, i) => {
      const n = i + 1;
      el.classList.remove('active','completed');
      if      (n < currentStep)  el.classList.add('completed');
      else if (n === currentStep) el.classList.add('active');
    });
    [1,2,3].forEach(i => {
      const fill = document.getElementById(`line${i}`);
      if (fill) fill.style.width = currentStep > i ? '100%' : '0%';
    });
  }

  // ── REVIEW ────────────────────────────────────
  function _buildReview() {
    const sevClass = {
      LOW:'sev-low', MEDIUM:'sev-medium', HIGH:'sev-high', CRITICAL:'sev-critical'
    }[report.severity] || '';

    const rows = [
      ['Incident Type', `<span class="type-badge">${report.incidentTypeLabel || '—'}</span>`],
      ['Severity',      `<span class="sev-badge ${sevClass}">${report.severity || '—'}</span>`],
      ['Title',         _esc(report.title) || '—'],
      ['Date',          report.dateOfIncident ? new Date(report.dateOfIncident).toLocaleString() : '—'],
      ['Platform',      report.platform  || '<em style="color:var(--muted)">Not specified</em>'],
      ['Description',   `<span style="white-space:pre-wrap;word-break:break-word">${_esc(report.description)}</span>` || '—'],
      ['Evidence',      report.evidenceFiles.length ? `${report.evidenceFiles.length} file(s) attached` : '<em style="color:var(--muted)">None attached</em>'],
      ['Suspect URL',   report.suspectUrl ? `<span style="font-family:var(--font-mono);font-size:12px;color:var(--red)">${_esc(report.suspectUrl)}</span>` : '<em style="color:var(--muted)">None provided</em>'],
    ];

    document.getElementById('reviewCard').innerHTML = rows.map(([k, v]) => `
      <div class="review-row">
        <span class="review-key">${k}</span>
        <span class="review-val">${v}</span>
      </div>
    `).join('');
  }

  function _esc(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── SUBMIT ────────────────────────────────────
  function updateSubmitBtn() {
    const checked = document.getElementById('consentCheck').checked;
    document.getElementById('submitBtn').disabled = !checked;
  }

  function submit() {
    report.reportId    = generateReportId();
    report.submittedAt = new Date().toISOString();
    report.status      = 'PENDING';

    const saved = saveReport(report);
    if (!saved) {
      alert('Could not save your report. Please try again.');
      return;
    }

    // Hide current panel, show success
    document.getElementById(`panel-${currentStep}`).classList.remove('active');
    document.getElementById('successScreen').classList.add('show');
    document.getElementById('displayReportId').textContent = report.reportId;
    document.querySelector('.progress-bar').style.opacity  = '0.4';
    document.querySelector('.progress-bar').style.pointerEvents = 'none';

    // Refresh awareness dashboard with new data
    if (typeof Dashboard !== 'undefined') {
      setTimeout(() => Dashboard.refresh(), 400);
    }

    // Clear saved draft and reset browser tab title
    if (typeof Integration !== 'undefined') {
      Integration.clearDraft();
      Integration.resetTitle();
    }
  }

  function copyId() {
    const id  = document.getElementById('displayReportId').textContent;
    const btn = document.querySelector('.copy-btn');
    navigator.clipboard.writeText(id).then(() => {
      btn.textContent = '✓ Copied!';
      btn.style.color = 'var(--green)';
      setTimeout(() => {
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
        btn.style.color = '';
      }, 2200);
    });
  }

  // ── RESET ─────────────────────────────────────
  function reset() {
    currentStep = 1;
    report = _freshReport();
    Uploader.clearFiles();

    document.getElementById('successScreen').classList.remove('show');
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-1').classList.add('active');
    document.querySelectorAll('.category-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('nextBtn1').disabled = true;
    document.querySelector('.progress-bar').style.opacity = '1';
    document.querySelector('.progress-bar').style.pointerEvents = '';

    // Reset form fields
    ['incidentTitle','incidentDate','incidentPlatform','incidentDesc','suspectUrl']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.querySelectorAll('.severity-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('consentCheck').checked = false;
    document.getElementById('submitBtn').disabled = true;
    document.getElementById('uploadPreviews').innerHTML = '';
    document.getElementById('titleCounter').textContent = '0/80';
    document.getElementById('descCounter').textContent  = '0/1000';

    _updateProgressBar();
  }

  // runPrefill is public so integration.js can trigger it after
  // writing ZT_PREFILL to localStorage from the URL param
  return {
    init, selectCategory, next, back, setSeverity,
    removeFile, updateSubmitBtn, submit, copyId, reset,
    runPrefill: _checkPhishScanPrefill
  };
})();

// wizard.init is called explicitly from index.html inline script
// AFTER Integration.init() so ZT_PREFILL is always ready first
