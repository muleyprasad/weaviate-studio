/**
 * usePagination - Custom hook for pagination logic
 * Provides computed values and actions for pagination controls
 */

import { useMemo, useCallback } from 'react';
import { useDataState, useUIState, useUIActions } from '../context';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export function usePagination() {
  const dataState = useDataState();
  const uiState = useUIState();
  const uiActions = useUIActions();

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(dataState.totalCount / uiState.pageSize));
  }, [dataState.totalCount, uiState.pageSize]);

  // Navigation actions
  const goToPage = useCallback(
    (page: number) => {
      const validPage = Math.max(1, Math.min(page, totalPages));
      if (validPage !== uiState.currentPage) {
        uiActions.setPage(validPage);
      }
    },
    [uiActions, uiState.currentPage, totalPages]
  );

  const goToFirstPage = useCallback(() => {
    goToPage(1);
  }, [goToPage]);

  const goToLastPage = useCallback(() => {
    goToPage(totalPages);
  }, [goToPage, totalPages]);

  const goToPreviousPage = useCallback(() => {
    goToPage(uiState.currentPage - 1);
  }, [goToPage, uiState.currentPage]);

  const goToNextPage = useCallback(() => {
    goToPage(uiState.currentPage + 1);
  }, [goToPage, uiState.currentPage]);

  const changePageSize = useCallback(
    (newSize: PageSize) => {
      if (newSize !== uiState.pageSize) {
        uiActions.setPageSize(newSize);
      }
    },
    [uiActions, uiState.pageSize]
  );

  // Computed values
  const canGoToPrevious = useMemo(() => uiState.currentPage > 1, [uiState.currentPage]);

  const canGoToNext = useMemo(
    () => uiState.currentPage < totalPages,
    [uiState.currentPage, totalPages]
  );

  // Calculate displayed range
  const { startIndex, endIndex } = useMemo(() => {
    const start = (uiState.currentPage - 1) * uiState.pageSize + 1;
    const end = Math.min(uiState.currentPage * uiState.pageSize, dataState.totalCount);
    return { startIndex: start, endIndex: end };
  }, [uiState.currentPage, uiState.pageSize, dataState.totalCount]);

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
      let start = Math.max(2, uiState.currentPage - 1);
      let end = Math.min(totalPages - 1, uiState.currentPage + 1);

      // Adjust if we're near the start
      if (uiState.currentPage <= 3) {
        start = 2;
        end = maxVisiblePages - 1;
      }

      // Adjust if we're near the end
      if (uiState.currentPage >= totalPages - 2) {
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
  }, [uiState.currentPage, totalPages]);

  return {
    // Current state
    currentPage: uiState.currentPage,
    pageSize: uiState.pageSize,
    totalCount: dataState.totalCount,
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
