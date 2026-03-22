// classifier.js
// AI-powered incident classifier using Claude API
// Debounces on description input → suggests category → user accepts or dismisses

const Classifier = (() => {
  const MODEL        = 'claude-sonnet-4-20250514';
  const DEBOUNCE_MS  = 1400;
  const MIN_CHARS    = 30;

  let _debounceTimer = null;
  let _lastText      = '';
  let _active        = false;

  // Category map — must match CATEGORIES in wizard.js
  const CAT_MAP = {
    phishing:     'Phishing Email',
    fraud:        'Financial Fraud',
    'fake-website':'Fake Website',
    malware:      'Malware',
    smishing:     'Smishing (SMS)',
    ransomware:   'Ransomware',
    identity:     'Identity Theft',
    social:       'Social Media Hack',
    other:        'Other / Unknown'
  };

  // ── PUBLIC: attach to description textarea ──────
  function attach(textareaId) {
    const el = document.getElementById(textareaId);
    if (!el) return;
    el.addEventListener('input', () => {
      const text = el.value.trim();
      clearTimeout(_debounceTimer);
      if (text.length < MIN_CHARS) { _hide(); return; }
      if (text === _lastText)       return;
      _showThinking();
      _debounceTimer = setTimeout(() => _classify(text), DEBOUNCE_MS);
    });
  }

  // ── CLASSIFY ────────────────────────────────────
  async function _classify(text) {
    if (_active) return;
    _active   = true;
    _lastText = text;

    const apiKey = _getApiKey();
    if (!apiKey) { _showSetupPrompt(); _active = false; return; }

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 60,
          system: `You are a cybersecurity incident classifier. Given a description of a cyber incident, respond with ONLY a JSON object — no markdown, no explanation. Format: {"id":"<category_id>","confidence":"HIGH|MEDIUM|LOW"}. Valid category IDs: phishing, fraud, fake-website, malware, smishing, ransomware, identity, social, other.`,
          messages: [{ role: 'user', content: `Classify this incident: ${text.slice(0, 600)}` }]
        })
      });

      if (!res.ok) throw new Error(`API ${res.status}`);
      const data  = await res.json();
      const raw   = data.content?.[0]?.text?.trim() || '';
      const clean = raw.replace(/```json|```/g, '').trim();
      const obj   = JSON.parse(clean);

      if (obj.id && CAT_MAP[obj.id]) {
        _showSuggestion(obj.id, CAT_MAP[obj.id], obj.confidence || 'MEDIUM');
      } else {
        _hide();
      }
    } catch (e) {
      console.warn('[Classifier]', e.message);
      _hide();
    } finally {
      _active = false;
    }
  }

  // ── API KEY MANAGEMENT ──────────────────────────
  function _getApiKey() {
    return localStorage.getItem('ZT_AI_KEY') || null;
  }

  function saveApiKey(key) {
    if (key && key.startsWith('sk-ant-')) {
      localStorage.setItem('ZT_AI_KEY', key);
      document.getElementById('aiKeyModal').style.display = 'none';
      return true;
    }
    return false;
  }

  function clearApiKey() {
    localStorage.removeItem('ZT_AI_KEY');
  }

  // ── UI HELPERS ──────────────────────────────────
  function _showThinking() {
    const el = document.getElementById('aiSuggestion');
    if (!el) return;
    el.innerHTML = `
      <div class="ai-suggest thinking">
        <div class="ai-dots">
          <span></span><span></span><span></span>
        </div>
        <span class="ai-thinking-text">AI is analysing your description…</span>
      </div>`;
    el.style.display = 'block';
  }

  function _showSuggestion(id, label, confidence) {
    const el = document.getElementById('aiSuggestion');
    if (!el) return;

    const confColor = { HIGH:'var(--green)', MEDIUM:'var(--amber)', LOW:'var(--muted2)' }[confidence] || 'var(--muted2)';
    const confLabel = { HIGH:'High confidence', MEDIUM:'Medium confidence', LOW:'Low confidence' }[confidence] || '';

    el.innerHTML = `
      <div class="ai-suggest show">
        <div class="ai-suggest-left">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none"
               stroke="var(--cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4l3 3"/>
          </svg>
          <span class="ai-label">AI Suggestion</span>
          <span class="ai-category">${label}</span>
          <span class="ai-conf" style="color:${confColor}">· ${confLabel}</span>
        </div>
        <div class="ai-suggest-actions">
          <button class="ai-btn-accept" onclick="Classifier.accept('${id}','${label}')">Accept</button>
          <button class="ai-btn-dismiss" onclick="Classifier.dismiss()">Dismiss</button>
        </div>
      </div>`;
    el.style.display = 'block';
  }

  function _showSetupPrompt() {
    const el = document.getElementById('aiSuggestion');
    if (!el) return;
    el.innerHTML = `
      <div class="ai-suggest setup">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
             stroke="var(--amber)" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span style="color:var(--muted2);font-size:12px;">
          Add your Claude API key to enable AI auto-classification.
        </span>
        <button class="ai-btn-setup" onclick="Classifier.showKeyModal()">Add Key</button>
      </div>`;
    el.style.display = 'block';
  }

  function _hide() {
    const el = document.getElementById('aiSuggestion');
    if (el) { el.style.display = 'none'; el.innerHTML = ''; }
  }

  // ── ACCEPT / DISMISS ────────────────────────────
  function accept(id, label) {
    // Select the matching category card in Step 1
    const card = document.querySelector(`.category-card[data-id="${id}"]`);
    if (card) wizard.selectCategory(id, label, card);
    _hide();
    // Brief flash confirmation
    const flash = document.getElementById('aiSuggestion');
    if (!flash) return;
    flash.innerHTML = `
      <div class="ai-suggest accepted">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
             stroke="var(--green)" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span style="color:var(--green);font-size:12px;">
          Category set to <strong>${label}</strong>
        </span>
      </div>`;
    flash.style.display = 'block';
    setTimeout(_hide, 2400);
  }

  function dismiss() { _hide(); }

  function showKeyModal() {
    const modal = document.getElementById('aiKeyModal');
    if (modal) modal.style.display = 'flex';
  }

  function hideKeyModal() {
    const modal = document.getElementById('aiKeyModal');
    if (modal) modal.style.display = 'none';
  }

  function submitKey() {
    const input = document.getElementById('apiKeyInput');
    const err   = document.getElementById('apiKeyError');
    if (!input) return;
    const val = input.value.trim();
    if (!saveApiKey(val)) {
      if (err) err.textContent = 'Invalid key — must start with sk-ant-';
    } else {
      if (err) err.textContent = '';
      input.value = '';
    }
  }

  return { attach, accept, dismiss, showKeyModal, hideKeyModal, submitKey, saveApiKey, clearApiKey };
})();
