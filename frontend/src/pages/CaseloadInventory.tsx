import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createResident, fetchResidents } from '@/lib/api-endpoints';
import { Resident } from '@/lib/types';
import { RiskBadge } from '@/components/RiskBadge';
import { StatusPill } from '@/components/StatusPill';
import { PaginationControl, usePagination } from '@/components/PaginationControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function CaseloadInventory() {
  const { data: residents = [], isLoading, error } = useQuery({ queryKey: ['residents'], queryFn: fetchResidents });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [safehouseFilter, setSafehouseFilter] = useState<string>('all');
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    caseControlNumber: '',
    internalCode: '',
    safehouseName: '',
    caseStatus: 'active',
    caseCategory: '',
    riskLevel: 'medium',
    assignedSocialWorker: '',
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filtered = residents.filter((r: Resident) => {
    const matchesSearch = r.internalCode.toLowerCase().includes(search.toLowerCase()) ||
        r.caseControlNumber.toLowerCase().includes(search.toLowerCase()) ||
        r.assignedSocialWorker.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.caseStatus === statusFilter;
    const matchesRisk = riskFilter === 'all' || r.riskLevel === riskFilter;
    const matchesSafehouse = safehouseFilter === 'all' || r.safehouse === safehouseFilter;
    return matchesSearch && matchesStatus && matchesRisk && matchesSafehouse;
  });

  const { currentPage, setCurrentPage, startIndex, endIndex, pageSize } = usePagination(filtered.length, 15);
  const paginated = filtered.slice(startIndex, endIndex);
  const safehouses = [...new Set(residents.map((r: Resident) => r.safehouse))];
  const createResidentMutation = useMutation({
    mutationFn: () => createResident(createForm),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['residents'] });
      setOpenCreate(false);
      setCreateForm({
        caseControlNumber: '',
        internalCode: '',
        safehouseName: '',
        caseStatus: 'active',
        caseCategory: '',
        riskLevel: 'medium',
        assignedSocialWorker: '',
      });
      toast({ title: 'Resident added', description: 'Resident profile created successfully.' });
      navigate(`/admin/resident/${created.id}`);
    },
    onError: () => toast({ title: 'Create failed', description: 'Could not create resident profile.', variant: 'destructive' }),
  });

  if (error) {
    return (
        <div className="space-y-2">
          <h1 className="text-3xl font-display font-bold text-foreground">Caseload Inventory</h1>
          <p className="text-destructive text-sm">Could not load residents from the API.</p>
        </div>
    );
  }

  return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-display font-bold text-foreground">Caseload Inventory</h1>
          <Button onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Resident
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by code, case number, or social worker..." className="pl-10" value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="transferred">Transferred</SelectItem>
            </SelectContent>
          </Select>
          <Select value={riskFilter} onValueChange={v => { setRiskFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Risk" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risk</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={safehouseFilter} onValueChange={v => { setSafehouseFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Safehouse" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Safehouses</SelectItem>
              {safehouses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block bg-card rounded-xl border shadow-sm overflow-x-auto">
          {isLoading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
              <Table className="table-striped">
                <TableHeader>
                  <TableRow>
                    <TableHead>Case #</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Safehouse</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Social Worker</TableHead>
                    <TableHead>Reintegration</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((r: Resident) => (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/admin/resident/${r.id}`)}>
                        <TableCell className="font-medium text-sm">{r.caseControlNumber}</TableCell>
                        <TableCell className="text-sm">{r.internalCode}</TableCell>
                        <TableCell className="text-sm">{r.safehouse}</TableCell>
                        <TableCell><StatusPill status={r.caseStatus} /></TableCell>
                        <TableCell className="text-sm">{r.caseCategory}</TableCell>
                        <TableCell><RiskBadge level={r.riskLevel} /></TableCell>
                        <TableCell className="text-sm">{r.assignedSocialWorker}</TableCell>
                        <TableCell className="text-sm">{r.reintegrationStatus}</TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/admin/resident/${r.id}`)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
          )}
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
              [...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
          ) : (
              paginated.map((r: Resident) => (
                  <div key={r.id} className="bg-card rounded-xl border shadow-sm p-4 cursor-pointer" onClick={() => navigate(`/admin/resident/${r.id}`)}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{r.caseControlNumber}</span>
                      <div className="flex gap-2">
                        <StatusPill status={r.caseStatus} />
                        <RiskBadge level={r.riskLevel} />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p><span className="font-medium">Code:</span> {r.internalCode}</p>
                      <p><span className="font-medium">Safehouse:</span> {r.safehouse}</p>
                      <p><span className="font-medium">Category:</span> {r.caseCategory}</p>
                      <p><span className="font-medium">Social Worker:</span> {r.assignedSocialWorker}</p>
                      <p><span className="font-medium">Reintegration:</span> {r.reintegrationStatus}</p>
                    </div>
                  </div>
              ))
          )}
        </div>

        <PaginationControl totalItems={filtered.length} pageSize={pageSize} currentPage={currentPage} onPageChange={setCurrentPage} />

        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Add Resident</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Case Control Number</Label>
                <Input value={createForm.caseControlNumber} onChange={(e) => setCreateForm({ ...createForm, caseControlNumber: e.target.value })} />
              </div>
              <div>
                <Label>Internal Code</Label>
                <Input value={createForm.internalCode} onChange={(e) => setCreateForm({ ...createForm, internalCode: e.target.value })} />
              </div>
              <div>
                <Label>Safehouse</Label>
                <Select value={createForm.safehouseName} onValueChange={(v) => setCreateForm({ ...createForm, safehouseName: v })}>
                  <SelectTrigger><SelectValue placeholder="Select safehouse" /></SelectTrigger>
                  <SelectContent>
                    {safehouses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Case Category</Label>
                <Input value={createForm.caseCategory} onChange={(e) => setCreateForm({ ...createForm, caseCategory: e.target.value })} />
              </div>
              <div>
                <Label>Assigned Social Worker</Label>
                <Input value={createForm.assignedSocialWorker} onChange={(e) => setCreateForm({ ...createForm, assignedSocialWorker: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Status</Label>
                  <Select value={createForm.caseStatus} onValueChange={(v) => setCreateForm({ ...createForm, caseStatus: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="transferred">Transferred</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Risk</Label>
                  <Select value={createForm.riskLevel} onValueChange={(v) => setCreateForm({ ...createForm, riskLevel: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={() => createResidentMutation.mutate()}
                disabled={createResidentMutation.isPending || !createForm.caseControlNumber || !createForm.internalCode || !createForm.safehouseName || !createForm.caseCategory || !createForm.assignedSocialWorker}
              >
                {createResidentMutation.isPending ? 'Creating...' : 'Create Resident'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
}