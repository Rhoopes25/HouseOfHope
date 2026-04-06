import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatCard } from '@/components/StatCard';
import { fetchReportsAnalytics } from '@/lib/api-endpoints';
import { Users, DollarSign, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

const COLORS = ['hsl(174, 55%, 38%)', 'hsl(200, 65%, 55%)', 'hsl(12, 70%, 65%)', 'hsl(35, 40%, 60%)', 'hsl(142, 60%, 45%)'];

export default function ReportsAnalytics() {
  const [dateFrom, setDateFrom] = useState('2024-01-01');
  const [dateTo, setDateTo] = useState('2024-09-30');
  const { data, isLoading, error } = useQuery({ queryKey: ['reports-analytics'], queryFn: fetchReportsAnalytics });

  const summary = data?.summary;
  const donationByType = useMemo(() => {
    const rows = data?.donationsByType ?? [];
    const total = rows.reduce((s, r) => s + r.value, 0) || 1;
    return rows.map(r => ({ name: r.name, value: Math.round((r.value / total) * 100) }));
  }, [data?.donationsByType]);

  if (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-bold text-foreground">Reports & Analytics</h1>
        <p className="text-destructive text-sm">Could not load reports from the API.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold text-foreground">Reports & Analytics</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-auto" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-auto" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard title="Total Residents Served" value={summary?.totalResidentsServed ?? 0} icon={<Users className="h-6 w-6" />} />
            <StatCard title="Total Donations" value={`₱${((summary?.totalDonationsReceived ?? 0) / 1000).toFixed(0)}K`} icon={<DollarSign className="h-6 w-6" />} />
            <StatCard title="Reintegration Success" value={`${summary?.reintegrationSuccessRate ?? 0}%`} icon={<TrendingUp className="h-6 w-6" />} />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Donation Trends</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[280px] w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={summary?.monthlyTrends ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(180 15% 90%)" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={v => `₱${v / 1000}K`} />
                  <Tooltip formatter={(v: number) => `₱${v.toLocaleString()}`} />
                  <Line type="monotone" dataKey="donations" stroke="hsl(174, 55%, 38%)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Donations by Type</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[280px] w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={donationByType} cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name} ${value}%`} dataKey="value">
                    {donationByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Education & Health Over Time</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[280px] w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={summary?.monthlyTrends ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(180 15% 90%)" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="education" stroke="hsl(200, 65%, 55%)" strokeWidth={2} name="Education %" />
                  <Line type="monotone" dataKey="health" stroke="hsl(174, 55%, 38%)" strokeWidth={2} name="Health %" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Safehouse Performance</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[280px] w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data?.safehouseComparison ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(180 15% 90%)" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="reintegration" fill="hsl(174, 55%, 38%)" name="Reintegration %" />
                  <Bar dataKey="education" fill="hsl(200, 65%, 55%)" name="Education %" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Reintegration Success by Type</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[280px] w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data?.reintegrationByType ?? []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(180 15% 90%)" />
                  <XAxis type="number" domain={[0, 100]} fontSize={12} />
                  <YAxis type="category" dataKey="name" fontSize={11} width={120} />
                  <Tooltip />
                  <Bar dataKey="rate" fill="hsl(174, 55%, 38%)" name="Success Rate %" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Incidents by Type & Severity</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[280px] w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data?.incidentsByType ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(180 15% 90%)" />
                  <XAxis dataKey="type" fontSize={10} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="low" fill="hsl(142, 60%, 45%)" name="Low" stackId="a" />
                  <Bar dataKey="medium" fill="hsl(45, 90%, 50%)" name="Medium" stackId="a" />
                  <Bar dataKey="high" fill="hsl(0, 72%, 55%)" name="High" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
