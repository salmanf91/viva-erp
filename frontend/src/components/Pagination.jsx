import React from 'react';

/**
 * Reusable Enterprise Pagination Control
 * 
 * @param {number} page - Current active page (1-indexed)
 * @param {number} pages - Total number of pages
 * @param {number} total - Total records count across all pages
 * @param {number} limit - Items per page limit
 * @param {function} onPageChange - Callback when user navigates page
 * @param {function} [onLimitChange] - Optional callback when user changes page size
 */
export default function Pagination({
  page = 1,
  pages = 1,
  total = 0,
  limit = 20,
  onPageChange,
  onLimitChange
}) {
  if (total === 0 && pages <= 1) return null;

  const startItem = total > 0 ? (page - 1) * limit + 1 : 0;
  const endItem = Math.min(page * limit, total);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 16px',
      background: 'var(--white)',
      borderTop: '1px solid var(--border)',
      flexWrap: 'wrap',
      gap: 12
    }}>
      {/* Items range indicator */}
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
        Showing <strong style={{ color: 'var(--text)' }}>{startItem}</strong> – <strong style={{ color: 'var(--text)' }}>{endItem}</strong> of <strong style={{ color: 'var(--text)' }}>{total}</strong> entries
      </div>

      {/* Navigation Buttons and Page Size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {onLimitChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
            <span>Show:</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                fontSize: 12,
                background: 'var(--bg)',
                cursor: 'pointer'
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}

        {/* Page Nav Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              opacity: page <= 1 ? 0.4 : 1,
              cursor: page <= 1 ? 'not-allowed' : 'pointer'
            }}
          >
            ‹ Prev
          </button>

          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text)',
            padding: '0 8px'
          }}>
            Page {page} of {Math.max(1, pages)}
          </span>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pages}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              opacity: page >= pages ? 0.4 : 1,
              cursor: page >= pages ? 'not-allowed' : 'pointer'
            }}
          >
            Next ›
          </button>
        </div>
      </div>
    </div>
  );
}
