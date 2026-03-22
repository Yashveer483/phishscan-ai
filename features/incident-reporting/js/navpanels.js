// navpanels.js
// Notification bell and settings gear panel logic
// Reads real data from localStorage to populate notifications

const NavPanels = (() => {

  const SETTINGS_KEY = 'ZT_IRS_SETTINGS';
  const READ_KEY     = 'ZT_NOTIF_READ';

  let _notifOpen    = false;
  let _settingsOpen = false;

  // ── DEFAULT SETTINGS ────────────────────────────
  const DEFAULTS = {
    reducedMotion: false,
    compactMode:   false,
    aiClassifier:  true,
    autoDraft:     true
  };

  // ── INIT ─────────────────────────────────────────
  function init() {
    _loadSettings();
    _updateBadge();
  }

  // ── TOGGLE PANELS ────────────────────────────────
  function toggleNotif() {
    if (_notifOpen) { closeAll(); return; }
    closeAll();
    _openNotif();
  }

  function toggleSettings() {
    if (_settingsOpen) { closeAll(); return; }
    closeAll();
    _openSettings();
  }

  function closeAll() {
    _closeNotif();
    _closeSettings();
    const overlay = document.getElementById('panelOverlay');
    if (overlay) overlay.classList.remove('show');
  }

  // ── NOTIFICATIONS ────────────────────────────────
  function _openNotif() {
    _notifOpen = true;
    _buildNotifications();
    document.getElementById('notifPanel').classList.add('open');
    document.getElementById('notifBtn').classList.add('active');
    document.getElementById('panelOverlay').classList.add('show');
  }

  function _closeNotif() {
    _notifOpen = false;
    const panel = document.getElementById('notifPanel');
    const btn   = document.getElementById('notifBtn');
    if (panel) panel.classList.remove('open');
    if (btn)   btn.classList.remove('active');
  }

  function _buildNotifications() {
    const body    = document.getElementById('notifBody');
    if (!body) return;

    const notifs  = _generateNotifications();
    const readIds = _getReadIds();

    if (!notifs.length) {
      body.innerHTML = `
        <div class="notif-empty">
          <svg viewBox="0 0 24 24" width="40" height="40"
               stroke-width="1.2" stroke-linecap="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <p>No notifications yet.<br>Submit a report to see updates here.</p>
        </div>`;
      return;
    }

    body.innerHTML = notifs.map(n => {
      const isUnread = !readIds.includes(n.id);
      return `
        <div class="notif-item ${isUnread ? 'unread' : ''}"
             onclick="NavPanels.readNotif('${n.id}')">
          <div class="notif-icon ${n.type}">
            ${_notifIcon(n.type)}
          </div>
          <div class="notif-content">
            <div class="notif-title">${n.title}</div>
            <div class="notif-body">${n.body}</div>
            <div class="notif-time">${n.time}</div>
          </div>
          <div class="notif-dot ${isUnread ? 'unread' : 'read'}"></div>
        </div>`;
    }).join('');
  }

  // Generates contextual notifications from real localStorage reports
  function _generateNotifications() {
    const notifs  = [];
    const reports = typeof getAllReports === 'function' ? getAllReports() : [];
    const now     = Date.now();

    // Notification for each real report submitted
    reports
      .filter(r => !r.reportId.startsWith('ZT-2025-DEMO'))
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      .slice(0, 5)
      .forEach(r => {
        const mins = (now - new Date(r.submittedAt).getTime()) / 60000;
        const type = r.severity === 'CRITICAL' ? 'danger'
                   : r.severity === 'HIGH'     ? 'warning'
                   : 'info';
        notifs.push({
          id:    `report_${r.reportId}`,
          type,
          title: `Report ${r.reportId} submitted`,
          body:  `${r.incidentTypeLabel || 'Incident'} — ${r.severity} severity. Status: ${_statusLabel(r.status)}.`,
          time:  _relativeTime(mins)
        });
      });

    // Status-change notifications for reports under review
    reports
      .filter(r => r.status === 'UNDER_REVIEW')
      .slice(0, 2)
      .forEach(r => {
        notifs.push({
          id:    `review_${r.reportId}`,
          type:  'warning',
          title: `${r.reportId} is Under Review`,
          body:  'Our security team has begun analysing this incident.',
          time:  'Recently updated'
        });
      });

    // Resolved notifications
    reports
      .filter(r => r.status === 'RESOLVED')
      .slice(0, 2)
      .forEach(r => {
        notifs.push({
          id:    `resolved_${r.reportId}`,
          type:  'success',
          title: `${r.reportId} has been Resolved`,
          body:  'The reported incident has been assessed and closed.',
          time:  'Case closed'
        });
      });

    // Static system notifications always shown
    notifs.push({
      id:    'sys_welcome',
      type:  'info',
      title: 'Welcome to Project Zero Trust',
      body:  'Incident Reporting System is active. All reports are anonymized and encrypted.',
      time:  'System'
    });

    if (reports.length > 0) {
      notifs.push({
        id:    'sys_dashboard',
        type:  'info',
        title: 'Awareness Dashboard updated',
        body:  `${reports.length} report${reports.length !== 1 ? 's' : ''} now visible in the analytics dashboard.`,
        time:  'Auto-updated'
      });
    }

    return notifs;
  }

  function _notifIcon(type) {
    const icons = {
      warning: `<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      danger:  `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      success: `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`,
      info:    `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
    };
    return icons[type] || icons.info;
  }

  function _relativeTime(mins) {
    if (mins < 1)    return 'Just now';
    if (mins < 60)   return `${Math.round(mins)}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
  }

  function _statusLabel(s) {
    return { PENDING:'Pending', UNDER_REVIEW:'Under Review',
             RESOLVED:'Resolved', CLOSED:'Closed' }[s] || s;
  }

  // ── READ / UNREAD ────────────────────────────────
  function readNotif(id) {
    const ids = _getReadIds();
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(READ_KEY, JSON.stringify(ids));
    }
    // Refresh badge and item styling
    _updateBadge();
    const item = document.querySelector(`[onclick="NavPanels.readNotif('${id}')"]`);
    if (item) {
      item.classList.remove('unread');
      const dot = item.querySelector('.notif-dot');
      if (dot) { dot.classList.remove('unread'); dot.classList.add('read'); }
    }
  }

  function markAllRead() {
    const notifs = _generateNotifications();
    const ids    = notifs.map(n => n.id);
    localStorage.setItem(READ_KEY, JSON.stringify(ids));
    _updateBadge();
    document.querySelectorAll('.notif-item.unread').forEach(el => {
      el.classList.remove('unread');
      const dot = el.querySelector('.notif-dot');
      if (dot) { dot.classList.remove('unread'); dot.classList.add('read'); }
    });
  }

  function _getReadIds() {
    try { return JSON.parse(localStorage.getItem(READ_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function _updateBadge() {
    const badge   = document.getElementById('notifBadge');
    if (!badge) return;
    const notifs  = _generateNotifications();
    const readIds = _getReadIds();
    const unread  = notifs.filter(n => !readIds.includes(n.id)).length;
    badge.classList.toggle('show', unread > 0);
  }

  // ── SETTINGS ─────────────────────────────────────
  function _openSettings() {
    _settingsOpen = true;
    _refreshSettingsUI();
    document.getElementById('settingsPanel').classList.add('open');
    document.getElementById('settingsBtn').classList.add('active');
    document.getElementById('panelOverlay').classList.add('show');
  }

  function _closeSettings() {
    _settingsOpen = false;
    const panel = document.getElementById('settingsPanel');
    const btn   = document.getElementById('settingsBtn');
    if (panel) panel.classList.remove('open');
    if (btn)   btn.classList.remove('active');
  }

  function _loadSettings() {
    const saved = _getSettings();
    _applySettings(saved);

    // Sync toggle states
    Object.entries(saved).forEach(([key, val]) => {
      const el = document.getElementById(`setting${_capitalize(key)}`);
      if (el) el.checked = val;
    });
  }

  function _refreshSettingsUI() {
    // Report count
    const countEl = document.getElementById('storedReportsCount');
    if (countEl) {
      const reports = typeof getAllReports === 'function' ? getAllReports() : [];
      const real    = reports.filter(r => !r.reportId.startsWith('ZT-2025-DEMO'));
      countEl.textContent = `${real.length} report${real.length !== 1 ? 's' : ''} stored locally`;
    }

    // API key status
    const keyEl = document.getElementById('apiKeyStatus');
    if (keyEl) {
      const hasKey = !!localStorage.getItem('ZT_AI_KEY');
      keyEl.textContent   = hasKey ? 'Configured ✓' : 'Not configured';
      keyEl.style.color   = hasKey ? 'var(--green)' : 'var(--muted)';
    }
  }

  function saveSetting(key, value) {
    const settings  = _getSettings();
    settings[key]   = value;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    _applySettings(settings);
  }

  function _applySettings(s) {
    // Reduced motion
    document.documentElement.style.setProperty(
      '--anim-duration', s.reducedMotion ? '0s' : ''
    );
    if (s.reducedMotion) {
      document.body.classList.add('reduced-motion');
    } else {
      document.body.classList.remove('reduced-motion');
    }

    // Compact mode
    document.body.classList.toggle('compact-mode', !!s.compactMode);
  }

  function _getSettings() {
    try {
      const raw  = localStorage.getItem(SETTINGS_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      return { ...DEFAULTS, ...saved };
    } catch (e) { return { ...DEFAULTS }; }
  }

  function _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ── CLEAR ALL REPORTS ────────────────────────────
  function clearAllReports() {
    if (!confirm('Delete all stored reports? This cannot be undone.')) return;
    const keys = Object.keys(localStorage).filter(k => k.startsWith('ZT_IRS_'));
    keys.forEach(k => localStorage.removeItem(k));
    _refreshSettingsUI();
    if (typeof Dashboard !== 'undefined') Dashboard.refresh();
    closeAll();
    // Show toast
    const t = document.createElement('div');
    t.style.cssText = `
      position:fixed;bottom:2rem;left:50%;transform:translateX(-50%) translateY(80px);
      background:var(--surface);border:1px solid var(--border2);border-left:3px solid var(--red);
      border-radius:10px;padding:11px 20px;font-size:13.5px;color:var(--text2);
      z-index:400;transition:transform .35s ease,opacity .35s;opacity:0;white-space:nowrap;
    `;
    t.textContent = 'All reports cleared.';
    document.body.appendChild(t);
    requestAnimationFrame(() => {
      t.style.transform = 'translateX(-50%) translateY(0)';
      t.style.opacity   = '1';
    });
    setTimeout(() => {
      t.style.opacity   = '0';
      t.style.transform = 'translateX(-50%) translateY(80px)';
      setTimeout(() => t.remove(), 400);
    }, 2800);
  }

  return { init, toggleNotif, toggleSettings, closeAll,
           readNotif, markAllRead, saveSetting, clearAllReports };
})();
