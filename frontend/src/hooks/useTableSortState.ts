import { useCallback, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

/** Column sort: first click ascending, second click descending; switching columns starts ascending again. */
export function useTableSortState() {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const toggleSort = useCallback(
    (key: string) => {
      if (sortKey !== key) {
        setSortKey(key);
        setSortDir('asc');
      } else {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      }
    },
    [sortKey],
  );

  return { sortKey, sortDir, toggleSort };
}
