import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboard, fetchResidents } from '@/lib/api-endpoints';
import { displaySafehouseName } from '@/lib/safehouseDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  HandCoins,
  MapPinned,
  ArrowRight,
  AlertTriangle,
  CalendarDays,
  TrendingUp,
  ClipboardList,
  Mic2,
} from 'lucide-react';
import type { Resident } from '@/lib/types';

const php = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n);

const crudLinks = [
  { name: 'Caseload inventory', to: '/admin/caseload', icon: Users, description: 'Residents — full profile CRUD' },
  { name: 'Visitations & conferences', to: '/admin/field-ops', icon: MapPinned, description: 'Home visits and case conferences' },
  { name: 'Donors & contributions', to: '/admin/donors', icon: HandCoins, description: 'Donor profiles and donation records' },
  { name: 'Process recording', to: '/admin/caseload', icon: Mic2, description: 'Open a resident to add or edit counseling sessions' },
];

export default function AdminDashboard() {
  const dashQ = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard });
  const resQ = useQuery({ queryKey: ['residents'], queryFn: fetchResidents });

  const residents = resQ.data ?? [];
  const dash = dashQ.data;

  const activeResidents = residents.filter((r: Resident) => r.caseStatus === 'active').length;
  const activeBySafehouse = residents
    .filter((r: Resident) => r.caseStatus === 'active')
    .reduce<Record<string, number>>((acc, r: Resident) => {
      const k = r.safehouse || 'Unknown';
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
  const safehouseRows = Object.entries(activeBySafehouse)
    .sort((a, b) => displaySafehouseName(a[0]).localeCompare(displaySafehouseName(b[0]), undefined, { numeric: true }))
    .slice(0, 8);

  const trend = dash?.educationHealthTrend ?? [];
  const lastTrend = trend.length ? trend[trend.length - 1] : null;
  const prevTrend = trend.length > 1 ? trend[trend.length - 2] : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Admin dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Command center: key counts and trends. Use the links below for create, read, update, and delete on records.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Active residents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resQ.isLoading ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <>
                <p className="text-3xl font-display font-bold tabular-nums">{activeResidents}</p>
                <p className="text-xs text-muted-foreground mt-1">Across all safehouses (case status active)</p>
                {safehouseRows.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground max-h-28 overflow-y-auto">
                    {safehouseRows.map(([name, count]) => (
                      <li key={name} className="flex justify-between gap-2">
                        <span>{displaySafehouseName(name)}</span>
                        <span className="tabular-nums text-foreground">{count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              High / critical risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashQ.isLoading ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <>
                <p className="text-3xl font-display font-bold tabular-nums">{dash?.highRiskResidents.length ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Residents currently flagged high or critical</p>
                <ul className="mt-3 space-y-1 text-xs max-h-28 overflow-y-auto">
                  {(dash?.highRiskResidents ?? []).slice(0, 6).map((r) => (
                    <li key={r.id}>
                      <Link to={`/admin/resident/${r.id}`} className="text-primary hover:underline">
                        {r.internalCode}
                      </Link>
                      <Badge variant="outline" className="ml-2 capitalize text-[10px] py-0">
                        {r.riskLevel}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HandCoins className="h-4 w-4 text-primary" />
              Donations this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashQ.isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <>
                <p className="text-3xl font-display font-bold tabular-nums">{php(dash?.monthlyDonationsTotal ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">Recorded in PHP (calendar month)</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Education / health trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashQ.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : lastTrend ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Latest month</span>
                  <span className="font-medium">
                    Edu {Math.round(lastTrend.education)}% · Health {Math.round(lastTrend.health)}%
                  </span>
                </div>
                {prevTrend && (
                  <div className="flex justify-between gap-4 text-xs text-muted-foreground">
                    <span>Prior</span>
                    <span>
                      Edu {Math.round(prevTrend.education)}% · Health {Math.round(prevTrend.health)}%
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">From public impact snapshots (aggregate)</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No trend data yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Upcoming case conferences
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashQ.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (dash?.upcomingConferences.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming conferences with dates on intervention plans.</p>
            ) : (
              <ul className="space-y-2 text-sm max-h-40 overflow-y-auto">
                {dash!.upcomingConferences.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-2 last:border-0">
                    <span className="font-medium">{c.date}</span>
                    <span className="text-muted-foreground">
                      {c.residentCode} · {c.type}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-display font-semibold text-foreground mb-3">Data entry &amp; CRUD</h2>
        <div className="grid sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {crudLinks.map((item) => (
            <Link key={item.to} to={item.to} className="block">
              <Card className="h-full hover:border-primary/40 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 text-primary shrink-0" />
                      {item.name}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Card className="border-dashed bg-muted/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            Reports &amp; social (ML roadmap)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <Link to="/admin/reports" className="text-primary font-medium hover:underline">
              Reports &amp; Analytics
            </Link>{' '}
            and{' '}
            <Link to="/admin/social-media" className="text-primary font-medium hover:underline">
              Social media analytics
            </Link>{' '}
            stay as placeholders until ML-backed dashboards are wired. Deep donation and resident analytics remain available under Reports API for future use.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
