import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { StatCard } from '@/components/StatCard';
import { RiskBadge } from '@/components/RiskBadge';
import { fetchDashboard, fetchImpactStats, fetchResidents } from '@/lib/api-endpoints';
import { Users, DollarSign, AlertTriangle, CalendarClock, TrendingUp, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

const RATES: Record<string, number> = { PHP: 1, USD: 1 / 56, EUR: 1 / 61 };
const SYMBOLS: Record<string, string> = { PHP: '₱', USD: '$', EUR: '€' };

function formatDonation(value: number, currency: string) {
  const converted = value * RATES[currency];
  if (converted >= 1_000_000) return `${SYMBOLS[currency]}${(converted / 1_000_000).toFixed(1)}M`;
  if (converted >= 1_000) return `${SYMBOLS[currency]}${(converted / 1_000).toFixed(0)}K`;
  return `${SYMBOLS[currency]}${converted.toFixed(0)}`;
}

export default function AdminDashboard() {
  const [currency, setCurrency] = useState<'PHP' | 'USD' | 'EUR'>('PHP');
  const residentsQ = useQuery({ queryKey: ['residents'], queryFn: fetchResidents });
  const impactQ = useQuery({ queryKey: ['impact'], queryFn: fetchImpactStats });
  const dashQ = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard });

  const residents = residentsQ.data;
  const impact = impactQ.data;
  const dash = dashQ.data;

  const activeResidents = residents?.filter(r => r.caseStatus === 'active').length ?? 0;
  const highRiskResidents = dash?.highRiskResidents ?? [];
  const recentDonations = dash?.recentDonations ?? [];
  const monthlyDonationsTotal = dash?.monthlyDonationsTotal ?? 0;
  const chartData = dash?.educationHealthTrend?.length
      ? dash.educationHealthTrend
      : impact?.monthlyTrends ?? [];
  const upcomingConferences = dash?.upcomingConferences ?? [];

  const loading = residentsQ.isLoading || impactQ.isLoading || dashQ.isLoading;
  const err = residentsQ.error || impactQ.error || dashQ.error;

  if (err) {
    const detail = [residentsQ.error, impactQ.error, dashQ.error]
        .filter(Boolean)
        .map(e => (e instanceof Error ? e.message : String(e)))
        .join(" · ");
    return (
        <div className="space-y-2 max-w-2xl">
          <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-destructive text-sm">
            Could not load dashboard data. Start the API from the <code className="text-xs">backend</code> folder
            (<code className="text-xs">dotnet run</code> → http://localhost:4000), then refresh.
          </p>
          <p className="text-xs text-muted-foreground font-mono break-all">{detail}</p>
        </div>
    );
  }

  return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-display font-bold text-foreground">Admin Command Center</h1>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Currency</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as 'PHP' | 'USD' | 'EUR')}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PHP">₱ PHP</SelectItem>
                <SelectItem value="USD">$ USD</SelectItem>
                <SelectItem value="EUR">€ EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
              [...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : (
              <>
                <StatCard title="Active Residents" value={activeResidents} icon={<Users className="h-6 w-6" />} description="Across all safehouses" />
                <StatCard title="High/Critical Risk" value={highRiskResidents.length} icon={<AlertTriangle className="h-6 w-6" />} description="Requiring attention" />
                <StatCard title="Donations (this month)" value={formatDonation(monthlyDonationsTotal, currency)} icon={<DollarSign className="h-6 w-6" />} description="Monetary & estimated value" />
                <StatCard title="Reintegration Rate" value={`${impact?.reintegrationSuccessRate ?? 0}%`} icon={<TrendingUp className="h-6 w-6" />} description="Completed / closed cases" />
              </>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Admin Modules</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-3">
                {[
                  { name: 'Donors & Contributions', to: '/admin/donors' },
                  { name: 'Caseload Inventory', to: '/admin/caseload' },
                  { name: 'Process Recording', to: '/admin/caseload' },
                  { name: 'Home Visitations & Case Conferences', to: '/admin/field-ops' },
                  { name: 'Reports & Analytics', to: '/admin/reports' },
                ].map((module) => (
                    <Link key={module.name} to={module.to} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60">
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
                {loading ? (
                    <Skeleton className="h-[250px] w-full" />
                ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(180 15% 90%)" />
                        <XAxis dataKey="month" fontSize={12} />
                        <YAxis fontSize={12} domain={[0, 100]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="education" stroke="hsl(200 65% 55%)" strokeWidth={2} name="Education %" />
                        <Line type="monotone" dataKey="health" stroke="hsl(174 55% 38%)" strokeWidth={2} name="Health %" />
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
                {loading ? (
                    <Skeleton className="h-32 w-full" />
                ) : (
                    <div className="space-y-3">
                      {highRiskResidents.map(r => (
                          <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div>
                              <p className="font-medium text-sm">{r.internalCode}</p>
                              <p className="text-xs text-muted-foreground">{r.safehouse} · {r.assignedSocialWorker}</p>
                            </div>
                            <RiskBadge level={r.riskLevel} />
                          </div>
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
                {loading ? (
                    <Skeleton className="h-40 w-full" />
                ) : (
                    <div className="space-y-3">
                      {recentDonations.map(d => (
                          <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div>
                              <p className="font-medium text-sm">{d.donorName}</p>
                              <p className="text-xs text-muted-foreground">{d.date} · {d.type}</p>
                            </div>
                            <span className="text-sm font-semibold text-primary">
                        {d.amount != null ? `${d.currency === 'USD' ? '$' : '₱'}${d.amount.toLocaleString()}` : d.type}
                      </span>
                          </div>
                      ))}
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
                {loading ? (
                    <Skeleton className="h-40 w-full" />
                ) : (
                    <div className="space-y-3">
                      {upcomingConferences.map(c => (
                          <div key={c.id} className="p-3 rounded-lg bg-muted/50">
                            <p className="font-medium text-sm">{c.residentCode}</p>
                            <p className="text-xs text-muted-foreground">{c.date} · {c.type}</p>
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