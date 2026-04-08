import { useCallback, useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Common choices for “rows per page” on admin tables. */
export const PAGE_SIZE_OPTIONS = [5, 10, 15, 25, 50, 100] as const;

interface PaginationControlProps {
  totalItems: number;
  pageSize: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (size: number) => void;
}

export function PaginationControl({
  totalItems,
  pageSize,
  currentPage,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
}: PaginationControlProps) {
  const pageSizeFieldId = useId();
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const showPageNumberButtons = totalPages > 1;

  return (
    <div className="mt-4 flex flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground shrink-0">
        Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </p>
      <div className="flex min-w-0 flex-1 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        {showPageNumberButtons && (
          <div className="flex max-h-48 min-w-0 flex-wrap items-center justify-center gap-1 overflow-y-auto sm:max-h-none sm:justify-end sm:overflow-visible">
            <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {pages.map((page) => (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'outline'}
                size="sm"
                className="min-w-9"
                onClick={() => onPageChange(page)}
                aria-label={`Page ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        {pageSizeOptions && onPageSizeChange && (
          <div className="flex items-center justify-center gap-2 sm:justify-end sm:border-l sm:border-border sm:pl-3">
            <Label htmlFor={pageSizeFieldId} className="text-sm text-muted-foreground whitespace-nowrap">
              Per page
            </Label>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger id={pageSizeFieldId} className="h-8 w-[76px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}

export function usePagination(totalItems: number, initialPageSize = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setCurrentPage(1);
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [totalItems, pageSize, currentPage]);

  return {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  };
}
