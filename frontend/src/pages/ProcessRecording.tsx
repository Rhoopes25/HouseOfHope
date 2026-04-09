import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  fetchAllInterventionPlansGlobal,
  fetchAllProcessRecordings,
  fetchResidents,
} from '@/lib/api-endpoints';
import type { CounselingSession, InterventionPlan, Resident } from '@/lib/types';
import {
  DEFAULT_PLAN_CATEGORY_SLUGS,
  EMOTIONAL_STATE_SEEDS,
  mergeDistinctOptions,
  planCategoryLabel,
  PLAN_STATUS_LABELS,
} from '@/lib/residentFieldOptions';
import { toTitleCase } from '@/lib/titleCase';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SortableTableHead } from '@/components/SortableTableHead';
import { useTableSortState } from '@/hooks/useTableSortState';
import { compareText } from '@/lib/tableSort';
import { ArrowRight, Plus, ScrollText } from 'lucide-react';
import { PAGE_SIZE_OPTIONS, PaginationControl, usePagination } from '@/components/PaginationControl';
import { CounselingSessionFormDialog } from '@/components/CounselingSessionFormDialog';
import { InterventionPlanFormDialog } from '@/components/InterventionPlanFormDialog';

type EventKind = 'counseling' | 'intervention';

interface TimelineRow {
  id: string;
  kind: EventKind;
  sortDate: string;
  residentId: string;
  residentCode: string;
  title: string;
  subtitle: string;
}

function interventionSortDate(p: InterventionPlan): string {
  return p.targetDate?.trim() || p.caseConferenceDate?.trim() || '';
}

