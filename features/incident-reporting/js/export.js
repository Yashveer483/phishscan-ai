// export.js
// Export system — PDF (jsPDF) and CSV download for incident reports

const Exporter = (() => {

  // ── CSV EXPORT ────────────────────────────────────
  function exportCSV() {
    const reports = getAllReports();
    if (!reports.length) { _toast('No reports to export.', false); return; }

    const headers = [
      'Report ID','Incident Type','Severity','Title',
      'Date of Incident','Platform','Suspect URL',
      'Status','Submitted At','Evidence Files','From PhishScan'
    ];

    const rows = reports.map(r => [
      r.reportId,
      r.incidentTypeLabel || r.incidentType || '',
      r.severity || '',
      _csvSafe(r.title),
      r.dateOfIncident ? new Date(r.dateOfIncident).toLocaleString() : '',
      _csvSafe(r.platform),
      _csvSafe(r.suspectUrl),
      r.status || '',
      r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '',
      r.evidenceFiles ? r.evidenceFiles.length : 0,
      r.fromPhishScan ? 'Yes' : 'No'
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const BOM   = '\uFEFF';
    const blob  = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = `ZeroTrust_Reports_${_dateTag()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    _toast(`${reports.length} reports exported as CSV`);
  }

  // ── PDF EXPORT (single report) ────────────────────
  async function exportPDF(reportId) {
    if (typeof window.jspdf === 'undefined') {
      _toast('PDF library not loaded yet — please try again.', false);
      return;
    }

    const report = reportId ? getReport(reportId) : _getLatestReport();
    if (!report) { _toast('No report found to export.', false); return; }

    _setLoading('btnExportPDF', true);

    try {
      const { jsPDF } = window.jspdf;
      const doc       = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const W         = 210;
      const margin    = 18;
      let   y         = 20;

      // HEADER BAND — dark background, light text OK here
      doc.setFillColor(10, 15, 30);
      doc.rect(0, 0, W, 38, 'F');

      doc.setTextColor(0, 212, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('PROJECT ZERO TRUST', margin, 13);

      doc.setTextColor(241, 245, 249);
      doc.setFontSize(16);
      doc.text('Cyber Incident Report', margin, 24);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 32);

      doc.setTextColor(0, 212, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(report.reportId, W - margin, 13, { align: 'right' });

      y = 50;

      // BODY — white background, ALL text must be DARK
      y = _pdfSection(doc, 'REPORT INFORMATION', y, margin, W);

      const sevColor = {
        LOW:      [5,  120, 85],
        MEDIUM:   [180, 100, 0],
        HIGH:     [200,  70, 0],
        CRITICAL: [180,  20, 40]
      }[report.severity] || [71, 85, 105];

      const infoRows = [
        ['Report ID',        report.reportId],
        ['Incident Type',    report.incidentTypeLabel || report.incidentType || '—'],
        ['Severity',         report.severity || '—'],
        ['Status',           report.status || '—'],
        ['Date of Incident', report.dateOfIncident ? new Date(report.dateOfIncident).toLocaleString() : '—'],
        ['Submitted',        report.submittedAt ? new Date(report.submittedAt).toLocaleString() : '—'],
        ['Platform',         report.platform || 'Not specified'],
        ['Via PhishScan',    report.fromPhishScan ? 'Yes' : 'No'],
      ];

      infoRows.forEach(([key, val]) => {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(key.toUpperCase(), margin, y);

        doc.setFont('helvetica', 'normal');
        if (key === 'Severity') {
          doc.setTextColor(...sevColor);
        } else {
          doc.setTextColor(15, 23, 42);
        }
        doc.text(String(val), margin + 52, y);
        y += 7;
      });

      y += 4;

      y = _pdfSection(doc, 'INCIDENT TITLE', y, margin, W);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      const titleLines = doc.splitTextToSize(report.title || '—', W - margin * 2);
      doc.text(titleLines, margin, y);
      y += titleLines.length * 7 + 4;

      y = _pdfSection(doc, 'DESCRIPTION', y, margin, W);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      const descLines = doc.splitTextToSize(report.description || '—', W - margin * 2);
      descLines.forEach(line => {
        if (y > 270) { doc.addPage(); _pdfNewPageHeader(doc); y = 25; }
        doc.text(line, margin, y);
        y += 5.5;
      });
      y += 4;

      if (report.suspectUrl) {
        y = _pdfSection(doc, 'SUSPECT URL / EMAIL', y, margin, W);
        doc.setFont('courier', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(180, 20, 40);
        doc.text(report.suspectUrl, margin, y);
        y += 10;
      }

      y = _pdfSection(doc, 'EVIDENCE', y, margin, W);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      const evCount = report.evidenceFiles?.length || 0;
      doc.text(evCount > 0 ? `${evCount} file(s) attached` : 'No evidence files attached', margin, y);
      y += 10;

      y += 4;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'This report is confidential. Your identity is never stored. All reports are fully anonymized.',
        margin, y
      );

      // FOOTER BAND — dark background, light text OK here
      const pageCount = doc.internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFillColor(10, 15, 30);
        doc.rect(0, 287, W, 10, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text('Project Zero Trust — Confidential Incident Report', margin, 293);
        doc.text(`Page ${p} of ${pageCount}`, W - margin, 293, { align: 'right' });
      }

      doc.save(`ZeroTrust_${report.reportId}_${_dateTag()}.pdf`);
      _toast(`PDF exported: ${report.reportId}`);
    } catch (e) {
      console.error('[Export PDF]', e);
      _toast('PDF export failed — please try again.', false);
    } finally {
      _setLoading('btnExportPDF', false);
    }
  }

  // ── PDF HELPERS ────────────────────────────────────
  function _pdfSection(doc, label, y, margin, W) {
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y - 4, W - margin * 2, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 212, 255);
    doc.text(label, margin + 3, y + 1.5);
    return y + 10;
  }

  function _pdfNewPageHeader(doc) {
    doc.setFillColor(10, 15, 30);
    doc.rect(0, 0, 210, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('PROJECT ZERO TRUST — Incident Report (continued)', 18, 9);
  }

  function _getLatestReport() {
    const all = getAllReports();
    if (!all.length) return null;
    return all.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
  }

  // ── UTILS ─────────────────────────────────────────
  function _csvSafe(str) {
    return (str || '').replace(/[\r\n]+/g, ' ');
  }

  function _dateTag() {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }

  function _setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.classList.toggle('loading', loading);
    btn.disabled = loading;
  }

  function _toast(msg, success = true) {
    const toast = document.getElementById('exportToast');
    if (!toast) return;
    const icon = toast.querySelector('svg');
    if (icon) icon.style.stroke = success ? 'var(--green)' : 'var(--red)';
    toast.querySelector('span').textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3200);
  }

  return { exportCSV, exportPDF };
})();