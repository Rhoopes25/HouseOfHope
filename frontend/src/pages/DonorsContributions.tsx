import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDonations, fetchSupporters } from '@/lib/api-endpoints';
import { Supporter, Donation } from '@/lib/types';
import { RiskBadge } from '@/components/RiskBadge';
import { PaginationControl, usePagination } from '@/components/PaginationControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function DonorsContributions() {
  const supportersQ = useQuery({ queryKey: ['supporters'], queryFn: fetchSupporters });
  const donationsQ = useQuery({ queryKey: ['donations'], queryFn: fetchDonations });
  const supporters = supportersQ.data ?? [];
  const donations = donationsQ.data ?? [];

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSupporter, setSelectedSupporter] = useState<Supporter | null>(null);
  const { toast } = useToast();

  const filtered = supporters.filter(s => {
    const matchesSearch = s.displayName.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || s.supporterType === typeFilter;
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const { currentPage, setCurrentPage, startIndex, endIndex, pageSize } = usePagination(filtered.length, 10);
  const paginated = filtered.slice(startIndex, endIndex);

  const supporterDonations = selectedSupporter
    ? donations.filter((d: Donation) => d.supporterId === selectedSupporter.id)
    : [];

  const comingSoon = () => toast({ title: 'Coming soon', description: 'This form will be available when write APIs are enabled.' });

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
          <Button onClick={comingSoon}><Plus className="h-4 w-4 mr-2" /> Add Supporter</Button>
          <Button variant="outline" onClick={comingSoon}><Plus className="h-4 w-4 mr-2" /> Record Donation</Button>
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
                    <Button variant="outline" size="sm" onClick={() => setSelectedSupporter(s)}>View</Button>
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
                    <div key={d.id} className="flex justify-between text-sm">
                      <span>{d.date}</span>
                      <span className="font-medium">
                        {d.amount != null ? `₱${d.amount.toLocaleString()}` : d.type}
                      </span>
                    </div>
                  ))}
                  {supporterDonations.length === 0 && <p className="text-sm text-muted-foreground">No donations recorded.</p>}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
