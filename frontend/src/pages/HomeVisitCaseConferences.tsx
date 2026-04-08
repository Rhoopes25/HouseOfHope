import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  createResidentVisitation,
  deleteResidentVisitation,
  fetchAllVisitations,
  fetchCaseConferences,
  fetchResidents,
  updateResidentVisitation,
} from '@/lib/api-endpoints';
import type { Resident, Visitation } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { SortableTableHead } from '@/components/SortableTableHead';
import { useToast } from '@/hooks/use-toast';
import { useTableSortState } from '@/hooks/useTableSortState';
import { compareText } from '@/lib/tableSort';
import { Checkbox } from '@/components/ui/checkbox';

const VISIT_TYPES = [
  'Initial Assessment',
  'Routine Follow-Up',
  'Reintegration Assessment',
  'Post-Placement Monitoring',
  'Emergency',
];

function parseDateLoose(s: string): number {
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

export default function HomeVisitCaseConferences() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [residentFilter, setResidentFilter] = useState<string>('all');
  const [visitTypeFilter, setVisitTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [safetyOnly, setSafetyOnly] = useState(false);
  const [followUpOnly, setFollowUpOnly] = useState(false);

  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visitation | null>(null);
  const [deleteVisitTarget, setDeleteVisitTarget] = useState<Visitation | null>(null);
  const [visitForm, setVisitForm] = useState({
    residentId: '',
    visitDate: new Date().toISOString().slice(0, 10),
    socialWorker: '',
    visitType: 'Initial Assessment',
    location: '',
    familyMembersPresent: '',
    purpose: '',
    observations: '',
    familyCooperationLevel: 'Cooperative',
    safetyConcernsNoted: false,
    followUpNeeded: false,
    visitOutcome: 'Favorable',
  });

  const visitQ = useQuery({ queryKey: ['visitations-all'], queryFn: fetchAllVisitations });
  const confQ = useQuery({ queryKey: ['case-conferences'], queryFn: fetchCaseConferences });
  const residentQ = useQuery({ queryKey: ['residents'], queryFn: fetchResidents });

  const residentsSorted = useMemo(
    () => [...(residentQ.data ?? [])].sort((a, b) => a.internalCode.localeCompare(b.internalCode)),
    [residentQ.data],
  );

  const residentsById = useMemo(
    () => Object.fromEntries((residentQ.data ?? []).map((r) => [r.id, r])),
    [residentQ.data],
  );

  const visitTypesFromData = useMemo(() => {
    const s = new Set(VISIT_TYPES);
    (visitQ.data ?? []).forEach((v) => {
      if (v.visitType) s.add(v.visitType);
    });
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [visitQ.data]);

  const filteredVisits = (visitQ.data ?? []).filter((v) => {
    const resident = residentsById[v.residentId];
    const target = `${resident?.internalCode ?? ''} ${v.socialWorker} ${v.visitType} ${v.visitDate}`.toLowerCase();
    if (!target.includes(search.toLowerCase())) return false;
    if (residentFilter !== 'all' && v.residentId !== residentFilter) return false;
    if (visitTypeFilter !== 'all' && v.visitType !== visitTypeFilter) return false;
    const d = v.visitDate || '';
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    if (safetyOnly && !v.safetyConcernsNoted) return false;
    if (followUpOnly && !v.followUpNeeded) return false;
    return true;
  });

  const now = Date.now();
  const conferenceRows = (confQ.data ?? []).filter((c) => {
    const target = `${c.residentCode} ${c.type} ${c.date}`.toLowerCase();
    return target.includes(search.toLowerCase());
  });
  const upcomingConferences = conferenceRows.filter((c) => parseDateLoose(c.date) >= now);
  const pastConferences = conferenceRows.filter((c) => parseDateLoose(c.date) < now);

  const { sortKey: visitSortKey, sortDir: visitSortDir, toggleSort: toggleVisitSort } = useTableSortState();
  const { sortKey: upcomingSortKey, sortDir: upcomingSortDir, toggleSort: toggleUpcomingSort } = useTableSortState();
  const { sortKey: pastSortKey, sortDir: pastSortDir, toggleSort: togglePastSort } = useTableSortState();

  const sortedVisits = useMemo(() => {
    if (!visitSortKey) return filteredVisits;
    return [...filteredVisits].sort((a, b) => {
      const codeA = residentsById[a.residentId]?.internalCode ?? '';
      const codeB = residentsById[b.residentId]?.internalCode ?? '';
      switch (visitSortKey) {
        case 'visitDate':
          return compareText(a.visitDate || '', b.visitDate || '', visitSortDir);
        case 'resident':
          return compareText(codeA, codeB, visitSortDir);
        case 'socialWorker':
          return compareText(a.socialWorker, b.socialWorker, visitSortDir);
        case 'visitType':
          return compareText(a.visitType, b.visitType, visitSortDir);
        case 'visitOutcome':
          return compareText(a.visitOutcome || '', b.visitOutcome || '', visitSortDir);
        default:
          return 0;
      }
    });
  }, [filteredVisits, visitSortKey, visitSortDir, residentsById]);

  const sortedUpcomingConferences = useMemo(() => {
    if (!upcomingSortKey) return upcomingConferences;
    return [...upcomingConferences].sort((a, b) => {
      switch (upcomingSortKey) {
        case 'date':
          return compareText(a.date, b.date, upcomingSortDir);
        case 'residentCode':
          return compareText(a.residentCode, b.residentCode, upcomingSortDir);
        case 'type':
          return compareText(a.type, b.type, upcomingSortDir);
        default:
          return 0;
      }
    });
  }, [upcomingConferences, upcomingSortKey, upcomingSortDir]);

  const sortedPastConferences = useMemo(() => {
    if (!pastSortKey) return pastConferences;
    return [...pastConferences].sort((a, b) => {
      switch (pastSortKey) {
        case 'date':
          return compareText(a.date, b.date, pastSortDir);
        case 'residentCode':
          return compareText(a.residentCode, b.residentCode, pastSortDir);
        case 'type':
          return compareText(a.type, b.type, pastSortDir);
        default:
          return 0;
      }
    });
  }, [pastConferences, pastSortKey, pastSortDir]);

  const saveVisitMutation = useMutation({
    mutationFn: async () => {
      const rid = visitForm.residentId;
      const payload = {
        visitDate: visitForm.visitDate,
        socialWorker: visitForm.socialWorker,
        visitType: visitForm.visitType,
        location: visitForm.location,
        familyMembersPresent: visitForm.familyMembersPresent,
        purpose: visitForm.purpose,
        observations: visitForm.observations,
        familyCooperationLevel: visitForm.familyCooperationLevel,
        safetyConcernsNoted: visitForm.safetyConcernsNoted,
        followUpNeeded: visitForm.followUpNeeded,
        visitOutcome: visitForm.visitOutcome,
      };
      if (editingVisit) return updateResidentVisitation(rid, editingVisit.id, payload);
      return createResidentVisitation(rid, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['visitations-all'] });
      setVisitDialogOpen(false);
      setEditingVisit(null);
      toast({ title: 'Saved', description: 'Visitation record saved.' });
    },
    onError: () => toast({ title: 'Save failed', variant: 'destructive' }),
  });

  const deleteVisitMutation = useMutation({
    mutationFn: async ({ residentId, visitId }: { residentId: string; visitId: string }) =>
      deleteResidentVisitation(residentId, visitId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['visitations-all'] });
      setDeleteVisitTarget(null);
      toast({ title: 'Deleted', description: 'Visitation removed.' });
    },
    onError: () => toast({ title: 'Delete failed', variant: 'destructive' }),
  });

  const openNewVisit = () => {
    setEditingVisit(null);
    setVisitForm({
      residentId: residentsSorted[0]?.id ?? '',
      visitDate: new Date().toISOString().slice(0, 10),
      socialWorker: '',
      visitType: 'Initial Assessment',
      location: '',
      familyMembersPresent: '',
      purpose: '',
      observations: '',
      familyCooperationLevel: 'Cooperative',
      safetyConcernsNoted: false,
      followUpNeeded: false,
      visitOutcome: 'Favorable',
    });
    setVisitDialogOpen(true);
  };

  const openEditVisit = (v: Visitation) => {
    setEditingVisit(v);
    setVisitForm({
      residentId: v.residentId,
      visitDate: v.visitDate,
      socialWorker: v.socialWorker,
      visitType: VISIT_TYPES.includes(v.visitType) ? v.visitType : v.visitType,
      location: v.location,
      familyMembersPresent: v.familyMembersPresent,
      purpose: v.purpose,
      observations: v.observations,
      familyCooperationLevel: v.familyCooperationLevel || 'Cooperative',
      safetyConcernsNoted: v.safetyConcernsNoted,
      followUpNeeded: v.followUpNeeded,
      visitOutcome: v.visitOutcome || 'Favorable',
    });
    setVisitDialogOpen(true);
  };

  if (visitQ.error || confQ.error) {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-bold text-foreground">Home visitations &amp; case conferences</h1>
        <p className="text-destructive text-sm">Could not load records from the API.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-display font-bold text-foreground">Home visitations &amp; case conferences</h1>
        <Button onClick={() => openNewVisit()}>
          <Plus className="h-4 w-4 mr-2" /> Log visitation
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Search by resident code, worker, type, or date..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-col lg:flex-row flex-wrap gap-3">
          <Select value={residentFilter} onValueChange={setResidentFilter}>
            <SelectTrigger className="w-full lg:w-[220px]">
              <SelectValue placeholder="Resident" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All residents</SelectItem>
              {residentsSorted.map((r: Resident) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.internalCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={visitTypeFilter} onValueChange={setVisitTypeFilter}>
            <SelectTrigger className="w-full lg:w-[240px]">
              <SelectValue placeholder="Visit type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All visit types</SelectItem>
              {visitTypesFromData.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
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
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={safetyOnly} onCheckedChange={(c) => setSafetyOnly(!!c)} />
            Safety concerns
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={followUpOnly} onCheckedChange={(c) => setFollowUpOnly(!!c)} />
            Follow-up needed
          </label>
        </div>
      </div>

      <Tabs defaultValue="visitations">
        <TabsList>
          <TabsTrigger value="visitations">Visitations</TabsTrigger>
          <TabsTrigger value="conferences">Case conferences</TabsTrigger>
        </TabsList>

        <TabsContent value="visitations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Home / field visits</CardTitle>
            </CardHeader>
            <CardContent>
              {visitQ.isLoading || residentQ.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead
                          active={visitSortKey === 'visitDate'}
                          direction={visitSortKey === 'visitDate' ? visitSortDir : null}
                          onSort={() => toggleVisitSort('visitDate')}
                        >
                          Date
                        </SortableTableHead>
                        <SortableTableHead
                          active={visitSortKey === 'resident'}
                          direction={visitSortKey === 'resident' ? visitSortDir : null}
                          onSort={() => toggleVisitSort('resident')}
                        >
                          Resident
                        </SortableTableHead>
                        <SortableTableHead
                          active={visitSortKey === 'socialWorker'}
                          direction={visitSortKey === 'socialWorker' ? visitSortDir : null}
                          onSort={() => toggleVisitSort('socialWorker')}
                        >
                          Worker
                        </SortableTableHead>
                        <SortableTableHead
                          active={visitSortKey === 'visitType'}
                          direction={visitSortKey === 'visitType' ? visitSortDir : null}
                          onSort={() => toggleVisitSort('visitType')}
                        >
                          Visit type
                        </SortableTableHead>
                        <SortableTableHead
                          active={visitSortKey === 'visitOutcome'}
                          direction={visitSortKey === 'visitOutcome' ? visitSortDir : null}
                          onSort={() => toggleVisitSort('visitOutcome')}
                        >
                          Outcome
                        </SortableTableHead>
                        <TableHead className="w-[100px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedVisits.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell>{v.visitDate}</TableCell>
                          <TableCell>
                            <Link className="text-primary underline-offset-4 hover:underline" to={`/admin/resident/${v.residentId}`}>
                              {residentsById[v.residentId]?.internalCode ?? `Resident ${v.residentId}`}
                            </Link>
                          </TableCell>
                          <TableCell>{v.socialWorker}</TableCell>
                          <TableCell>{v.visitType}</TableCell>
                          <TableCell>{v.visitOutcome || '—'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditVisit(v)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteVisitTarget(v)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conferences" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming conferences</CardTitle>
            </CardHeader>
            <CardContent>
              {confQ.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead
                        active={upcomingSortKey === 'date'}
                        direction={upcomingSortKey === 'date' ? upcomingSortDir : null}
                        onSort={() => toggleUpcomingSort('date')}
                      >
                        Date
                      </SortableTableHead>
                      <SortableTableHead
                        active={upcomingSortKey === 'residentCode'}
                        direction={upcomingSortKey === 'residentCode' ? upcomingSortDir : null}
                        onSort={() => toggleUpcomingSort('residentCode')}
                      >
                        Resident code
                      </SortableTableHead>
                      <SortableTableHead
                        active={upcomingSortKey === 'type'}
                        direction={upcomingSortKey === 'type' ? upcomingSortDir : null}
                        onSort={() => toggleUpcomingSort('type')}
                      >
                        Type
                      </SortableTableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedUpcomingConferences.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.date}</TableCell>
                        <TableCell>{c.residentCode}</TableCell>
                        <TableCell>{c.type}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {!confQ.isLoading && sortedUpcomingConferences.length === 0 && (
                <p className="text-sm text-muted-foreground">No upcoming conferences in range.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Conference history</CardTitle>
            </CardHeader>
            <CardContent>
              {confQ.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead
                        active={pastSortKey === 'date'}
                        direction={pastSortKey === 'date' ? pastSortDir : null}
                        onSort={() => togglePastSort('date')}
                      >
                        Date
                      </SortableTableHead>
                      <SortableTableHead
                        active={pastSortKey === 'residentCode'}
                        direction={pastSortKey === 'residentCode' ? pastSortDir : null}
                        onSort={() => togglePastSort('residentCode')}
                      >
                        Resident code
                      </SortableTableHead>
                      <SortableTableHead
                        active={pastSortKey === 'type'}
                        direction={pastSortKey === 'type' ? pastSortDir : null}
                        onSort={() => togglePastSort('type')}
                      >
                        Type
                      </SortableTableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPastConferences.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.date}</TableCell>
                        <TableCell>{c.residentCode}</TableCell>
                        <TableCell>{c.type}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={visitDialogOpen} onOpenChange={setVisitDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editingVisit ? 'Edit visitation' : 'Log visitation'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Resident</Label>
              <Select
                value={visitForm.residentId}
                onValueChange={(v) => setVisitForm({ ...visitForm, residentId: v })}
                disabled={!!editingVisit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select resident" />
                </SelectTrigger>
                <SelectContent>
                  {residentsSorted.map((r: Resident) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.internalCode} — {r.caseControlNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Visit date</Label>
                <Input type="date" value={visitForm.visitDate} onChange={(e) => setVisitForm({ ...visitForm, visitDate: e.target.value })} />
              </div>
              <div>
                <Label>Social worker</Label>
                <Input value={visitForm.socialWorker} onChange={(e) => setVisitForm({ ...visitForm, socialWorker: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Visit type</Label>
              <Select value={visitForm.visitType} onValueChange={(v) => setVisitForm({ ...visitForm, visitType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Location</Label>
              <Input value={visitForm.location} onChange={(e) => setVisitForm({ ...visitForm, location: e.target.value })} />
            </div>
            <div>
              <Label>Family members present</Label>
              <Input value={visitForm.familyMembersPresent} onChange={(e) => setVisitForm({ ...visitForm, familyMembersPresent: e.target.value })} />
            </div>
            <div>
              <Label>Purpose</Label>
              <Input value={visitForm.purpose} onChange={(e) => setVisitForm({ ...visitForm, purpose: e.target.value })} />
            </div>
            <div>
              <Label>Observations</Label>
              <Textarea value={visitForm.observations} onChange={(e) => setVisitForm({ ...visitForm, observations: e.target.value })} rows={4} />
            </div>
            <div>
              <Label>Family cooperation</Label>
              <Select
                value={visitForm.familyCooperationLevel}
                onValueChange={(v) => setVisitForm({ ...visitForm, familyCooperationLevel: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Highly Cooperative', 'Cooperative', 'Neutral', 'Uncooperative'].map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Outcome</Label>
              <Select value={visitForm.visitOutcome} onValueChange={(v) => setVisitForm({ ...visitForm, visitOutcome: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Favorable', 'Needs Improvement', 'Unfavorable', 'Inconclusive'].map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={visitForm.safetyConcernsNoted} onCheckedChange={(c) => setVisitForm({ ...visitForm, safetyConcernsNoted: !!c })} />
              Safety concerns noted
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={visitForm.followUpNeeded} onCheckedChange={(c) => setVisitForm({ ...visitForm, followUpNeeded: !!c })} />
              Follow-up needed
            </label>
            <Button
              onClick={() => saveVisitMutation.mutate()}
              disabled={saveVisitMutation.isPending || !visitForm.residentId || !visitForm.visitDate || !visitForm.socialWorker}
            >
              {saveVisitMutation.isPending ? 'Saving...' : 'Save visitation'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteVisitTarget}
        onClose={() => setDeleteVisitTarget(null)}
        onConfirm={() =>
          deleteVisitTarget && deleteVisitMutation.mutate({ residentId: deleteVisitTarget.residentId, visitId: deleteVisitTarget.id })
        }
        title="Delete visitation?"
        description="This home visitation record will be permanently removed."
      />
    </div>
  );
}
