import React from 'react';
import { useDataExplorer } from '../../DataExplorer';

/**
 * Pagination component with page controls
 */
export function Pagination() {
  const { state, dispatch, fetchObjects } = useDataExplorer();

  const totalPages = Math.ceil(state.totalCount / state.pageSize);
  const currentPage = state.currentPage;

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      const newPage = currentPage - 1;
      dispatch({ type: 'SET_PAGE', payload: newPage });
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      const newPage = currentPage + 1;
      dispatch({ type: 'SET_PAGE', payload: newPage });
    }
  };

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(event.target.value, 10);
    dispatch({ type: 'SET_PAGE_SIZE', payload: newSize });
  };

  const handleRefresh = () => {
    fetchObjects();
  };

  const startItem = currentPage * state.pageSize + 1;
  const endItem = Math.min((currentPage + 1) * state.pageSize, state.totalCount);

  return (
    <div className="pagination">
      <div className="pagination-info">
        {state.totalCount > 0 ? (
          <>
            Showing {startItem} to {endItem} of {state.totalCount} objects
          </>
        ) : (
          'No objects found'
        )}
      </div>

      <div className="pagination-controls">
        <button
          className="pagination-button"
          onClick={handlePreviousPage}
          disabled={currentPage === 0 || state.loading}
          aria-label="Previous page"
        >
          ← Previous
        </button>

        <span className="pagination-pages">
          Page {totalPages > 0 ? currentPage + 1 : 0} of {totalPages}
        </span>

        <button
          className="pagination-button"
          onClick={handleNextPage}
          disabled={currentPage >= totalPages - 1 || state.loading}
          aria-label="Next page"
        >
          Next →
        </button>

        <select
          className="page-size-selector"
          value={state.pageSize}
          onChange={handlePageSizeChange}
          disabled={state.loading}
          aria-label="Items per page"
        >
          <option value={10}>10 per page</option>
          <option value={20}>20 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>

        <button
          className="refresh-button"
          onClick={handleRefresh}
          disabled={state.loading}
          aria-label="Refresh data"
          title="Refresh"
        >
          🔄
        </button>
      </div>
    </div>
  );
}
