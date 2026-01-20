/**
 * Pagination - Page controls component
 * Provides navigation between pages and page size selection
 */

import React, { useCallback } from 'react';
import { usePagination, PAGE_SIZE_OPTIONS } from '../../hooks/usePagination';

export function Pagination() {
  const {
    currentPage,
    pageSize,
    totalCount,
    totalPages,
    startIndex,
    endIndex,
    pageNumbers,
    canGoToPrevious,
    canGoToNext,
    goToFirstPage,
    goToLastPage,
    goToPreviousPage,
    goToNextPage,
    goToPage,
    changePageSize,
  } = usePagination();

  const handlePageSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newSize = parseInt(e.target.value, 10) as (typeof PAGE_SIZE_OPTIONS)[number];
      changePageSize(newSize);
    },
    [changePageSize]
  );

  if (totalCount === 0) {
    return null;
  }

  return (
    <div className="pagination" role="navigation" aria-label="Pagination">
      {/* Results summary */}
      <div className="pagination-info">
        <span className="results-text">
          Showing <strong>{startIndex}</strong> - <strong>{endIndex}</strong> of{' '}
          <strong>{totalCount.toLocaleString()}</strong> objects
        </span>
      </div>

      {/* Page navigation */}
      <div className="pagination-nav">
        <button
          className="pagination-btn first-btn"
          onClick={goToFirstPage}
          disabled={!canGoToPrevious}
          title="First page"
          aria-label="Go to first page"
        >
          ⟨⟨
        </button>

        <button
          className="pagination-btn prev-btn"
          onClick={goToPreviousPage}
          disabled={!canGoToPrevious}
          title="Previous page"
          aria-label="Go to previous page"
        >
          ◀ Previous
        </button>

        <div className="page-numbers" role="group" aria-label="Page numbers">
          {pageNumbers.map((item, index) =>
            item === 'ellipsis' ? (
              <span key={`ellipsis-${index}`} className="page-ellipsis">
                ⋯
              </span>
            ) : (
              <button
                key={item}
                className={`page-number ${currentPage === item ? 'active' : ''}`}
                onClick={() => goToPage(item)}
                aria-current={currentPage === item ? 'page' : undefined}
                aria-label={`Go to page ${item}`}
              >
                {item}
              </button>
            )
          )}
        </div>

        <button
          className="pagination-btn next-btn"
          onClick={goToNextPage}
          disabled={!canGoToNext}
          title="Next page"
          aria-label="Go to next page"
        >
          Next ▶
        </button>

        <button
          className="pagination-btn last-btn"
          onClick={goToLastPage}
          disabled={!canGoToNext}
          title="Last page"
          aria-label="Go to last page"
        >
          ⟩⟩
        </button>
      </div>

      {/* Page size selector */}
      <div className="pagination-size">
        <label htmlFor="pageSize" className="size-label">
          Per page:
        </label>
        <select
          id="pageSize"
          value={pageSize}
          onChange={handlePageSizeChange}
          className="size-select"
          aria-label="Items per page"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
