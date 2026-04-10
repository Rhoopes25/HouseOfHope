import { useMemo, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { StatCard } from '@/components/StatCard';
import { RiskBadge } from '@/components/RiskBadge';
import { fetchResidents, fetchDonations, fetchCaseConferences } from '@/lib/api-endpoints';
import type { Donation, Resident } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Users,
  DollarSign,
  AlertTriangle,
  CalendarClock,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { displaySafehouseName } from '@/lib/safehouseDisplay';
import {
  CURRENCY_SYMBOLS,
  convertFromPhp,
  formatCurrency,
  normalizeToPhp,
  type SupportedCurrency,
  toSupportedCurrency,
} from '@/lib/currency';

/** Match backend `DateTime.UtcNow.ToString("yyyy-MM")` for monthly donation totals */
function currentUtcMonthPrefix(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** Site theme: primary teal + accent blue (see index.css --primary / --accent) */
const BAR_FILLS = [
  'hsl(174 55% 38%)',
  'hsl(200 65% 55%)',
  'hsl(174 48% 46%)',
  'hsl(200 58% 48%)',
  'hsl(174 42% 52%)',
  'hsl(200 50% 52%)',
];

const queryOpts = {
  staleTime: 15_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: true,
  retry: 1,
  placeholderData: keepPreviousData,
} as const;

function activeResidentsBySafehouse(residents: Resident[] | undefined) {
  const list = (residents ?? []).filter((r) => r.caseStatus === 'active');
  const map = new Map<string, number>();
  for (const r of list) {
    const rawName = (r.safehouse || 'Unknown').trim() || 'Unknown';
    const name = displaySafehouseName(rawName) || 'Unknown';
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function deriveFromResidents(residents: Resident[] | undefined) {
  const list = residents ?? [];
  const activeList = list.filter((r) => r.caseStatus === 'active');
  const active = activeList.length;
  const safehouseSet = new Set(
    activeList.map((r) => (r.safehouse || '').trim()).filter(Boolean),
  );
  const riskRank = (level: Resident['riskLevel']) => (level === 'critical' ? 2 : level === 'high' ? 1 : 0);
  const highRisk = list
    .filter((r) => r.riskLevel === 'high' || r.riskLevel === 'critical')
    .sort((a, b) => {
      const rankDiff = riskRank(b.riskLevel) - riskRank(a.riskLevel);
      if (rankDiff !== 0) return rankDiff;
      return a.internalCode.localeCompare(b.internalCode, undefined, { numeric: true });
    })
    .slice(0, 8);
  const bySafehouse = activeResidentsBySafehouse(residents);
  return {
    active,
    safehouseCount: safehouseSet.size,
    highRisk,
    bySafehouse,
  };
}

function deriveDonations(donations: Donation[] | undefined, monthPrefix: string) {
  const list = donations ?? [];
  const monthlyTotalPhp = list
    .filter((d) => d.date && d.date.startsWith(monthPrefix))
    .reduce((sum, d) => sum + normalizeToPhp(d.amount ?? 0, d.currency), 0);
  const recent = [...list]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 8);
  return { monthlyTotalPhp, recent };
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const monthPrefix = useMemo(() => currentUtcMonthPrefix(), []);
  const [displayCurrency, setDisplayCurrency] = useState<SupportedCurrency>('PHP');

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
  const conferencesQ = useQuery({
    queryKey: ['case-conferences', 'future'],
    queryFn: () => fetchCaseConferences({ futureOnly: true }),
    ...queryOpts,
  });

  const { active: activeResidents, safehouseCount, highRisk: highRiskResidents, bySafehouse } =
    useMemo(() => deriveFromResidents(residentsQ.data), [residentsQ.data]);

  const { monthlyTotalPhp, recent: recentDonations } = useMemo(
    () => deriveDonations(donationsQ.data, monthPrefix),
    [donationsQ.data, monthPrefix],
  );
  const monthlyDonationsDisplay = useMemo(
    () => convertFromPhp(monthlyTotalPhp, displayCurrency),
    [monthlyTotalPhp, displayCurrency],
  );

  const upcomingConferences = conferencesQ.data ?? [];

  const refetching =
    (residentsQ.isFetching && !residentsQ.isPending) ||
    (donationsQ.isFetching && !donationsQ.isPending) ||
    (conferencesQ.isFetching && !conferencesQ.isPending);

  const handleRefresh = () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ['residents'] }),
      queryClient.invalidateQueries({ queryKey: ['donations'] }),
      queryClient.invalidateQueries({ queryKey: ['case-conferences'] }),
    ]);
  };

  const allFailed = residentsQ.isError && donationsQ.isError && conferencesQ.isError;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Admin dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Command center for daily operations: active caseload by safehouse, donations, residents who need attention,
            and upcoming conferences.
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
              (residentsQ.isFetching || donationsQ.isFetching || conferencesQ.isFetching) && 'animate-spin',
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
            {[residentsQ.error, donationsQ.error, conferencesQ.error]
              .filter(Boolean)
              .map((e) => (e instanceof Error ? e.message : String(e)))
              .join(' · ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Donations spans 2 columns on large screens so long PHP totals don’t overflow */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {residentsQ.isPending && !residentsQ.data ? (
          <Skeleton className="h-28 rounded-xl" />
        ) : residentsQ.isError ? (
          <StatCard
            title="Active residents"
            value="—"
            icon={<Users className="h-6 w-6" />}
            description="Could not load residents"
          />
        ) : (
          <StatCard
            title="Active residents"
            value={activeResidents}
            icon={<Users className="h-6 w-6" />}
            description={
              safehouseCount > 0
                ? `Across ${safehouseCount} safehouse${safehouseCount === 1 ? '' : 's'}`
                : 'No active cases'
            }
          />
        )}

        {residentsQ.isPending && !residentsQ.data ? (
          <Skeleton className="h-28 rounded-xl" />
        ) : residentsQ.isError ? (
          <StatCard
            title="High / critical risk"
            value="—"
            icon={<AlertTriangle className="h-6 w-6" />}
            description="Could not load residents"
          />
        ) : (
          <StatCard
            title="High / critical risk"
            value={highRiskResidents.length}
            icon={<AlertTriangle className="h-6 w-6" />}
            description="Needs follow-up"
          />
        )}

        {donationsQ.isPending && !donationsQ.data ? (
          <Skeleton className="h-28 rounded-xl col-span-2" />
        ) : donationsQ.isError ? (
          <StatCard
            className="col-span-2"
            title="Donations (this month)"
            value="—"
            icon={<DollarSign className="h-6 w-6" />}
            description="Could not load donations"
          />
        ) : (
          <div className="col-span-2 relative">
            <StatCard
              className="pb-10"
              title="Donations (this month)"
              value={formatCurrency(monthlyDonationsDisplay, displayCurrency)}
              icon={<DollarSign className="h-6 w-6" />}
              description={`Monetary total ${displayCurrency}`}
              valueClassName="text-2xl sm:text-3xl lg:text-4xl break-words"
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-1">
              {(['PHP', 'USD', 'EUR'] as SupportedCurrency[]).map((currency) => (
                <Button
                  key={currency}
                  type="button"
                  variant={displayCurrency === currency ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDisplayCurrency(currency)}
                  aria-pressed={displayCurrency === currency}
                  className="h-7 px-2 text-xs"
                >
                  {CURRENCY_SYMBOLS[currency]} {currency}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 lg:items-stretch">
        <Card className="flex h-full min-h-0 flex-col">
          <CardHeader>
            <CardTitle className="font-display text-lg">Recent donations</CardTitle>
            <p className="text-xs text-muted-foreground font-normal">Latest logged contributions (all types)</p>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col min-h-0">
            {donationsQ.isPending && !donationsQ.data ? (
              <Skeleton className="min-h-[200px] flex-1 w-full" />
            ) : donationsQ.isError ? (
              <p className="text-sm text-destructive">Could not load donations.</p>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {recentDonations.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50 min-w-0"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{d.donorName}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.date} · {d.type}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-primary shrink-0 tabular-nums">
                        {d.amount != null
                          ? `${CURRENCY_SYMBOLS[toSupportedCurrency(d.currency)]}${d.amount.toLocaleString()}`
                          : d.type}
                      </span>
                    </div>
                  ))}
                  {recentDonations.length === 0 && (
                    <p className="text-sm text-muted-foreground">No donations recorded yet.</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex h-full min-h-0 flex-col">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-risk-high" /> Flagged residents
            </CardTitle>
            <p className="text-xs text-muted-foreground font-normal">High or critical risk — open a resident for actions</p>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col min-h-0">
            {residentsQ.isPending && !residentsQ.data ? (
              <Skeleton className="min-h-[200px] flex-1 w-full" />
            ) : residentsQ.isError ? (
              <p className="text-sm text-destructive">Could not load residents for risk list.</p>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="space-y-3">
                  {highRiskResidents.map((r) => (
                    <Link
                      key={r.id}
                      to={`/admin/resident/${r.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground">{r.internalCode}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {displaySafehouseName(r.safehouse)} · {r.assignedSocialWorker}
                        </p>
                      </div>
                      <RiskBadge level={r.riskLevel} />
                    </Link>
                  ))}
                  {highRiskResidents.length === 0 && (
                    <p className="text-sm text-muted-foreground">No high or critical risk residents in the current list.</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Active residents by safehouse</CardTitle>
          <p className="text-xs text-muted-foreground font-normal">
            Distribution of open cases — use Caseload for detail
          </p>
        </CardHeader>
        <CardContent>
          {residentsQ.isPending && !residentsQ.data ? (
            <Skeleton className="h-[280px] w-full" />
          ) : residentsQ.isError ? (
            <p className="text-sm text-destructive">Could not load residents.</p>
          ) : bySafehouse.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No active residents to chart.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={bySafehouse}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                aria-label="Active residents by safehouse"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" allowDecimals={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                  interval={0}
                />
                <Tooltip
                  formatter={(value: number) => [value, 'Active residents']}
                  labelFormatter={(label) => String(label)}
                  contentStyle={{
                    borderRadius: 'var(--radius)',
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                  }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {bySafehouse.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={BAR_FILLS[i % BAR_FILLS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-accent" /> Upcoming case conferences
          </CardTitle>
          <p className="text-xs text-muted-foreground font-normal">Scheduled on or after today (UTC)</p>
        </CardHeader>
        <CardContent>
          {conferencesQ.isPending && !conferencesQ.data ? (
            <Skeleton className="h-24 w-full" />
          ) : conferencesQ.isError ? (
            <p className="text-sm text-destructive">Could not load case conferences.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {upcomingConferences.map((c) => (
                <div
                  key={c.id}
                  className="inline-flex flex-col rounded-lg border bg-muted/40 px-3 py-2 text-sm min-w-[200px]"
                >
                  <span className="font-medium">{c.residentCode}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.date} · {c.type}
                  </span>
                </div>
              ))}
              {upcomingConferences.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No upcoming conferences with a future date. Add dates on intervention plans in Field ops.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
