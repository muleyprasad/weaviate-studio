/**
 * usePagination - Custom hook for pagination logic
 * Provides computed values and actions for pagination controls
 */

import { useMemo, useCallback } from 'react';
import { useDataExplorer } from '../context/DataExplorerContext';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export function usePagination() {
  const { state, actions, totalPages } = useDataExplorer();

  // Navigation actions
  const goToPage = useCallback(
    (page: number) => {
      const validPage = Math.max(1, Math.min(page, totalPages));
      if (validPage !== state.currentPage) {
        actions.setPage(validPage);
      }
    },
    [actions, state.currentPage, totalPages]
  );

  const goToFirstPage = useCallback(() => {
    goToPage(1);
  }, [goToPage]);

  const goToLastPage = useCallback(() => {
    goToPage(totalPages);
  }, [goToPage, totalPages]);

  const goToPreviousPage = useCallback(() => {
    goToPage(state.currentPage - 1);
  }, [goToPage, state.currentPage]);

  const goToNextPage = useCallback(() => {
    goToPage(state.currentPage + 1);
  }, [goToPage, state.currentPage]);

  const changePageSize = useCallback(
    (newSize: PageSize) => {
      if (newSize !== state.pageSize) {
        actions.setPageSize(newSize);
      }
    },
    [actions, state.pageSize]
  );

  // Computed values
  const canGoToPrevious = useMemo(() => state.currentPage > 1, [state.currentPage]);

  const canGoToNext = useMemo(
    () => state.currentPage < totalPages,
    [state.currentPage, totalPages]
  );

  // Calculate displayed range
  const { startIndex, endIndex } = useMemo(() => {
    const start = (state.currentPage - 1) * state.pageSize + 1;
    const end = Math.min(state.currentPage * state.pageSize, state.totalCount);
    return { startIndex: start, endIndex: end };
  }, [state.currentPage, state.pageSize, state.totalCount]);

  // Generate page numbers for pagination UI
  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages + 2) {
      // Show all pages if we have few enough
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate start and end of visible range
      let start = Math.max(2, state.currentPage - 1);
      let end = Math.min(totalPages - 1, state.currentPage + 1);

      // Adjust if we're near the start
      if (state.currentPage <= 3) {
        start = 2;
        end = maxVisiblePages - 1;
      }

      // Adjust if we're near the end
      if (state.currentPage >= totalPages - 2) {
        start = totalPages - maxVisiblePages + 2;
        end = totalPages - 1;
      }

      // Add ellipsis before middle section if needed
      if (start > 2) {
        pages.push('ellipsis');
      }

      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      // Add ellipsis after middle section if needed
      if (end < totalPages - 1) {
        pages.push('ellipsis');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  }, [state.currentPage, totalPages]);

  return {
    // Current state
    currentPage: state.currentPage,
    pageSize: state.pageSize,
    totalCount: state.totalCount,
    totalPages,
    startIndex,
    endIndex,
    pageNumbers,

    // Navigation flags
    canGoToPrevious,
    canGoToNext,

    // Actions
    goToPage,
    goToFirstPage,
    goToLastPage,
    goToPreviousPage,
    goToNextPage,
    changePageSize,

    // Options
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  };
}
