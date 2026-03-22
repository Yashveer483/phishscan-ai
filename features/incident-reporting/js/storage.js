// storage.js
// localStorage interface for the Incident Reporting System
// All keys are prefixed with ZT_IRS_ to avoid collisions

const STORAGE_PREFIX = 'ZT_IRS_';
const INDEX_KEY      = 'ZT_IRS_INDEX';

function saveReport(report) {
  try {
    const key = STORAGE_PREFIX + report.reportId;
    localStorage.setItem(key, JSON.stringify(report));
    // Keep a flat index of all report IDs for the dashboard
    const index = _getIndex();
    if (!index.includes(report.reportId)) index.push(report.reportId);
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    return true;
  } catch (e) {
    console.error('[ZT] Failed to save report:', e);
    return false;
  }
}

function getReport(reportId) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + reportId);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function getAllReports() {
  return _getIndex()
    .map(id => getReport(id))
    .filter(Boolean);
}

function deleteReport(reportId) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + reportId);
    const index = _getIndex().filter(id => id !== reportId);
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    return true;
  } catch (e) { return false; }
}

function _getIndex() {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
