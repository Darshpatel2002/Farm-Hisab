/** CSV / JSON export helpers used by Reports and Settings -> Backup. */

export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) return '';
  const keys = columns ?? Object.keys(rows[0]);
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    // Prefixing formula characters stops spreadsheet formula injection.
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const header = keys.map(escape).join(',');
  const body = rows.map((row) => keys.map((key) => escape(row[key])).join(',')).join('\n');
  return `${header}\n${body}`;
}

export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob(['\uFEFF', content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>, columns?: string[]): void {
  downloadFile(filename, toCsv(rows, columns), 'text/csv');
}

export function downloadJson(filename: string, data: unknown): void {
  downloadFile(filename, JSON.stringify(data, null, 2), 'application/json');
}

/** One named block of rows inside an Excel or PDF export. */
export interface ExportSheet {
  name: string;
  rows: Array<Record<string, unknown>>;
  columns?: string[];
}

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rowsToHtmlTable(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) return '<p>No data</p>';
  const keys = columns ?? Object.keys(rows[0]);
  const head = keys.map((key) => `<th>${escapeHtml(key)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${keys.map((key) => `<td>${escapeHtml(row[key])}</td>`).join('')}</tr>`)
    .join('');
  return `<table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Excel opens HTML tables natively; each sheet becomes a titled section. */
export function downloadExcel(filename: string, sheets: ExportSheet[]): void {
  const sections = sheets
    .map((sheet) => `<h2>${escapeHtml(sheet.name)}</h2>${rowsToHtmlTable(sheet.rows, sheet.columns)}`)
    .join('<br/>');
  const html = `<html><head><meta charset="utf-8" /></head><body>${sections}</body></html>`;
  downloadFile(filename, html, 'application/vnd.ms-excel');
}

/** Opens a print-ready window so the browser can "Save as PDF". */
export function downloadPdf(title: string, sheets: ExportSheet[]): void {
  const sections = sheets
    .map((sheet) => `<h2>${escapeHtml(sheet.name)}</h2>${rowsToHtmlTable(sheet.rows, sheet.columns)}`)
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
    <style>
      body { font-family: system-ui, 'Segoe UI', Arial, sans-serif; padding: 24px; color: #0f172a; }
      h1 { color: #15803d; margin: 0 0 8px; }
      h2 { color: #166534; margin: 24px 0 4px; font-size: 16px; }
      table { border-collapse: collapse; width: 100%; font-size: 11px; }
      th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; }
      th { background: #dcfce7; }
    </style></head>
    <body><h1>${escapeHtml(title)}</h1>${sections}</body></html>`;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.setTimeout(() => win.print(), 300);
}

export function timestampedName(prefix: string, extension: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${prefix}-${stamp}.${extension}`;
}
