import { useMemo } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { StatCard } from '@/components/StatCard';
import { RiskBadge } from '@/components/RiskBadge';
import {
  fetchResidents,
  fetchDonations,
  fetchImpactStats,
  fetchCaseConferences,
} from '@/lib/api-endpoints';
import type { Donation, Resident } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Users,
  DollarSign,
  AlertTriangle,
  CalendarClock,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Match backend `DateTime.UtcNow.ToString("yyyy-MM")` for monthly donation totals */
function currentUtcMonthPrefix(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

const queryOpts = {
  staleTime: 15_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: true,
  retry: 1,
  placeholderData: keepPreviousData,
} as const;

function deriveFromResidents(residents: Resident[] | undefined) {
  const list = residents ?? [];
  const active = list.filter((r) => r.caseStatus === 'active').length;
  const highRisk = list
    .filter((r) => r.riskLevel === 'high' || r.riskLevel === 'critical')
    .sort((a, b) => a.internalCode.localeCompare(b.internalCode, undefined, { numeric: true }))
    .slice(0, 12);
  return { active, highRisk };
}

function deriveDonations(donations: Donation[] | undefined, monthPrefix: string) {
  const list = donations ?? [];
  const monthlyTotal = list
    .filter((d) => d.date && d.date.startsWith(monthPrefix))
    .reduce((sum, d) => sum + (d.amount ?? 0), 0);
  const recent = [...list]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5);
  return { monthlyTotal, recent };
}

