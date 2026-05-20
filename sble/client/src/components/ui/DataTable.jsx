import React, { useEffect, useMemo, useState } from 'react';
import LoadingState from './LoadingState';
import EmptyState from './EmptyState';
import { SearchInput } from './FilterBar';
import Button from './Button';
import s from './system.module.css';

const PAGE_SIZE = 25;

/**
 * Unified data table — floating container, sticky header, optional toolbar & pagination.
 */
export default function DataTable({
  columns,
  rows,
  rowKey,
  searchPlaceholder = 'Search…',
  searchFn,
  filterSlot = null,
  emptyMessage = 'No records found.',
  loading = false,
  hideToolbar = false,
  query: controlledQuery,
  onQueryChange,
  pageSize = PAGE_SIZE
}) {
  const [internalQuery, setInternalQuery] = useState('');
  const [page, setPage] = useState(0);

  const query = controlledQuery !== undefined ? controlledQuery : internalQuery;
  const setQuery = onQueryChange || setInternalQuery;

  const filtered = useMemo(() => {
    const q = String(query).trim().toLowerCase();
    if (!q || !searchFn) return rows;
    return rows.filter((row) => searchFn(row, q));
  }, [rows, query, searchFn]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);

  useEffect(() => {
    setPage(0);
  }, [query, rows.length, filtered.length]);

  const paged = useMemo(() => {
    const start = safePage * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const showPagination = filtered.length > pageSize;

  return (
    <div className={s.tableShell}>
      {!hideToolbar ? (
        <div className={`${s.actions} ${s.tableToolbar}`}>
          <div className={s.actionsSearch}>
            <SearchInput
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search table"
            />
          </div>
          {filterSlot ? <div className={s.actionsFilters}>{filterSlot}</div> : null}
        </div>
      ) : null}

      {loading ? (
        <div className={s.tableState}>
          <LoadingState label="Loading records…" />
        </div>
      ) : filtered.length === 0 ? (
        <div className={s.tableState}>
          <EmptyState message={emptyMessage} />
        </div>
      ) : (
        <>
          <div
            className={s.tableScroll}
            tabIndex={0}
            role="region"
            aria-label="Data table"
          >
            <table className={s.table}>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className={col.hideOnMobile ? s.hideMobile : undefined}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((row) => (
                  <tr key={rowKey(row)}>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={col.hideOnMobile ? s.hideMobile : undefined}
                      >
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showPagination ? (
            <div className={s.pagination}>
              <span>
                {filtered.length} record{filtered.length === 1 ? '' : 's'}
                {' · '}
                Page {safePage + 1} of {pageCount}
              </span>
              <div className={s.paginationBtns}>
                <Button
                  variant="ghost"
                  disabled={safePage <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function TableActions({ children, className = '' }) {
  return <div className={`${s.tableActions} ${className}`.trim()}>{children}</div>;
}
