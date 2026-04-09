import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createResident, fetchResidents } from '@/lib/api-endpoints';
import { Resident } from '@/lib/types';
import { formatCaseCategoryLabel } from '@/lib/caseCategoryDisplay';
import { displaySafehouseName } from '@/lib/safehouseDisplay';
import { RiskBadge } from '@/components/RiskBadge';
import { StatusPill } from '@/components/StatusPill';
import { PAGE_SIZE_OPTIONS, PaginationControl, usePagination } from '@/components/PaginationControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Edit, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EditableSelect } from '@/components/EditableSelect';
import { SortableTableHead } from '@/components/SortableTableHead';
import { useTableSortState } from '@/hooks/useTableSortState';
import { compareRiskLevel, compareText } from '@/lib/tableSort';

function emptyCreateForm() {
  return {
    caseControlNumber: '',
    internalCode: '',
    safehouseName: '',
    caseStatus: 'active',
    caseCategory: '',
    caseCategoryOther: '',
    riskLevel: 'medium',
    assignedSocialWorker: '',
    assignedSocialWorkerOther: '',
    reintegrationStatus: '',
    reintegrationStatusOther: '',
    reintegrationType: '',
    reintegrationTypeOther: '',
    referralSource: '',
    referralSourceOther: '',
    referringAgency: '',
    referringAgencyOther: '',
    initialAssessment: '',
    admissionDate: '',
    dateOfBirth: '',
    religion: '',
    religionOther: '',
    birthStatus: '',
    birthStatusOther: '',
    placeOfBirth: '',
    placeOfBirthOther: '',
    subCatOrphaned: false,
    subCatTrafficked: false,
    subCatChildLabor: false,
    subCatPhysicalAbuse: false,
    subCatSexualAbuse: false,
    subCatOsaec: false,
    subCatCicl: false,
    subCatAtRisk: false,
    subCatStreetChild: false,
    subCatChildWithHiv: false,
    familyIs4ps: false,
    familySoloParent: false,
    familyIndigenous: false,
    familyInformalSettler: false,
    familyParentPwd: false,
  };
}

