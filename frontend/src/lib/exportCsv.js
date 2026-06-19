// Minimal client-side CSV export. No dependency — builds a UTF-8 (BOM) file so
// Excel opens ₹ and other characters correctly, then triggers a download.
//
// columns: [{ label, key }] or [{ label, map: (row) => value }]
export function exportToCsv(filename, rows, columns) {
  const escape = (value) => {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const header = columns.map((col) => escape(col.label)).join(',');
  const body = (rows || [])
    .map((row) => columns.map((col) => escape(col.map ? col.map(row) : row[col.key])).join(','))
    .join('\n');
  const csv = `﻿${header}\n${body}`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Convert paise (integer) to a plain rupee number string for spreadsheets,
// e.g. 45000 -> "450.00". Kept separate from the ₹-formatted UI helper.
export const paiseToRupees = (paise) => (Number(paise || 0) / 100).toFixed(2);