function sortUpcomingConferences(
  rows: { id: string; residentCode: string; date: string; type: string }[] | undefined,
) {
  if (!rows?.length) return [];
  return [...rows].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10);
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const monthPrefix = useMemo(() => currentUtcMonthPrefix(), []);

  const residentsQ = useQuery({
    queryKey: ['residents'],
    queryFn: fetchResidents,
    ...queryOpts,
  });
  const donationsQ = useQuery({
    queryKey: ['donations'],
    queryFn: fetchDonations,
    ...queryOpts,
  });
  const impactQ = useQuery({
    queryKey: ['impact'],
    queryFn: fetchImpactStats,
    ...queryOpts,
  });
  const conferencesQ = useQuery({
    queryKey: ['case-conferences'],
    queryFn: fetchCaseConferences,
    ...queryOpts,
  });

  const { active: activeResidents, highRisk: highRiskResidents } = useMemo(
    () => deriveFromResidents(residentsQ.data),
    [residentsQ.data],
  );

  const { monthlyTotal: monthlyDonationsTotal, recent: recentDonations } = useMemo(
    () => deriveDonations(donationsQ.data, monthPrefix),
    [donationsQ.data, monthPrefix],
  );

  const chartData = impactQ.data?.monthlyTrends ?? [];
  const upcomingConferences = useMemo(
    () => sortUpcomingConferences(conferencesQ.data),
    [conferencesQ.data],
  );
  const impact = impactQ.data;

  const refetching =
    (residentsQ.isFetching && !residentsQ.isPending) ||
    (donationsQ.isFetching && !donationsQ.isPending) ||
    (impactQ.isFetching && !impactQ.isPending) ||
    (conferencesQ.isFetching && !conferencesQ.isPending);

  const handleRefresh = () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ['residents'] }),
      queryClient.invalidateQueries({ queryKey: ['donations'] }),
      queryClient.invalidateQueries({ queryKey: ['impact'] }),
      queryClient.invalidateQueries({ queryKey: ['case-conferences'] }),
    ]);
  };

  const allFailed =
    residentsQ.isError && donationsQ.isError && impactQ.isError && conferencesQ.isError;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Same data as Caseload and Donors: residents, donations, impact trends, and case conferences — refreshed
            together.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-2"
          onClick={() => {
            void handleRefresh();
          }}
        >
          <RefreshCw
            className={cn(
              'h-4 w-4',
              (residentsQ.isFetching || donationsQ.isFetching || impactQ.isFetching || conferencesQ.isFetching) &&
                'animate-spin',
            )}
          />
          Refresh data
        </Button>
      </div>

      {refetching && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          Updating…
        </p>
      )}

      {allFailed && (
        <Alert variant="destructive">
          <AlertTitle>Could not load dashboard</AlertTitle>
          <AlertDescription>
            Start the API (<code className="text-xs">dotnet run</code> in <code className="text-xs">backend</code>), sign
            in as admin, then use Refresh.{' '}
            {[residentsQ.error, donationsQ.error, impactQ.error, conferencesQ.error]
              .filter(Boolean)
              .map((e) => (e instanceof Error ? e.message : String(e)))
              .join(' · ')}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {residentsQ.isPending && !residentsQ.data ? (
          <Skeleton className="h-28 rounded-xl" />
        ) : residentsQ.isError ? (
          <StatCard
            title="Active Residents"
            value="—"
            icon={<Users className="h-6 w-6" />}
            description="Could not load residents"
          />
        ) : (
          <StatCard
            title="Active Residents"
            value={activeResidents}
            icon={<Users className="h-6 w-6" />}
            description="Across all safehouses"
          />
        )}

        {residentsQ.isPending && !residentsQ.data ? (
          <Skeleton className="h-28 rounded-xl" />
        ) : residentsQ.isError ? (
          <StatCard
            title="High/Critical Risk"
            value="—"
            icon={<AlertTriangle className="h-6 w-6" />}
            description="Could not load residents"
          />
        ) : (
          <StatCard
            title="High/Critical Risk"
            value={highRiskResidents.length}
            icon={<AlertTriangle className="h-6 w-6" />}
            description="Requiring attention"
          />
        )}

        {donationsQ.isPending && !donationsQ.data ? (
          <Skeleton className="h-28 rounded-xl" />
        ) : donationsQ.isError ? (
          <StatCard
            title="Donations (this month)"
            value="—"
            icon={<DollarSign className="h-6 w-6" />}
            description="Could not load donations"
          />
        ) : (
          <StatCard
            title="Donations (this month)"
            value={`₱${Math.round(monthlyDonationsTotal).toLocaleString()}`}
            icon={<DollarSign className="h-6 w-6" />}
            description="Monetary total (UTC month)"
          />
        )}

        {impactQ.isPending && !impactQ.data ? (
          <Skeleton className="h-28 rounded-xl" />
        ) : impactQ.isError ? (
          <StatCard
            title="Reintegration Rate"
            value="—"
            icon={<TrendingUp className="h-6 w-6" />}
            description="Impact stats unavailable"
          />
        ) : (
          <StatCard
            title="Reintegration Rate"
            value={`${impact?.reintegrationSuccessRate ?? 0}%`}
            icon={<TrendingUp className="h-6 w-6" />}
            description="Completed / closed cases"
          />
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">IS413 Admin Modules</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-3">
              {[
                { name: 'Donors & Contributions', to: '/admin/donors' },
                { name: 'Caseload Inventory', to: '/admin/caseload' },
                { name: 'Process Recording', to: '/admin/process-recording' },
                { name: 'Home Visitations & Case Conferences', to: '/admin/field-ops' },
                { name: 'Reports & Analytics', to: '/admin/reports' },
                { name: 'Social Media Analytics', to: '/admin/social-media' },
              ].map((module) => (
                <Link
                  key={module.name}
                  to={module.to}
                  className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60"
                >
                  <span>{module.name}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Education & Health Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {impactQ.isPending && !impactQ.data ? (
                <Skeleton className="h-[250px] w-full" />
              ) : impactQ.isError ? (
                <p className="text-sm text-destructive">Could not load impact / trend data.</p>
              ) : chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No trend data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(180 15% 90%)" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} domain={[0, 100]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="education"
                      stroke="hsl(200 65% 55%)"
                      strokeWidth={2}
                      name="Education %"
                    />
                    <Line
                      type="monotone"
                      dataKey="health"
                      stroke="hsl(174 55% 38%)"
                      strokeWidth={2}
                      name="Health %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-risk-high" /> Flagged Residents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {residentsQ.isPending && !residentsQ.data ? (
                <Skeleton className="h-32 w-full" />
              ) : residentsQ.isError ? (
                <p className="text-sm text-destructive">Could not load residents for risk list.</p>
              ) : (
                <div className="space-y-3">
                  {highRiskResidents.map((r) => (
                    <Link
                      key={r.id}
                      to={`/admin/resident/${r.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-sm text-foreground">{r.internalCode}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.safehouse} · {r.assignedSocialWorker}
                        </p>
                      </div>
                      <RiskBadge level={r.riskLevel} />
                    </Link>
                  ))}
                  {highRiskResidents.length === 0 && (
                    <p className="text-sm text-muted-foreground">No high or critical risk residents in the current sample.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Recent Donations</CardTitle>
            </CardHeader>
            <CardContent>
              {donationsQ.isPending && !donationsQ.data ? (
                <Skeleton className="h-40 w-full" />
              ) : donationsQ.isError ? (
                <p className="text-sm text-destructive">Could not load donations.</p>
              ) : (
                <div className="space-y-3">
                  {recentDonations.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium text-sm">{d.donorName}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.date} · {d.type}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-primary">
                        {d.amount != null
                          ? `${d.currency === 'USD' ? '$' : '₱'}${d.amount.toLocaleString()}`
                          : d.type}
                      </span>
                    </div>
                  ))}
                  {recentDonations.length === 0 && (
                    <p className="text-sm text-muted-foreground">No recent donations yet.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-accent" /> Upcoming Conferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              {conferencesQ.isPending && !conferencesQ.data ? (
                <Skeleton className="h-40 w-full" />
              ) : conferencesQ.isError ? (
                <p className="text-sm text-destructive">Could not load case conferences.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingConferences.map((c) => (
                    <div key={c.id} className="p-3 rounded-lg bg-muted/50">
                      <p className="font-medium text-sm">{c.residentCode}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.date} · {c.type}
                      </p>
                    </div>
                  ))}
                  {upcomingConferences.length === 0 && (
                    <p className="text-sm text-muted-foreground">No upcoming case conferences found.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