export default function CaseloadInventory() {
  const { data: residents = [], isLoading, error } = useQuery({ queryKey: ['residents'], queryFn: fetchResidents });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [mlRiskFilter, setMlRiskFilter] = useState<string>('all');
  const [safehouseFilter, setSafehouseFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const { sortKey, sortDir, toggleSort } = useTableSortState();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filtered = residents.filter((r: Resident) => {
    const matchesSearch = r.internalCode.toLowerCase().includes(search.toLowerCase()) ||
        r.caseControlNumber.toLowerCase().includes(search.toLowerCase()) ||
        r.assignedSocialWorker.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.caseStatus === statusFilter;
    const matchesRisk = riskFilter === 'all' || r.riskLevel === riskFilter;
    const predictedTier = r.casePrediction?.riskEscalationTier ?? 'unknown';
    const matchesMlRisk =
      mlRiskFilter === 'all' ||
      (mlRiskFilter === 'none' && !r.casePrediction?.modelAvailable) ||
      predictedTier === mlRiskFilter;
    const matchesSafehouse = safehouseFilter === 'all' || r.safehouse === safehouseFilter;
    const matchesCategory = categoryFilter === 'all' || r.caseCategory === categoryFilter;
    return matchesSearch && matchesStatus && matchesRisk && matchesMlRisk && matchesSafehouse && matchesCategory;
  });

  const sortedFiltered = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a: Resident, b: Resident) => {
      switch (sortKey) {
        case 'caseControlNumber':
          return compareText(a.caseControlNumber, b.caseControlNumber, sortDir);
        case 'internalCode':
          return compareText(a.internalCode, b.internalCode, sortDir);
        case 'safehouse':
          return compareText(a.safehouse, b.safehouse, sortDir);
        case 'caseStatus':
          return compareText(a.caseStatus, b.caseStatus, sortDir);
        case 'caseCategory':
          return compareText(a.caseCategory, b.caseCategory, sortDir);
        case 'riskLevel':
          return compareRiskLevel(a.riskLevel, b.riskLevel, sortDir);
        case 'assignedSocialWorker':
          return compareText(a.assignedSocialWorker, b.assignedSocialWorker, sortDir);
        case 'reintegrationStatus':
          return compareText(a.reintegrationStatus, b.reintegrationStatus, sortDir);
        case 'mlRiskTier':
          return compareText(
            a.casePrediction?.riskEscalationTier ?? 'unknown',
            b.casePrediction?.riskEscalationTier ?? 'unknown',
            sortDir,
          );
        case 'mlRiskScore':
          return sortDir === 'asc'
            ? (a.casePrediction?.riskEscalationProbability ?? -1) - (b.casePrediction?.riskEscalationProbability ?? -1)
            : (b.casePrediction?.riskEscalationProbability ?? -1) - (a.casePrediction?.riskEscalationProbability ?? -1);
        default:
          return 0;
      }
    });
  }, [filtered, sortKey, sortDir]);

  const { currentPage, setCurrentPage, startIndex, endIndex, pageSize, setPageSize } = usePagination(sortedFiltered.length);
  const paginated = sortedFiltered.slice(startIndex, endIndex);

  const handleColumnSort = (key: string) => {
    toggleSort(key);
    setCurrentPage(1);
  };

  const safehouses = useMemo(
    () => [...new Set(residents.map((r: Resident) => r.safehouse).filter(Boolean))].sort((a, b) =>
      displaySafehouseName(a).localeCompare(displaySafehouseName(b), undefined, { numeric: true }),
    ),
    [residents],
  );
  const caseCategories = useMemo(
    () => [...new Set(residents.map((r: Resident) => r.caseCategory).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    ),
    [residents],
  );
  const socialWorkers = useMemo(
    () => [...new Set(residents.map((r: Resident) => r.assignedSocialWorker).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    ),
    [residents],
  );
  const reintStatusOptions = useMemo(
    () =>
      [...new Set(residents.map((r: Resident) => r.reintegrationStatus).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    [residents],
  );
  const reintTypeOptions = useMemo(
    () =>
      [...new Set(residents.map((r: Resident) => r.reintegrationType).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    [residents],
  );
  const religionOptions = useMemo(
    () =>
      [...new Set(residents.map((r: Resident) => r.religion).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    [residents],
  );
  const birthStatusOptions = useMemo(
    () =>
      [...new Set(residents.map((r: Resident) => r.birthStatus).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    [residents],
  );
  const referralSourceOptions = useMemo(
    () =>
      [...new Set(residents.map((r: Resident) => r.referralSource).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    [residents],
  );
  const referringAgencyOptions = useMemo(
    () =>
      [...new Set(residents.map((r: Resident) => r.referringAgency).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    [residents],
  );
  const placeOfBirthOptions = useMemo(
    () =>
      [...new Set(residents.map((r: Resident) => r.placeOfBirth).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    [residents],
  );

  const resolvedCategory = createForm.caseCategory === 'other' ? createForm.caseCategoryOther : createForm.caseCategory;
  const resolvedWorker =
    createForm.assignedSocialWorker === 'other' ? createForm.assignedSocialWorkerOther : createForm.assignedSocialWorker;
  const resolvedReintStatus =
    createForm.reintegrationStatus === 'other' ? createForm.reintegrationStatusOther : createForm.reintegrationStatus;
  const resolvedReintType =
    createForm.reintegrationType === 'other' ? createForm.reintegrationTypeOther : createForm.reintegrationType;
  const resolvedReligion = createForm.religion === 'other' ? createForm.religionOther : createForm.religion;
  const resolvedBirthStatus = createForm.birthStatus === 'other' ? createForm.birthStatusOther : createForm.birthStatus;
  const resolvedReferralSource =
    createForm.referralSource === 'other' ? createForm.referralSourceOther : createForm.referralSource;
  const resolvedReferringAgency =
    createForm.referringAgency === 'other' ? createForm.referringAgencyOther : createForm.referringAgency;
  const resolvedPlaceOfBirth =
    createForm.placeOfBirth === 'other' ? createForm.placeOfBirthOther : createForm.placeOfBirth;

  const createResidentMutation = useMutation({
    mutationFn: () =>
      createResident({
        caseControlNumber: createForm.caseControlNumber,
        internalCode: createForm.internalCode,
        safehouseName: createForm.safehouseName,
        caseStatus: createForm.caseStatus,
        caseCategory: resolvedCategory,
        riskLevel: createForm.riskLevel,
        assignedSocialWorker: resolvedWorker,
        reintegrationStatus: resolvedReintStatus.trim() || undefined,
        reintegrationType: resolvedReintType.trim() || undefined,
        referralSource: resolvedReferralSource.trim() || undefined,
        referringAgency: resolvedReferringAgency.trim() || undefined,
        initialAssessment: createForm.initialAssessment || undefined,
        admissionDate: createForm.admissionDate || undefined,
        dateOfBirth: createForm.dateOfBirth || undefined,
        religion: resolvedReligion.trim() || undefined,
        birthStatus: resolvedBirthStatus.trim() || undefined,
        placeOfBirth: resolvedPlaceOfBirth.trim() || undefined,
        subCatOrphaned: createForm.subCatOrphaned,
        subCatTrafficked: createForm.subCatTrafficked,
        subCatChildLabor: createForm.subCatChildLabor,
        subCatPhysicalAbuse: createForm.subCatPhysicalAbuse,
        subCatSexualAbuse: createForm.subCatSexualAbuse,
        subCatOsaec: createForm.subCatOsaec,
        subCatCicl: createForm.subCatCicl,
        subCatAtRisk: createForm.subCatAtRisk,
        subCatStreetChild: createForm.subCatStreetChild,
        subCatChildWithHiv: createForm.subCatChildWithHiv,
        familyIs4ps: createForm.familyIs4ps,
        familySoloParent: createForm.familySoloParent,
        familyIndigenous: createForm.familyIndigenous,
        familyInformalSettler: createForm.familyInformalSettler,
        familyParentPwd: createForm.familyParentPwd,
      }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['residents'] });
      setOpenCreate(false);
      setCreateForm(emptyCreateForm());
      toast({ title: 'Resident added', description: 'Resident profile created successfully.' });
      navigate(`/admin/resident/${created.id}`);
    },
    onError: () => toast({ title: 'Create failed', description: 'Could not create resident profile.', variant: 'destructive' }),
  });

  const canSubmit =
    !!createForm.caseControlNumber.trim() &&
    !!createForm.internalCode.trim() &&
    !!createForm.safehouseName.trim() &&
    !!resolvedCategory.trim() &&
    !!resolvedWorker.trim();

  if (error) {
    return (
        <div className="space-y-2">
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <Users className="h-8 w-8 text-primary shrink-0" />
            Caseload Inventory
          </h1>
          <p className="text-destructive text-sm">Could not load residents from the API.</p>
        </div>
    );
  }

  return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <Users className="h-8 w-8 text-primary shrink-0" />
            Caseload Inventory
          </h1>
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
          <Select value={mlRiskFilter} onValueChange={v => { setMlRiskFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Predicted Risk" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Predicted Risk</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
              <SelectItem value="none">Model Unavailable</SelectItem>
            </SelectContent>
          </Select>
          <Select value={safehouseFilter} onValueChange={v => { setSafehouseFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Safehouse" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Safehouses</SelectItem>
              {safehouses.map(s => (
                <SelectItem key={s} value={s}>{displaySafehouseName(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {caseCategories.map(c => (
                <SelectItem key={c} value={c}>{formatCaseCategoryLabel(c)}</SelectItem>
              ))}
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
                    <SortableTableHead
                      active={sortKey === 'caseControlNumber'}
                      direction={sortKey === 'caseControlNumber' ? sortDir : null}
                      onSort={() => handleColumnSort('caseControlNumber')}
                    >
                      Case #
                    </SortableTableHead>
                    <SortableTableHead
                      active={sortKey === 'internalCode'}
                      direction={sortKey === 'internalCode' ? sortDir : null}
                      onSort={() => handleColumnSort('internalCode')}
                    >
                      Code
                    </SortableTableHead>
                    <SortableTableHead
                      active={sortKey === 'safehouse'}
                      direction={sortKey === 'safehouse' ? sortDir : null}
                      onSort={() => handleColumnSort('safehouse')}
                    >
                      Safehouse
                    </SortableTableHead>
                    <SortableTableHead
                      active={sortKey === 'caseStatus'}
                      direction={sortKey === 'caseStatus' ? sortDir : null}
                      onSort={() => handleColumnSort('caseStatus')}
                    >
                      Status
                    </SortableTableHead>
                    <SortableTableHead
                      active={sortKey === 'caseCategory'}
                      direction={sortKey === 'caseCategory' ? sortDir : null}
                      onSort={() => handleColumnSort('caseCategory')}
                    >
                      Category
                    </SortableTableHead>
                    <SortableTableHead
                      active={sortKey === 'riskLevel'}
                      direction={sortKey === 'riskLevel' ? sortDir : null}
                      onSort={() => handleColumnSort('riskLevel')}
                    >
                      Risk
                    </SortableTableHead>
                    <SortableTableHead
                      active={sortKey === 'mlRiskTier'}
                      direction={sortKey === 'mlRiskTier' ? sortDir : null}
                      onSort={() => handleColumnSort('mlRiskTier')}
                    >
                      Predicted Tier
                    </SortableTableHead>
                    <SortableTableHead
                      active={sortKey === 'mlRiskScore'}
                      direction={sortKey === 'mlRiskScore' ? sortDir : null}
                      onSort={() => handleColumnSort('mlRiskScore')}
                    >
                      Predicted Score
                    </SortableTableHead>
                    <SortableTableHead
                      active={sortKey === 'assignedSocialWorker'}
                      direction={sortKey === 'assignedSocialWorker' ? sortDir : null}
                      onSort={() => handleColumnSort('assignedSocialWorker')}
                    >
                      Social Worker
                    </SortableTableHead>
                    <SortableTableHead
                      active={sortKey === 'reintegrationStatus'}
                      direction={sortKey === 'reintegrationStatus' ? sortDir : null}
                      onSort={() => handleColumnSort('reintegrationStatus')}
                    >
                      Reintegration
                    </SortableTableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((r: Resident) => (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/admin/resident/${r.id}`)}>
                        <TableCell className="font-medium text-sm">{r.caseControlNumber}</TableCell>
                        <TableCell className="text-sm">{r.internalCode}</TableCell>
                        <TableCell className="text-sm">{displaySafehouseName(r.safehouse)}</TableCell>
                        <TableCell><StatusPill status={r.caseStatus} /></TableCell>
                        <TableCell className="text-sm">{formatCaseCategoryLabel(r.caseCategory)}</TableCell>
                        <TableCell><RiskBadge level={r.riskLevel} /></TableCell>
                        <TableCell className="text-sm capitalize">
                          {r.casePrediction?.riskEscalationTier ?? 'unknown'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.casePrediction?.modelAvailable
                            ? `${Math.round((r.casePrediction.riskEscalationProbability ?? 0) * 100)}%`
                            : 'Unavailable'}
                        </TableCell>
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
                      <p><span className="font-medium">Safehouse:</span> {displaySafehouseName(r.safehouse)}</p>
                      <p><span className="font-medium">Category:</span> {r.caseCategory}</p>
                      <p><span className="font-medium">Social Worker:</span> {r.assignedSocialWorker}</p>
                      <p><span className="font-medium">Predicted Tier:</span> {r.casePrediction?.riskEscalationTier ?? 'unknown'}</p>
                      <p>
                        <span className="font-medium">Predicted Score:</span>{' '}
                        {r.casePrediction?.modelAvailable
                          ? `${Math.round((r.casePrediction.riskEscalationProbability ?? 0) * 100)}%`
                          : 'Unavailable'}
                      </p>
                      <p><span className="font-medium">Reintegration:</span> {r.reintegrationStatus}</p>
                    </div>
                  </div>
              ))
          )}
        </div>

        <PaginationControl
          totalItems={sortedFiltered.length}
          pageSize={pageSize}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={setPageSize}
        />

        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogContent className="sm:max-w-4xl w-[min(100vw-2rem,56rem)] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
              <DialogTitle className="font-display">Add Resident</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto px-6 pb-4 flex-1 min-h-0 space-y-6">
              <div className="grid gap-3">
                <p className="text-sm font-medium text-foreground">Case &amp; placement</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Case Control Number</Label>
                    <Input value={createForm.caseControlNumber} onChange={(e) => setCreateForm({ ...createForm, caseControlNumber: e.target.value })} />
                  </div>
                  <div>
                    <Label>Internal Code</Label>
                    <Input value={createForm.internalCode} onChange={(e) => setCreateForm({ ...createForm, internalCode: e.target.value })} />
                  </div>
                </div>
                <EditableSelect
                  label="Safehouse"
                  value={createForm.safehouseName}
                  customValue={createForm.safehouseName}
                  options={safehouses}
                  getOptionLabel={displaySafehouseName}
                  onChange={(v) => setCreateForm({ ...createForm, safehouseName: v === 'other' ? '' : v })}
                  onCustomChange={(v) => setCreateForm({ ...createForm, safehouseName: v })}
                />
                <EditableSelect
                  label="Case category"
                  value={createForm.caseCategory}
                  customValue={createForm.caseCategoryOther}
                  options={caseCategories}
                  getOptionLabel={formatCaseCategoryLabel}
                  onChange={(v) => setCreateForm({ ...createForm, caseCategory: v })}
                  onCustomChange={(v) => setCreateForm({ ...createForm, caseCategoryOther: v })}
                />
                <EditableSelect
                  label="Assigned Social Worker"
                  value={createForm.assignedSocialWorker}
                  customValue={createForm.assignedSocialWorkerOther}
                  options={socialWorkers}
                  onChange={(v) => setCreateForm({ ...createForm, assignedSocialWorker: v })}
                  onCustomChange={(v) => setCreateForm({ ...createForm, assignedSocialWorkerOther: v })}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              </div>

              <div className="grid gap-3">
                <p className="text-sm font-medium text-foreground">Demographics</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Date of birth</Label>
                    <Input type="date" value={createForm.dateOfBirth} onChange={(e) => setCreateForm({ ...createForm, dateOfBirth: e.target.value })} />
                  </div>
                  <div>
                    <Label>Admission date</Label>
                    <Input type="date" value={createForm.admissionDate} onChange={(e) => setCreateForm({ ...createForm, admissionDate: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <EditableSelect
                    label="Religion"
                    allowEmpty
                    placeholder="Select religion"
                    value={createForm.religion}
                    customValue={createForm.religionOther}
                    options={religionOptions}
                    onChange={(v) => setCreateForm({ ...createForm, religion: v })}
                    onCustomChange={(v) => setCreateForm({ ...createForm, religionOther: v })}
                  />
                  <EditableSelect
                    label="Birth status"
                    allowEmpty
                    placeholder="Select birth status"
                    value={createForm.birthStatus}
                    customValue={createForm.birthStatusOther}
                    options={birthStatusOptions}
                    onChange={(v) => setCreateForm({ ...createForm, birthStatus: v })}
                    onCustomChange={(v) => setCreateForm({ ...createForm, birthStatusOther: v })}
                  />
                </div>
                <EditableSelect
                  label="Place of birth"
                  allowEmpty
                  placeholder="Select place of birth"
                  value={createForm.placeOfBirth}
                  customValue={createForm.placeOfBirthOther}
                  options={placeOfBirthOptions}
                  onChange={(v) => setCreateForm({ ...createForm, placeOfBirth: v })}
                  onCustomChange={(v) => setCreateForm({ ...createForm, placeOfBirthOther: v })}
                />
              </div>

              <div className="grid gap-2">
                <p className="text-sm font-medium text-foreground">Case subcategories</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {([
                    ['subCatOrphaned', 'Orphaned'],
                    ['subCatTrafficked', 'Trafficked'],
                    ['subCatChildLabor', 'Child labor'],
                    ['subCatPhysicalAbuse', 'Physical abuse'],
                    ['subCatSexualAbuse', 'Sexual abuse'],
                    ['subCatOsaec', 'OSAEC / CSAEM'],
                    ['subCatCicl', 'CICL'],
                    ['subCatAtRisk', 'At risk'],
                    ['subCatStreetChild', 'Street child'],
                    ['subCatChildWithHiv', 'Child with HIV'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={createForm[key]}
                        onChange={(e) => setCreateForm({ ...createForm, [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <p className="text-sm font-medium text-foreground">Family profile</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {([
                    ['familyIs4ps', '4Ps beneficiary'],
                    ['familySoloParent', 'Solo parent'],
                    ['familyIndigenous', 'Indigenous group'],
                    ['familyInformalSettler', 'Informal settler'],
                    ['familyParentPwd', 'Parent with disability'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={createForm[key]}
                        onChange={(e) => setCreateForm({ ...createForm, [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-3">
                <p className="text-sm font-medium text-foreground">Referral &amp; reintegration</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <EditableSelect
                    label="Referral source"
                    allowEmpty
                    placeholder="Select referral source"
                    value={createForm.referralSource}
                    customValue={createForm.referralSourceOther}
                    options={referralSourceOptions}
                    onChange={(v) => setCreateForm({ ...createForm, referralSource: v })}
                    onCustomChange={(v) => setCreateForm({ ...createForm, referralSourceOther: v })}
                  />
                  <EditableSelect
                    label="Referring agency / person"
                    allowEmpty
                    placeholder="Select agency or person"
                    value={createForm.referringAgency}
                    customValue={createForm.referringAgencyOther}
                    options={referringAgencyOptions}
                    onChange={(v) => setCreateForm({ ...createForm, referringAgency: v })}
                    onCustomChange={(v) => setCreateForm({ ...createForm, referringAgencyOther: v })}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <EditableSelect
                    label="Reintegration status"
                    allowEmpty
                    placeholder="Select status"
                    value={createForm.reintegrationStatus}
                    customValue={createForm.reintegrationStatusOther}
                    options={reintStatusOptions}
                    onChange={(v) => setCreateForm({ ...createForm, reintegrationStatus: v })}
                    onCustomChange={(v) => setCreateForm({ ...createForm, reintegrationStatusOther: v })}
                  />
                  <EditableSelect
                    label="Reintegration type"
                    allowEmpty
                    placeholder="Select type"
                    value={createForm.reintegrationType}
                    customValue={createForm.reintegrationTypeOther}
                    options={reintTypeOptions}
                    onChange={(v) => setCreateForm({ ...createForm, reintegrationType: v })}
                    onCustomChange={(v) => setCreateForm({ ...createForm, reintegrationTypeOther: v })}
                  />
                </div>
                <div>
                  <Label>Initial assessment</Label>
                  <Textarea rows={4} value={createForm.initialAssessment} onChange={(e) => setCreateForm({ ...createForm, initialAssessment: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="border-t px-6 py-4 shrink-0 flex justify-end gap-2 bg-muted/30">
              <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
              <Button
                onClick={() => createResidentMutation.mutate()}
                disabled={createResidentMutation.isPending || !canSubmit}
              >
                {createResidentMutation.isPending ? 'Creating...' : 'Create Resident'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
}