function parseTime(s: string): number {
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

function buildRows(
  sessions: CounselingSession[],
  plans: InterventionPlan[],
  residents: Resident[],
): TimelineRow[] {
  const codeById = new Map(residents.map((r) => [r.id, r.internalCode]));
  const rows: TimelineRow[] = [];

  for (const s of sessions) {
    const code = s.residentInternalCode ?? codeById.get(s.residentId) ?? '—';
    rows.push({
      id: `c-${s.id}`,
      kind: 'counseling',
      sortDate: s.sessionDate,
      residentId: s.residentId,
      residentCode: code,
      title: `Counseling · ${toTitleCase(s.sessionType)} · ${s.durationMinutes} min`,
      subtitle: [s.socialWorker, s.narrative?.slice(0, 120)].filter(Boolean).join(' · ') || '—',
    });
  }
  for (const p of plans) {
    const code = p.residentInternalCode ?? codeById.get(p.residentId) ?? '—';
    const when = interventionSortDate(p);
    rows.push({
      id: `p-${p.id}`,
      kind: 'intervention',
      sortDate: when,
      residentId: p.residentId,
      residentCode: code,
      title: `Intervention · ${planCategoryLabel(p.planCategory)} · ${PLAN_STATUS_LABELS[p.status] ?? p.status}`,
      subtitle: [p.description?.slice(0, 120), p.servicesProvided?.slice(0, 80)].filter(Boolean).join(' · ') || '—',
    });
  }
  return rows;
}

export default function ProcessRecording() {
  const [residentFilter, setResidentFilter] = useState<string>('all');
  const [eventKind, setEventKind] = useState<'all' | EventKind>('all');
  const [sessionType, setSessionType] = useState<'all' | 'individual' | 'group'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [counselingDialogOpen, setCounselingDialogOpen] = useState(false);
  const [interventionDialogOpen, setInterventionDialogOpen] = useState(false);
  const [addCounselingResidentId, setAddCounselingResidentId] = useState('');
  const [addInterventionResidentId, setAddInterventionResidentId] = useState('');

  const residentParam = residentFilter === 'all' ? undefined : residentFilter;

  const sessionsQ = useQuery({
    queryKey: ['process-recordings', residentParam ?? 'all'],
    queryFn: () => fetchAllProcessRecordings(residentParam),
  });
  const plansQ = useQuery({
    queryKey: ['intervention-plans-all', residentParam ?? 'all'],
    queryFn: () => fetchAllInterventionPlansGlobal(residentParam),
  });
  const residentsQ = useQuery({ queryKey: ['residents'], queryFn: fetchResidents });

  const residentsSorted = useMemo(
    () => [...(residentsQ.data ?? [])].sort((a, b) => a.internalCode.localeCompare(b.internalCode)),
    [residentsQ.data],
  );

  const socialWorkerOptions = useMemo(
    () =>
      [...new Set(residentsSorted.map((r) => r.assignedSocialWorker).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    [residentsSorted],
  );

  const emotionalStateOptions = useMemo(
    () =>
      mergeDistinctOptions(
        (sessionsQ.data ?? []).flatMap((s) => [s.emotionalStateStart, s.emotionalStateEnd]),
        [...EMOTIONAL_STATE_SEEDS],
      ),
    [sessionsQ.data],
  );

  const planCategoryOptions = useMemo(
    () => mergeDistinctOptions((plansQ.data ?? []).map((p) => p.planCategory), [...DEFAULT_PLAN_CATEGORY_SLUGS]),
    [plansQ.data],
  );

  const { sortKey, sortDir, toggleSort } = useTableSortState();

  const merged = useMemo(() => {
    const sessions = sessionsQ.data ?? [];
    const plans = plansQ.data ?? [];
    const residents = residentsQ.data ?? [];
    let rows = buildRows(sessions, plans, residents);

    if (eventKind === 'counseling') rows = rows.filter((r) => r.kind === 'counseling');
    if (eventKind === 'intervention') rows = rows.filter((r) => r.kind === 'intervention');

    if (sessionType !== 'all') {
      const need = sessionType;
      rows = rows.filter((r) => {
        if (r.kind !== 'counseling') return true;
        const s = sessions.find((x) => `c-${x.id}` === r.id);
        return s?.sessionType === need;
      });
    }

    if (dateFrom.trim()) {
      const fromT = parseTime(dateFrom);
      rows = rows.filter((r) => parseTime(r.sortDate) >= fromT);
    }
    if (dateTo.trim()) {
      const toT = parseTime(dateTo + 'T23:59:59');
      rows = rows.filter((r) => !r.sortDate.trim() || parseTime(r.sortDate) <= toT);
    }

    return rows;
  }, [sessionsQ.data, plansQ.data, residentsQ.data, eventKind, sessionType, dateFrom, dateTo]);

  const sortedRows = useMemo(() => {
    if (!sortKey) {
      return [...merged].sort((a, b) => parseTime(b.sortDate) - parseTime(a.sortDate));
    }
    return [...merged].sort((a, b) => {
      switch (sortKey) {
        case 'sortDate': {
          const na = parseTime(a.sortDate);
          const nb = parseTime(b.sortDate);
          const n = na - nb;
          return sortDir === 'asc' ? n : -n;
        }
        case 'kind':
          return compareText(a.kind, b.kind, sortDir);
        case 'residentCode':
          return compareText(a.residentCode, b.residentCode, sortDir);
        case 'title':
          return compareText(a.title, b.title, sortDir);
        default:
          return 0;
      }
    });
  }, [merged, sortKey, sortDir]);

  const { currentPage, setCurrentPage, startIndex, endIndex, pageSize, setPageSize } = usePagination(sortedRows.length);
  const paginatedRows = sortedRows.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [residentFilter, eventKind, sessionType, dateFrom, dateTo, setCurrentPage]);

  const handleColumnSort = (key: string) => {
    toggleSort(key);
    setCurrentPage(1);
  };

  const loading = sessionsQ.isLoading || plansQ.isLoading || residentsQ.isLoading;

  const openAddCounseling = () => {
    setAddCounselingResidentId(residentFilter !== 'all' ? residentFilter : '');
    setCounselingDialogOpen(true);
  };

  const openAddIntervention = () => {
    setAddInterventionResidentId(residentFilter !== 'all' ? residentFilter : '');
    setInterventionDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <ScrollText className="h-8 w-8 text-primary shrink-0" aria-hidden="true" />
            Process Recording
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Chronological view of counseling sessions and intervention plans across the caseload. Filter by resident to narrow
            the list, or use Add counseling / Add intervention to log entries for any girl (choose her in the form). You can
            still add or edit from each{' '}
            <Link to="/admin/caseload" className="text-primary underline-offset-4 hover:underline">
              resident profile
            </Link>
            . Newest first by default; up to 500 counseling sessions and 500 intervention plans loaded per resident filter.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          <Button type="button" variant="outline" onClick={openAddCounseling}>
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            Add counseling
          </Button>
          <Button type="button" variant="outline" onClick={openAddIntervention}>
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            Add intervention
          </Button>
        </div>
      </div>

      <CounselingSessionFormDialog
        open={counselingDialogOpen}
        onOpenChange={(o) => {
          setCounselingDialogOpen(o);
          if (!o) setAddCounselingResidentId('');
        }}
        baseResidentId=""
        residentPicker={{
          value: addCounselingResidentId,
          onChange: setAddCounselingResidentId,
          residents: residentsSorted,
        }}
        socialWorkerOptions={socialWorkerOptions}
        emotionalStateOptions={emotionalStateOptions}
        editingSession={null}
      />

      <InterventionPlanFormDialog
        open={interventionDialogOpen}
        onOpenChange={(o) => {
          setInterventionDialogOpen(o);
          if (!o) setAddInterventionResidentId('');
        }}
        baseResidentId=""
        residentPicker={{
          value: addInterventionResidentId,
          onChange: setAddInterventionResidentId,
          residents: residentsSorted,
        }}
        planCategoryOptions={planCategoryOptions}
        editingPlan={null}
      />

      <div className="flex flex-col lg:flex-row flex-wrap gap-3">
        <Select value={residentFilter} onValueChange={setResidentFilter}>
          <SelectTrigger className="w-full lg:w-[220px]">
            <SelectValue placeholder="All residents" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All residents</SelectItem>
            {residentsSorted.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.internalCode}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={eventKind} onValueChange={(v) => setEventKind(v as 'all' | EventKind)}>
          <SelectTrigger className="w-full lg:w-[200px]">
            <SelectValue placeholder="Event type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            <SelectItem value="counseling">Counseling only</SelectItem>
            <SelectItem value="intervention">Intervention plans only</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sessionType}
          onValueChange={(v) => setSessionType(v as 'all' | 'individual' | 'group')}
          disabled={eventKind === 'intervention'}
        >
          <SelectTrigger className="w-full lg:w-[220px]">
            <SelectValue placeholder="Session type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All session types</SelectItem>
            <SelectItem value="individual">Individual</SelectItem>
            <SelectItem value="group">Group</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Label className="text-xs whitespace-nowrap">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs whitespace-nowrap">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" />
        </div>
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => { setDateFrom(''); setDateTo(''); }}>
          Clear dates
        </Button>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        {loading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : (
          <Table className="table-striped">
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  active={sortKey === 'sortDate'}
                  direction={sortKey === 'sortDate' ? sortDir : null}
                  onSort={() => handleColumnSort('sortDate')}
                >
                  Date
                </SortableTableHead>
                <SortableTableHead
                  active={sortKey === 'kind'}
                  direction={sortKey === 'kind' ? sortDir : null}
                  onSort={() => handleColumnSort('kind')}
                >
                  Kind
                </SortableTableHead>
                <SortableTableHead
                  active={sortKey === 'residentCode'}
                  direction={sortKey === 'residentCode' ? sortDir : null}
                  onSort={() => handleColumnSort('residentCode')}
                >
                  Resident
                </SortableTableHead>
                <SortableTableHead
                  active={sortKey === 'title'}
                  direction={sortKey === 'title' ? sortDir : null}
                  onSort={() => handleColumnSort('title')}
                >
                  Summary
                </SortableTableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    No events match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap font-medium">{row.sortDate || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={row.kind === 'counseling' ? 'default' : 'secondary'}>
                        {row.kind === 'counseling' ? 'Counseling' : 'Intervention'}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.residentCode}</TableCell>
                    <TableCell className="max-w-xl">
                      <div className="font-medium text-sm">{row.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{row.subtitle}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/admin/resident/${row.residentId}`}>
                          Resident <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <PaginationControl
        totalItems={sortedRows.length}
        pageSize={pageSize}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}
