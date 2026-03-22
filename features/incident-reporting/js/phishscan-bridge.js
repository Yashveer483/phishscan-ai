// phishscan-bridge.js
// ─────────────────────────────────────────────────────────
// ADD THIS FILE to: features/phishscan/
// LINK IT in:      features/phishscan/index.html
//
// This bridges the PhishScan feature to the Incident Reporting System.
// When PhishScan returns a SUSPICIOUS or DANGEROUS result, this script
// injects a "Report This Incident" button into the result card.
// Clicking it saves the scan data to localStorage and redirects to the IRS.
// ─────────────────────────────────────────────────────────

const PhishScanBridge = (() => {

  const IRS_URL    = '../incident-reporting/index.html';
  const PREFILL_KEY = 'ZT_PREFILL';

  // ── CALL THIS after PhishScan returns a result ──────
  // Pass the scan result object to inject the Report button.
  //
  // Example usage in your phishscan.js:
  //
  //   const result = await runScan(emailText);
  //   PhishScanBridge.onScanResult(result, {
  //     subject: emailSubject,
  //     sender:  emailSender,
  //     body:    emailText
  //   });
  //
  // result object should have: { threatLevel: 'SAFE'|'SUSPICIOUS'|'DANGEROUS', flags: [] }
  // ────────────────────────────────────────────────────

  function onScanResult(result, emailData = {}) {
    if (!result) return;

    const level = (result.threatLevel || result.level || '').toUpperCase();

    // Only inject button for threats — not for safe emails
    if (level !== 'SUSPICIOUS' && level !== 'DANGEROUS') return;

    _injectReportButton(result, emailData);
  }

  // ── Inject "Report This Incident" button into result UI ──
  function _injectReportButton(result, emailData) {
    // Avoid injecting twice
    if (document.getElementById('phishReportBtn')) return;

    // Find the result card — adjust selector to match your PhishScan HTML
    const resultCard = document.querySelector(
      '.result-card, .scan-result, #scanResult, .threat-result'
    );

    if (!resultCard) {
      console.warn('[PhishScanBridge] Could not find result card element.');
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(255,255,255,0.08);
    `;

    wrapper.innerHTML = `
      <button id="phishReportBtn" onclick="PhishScanBridge.reportIncident()" style="
        display: inline-flex;
        align-items: center;
        gap: 9px;
        background: rgba(255,59,92,0.10);
        border: 1px solid rgba(255,59,92,0.35);
        border-radius: 9px;
        padding: 10px 20px;
        color: #FF3B5C;
        font-size: 13.5px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
        width: 100%;
        justify-content: center;
      "
      onmouseover="this.style.background='rgba(255,59,92,0.18)'"
      onmouseout="this.style.background='rgba(255,59,92,0.10)'"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
             stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9"  x2="12"   y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        Report This Incident
      </button>
      <p style="
        margin: 8px 0 0;
        font-size: 11.5px;
        color: #64748B;
        text-align: center;
        font-family: 'IBM Plex Mono', monospace;
        letter-spacing: 0.02em;
      ">
        Opens the Incident Reporting System with this scan pre-filled
      </p>`;

    resultCard.appendChild(wrapper);

    // Store scan data so the button can pass it on click
    _currentScanData = { result, emailData };
  }

  let _currentScanData = null;

  // ── Navigate to IRS with pre-filled data ────────────
  function reportIncident() {
    if (!_currentScanData) return;

    const { result, emailData } = _currentScanData;

    const prefill = {
      subject:    emailData.subject || '',
      sender:     emailData.sender  || '',
      flags:      result.flags      || [],
      threatLevel: result.threatLevel || result.level || 'SUSPICIOUS',
      timestamp:  new Date().toISOString()
    };

    try {
      localStorage.setItem('ZT_PREFILL', JSON.stringify(prefill));
    } catch (e) {
      console.error('[PhishScanBridge] Could not save prefill data:', e);
      return;
    }

    // Navigate to IRS
    window.location.href = IRS_URL;
  }

  // ── MANUAL TRIGGER (for testing) ─────────────────────
  // Call this from the browser console to test the bridge:
  //   PhishScanBridge.testBridge()
  function testBridge() {
    onScanResult(
      { threatLevel: 'SUSPICIOUS', flags: ['Spoofed domain', 'OTP harvesting', 'Urgency language'] },
      { subject: 'Urgent: Verify your SBI account now', sender: 'noreply@sbi-verify-account.net' }
    );
    console.log('[PhishScanBridge] Test button injected — click "Report This Incident"');
  }

  return { onScanResult, reportIncident, testBridge };
})();
