/**
 * Utility to export structured tabular datasets into Excel/CSV format.
 * Includes UTF-8 BOM (\uFEFF) to ensure Microsoft Excel correctly displays
 * special currency symbols (₹, SAR, €, etc.) and multi-lingual characters.
 */
export function exportToCSV(filename, headers, rows) {
  const sanitizeCell = (cell) => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = headers.map(sanitizeCell).join(',');
  const rowLines = rows.map(r => r.map(sanitizeCell).join(','));
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export default exportToCSV;
