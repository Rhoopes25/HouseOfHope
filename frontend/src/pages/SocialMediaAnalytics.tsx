import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSocialPosts } from '@/lib/api-endpoints';
import { StatCard } from '@/components/StatCard';
import { PaginationControl, usePagination } from '@/components/PaginationControl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Eye, Users, DollarSign, MousePointerClick, Lightbulb } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

export default function SocialMediaAnalytics() {
  const { data: posts = [], isLoading, error } = useQuery({ queryKey: ['social-posts'], queryFn: fetchSocialPosts });
  const [platformFilter, setPlatformFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('2023-01-01');
  const [dateTo, setDateTo] = useState('2026-12-31');

  const filtered = useMemo(() => posts.filter(p => {
    const matchesPlatform = platformFilter === 'all' || p.platform === platformFilter;
    const d = p.date;
    const matchesFrom = !dateFrom || d >= dateFrom;
    const matchesTo = !dateTo || d <= dateTo;
    return matchesPlatform && matchesFrom && matchesTo;
  }), [posts, platformFilter, dateFrom, dateTo]);

  const { currentPage, setCurrentPage, startIndex, endIndex, pageSize } = usePagination(filtered.length, 5);
  const paginated = filtered.slice(startIndex, endIndex);

  const totalImpressions = filtered.reduce((s, p) => s + p.impressions, 0);
  const totalReach = filtered.reduce((s, p) => s + p.reach, 0);
  const totalReferrals = filtered.reduce((s, p) => s + p.donationReferrals, 0);
  const totalDonationValue = filtered.reduce((s, p) => s + p.estimatedDonationValue, 0);
  const platforms = [...new Set(posts.map(p => p.platform))];

  const engagementByPlatform = platforms.map(platform => {
    const pp = posts.filter(p => p.platform === platform);
    const avgEngagement = pp.length ? pp.reduce((s, p) => s + p.engagementRate, 0) / pp.length : 0;
    return { platform, engagement: +(avgEngagement * 100).toFixed(1) };  });

  const postTypes = [...new Set(posts.map(p => p.postType))];
  const referralsByType = postTypes.map(type => {
    const pp = posts.filter(p => p.postType === type);
    return { type, referrals: pp.reduce((s, p) => s + p.donationReferrals, 0) };
  });

  if (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-bold text-foreground">Social Media Analytics</h1>
        <p className="text-destructive text-sm">Could not load social posts from the API.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold text-foreground">Social Media Analytics</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-auto" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-auto" />
        </div>
        <div>
          <Label className="text-xs">Platform</Label>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Platform" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {platforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {isLoading ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <StatCard title="Total Impressions" value={totalImpressions.toLocaleString()} icon={<Eye className="h-6 w-6" />} />
            <StatCard title="Total Reach" value={totalReach.toLocaleString()} icon={<Users className="h-6 w-6" />} />
            <StatCard title="Donation Referrals" value={totalReferrals} icon={<MousePointerClick className="h-6 w-6" />} />
            <StatCard title="Est. Donation Value" value={`₱${totalDonationValue.toLocaleString()}`} icon={<DollarSign className="h-6 w-6" />} />
            <StatCard title="Posts (filtered)" value={filtered.length} icon={<Lightbulb className="h-6 w-6" />} />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Engagement by Platform</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[280px] w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={engagementByPlatform}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(180 15% 90%)" />
                  <XAxis dataKey="platform" fontSize={11} />
                  <YAxis fontSize={12} tickFormatter={(v) => `${v}%`} />
                  <Tooltip />
                  <Bar dataKey="engagement" fill="hsl(174, 55%, 38%)" name="Avg engagement %" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Referrals by Post Type</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[280px] w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={referralsByType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(180 15% 90%)" />
                  <XAxis dataKey="type" fontSize={10} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="referrals" fill="hsl(200, 65%, 55%)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
        {isLoading ? <Skeleton className="h-64 w-full rounded-xl" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">Referrals</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{p.date}</TableCell>
                  <TableCell><Badge variant="secondary">{p.platform}</Badge></TableCell>
                  <TableCell className="text-sm">{p.postType}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{p.contentTopic}</TableCell>
                  <TableCell className="text-right">{p.impressions.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{p.donationReferrals}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <PaginationControl totalItems={filtered.length} pageSize={pageSize} currentPage={currentPage} onPageChange={setCurrentPage} />
    </div>
  );
}
