import type { ComponentProps } from 'react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { SortDirection } from '@/hooks/useTableSortState';

type Props = ComponentProps<typeof TableHead> & {
  /** When true, this column is the active sort column */
  active: boolean;
  /** Current direction when active; ignored when not active */
  direction: SortDirection | null;
  onSort: () => void;
};

export function SortableTableHead({ active, direction, onSort, children, className, ...props }: Props) {
  return (
    <TableHead className={cn('select-none', className)} {...props}>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 font-medium hover:text-foreground text-muted-foreground hover:bg-muted/60 -mx-2 px-2 py-1 rounded-md text-left w-full min-w-0"
        onClick={onSort}
        aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span className="truncate">{children}</span>
        {active ? (
          direction === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-35" aria-hidden />
        )}
      </button>
    </TableHead>
  );
}
