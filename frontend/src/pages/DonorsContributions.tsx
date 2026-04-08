import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createDonation, createSupporter, deleteDonation, deleteSupporter, fetchDonations, fetchSupporters, updateDonation, updateSupporter } from '@/lib/api-endpoints';
import { Supporter, Donation } from '@/lib/types';
import { RiskBadge } from '@/components/RiskBadge';
import { PaginationControl, usePagination } from '@/components/PaginationControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, Trash2, Pencil, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';

const supporterTypeOptions = ['monetary', 'in-kind', 'volunteer', 'skills', 'social-media', 'partner', 'other'];
const donationTypeOptions = ['monetary', 'in-kind', 'time', 'skills', 'social-media', 'other'];
const channelOptions = ['web portal', 'referral', 'event', 'social media', 'email', 'other'];

export default function DonorsContributions() {
  const queryClient = useQueryClient();
  const supportersQ = useQuery({ queryKey: ['supporters'], queryFn: fetchSupporters });
  const donationsQ = useQuery({ queryKey: ['donations'], queryFn: fetchDonations });
  const supporters = supportersQ.data ?? [];
  const donations = donationsQ.data ?? [];

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSupporter, setSelectedSupporter] = useState<Supporter | null>(null);
  const [supporterDialogOpen, setSupporterDialogOpen] = useState(false);
  const [donationDialogOpen, setDonationDialogOpen] = useState(false);
  const [editingSupporter, setEditingSupporter] = useState<Supporter | null>(null);
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [deleteSupporterTarget, setDeleteSupporterTarget] = useState<Supporter | null>(null);
  const [deleteDonationTarget, setDeleteDonationTarget] = useState<Donation | null>(null);
  const { toast } = useToast();
  const [supporterForm, setSupporterForm] = useState({
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
    donationType: 'monetary',
    donationTypeOther: '',
    donationDate: new Date().toISOString().slice(0, 10),
    amount: '',
    estimatedValue: '',
    currencyCode: 'PHP',
    campaignName: '',
    notes: '',
  });

  const normalizedSupporters = useMemo(() => supporters, [supporters]);
  const supporterTypeValues = useMemo(
    () => [...new Set([...supporterTypeOptions, ...supporters.map((s) => s.supporterType)])],
    [supporters],
  );
  const donationTypeValues = useMemo(
    () => [...new Set([...donationTypeOptions, ...donations.map((d) => d.type)])],
    [donations],
  );
  const channelValues = useMemo(
    () => [...new Set([...channelOptions, ...supporters.map((s) => (s.acquisitionChannel || '').toLowerCase()).filter(Boolean)])],
    [supporters],
  );
  const normalizedDonations = useMemo(
    () => [...donations].sort((a, b) => (b.date || '').localeCompare(a.date || '') || Number(b.id) - Number(a.id)),
    [donations],
  );

  const filtered = supporters.filter(s => {
    const matchesSearch = s.displayName.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || s.supporterType === typeFilter;
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const { currentPage, setCurrentPage, startIndex, endIndex, pageSize } = usePagination(filtered.length, 10);
  const paginated = filtered.slice(startIndex, endIndex);

  const supporterDonations = selectedSupporter
    ? normalizedDonations.filter((d: Donation) => d.supporterId === selectedSupporter.id)
    : [];

  const resetSupporterForm = () => setSupporterForm({
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
  const resetDonationForm = () => setDonationForm({
    supporterId: '',
    donationType: 'monetary',
    donationTypeOther: '',
    donationDate: new Date().toISOString().slice(0, 10),
    amount: '',
    estimatedValue: '',
    currencyCode: 'PHP',
    campaignName: '',
    notes: '',
  });

  const saveSupporterMutation = useMutation({
    mutationFn: async () => {
      const supporterType = supporterForm.supporterType === 'other' ? supporterForm.supporterTypeOther : supporterForm.supporterType;
      const acquisitionChannel = supporterForm.acquisitionChannel === 'other' ? supporterForm.acquisitionChannelOther : supporterForm.acquisitionChannel;
      const payload = {
        displayName: supporterForm.displayName.trim(),
        supporterType,
        status: supporterForm.status,
        country: supporterForm.country.trim() || undefined,
        email: supporterForm.email.trim() || undefined,
        acquisitionChannel: acquisitionChannel?.trim() || undefined,
        firstDonationDate: supporterForm.firstDonationDate || undefined,
      };
      if (editingSupporter) return updateSupporter(editingSupporter.id, payload);
      return createSupporter(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supporters'] });
      setSupporterDialogOpen(false);
      setEditingSupporter(null);
      resetSupporterForm();
      toast({ title: 'Saved', description: 'Supporter saved successfully.' });
    },
    onError: () => toast({ title: 'Save failed', description: 'Could not save supporter.', variant: 'destructive' }),
  });

  const saveDonationMutation = useMutation({
    mutationFn: async () => {
      const donationTypeRaw = donationForm.donationType === 'other' ? donationForm.donationTypeOther : donationForm.donationType;
      const mapType: Record<string, string> = {
        monetary: 'Monetary',
        'in-kind': 'InKind',
        time: 'Time',
        skills: 'Skills',
        'social-media': 'SocialMedia',
      };
      const payload = {
        supporterId: Number(donationForm.supporterId),
        donationType: mapType[donationTypeRaw] ?? donationTypeRaw,
        donationDate: donationForm.donationDate,
        amount: donationForm.amount ? Number(donationForm.amount) : undefined,
        estimatedValue: donationForm.estimatedValue ? Number(donationForm.estimatedValue) : undefined,
        currencyCode: donationForm.currencyCode || 'PHP',
        campaignName: donationForm.campaignName.trim() || undefined,
        notes: donationForm.notes.trim() || undefined,
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

  const deleteSupporterMutation = useMutation({
    mutationFn: (id: string) => deleteSupporter(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supporters'] });
      setDeleteSupporterTarget(null);
      toast({ title: 'Deleted', description: 'Supporter removed.' });
    },
    onError: () => toast({ title: 'Delete failed', description: 'Could not delete supporter.', variant: 'destructive' }),
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
        <h1 className="text-3xl font-display font-bold text-foreground">Donors & Contributors</h1>
        <p className="text-destructive text-sm">Could not load data from the API.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-display font-bold text-foreground">Donors & Contributors</h1>
        <div className="flex gap-2">
          <Button onClick={() => { setEditingSupporter(null); resetSupporterForm(); setSupporterDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" /> Add Supporter</Button>
          <Button variant="outline" onClick={() => { setEditingDonation(null); resetDonationForm(); setDonationDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" /> Record Donation</Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search supporters..." className="pl-10" value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} />
        </div>
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="monetary">Monetary Donor</SelectItem>
            <SelectItem value="in-kind">In-Kind Donor</SelectItem>
            <SelectItem value="volunteer">Volunteer</SelectItem>
            <SelectItem value="skills">Skills Contributor</SelectItem>
            <SelectItem value="social-media">Social Media Advocate</SelectItem>
            <SelectItem value="partner">Partner Organization</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        {loading ? <Skeleton className="h-64 w-full rounded-xl" /> : (
          <Table className="table-striped">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Churn Risk</TableHead>
                <TableHead className="w-[100px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.displayName}</TableCell>
                  <TableCell className="capitalize">{s.supporterType.replace('-', ' ')}</TableCell>
                  <TableCell><Badge variant={s.status === 'active' ? 'default' : 'secondary'}>{s.status}</Badge></TableCell>
                  <TableCell>{s.country}</TableCell>
                  <TableCell className="text-sm">{s.acquisitionChannel}</TableCell>
                  <TableCell><RiskBadge level={s.churnRisk} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => setSelectedSupporter(s)}>View</Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingSupporter(s);
                          setSupporterForm({
                            displayName: s.displayName,
                            supporterType: supporterTypeOptions.includes(s.supporterType) ? s.supporterType : 'other',
                            supporterTypeOther: supporterTypeOptions.includes(s.supporterType) ? '' : s.supporterType,
                            status: s.status,
                            country: s.country ?? '',
                            email: '',
                            acquisitionChannel: channelOptions.includes((s.acquisitionChannel || '').toLowerCase()) ? s.acquisitionChannel.toLowerCase() : 'other',
                            acquisitionChannelOther: channelOptions.includes((s.acquisitionChannel || '').toLowerCase()) ? '' : (s.acquisitionChannel || ''),
                            firstDonationDate: s.firstDonationDate || '',
                          });
                          setSupporterDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteSupporterTarget(s)}>
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

      <PaginationControl totalItems={filtered.length} pageSize={pageSize} currentPage={currentPage} onPageChange={setCurrentPage} />

      <Dialog open={!!selectedSupporter} onOpenChange={() => setSelectedSupporter(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{selectedSupporter?.displayName}</DialogTitle>
          </DialogHeader>
          <Button variant="ghost" size="icon" className="absolute right-4 top-4" onClick={() => setSelectedSupporter(null)}>
            <X className="h-4 w-4" />
          </Button>
          {selectedSupporter && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Type:</span> {selectedSupporter.supporterType}</div>
                <div><span className="text-muted-foreground">First gift:</span> {selectedSupporter.firstDonationDate}</div>
              </div>
              <Card>
                <CardHeader><CardTitle className="text-base font-display">Donations</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {supporterDonations.map((d: Donation) => (
                    <div key={d.id} className="flex items-center justify-between text-sm border rounded-md p-2">
                      <div>
                        <p>{d.date}</p>
                        <p className="text-xs text-muted-foreground capitalize">{d.type}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">
                          {d.type === 'time' ? `${d.hours ?? d.amount ?? 0} hrs` : d.amount != null ? `₱${d.amount.toLocaleString()}` : d.type}
                        </span>
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingDonation(d);
                          setDonationForm({
                            supporterId: d.supporterId,
                            donationType: donationTypeOptions.includes(d.type) ? d.type : 'other',
                            donationTypeOther: donationTypeOptions.includes(d.type) ? '' : d.type,
                            donationDate: d.date,
                            amount: d.type === 'monetary' ? String(d.amount ?? '') : '',
                            estimatedValue: d.type !== 'monetary' ? String(d.amount ?? d.hours ?? '') : '',
                            currencyCode: d.currency || 'PHP',
                            campaignName: d.campaignName || '',
                            notes: d.notes || '',
                          });
                          setDonationDialogOpen(true);
                        }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteDonationTarget(d)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {supporterDonations.length === 0 && <p className="text-sm text-muted-foreground">No donations recorded.</p>}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={supporterDialogOpen} onOpenChange={setSupporterDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display">{editingSupporter ? 'Edit Supporter' : 'Add Supporter'}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Name</Label><Input value={supporterForm.displayName} onChange={(e) => setSupporterForm({ ...supporterForm, displayName: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={supporterForm.supporterType} onValueChange={(v) => setSupporterForm({ ...supporterForm, supporterType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{supporterTypeValues.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {supporterForm.supporterType === 'other' && <div><Label>New Type</Label><Input value={supporterForm.supporterTypeOther} onChange={(e) => setSupporterForm({ ...supporterForm, supporterTypeOther: e.target.value })} /></div>}
            <div>
              <Label>Status</Label>
              <Select value={supporterForm.status} onValueChange={(v) => setSupporterForm({ ...supporterForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">active</SelectItem><SelectItem value="inactive">inactive</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Email (optional)</Label><Input value={supporterForm.email} onChange={(e) => setSupporterForm({ ...supporterForm, email: e.target.value })} /></div>
            <div><Label>Country</Label><Input value={supporterForm.country} onChange={(e) => setSupporterForm({ ...supporterForm, country: e.target.value })} /></div>
            <div>
              <Label>Acquisition Channel</Label>
              <Select value={supporterForm.acquisitionChannel} onValueChange={(v) => setSupporterForm({ ...supporterForm, acquisitionChannel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{channelValues.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {supporterForm.acquisitionChannel === 'other' && <div><Label>New Channel</Label><Input value={supporterForm.acquisitionChannelOther} onChange={(e) => setSupporterForm({ ...supporterForm, acquisitionChannelOther: e.target.value })} /></div>}
            <div><Label>First Donation Date (optional)</Label><Input type="date" value={supporterForm.firstDonationDate} onChange={(e) => setSupporterForm({ ...supporterForm, firstDonationDate: e.target.value })} /></div>
            <Button
              onClick={() => saveSupporterMutation.mutate()}
              disabled={saveSupporterMutation.isPending || !supporterForm.displayName || (supporterForm.supporterType === 'other' && !supporterForm.supporterTypeOther)}
            >
              {saveSupporterMutation.isPending ? 'Saving...' : 'Save Supporter'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={donationDialogOpen} onOpenChange={setDonationDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display">{editingDonation ? 'Edit Donation' : 'Record Donation'}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Supporter</Label>
              <Select value={donationForm.supporterId} onValueChange={(v) => setDonationForm({ ...donationForm, supporterId: v })}>
                <SelectTrigger><SelectValue placeholder="Select supporter" /></SelectTrigger>
                <SelectContent>
                  {normalizedSupporters.map((s) => <SelectItem key={s.id} value={s.id}>{s.displayName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Donation Type</Label>
              <Select value={donationForm.donationType} onValueChange={(v) => setDonationForm({ ...donationForm, donationType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{donationTypeValues.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {donationForm.donationType === 'other' && <div><Label>New Donation Type</Label><Input value={donationForm.donationTypeOther} onChange={(e) => setDonationForm({ ...donationForm, donationTypeOther: e.target.value })} /></div>}
            <div><Label>Date</Label><Input type="date" value={donationForm.donationDate} onChange={(e) => setDonationForm({ ...donationForm, donationDate: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount</Label><Input type="number" value={donationForm.amount} onChange={(e) => setDonationForm({ ...donationForm, amount: e.target.value })} /></div>
              <div><Label>Estimated Value</Label><Input type="number" value={donationForm.estimatedValue} onChange={(e) => setDonationForm({ ...donationForm, estimatedValue: e.target.value })} /></div>
            </div>
            <div><Label>Currency</Label><Input value={donationForm.currencyCode} onChange={(e) => setDonationForm({ ...donationForm, currencyCode: e.target.value })} /></div>
            <div><Label>Campaign</Label><Input value={donationForm.campaignName} onChange={(e) => setDonationForm({ ...donationForm, campaignName: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={donationForm.notes} onChange={(e) => setDonationForm({ ...donationForm, notes: e.target.value })} /></div>
            <Button
              onClick={() => saveDonationMutation.mutate()}
              disabled={saveDonationMutation.isPending || !donationForm.supporterId || !donationForm.donationDate || (donationForm.donationType === 'other' && !donationForm.donationTypeOther)}
            >
              {saveDonationMutation.isPending ? 'Saving...' : 'Save Donation'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteSupporterTarget}
        onClose={() => setDeleteSupporterTarget(null)}
        onConfirm={() => deleteSupporterTarget && deleteSupporterMutation.mutate(deleteSupporterTarget.id)}
        title="Delete supporter?"
        description={`This will remove ${deleteSupporterTarget?.displayName ?? 'this supporter'}.`}
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
