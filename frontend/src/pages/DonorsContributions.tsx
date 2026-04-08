import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDonation,
  createSupporter,
  deleteDonation,
  deleteSupporter,
  fetchDonations,
  fetchSupporters,
  updateDonation,
  updateSupporter,
} from '@/lib/api-endpoints';
import type { Supporter, Donation } from '@/lib/types';
import { RiskBadge } from '@/components/RiskBadge';
import { PAGE_SIZE_OPTIONS, PaginationControl, usePagination } from '@/components/PaginationControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Trash2, Pencil, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { SortableTableHead } from '@/components/SortableTableHead';
import { useTableSortState } from '@/hooks/useTableSortState';
import { compareDonationValue, compareRiskLevel, compareText } from '@/lib/tableSort';
import { buildAdminDonationBody, type UiDonationType } from '@/lib/donationPayload';

const donorTypeOptions = ['monetary', 'in-kind', 'volunteer', 'skills', 'social-media', 'partner', 'other'];
const donationTypeOptions: UiDonationType[] = ['monetary', 'in-kind', 'time', 'skills', 'social-media'];
const channelOptions = ['web portal', 'referral', 'event', 'social media', 'email', 'other'];

function sortStrings(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

export default function DonorsContributions() {
  const queryClient = useQueryClient();
  const supportersQ = useQuery({ queryKey: ['supporters'], queryFn: fetchSupporters });
  const donationsQ = useQuery({ queryKey: ['donations'], queryFn: fetchDonations });
  const supporters = supportersQ.data ?? [];
  const donations = donationsQ.data ?? [];

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDonor, setSelectedDonor] = useState<Supporter | null>(null);
  const [donorDialogOpen, setDonorDialogOpen] = useState(false);
  const [donationDialogOpen, setDonationDialogOpen] = useState(false);
  const [editingDonor, setEditingDonor] = useState<Supporter | null>(null);
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [deleteDonorTarget, setDeleteDonorTarget] = useState<Supporter | null>(null);
  const [deleteDonationTarget, setDeleteDonationTarget] = useState<Donation | null>(null);
  const { toast } = useToast();

  const [allDonationTypeFilter, setAllDonationTypeFilter] = useState<string>('all');
  const [donationDateFrom, setDonationDateFrom] = useState('');
  const [donationDateTo, setDonationDateTo] = useState('');

  const [donorForm, setDonorForm] = useState({
    displayName: '',
    supporterType: 'monetary',
    supporterTypeOther: '',
    status: 'active',
    country: '',
    email: '',
    acquisitionChannel: 'web portal',
    acquisitionChannelOther: '',
    firstDonationDate: '',
  });
  const [donationForm, setDonationForm] = useState({
    supporterId: '',
    donationType: 'monetary' as UiDonationType,
    donationDate: new Date().toISOString().slice(0, 10),
    amount: '1000',
    inputCurrency: 'PHP' as 'PHP' | 'USD' | 'EUR',
    campaignName: '',
    notes: '',
  });

  const normalizedSupporters = useMemo(
    () => [...supporters].sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })),
    [supporters],
  );
  const donorTypeValues = useMemo(
    () => [...new Set([...donorTypeOptions, ...supporters.map((s) => s.supporterType)])].sort(sortStrings),
    [supporters],
  );
  const donationTypeValues = useMemo(
    () => [...new Set([...donationTypeOptions, ...donations.map((d) => d.type)])].sort(sortStrings) as string[],
    [donations],
  );
  const channelValues = useMemo(
    () =>
      [...new Set([...channelOptions, ...supporters.map((s) => (s.acquisitionChannel || '').toLowerCase()).filter(Boolean)])].sort(
        sortStrings,
      ),
    [supporters],
  );
  const normalizedDonations = useMemo(
    () => [...donations].sort((a, b) => (b.date || '').localeCompare(a.date || '') || Number(b.id) - Number(a.id)),
    [donations],
  );

  const filteredDonors = supporters.filter((s) => {
    const matchesSearch = s.displayName.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || s.supporterType === typeFilter;
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const filteredAllDonations = normalizedDonations.filter((d: Donation) => {
    const matchesType = allDonationTypeFilter === 'all' || d.type === allDonationTypeFilter;
    const dStr = d.date || '';
    const matchesFrom = !donationDateFrom || dStr >= donationDateFrom;
    const matchesTo = !donationDateTo || dStr <= donationDateTo;
    return matchesType && matchesFrom && matchesTo;
  });

  const { sortKey: donorSortKey, sortDir: donorSortDir, toggleSort: toggleDonorSort } = useTableSortState();
  const { sortKey: contribSortKey, sortDir: contribSortDir, toggleSort: toggleContribSort } = useTableSortState();

  const sortedDonors = useMemo(() => {
    if (!donorSortKey) return filteredDonors;
    return [...filteredDonors].sort((a, b) => {
      switch (donorSortKey) {
        case 'displayName':
          return compareText(a.displayName, b.displayName, donorSortDir);
        case 'supporterType':
          return compareText(a.supporterType, b.supporterType, donorSortDir);
        case 'status':
          return compareText(a.status, b.status, donorSortDir);
        case 'country':
          return compareText(a.country || '', b.country || '', donorSortDir);
        case 'acquisitionChannel':
          return compareText(a.acquisitionChannel || '', b.acquisitionChannel || '', donorSortDir);
        case 'churnRisk':
          return compareRiskLevel(a.churnRisk, b.churnRisk, donorSortDir);
        default:
          return 0;
      }
    });
  }, [filteredDonors, donorSortKey, donorSortDir]);

  const sortedContributions = useMemo(() => {
    if (!contribSortKey) return filteredAllDonations;
    return [...filteredAllDonations].sort((a: Donation, b: Donation) => {
      switch (contribSortKey) {
        case 'date':
          return compareText(a.date || '', b.date || '', contribSortDir);
        case 'donorName':
          return compareText(a.donorName || '', b.donorName || '', contribSortDir);
        case 'type':
          return compareText(a.type, b.type, contribSortDir);
        case 'value':
          return compareDonationValue(a, b, contribSortDir);
        default:
          return 0;
      }
    });
  }, [filteredAllDonations, contribSortKey, contribSortDir]);

  const { currentPage, setCurrentPage, startIndex, endIndex, pageSize, setPageSize } = usePagination(sortedDonors.length, 10);
  const paginated = sortedDonors.slice(startIndex, endIndex);

  const handleDonorSort = (key: string) => {
    toggleDonorSort(key);
    setCurrentPage(1);
  };

  const donorDonations = selectedDonor
    ? normalizedDonations.filter((d: Donation) => d.supporterId === selectedDonor.id)
    : [];

  const resetDonorForm = () =>
    setDonorForm({
      displayName: '',
      supporterType: 'monetary',
      supporterTypeOther: '',
      status: 'active',
      country: '',
      email: '',
      acquisitionChannel: 'web portal',
      acquisitionChannelOther: '',
      firstDonationDate: '',
    });
  const resetDonationForm = () =>
    setDonationForm({
      supporterId: '',
      donationType: 'monetary',
      donationDate: new Date().toISOString().slice(0, 10),
      amount: '1000',
      inputCurrency: 'PHP',
      campaignName: '',
      notes: '',
    });

  const saveDonorMutation = useMutation({
    mutationFn: async () => {
      const supporterType = donorForm.supporterType === 'other' ? donorForm.supporterTypeOther : donorForm.supporterType;
      const acquisitionChannel = donorForm.acquisitionChannel === 'other' ? donorForm.acquisitionChannelOther : donorForm.acquisitionChannel;
      const payload = {
        displayName: donorForm.displayName.trim(),
        supporterType,
        status: donorForm.status,
        country: donorForm.country.trim() || undefined,
        email: donorForm.email.trim() || undefined,
        acquisitionChannel: acquisitionChannel?.trim() || undefined,
        firstDonationDate: donorForm.firstDonationDate || undefined,
      };
      if (editingDonor) return updateSupporter(editingDonor.id, payload);
      return createSupporter(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supporters'] });
      setDonorDialogOpen(false);
      setEditingDonor(null);
      resetDonorForm();
      toast({ title: 'Saved', description: 'Donor profile saved successfully.' });
    },
    onError: () => toast({ title: 'Save failed', description: 'Could not save donor.', variant: 'destructive' }),
  });

  const saveDonationMutation = useMutation({
    mutationFn: async () => {
      const numericAmount = Number(donationForm.amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error('Invalid amount');
      }
      const base = buildAdminDonationBody({
        donationTypeUi: donationForm.donationType,
        donationDate: donationForm.donationDate,
        amountInput: numericAmount,
        inputCurrency: donationForm.inputCurrency,
        campaignName: donationForm.campaignName,
        notes: donationForm.notes,
      });
      const payload = {
        supporterId: Number(donationForm.supporterId),
        donationType: base.donationType,
        donationDate: base.donationDate,
        amount: base.amount,
        estimatedValue: base.estimatedValue,
        currencyCode: base.currencyCode ?? 'PHP',
        campaignName: base.campaignName,
        notes: base.notes,
      };
      if (editingDonation) return updateDonation(editingDonation.id, payload);
      return createDonation(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['donations'] });
      setDonationDialogOpen(false);
      setEditingDonation(null);
      resetDonationForm();
      toast({ title: 'Saved', description: 'Donation saved successfully.' });
    },
    onError: () => toast({ title: 'Save failed', description: 'Could not save donation.', variant: 'destructive' }),
  });

  const deleteDonorMutation = useMutation({
    mutationFn: (id: string) => deleteSupporter(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supporters'] });
      setDeleteDonorTarget(null);
      toast({ title: 'Deleted', description: 'Donor removed.' });
    },
    onError: () => toast({ title: 'Delete failed', description: 'Could not delete donor.', variant: 'destructive' }),
  });
  const deleteDonationMutation = useMutation({
    mutationFn: (id: string) => deleteDonation(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['donations'] });
      setDeleteDonationTarget(null);
      toast({ title: 'Deleted', description: 'Donation removed.' });
    },
    onError: () => toast({ title: 'Delete failed', description: 'Could not delete donation.', variant: 'destructive' }),
  });

  const loading = supportersQ.isLoading || donationsQ.isLoading;

  if (supportersQ.error || donationsQ.error) {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-bold text-foreground">Donors &amp; contributions</h1>
        <p className="text-destructive text-sm">Could not load data from the API.</p>
      </div>
    );
  }

  const openDonationForCreate = () => {
    setEditingDonation(null);
    resetDonationForm();
    setDonationDialogOpen(true);
  };

  const openDonationForEdit = (d: Donation) => {
    setEditingDonation(d);
    const isMonetary = d.type === 'monetary';
    const raw = isMonetary ? String(d.amount ?? '') : String(d.hours ?? d.amount ?? '');
    setDonationForm({
      supporterId: d.supporterId,
      donationType: d.type as UiDonationType,
      donationDate: d.date,
      amount: raw || '1',
      inputCurrency: 'PHP',
      campaignName: d.campaignName || '',
      notes: d.notes || '',
    });
    setDonationDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-display font-bold text-foreground">Donors &amp; contributions</h1>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => { setEditingDonor(null); resetDonorForm(); setDonorDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add donor
          </Button>
          <Button variant="outline" onClick={() => openDonationForCreate()}>
            <Plus className="h-4 w-4 mr-2" /> Record donation
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground max-w-3xl">
        Donation amounts use the same rules as the donor portal: values are stored in PHP (currency conversion matches the portal).
        Allocation by safehouse/program is recorded in the database; detailed allocation UI ships with the analytics phase.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search donors by name..."
            className="pl-10"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="monetary">Monetary donor</SelectItem>
            <SelectItem value="in-kind">In-kind donor</SelectItem>
            <SelectItem value="volunteer">Volunteer</SelectItem>
            <SelectItem value="skills">Skills contributor</SelectItem>
            <SelectItem value="social-media">Social media advocate</SelectItem>
            <SelectItem value="partner">Partner organization</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        {loading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : (
          <Table className="table-striped">
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  active={donorSortKey === 'displayName'}
                  direction={donorSortKey === 'displayName' ? donorSortDir : null}
                  onSort={() => handleDonorSort('displayName')}
                >
                  Name
                </SortableTableHead>
                <SortableTableHead
                  active={donorSortKey === 'supporterType'}
                  direction={donorSortKey === 'supporterType' ? donorSortDir : null}
                  onSort={() => handleDonorSort('supporterType')}
                >
                  Type
                </SortableTableHead>
                <SortableTableHead
                  active={donorSortKey === 'status'}
                  direction={donorSortKey === 'status' ? donorSortDir : null}
                  onSort={() => handleDonorSort('status')}
                >
                  Status
                </SortableTableHead>
                <SortableTableHead
                  active={donorSortKey === 'country'}
                  direction={donorSortKey === 'country' ? donorSortDir : null}
                  onSort={() => handleDonorSort('country')}
                >
                  Country
                </SortableTableHead>
                <SortableTableHead
                  active={donorSortKey === 'acquisitionChannel'}
                  direction={donorSortKey === 'acquisitionChannel' ? donorSortDir : null}
                  onSort={() => handleDonorSort('acquisitionChannel')}
                >
                  Channel
                </SortableTableHead>
                <SortableTableHead
                  active={donorSortKey === 'churnRisk'}
                  direction={donorSortKey === 'churnRisk' ? donorSortDir : null}
                  onSort={() => handleDonorSort('churnRisk')}
                >
                  Churn risk
                </SortableTableHead>
                <TableHead className="w-[100px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.displayName}</TableCell>
                  <TableCell className="capitalize">{s.supporterType.replace('-', ' ')}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === 'active' ? 'default' : 'secondary'}>{s.status}</Badge>
                  </TableCell>
                  <TableCell>{s.country}</TableCell>
                  <TableCell className="text-sm">{s.acquisitionChannel}</TableCell>
                  <TableCell>
                    <RiskBadge level={s.churnRisk} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => setSelectedDonor(s)}>
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingDonor(s);
                          setDonorForm({
                            displayName: s.displayName,
                            supporterType: donorTypeOptions.includes(s.supporterType) ? s.supporterType : 'other',
                            supporterTypeOther: donorTypeOptions.includes(s.supporterType) ? '' : s.supporterType,
                            status: s.status,
                            country: s.country ?? '',
                            email: '',
                            acquisitionChannel: channelOptions.includes((s.acquisitionChannel || '').toLowerCase())
                              ? s.acquisitionChannel.toLowerCase()
                              : 'other',
                            acquisitionChannelOther: channelOptions.includes((s.acquisitionChannel || '').toLowerCase())
                              ? ''
                              : (s.acquisitionChannel || ''),
                            firstDonationDate: s.firstDonationDate || '',
                          });
                          setDonorDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteDonorTarget(s)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <PaginationControl
        totalItems={sortedDonors.length}
        pageSize={pageSize}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageSizeChange={setPageSize}
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">All contributions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <Select value={allDonationTypeFilter} onValueChange={setAllDonationTypeFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Donation type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All donation types</SelectItem>
                {donationTypeValues.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 items-center">
              <Label className="text-xs whitespace-nowrap">From</Label>
              <Input type="date" value={donationDateFrom} onChange={(e) => setDonationDateFrom(e.target.value)} className="w-[160px]" />
            </div>
            <div className="flex gap-2 items-center">
              <Label className="text-xs whitespace-nowrap">To</Label>
              <Input type="date" value={donationDateTo} onChange={(e) => setDonationDateTo(e.target.value)} className="w-[160px]" />
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    active={contribSortKey === 'date'}
                    direction={contribSortKey === 'date' ? contribSortDir : null}
                    onSort={() => toggleContribSort('date')}
                  >
                    Date
                  </SortableTableHead>
                  <SortableTableHead
                    active={contribSortKey === 'donorName'}
                    direction={contribSortKey === 'donorName' ? contribSortDir : null}
                    onSort={() => toggleContribSort('donorName')}
                  >
                    Donor
                  </SortableTableHead>
                  <SortableTableHead
                    active={contribSortKey === 'type'}
                    direction={contribSortKey === 'type' ? contribSortDir : null}
                    onSort={() => toggleContribSort('type')}
                  >
                    Type
                  </SortableTableHead>
                  <SortableTableHead
                    active={contribSortKey === 'value'}
                    direction={contribSortKey === 'value' ? contribSortDir : null}
                    onSort={() => toggleContribSort('value')}
                  >
                    Value
                  </SortableTableHead>
                  <TableHead className="w-[90px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedContributions.slice(0, 50).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-sm">{d.date}</TableCell>
                    <TableCell className="text-sm">{d.donorName}</TableCell>
                    <TableCell className="capitalize text-sm">{d.type}</TableCell>
                    <TableCell className="text-sm">
                      {d.type === 'time'
                        ? `${(d.hours ?? d.amount ?? 0).toLocaleString()} hrs`
                        : d.amount != null
                          ? `₱${d.amount.toLocaleString()}`
                          : '—'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openDonationForEdit(d)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedDonor} onOpenChange={() => setSelectedDonor(null)}>
        <DialogContent className="sm:max-w-4xl w-[min(100vw-2rem,56rem)] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="font-display">{selectedDonor?.displayName}</DialogTitle>
          </DialogHeader>
          <Button variant="ghost" size="icon" className="absolute right-4 top-4" onClick={() => setSelectedDonor(null)}>
            <X className="h-4 w-4" />
          </Button>
          {selectedDonor && (
            <Tabs defaultValue="donations" className="flex-1 flex flex-col min-h-0 px-6 pb-6">
              <TabsList>
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="donations">Donations</TabsTrigger>
              </TabsList>
              <TabsContent value="profile" className="mt-4 text-sm space-y-2 overflow-y-auto max-h-[50vh]">
                <p><span className="text-muted-foreground">Type:</span> {selectedDonor.supporterType}</p>
                <p><span className="text-muted-foreground">Status:</span> {selectedDonor.status}</p>
                <p><span className="text-muted-foreground">First gift:</span> {selectedDonor.firstDonationDate || '—'}</p>
              </TabsContent>
              <TabsContent value="donations" className="mt-4 space-y-3 overflow-y-auto max-h-[50vh]">
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedDonor(null);
                    setEditingDonation(null);
                    resetDonationForm();
                    setDonationForm((f) => ({ ...f, supporterId: selectedDonor.id }));
                    setDonationDialogOpen(true);
                  }}
                >
                  Add donation for this donor
                </Button>
                {donorDonations.map((d: Donation) => (
                  <div key={d.id} className="flex items-center justify-between text-sm border rounded-md p-2">
                    <div>
                      <p>{d.date}</p>
                      <p className="text-xs text-muted-foreground capitalize">{d.type}</p>
                      {d.campaignName && <p className="text-xs text-muted-foreground">Campaign: {d.campaignName}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">
                        {d.type === 'time' ? `${d.hours ?? d.amount ?? 0} hrs` : d.amount != null ? `₱${d.amount.toLocaleString()}` : d.type}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedDonor(null);
                          openDonationForEdit(d);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteDonationTarget(d)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {donorDonations.length === 0 && <p className="text-sm text-muted-foreground">No donations recorded.</p>}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={donorDialogOpen} onOpenChange={setDonorDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editingDonor ? 'Edit donor' : 'Add donor'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Name</Label>
              <Input value={donorForm.displayName} onChange={(e) => setDonorForm({ ...donorForm, displayName: e.target.value })} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={donorForm.supporterType} onValueChange={(v) => setDonorForm({ ...donorForm, supporterType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {donorTypeValues.filter((t) => t !== 'other').map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">Add new…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {donorForm.supporterType === 'other' && (
              <div>
                <Label>New type</Label>
                <Input value={donorForm.supporterTypeOther} onChange={(e) => setDonorForm({ ...donorForm, supporterTypeOther: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Status</Label>
              <Select value={donorForm.status} onValueChange={(v) => setDonorForm({ ...donorForm, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="inactive">inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Email (optional)</Label>
              <Input value={donorForm.email} onChange={(e) => setDonorForm({ ...donorForm, email: e.target.value })} />
            </div>
            <div>
              <Label>Country</Label>
              <Input value={donorForm.country} onChange={(e) => setDonorForm({ ...donorForm, country: e.target.value })} />
            </div>
            <div>
              <Label>Acquisition channel</Label>
              <Select value={donorForm.acquisitionChannel} onValueChange={(v) => setDonorForm({ ...donorForm, acquisitionChannel: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {channelValues.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">Add new…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {donorForm.acquisitionChannel === 'other' && (
              <div>
                <Label>New channel</Label>
                <Input
                  value={donorForm.acquisitionChannelOther}
                  onChange={(e) => setDonorForm({ ...donorForm, acquisitionChannelOther: e.target.value })}
                />
              </div>
            )}
            <div>
              <Label>First donation date (optional)</Label>
              <Input type="date" value={donorForm.firstDonationDate} onChange={(e) => setDonorForm({ ...donorForm, firstDonationDate: e.target.value })} />
            </div>
            <Button
              onClick={() => saveDonorMutation.mutate()}
              disabled={
                saveDonorMutation.isPending ||
                !donorForm.displayName ||
                (donorForm.supporterType === 'other' && !donorForm.supporterTypeOther)
              }
            >
              {saveDonorMutation.isPending ? 'Saving...' : 'Save donor'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={donationDialogOpen} onOpenChange={setDonationDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editingDonation ? 'Edit donation' : 'Record donation'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Donor</Label>
              <Select value={donationForm.supporterId} onValueChange={(v) => setDonationForm({ ...donationForm, supporterId: v })} disabled={!!editingDonation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select donor" />
                </SelectTrigger>
                <SelectContent>
                  {normalizedSupporters.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Donation type</Label>
              <Select
                value={donationForm.donationType}
                onValueChange={(v) =>
                  setDonationForm({
                    ...donationForm,
                    donationType: v as UiDonationType,
                    amount: v === 'monetary' ? '1000' : '2',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {donationTypeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>
                {donationForm.donationType === 'monetary'
                  ? `Amount (${donationForm.inputCurrency})`
                  : donationForm.donationType === 'time'
                    ? 'Hours'
                    : `Estimated value (${donationForm.inputCurrency})`}
              </Label>
              <Input type="number" min="0.25" step="0.25" value={donationForm.amount} onChange={(e) => setDonationForm({ ...donationForm, amount: e.target.value })} />
            </div>
            {donationForm.donationType !== 'time' && (
              <div>
                <Label>Input currency</Label>
                <Select
                  value={donationForm.inputCurrency}
                  onValueChange={(v) => setDonationForm({ ...donationForm, inputCurrency: v as 'PHP' | 'USD' | 'EUR' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PHP">PHP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Donation date</Label>
              <Input type="date" value={donationForm.donationDate} onChange={(e) => setDonationForm({ ...donationForm, donationDate: e.target.value })} />
            </div>
            <div>
              <Label>Campaign / source (optional)</Label>
              <Input value={donationForm.campaignName} onChange={(e) => setDonationForm({ ...donationForm, campaignName: e.target.value })} />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={donationForm.notes} onChange={(e) => setDonationForm({ ...donationForm, notes: e.target.value })} rows={3} />
            </div>
            <p className="text-xs text-muted-foreground">Stored in PHP for monetary and estimated-value types, matching the donor portal.</p>
            <Button
              onClick={() => saveDonationMutation.mutate()}
              disabled={
                saveDonationMutation.isPending ||
                !donationForm.supporterId ||
                !donationForm.donationDate ||
                !Number(donationForm.amount) ||
                Number(donationForm.amount) <= 0
              }
            >
              {saveDonationMutation.isPending ? 'Saving...' : 'Save donation'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteDonorTarget}
        onClose={() => setDeleteDonorTarget(null)}
        onConfirm={() => deleteDonorTarget && deleteDonorMutation.mutate(deleteDonorTarget.id)}
        title="Delete donor?"
        description={`This will remove ${deleteDonorTarget?.displayName ?? 'this donor'}.`}
      />
      <ConfirmDeleteDialog
        open={!!deleteDonationTarget}
        onClose={() => setDeleteDonationTarget(null)}
        onConfirm={() => deleteDonationTarget && deleteDonationMutation.mutate(deleteDonationTarget.id)}
        title="Delete donation?"
        description="This donation record will be permanently removed."
      />
    </div>
  );
}
