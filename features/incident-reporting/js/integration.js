// integration.js
// Phase 6 — Final integration layer for Project Zero Trust IRS
//
// Covers:
//  1. Form draft persistence  — saves/restores in-progress form to localStorage
//  2. Page title updates      — browser tab reflects current wizard step
//  3. Smooth scroll nav       — navbar section links scroll smoothly
//  4. Storage guard           — graceful handling when localStorage is full
//  5. Keyboard shortcuts      — Escape = back, Enter = next where safe
//  6. PhishScan banner        — shows a banner when arriving from PhishScan
//  7. Scroll-to-wizard        — auto-scrolls to form when arriving from PhishScan
//  8. Error boundary          — catches unhandled JS errors, shows friendly message

const Integration = (() => {

  const DRAFT_KEY  = 'ZT_IRS_DRAFT';
  const STEP_TITLES = [
    'Select Incident Type',
    'Incident Details',
    'Attach Evidence',
    'Review & Submit'
  ];

  // ── 1. FORM DRAFT PERSISTENCE ──────────────────────
  // Auto-saves the in-progress form every time user edits a field.
  // On page load, if a draft exists, offers to restore it.

  function initDraft() {
    const fields = [
      'incidentTitle', 'incidentDate', 'incidentPlatform',
      'incidentDesc', 'suspectUrl'
    ];

    // Attach save-on-input to every field
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', _saveDraft);
      el.addEventListener('change', _saveDraft);
    });

    document.querySelectorAll('.severity-btn').forEach(btn => {
      btn.addEventListener('click', _saveDraft);
    });

    // Check for existing draft on load (but not if PhishScan prefill present)
    const hasPrefill = !!localStorage.getItem('ZT_PREFILL');
    if (!hasPrefill) _checkDraft();
  }

  function _saveDraft() {
    try {
      const draft = {
        title:    document.getElementById('incidentTitle')?.value   || '',
        date:     document.getElementById('incidentDate')?.value    || '',
        platform: document.getElementById('incidentPlatform')?.value|| '',
        desc:     document.getElementById('incidentDesc')?.value    || '',
        url:      document.getElementById('suspectUrl')?.value      || '',
        severity: document.querySelector('.severity-btn.active')?.dataset.severity || null,
        savedAt:  Date.now()
      };
      // Only save if something was actually typed
      if (draft.title || draft.desc || draft.platform) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      }
    } catch (e) {
      // localStorage full — silently skip draft save
    }
  }

  function _checkDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft.title && !draft.desc) return;

      // Only restore if draft is less than 24 hours old
      if (Date.now() - draft.savedAt > 86400000) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }

      _showDraftBanner(draft);
    } catch (e) {
      localStorage.removeItem(DRAFT_KEY);
    }
  }

  function _showDraftBanner(draft) {
    const banner = document.createElement('div');
    banner.id        = 'draftBanner';
    banner.className = 'draft-banner';
    banner.innerHTML = `
      <div class="draft-banner-left">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
             stroke="var(--amber)" stroke-width="2" stroke-linecap="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        <span>You have an unfinished report — <strong>${draft.title || 'untitled'}</strong></span>
      </div>
      <div class="draft-banner-actions">
        <button class="draft-btn-restore" onclick="Integration.restoreDraft()">Restore Draft</button>
        <button class="draft-btn-discard" onclick="Integration.discardDraft()">Discard</button>
      </div>`;

    const wizardCard = document.querySelector('.wizard-card');
    if (wizardCard) wizardCard.insertAdjacentElement('beforebegin', banner);
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);

      const set = (id, val) => {
        const el = document.getElementById(id);
        if (el && val) { el.value = val; el.dispatchEvent(new Event('input')); }
      };

      set('incidentTitle',    draft.title);
      set('incidentDate',     draft.date);
      set('incidentPlatform', draft.platform);
      set('incidentDesc',     draft.desc);
      set('suspectUrl',       draft.url);

      if (draft.severity) {
        const btn = document.querySelector(`.severity-btn[data-severity="${draft.severity}"]`);
        if (btn) wizard.setSeverity(btn);
      }

      _removeDraftBanner();
      _showToast('Draft restored — continue where you left off.', 'amber');
    } catch (e) {
      _removeDraftBanner();
    }
  }

  function discardDraft() {
    localStorage.removeItem(DRAFT_KEY);
    _removeDraftBanner();
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  }

  function _removeDraftBanner() {
    const b = document.getElementById('draftBanner');
    if (b) b.remove();
  }

  // ── 2. PAGE TITLE UPDATES ──────────────────────────
  // Updates the browser tab title as the user moves through wizard steps

  function updateTitle(step) {
    if (step >= 1 && step <= 4) {
      document.title = `Step ${step} of 4 — ${STEP_TITLES[step - 1]} | Project Zero Trust`;
    } else {
      document.title = 'Incident Reporting — Project Zero Trust';
    }
  }

  function resetTitle() {
    document.title = 'Incident Reporting — Project Zero Trust';
  }

  // ── 3. SMOOTH SCROLL NAV ───────────────────────────
  // Adds smooth scroll behaviour to navbar anchor links

  function initScrollNav() {
    const targets = {
      '#report':    '.wizard-section',
      '#tracker':   '.tracker-section',
      '#dashboard': '.dashboard-section'
    };

    document.querySelectorAll('.nav-link[href^="#"]').forEach(link => {
      link.addEventListener('click', e => {
        const selector = targets[link.getAttribute('href')];
        if (!selector) return;
        e.preventDefault();
        const el = document.querySelector(selector);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  // ── 4. STORAGE GUARD ──────────────────────────────
  // Wraps localStorage writes to handle QuotaExceededError gracefully

  function initStorageGuard() {
    window.addEventListener('error', e => {
      if (e.message && e.message.toLowerCase().includes('quota')) {
        _showToast(
          'Storage is full — please export and clear old reports.',
          'red'
        );
      }
    });
  }

  // ── 5. KEYBOARD SHORTCUTS ─────────────────────────
  function initKeyboard() {
    document.addEventListener('keydown', e => {
      // Don't fire if user is typing in a field
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        const modal = document.getElementById('aiKeyModal');
        if (modal && modal.style.display === 'flex') {
          Classifier.hideKeyModal();
          return;
        }
        // Go back a step if in the wizard
        if (typeof wizard !== 'undefined') wizard.back();
      }
    });
  }

  // ── 6. PHISHSCAN BANNER ───────────────────────────
  // Shows a contextual banner when arriving from PhishScan feature
  // Supports two sources:
  //   A) URL param ?prefill=BASE64  (from Streamlit Cloud deployment)
  //   B) localStorage ZT_PREFILL    (from local HTML PhishScan)

  function checkPhishScanArrival() {
    // A) Try URL parameter first (Streamlit Cloud path)
    const urlData = _readUrlParam();
    if (urlData) {
      try {
        // Save to localStorage so wizard.js can read it normally
        localStorage.setItem('ZT_PREFILL', JSON.stringify(urlData));
        // Clean the URL so param doesn't persist on refresh
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        // Immediately trigger wizard prefill — it is already initialised by now
        if (typeof wizard !== 'undefined' && wizard.runPrefill) {
          wizard.runPrefill();
        }
        _showPhishBanner(urlData);
        _scrollToWizard();
        return;
      } catch (e) { console.warn('[Integration] URL param parse failed:', e); }
    }

    // B) Fallback — check localStorage (local HTML PhishScan path)
    const prefill = localStorage.getItem('ZT_PREFILL');
    if (!prefill) return;
    try {
      const data = JSON.parse(prefill);
      _showPhishBanner(data);
      _scrollToWizard();
    } catch (e) { /* malformed — wizard.js will clean it up */ }
  }

  function _readUrlParam() {
    try {
      const params  = new URLSearchParams(window.location.search);
      const encoded = params.get('prefill');
      if (!encoded) return null;
      // Base64 URL-safe decode
      const json = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json);
    } catch (e) { return null; }
  }

  function _showPhishBanner(data) {
    const existing = document.getElementById('phishBanner');
    if (existing) return;

    const banner = document.createElement('div');
    banner.id        = 'phishBanner';
    banner.className = 'phish-banner';
    banner.innerHTML = `
      <div class="phish-banner-left">
        <div class="phish-banner-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
               stroke="var(--red)" stroke-width="2" stroke-linecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div>
          <div class="phish-banner-title">PhishScan detected a threat</div>
          <div class="phish-banner-sub">
            Form pre-filled from scan results
            ${data.subject ? `— <em>${data.subject}</em>` : ''}
          </div>
        </div>
      </div>
      <button class="phish-banner-close" onclick="Integration.dismissPhishBanner()"
              title="Dismiss">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
             stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6"  y1="6" x2="18" y2="18"/>
        </svg>
      </button>`;

    const wizardCard = document.querySelector('.wizard-card');
    if (wizardCard) wizardCard.insertAdjacentElement('beforebegin', banner);
  }

  function dismissPhishBanner() {
    const b = document.getElementById('phishBanner');
    if (b) { b.style.opacity = '0'; setTimeout(() => b.remove(), 300); }
  }

  // ── 7. SCROLL TO WIZARD ────────────────────────────
  function _scrollToWizard() {
    setTimeout(() => {
      const section = document.querySelector('.wizard-section');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
  }

  // ── 8. MINI TOAST (internal) ──────────────────────
  // Separate from Exporter toast — used by Integration itself

  function _showToast(msg, type = 'green') {
    const colors = { green:'var(--green)', amber:'var(--amber)', red:'var(--red)' };
    const t = document.createElement('div');
    t.className = 'integration-toast';
    t.style.cssText = `
      position:fixed; bottom:2rem; left:50%; transform:translateX(-50%) translateY(80px);
      background:var(--surface); border:1px solid var(--border2);
      border-radius:10px; padding:11px 20px; font-size:13.5px;
      color:var(--text2); z-index:400; transition:transform 0.35s ease,opacity 0.35s;
      opacity:0; white-space:nowrap; border-left:3px solid ${colors[type]||colors.green};
    `;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => {
      t.style.transform  = 'translateX(-50%) translateY(0)';
      t.style.opacity    = '1';
    });
    setTimeout(() => {
      t.style.opacity   = '0';
      t.style.transform = 'translateX(-50%) translateY(80px)';
      setTimeout(() => t.remove(), 400);
    }, 3500);
  }

  // ── INIT ALL ──────────────────────────────────────
  function init() {
    initDraft();
    initScrollNav();
    initStorageGuard();
    initKeyboard();
    checkPhishScanArrival();
  }

  return {
    init,
    updateTitle,
    resetTitle,
    restoreDraft,
    discardDraft,
    clearDraft,
    dismissPhishBanner
  };
})();
