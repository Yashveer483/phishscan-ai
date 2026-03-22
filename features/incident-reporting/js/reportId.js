// reportId.js
// Generates unique ZT-YYYY-XXXX format report IDs
// Chars chosen to avoid ambiguous lookalikes (0/O, 1/I)

function generateReportId() {
  const year  = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix  = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `ZT-${year}-${suffix}`;
}
