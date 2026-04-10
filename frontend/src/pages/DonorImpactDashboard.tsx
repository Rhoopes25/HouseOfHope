import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatCard } from '@/components/StatCard';
import { fetchImpactStats } from '@/lib/api-endpoints';
import { Users, DollarSign, GraduationCap, HeartPulse, Heart } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

const EXCHANGE_RATES: Record<'PHP' | 'USD' | 'EUR', number> = {
  PHP: 1,
  USD: 1 / 56,
  EUR: 1 / 61,
};

const CURRENCY_SYMBOLS: Record<'PHP' | 'USD' | 'EUR', string> = {
  PHP: '₱',
  USD: '$',
  EUR: '€',
};

function formatDonationAxisValue(value: number, currency: 'PHP' | 'USD' | 'EUR'): string {
  const sym = CURRENCY_SYMBOLS[currency];
  const v = Math.abs(value);
  if (v >= 1000) {
    return `${sym}${(value / 1000).toFixed(v >= 10000 ? 0 : 1)}K`;
  }
  return `${sym}${Math.round(value).toLocaleString()}`;
}

function formatDonationTooltipValue(value: number, currency: 'PHP' | 'USD' | 'EUR'): string {
  const sym = CURRENCY_SYMBOLS[currency];
  return `${sym}${Math.round(value).toLocaleString()}`;
}

function formatPercentTooltip(value: number | string | undefined): string {
  if (value === undefined || value === null) return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return '—';
  return `${Math.round(n)}%`;
}

export default function DonorImpactDashboard() {
  const [currency, setCurrency] = useState<'PHP' | 'USD' | 'EUR'>('PHP');
  const { data: impact, isLoading, error } = useQuery({ queryKey: ['impact'], queryFn: fetchImpactStats });

  const chartData = useMemo(() => {
    const trends = impact?.monthlyTrends ?? [];
    const rate = EXCHANGE_RATES[currency];
    return trends.map((t) => ({
      ...t,
      donationsDisplay: (t.donations ?? 0) * rate,
    }));
  }, [impact?.monthlyTrends, currency]);

  const periodCaption = useMemo(() => {
    const trends = impact?.monthlyTrends ?? [];
    if (trends.length < 2) return null;
    return `${trends[0].month} – ${trends[trends.length - 1].month}`;
  }, [impact?.monthlyTrends]);

  if (error) {
    return (
      <div className="gradient-warm py-12 min-h-screen">
        <div className="container mx-auto px-4 max-w-lg text-center space-y-3">
          <p className="text-destructive font-medium">Unable to load impact data.</p>
          <p className="text-sm text-foreground/80">
            The browser could not reach the API. For local development, start the backend on{' '}
            <span className="font-mono">http://localhost:4000</span> so Vite can proxy{' '}
            <span className="font-mono">/api</span> (see <span className="font-mono">vite.config.ts</span>
            ).
          </p>
        </div>
      </div>
    );
  }

  const rawDonations = impact?.totalDonationsReceived ?? 0;
  const convertedDonations = rawDonations * EXCHANGE_RATES[currency];
  const formattedDonations = `${CURRENCY_SYMBOLS[currency]}${(convertedDonations / 1000).toFixed(0)}K`;

  return (
    <div className="gradient-warm py-12 min-h-screen">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-display font-bold text-foreground">Our Impact</h1>
          <p className="text-foreground/70 mt-3 max-w-xl mx-auto">
            See how your support transforms lives. All data is anonymized to protect the privacy of the girls we serve.
          </p>
          <div className="mt-4 flex justify-center items-center gap-2 flex-wrap">
            <label htmlFor="currency-select" className="text-sm text-foreground/70">
              Display currency:
            </label>
            <select
              id="currency-select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as 'PHP' | 'USD' | 'EUR')}
              className="text-sm border rounded-md px-2 py-1 bg-background text-foreground"
              aria-label="Select display currency"
            >
              <option value="PHP">₱ PHP</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
            </select>
          </div>
          {periodCaption && (
            <p className="text-xs text-foreground/60 mt-2">
              Charts show the last 12 complete calendar months ({periodCaption}). The current month is omitted until it
              closes. Amounts are stored in PHP; other currencies use fixed display rates for illustration.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
          {isLoading ? (
            [...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : (
            <>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
                <StatCard
                  title="Total Residents Served"
                  value={impact?.totalResidentsServed ?? 0}
                  icon={<Users className="h-6 w-6" aria-hidden="true" />}
                  metricHint="Total number of resident profiles in the system (each person counted once). This is an aggregate count with no names or identifiers shown."
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <StatCard
                  title="Total Donations"
                  value={formattedDonations}
                  icon={<DollarSign className="h-6 w-6" aria-hidden="true" />}
                  metricHint="Sum of logged contribution values: monetary amounts plus estimated PHP values for in-kind, time, skills, and similar entries as recorded in the database. Display currency applies a fixed conversion from PHP for this view only."
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <StatCard
                  title="Education Rate"
                  value={`${impact?.educationEnrollmentRate ?? 0}%`}
                  icon={<GraduationCap className="h-6 w-6" aria-hidden="true" />}
                  metricHint="Average of all recorded education progress percentages (0–100%) across education records in the database, rounded to a whole percent for the headline figure."
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <StatCard
                  title="Health Improvement"
                  value={`${impact?.healthImprovementRate ?? 0}%`}
                  icon={<HeartPulse className="h-6 w-6" aria-hidden="true" />}
                  metricHint="Average of recorded general health scores, mapped from the roughly 0–5 scale to 0–100% and rounded. Based on health and wellbeing records in the database."
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <StatCard
                  title="Donor Retention Rate"
                  value={`${impact?.donorRetentionRate ?? 0}%`}
                  icon={<Heart className="h-6 w-6" aria-hidden="true" />}
                  metricHint="Of supporters who had at least one donation dated in the previous calendar year (UTC), the share who also had at least one donation dated in the current calendar year. Uses anonymized supporter IDs only."
                />
              </motion.div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">
                <h2 className="text-lg font-display font-semibold">Donations Over Time</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} aria-label="Donations over time chart">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(180 15% 90%)" />
                    <XAxis
                      dataKey="month"
                      fontSize={11}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis
                      fontSize={12}
                      tickFormatter={(v: number) => formatDonationAxisValue(v, currency)}
                    />
                    <Tooltip
                      formatter={(v: number) => formatDonationTooltipValue(v, currency)}
                      labelFormatter={(label) => String(label)}
                    />
                    <Line
                      type="monotone"
                      dataKey="donationsDisplay"
                      stroke="hsl(174 55% 38%)"
                      strokeWidth={3}
                      dot={{ fill: 'hsl(174 55% 38%)' }}
                      name={`Donations (${currency})`}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">
                <h2 className="text-lg font-display font-semibold">Education &amp; Health Progress</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} aria-label="Education and health progress chart">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(180 15% 90%)" />
                    <XAxis
                      dataKey="month"
                      fontSize={11}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis fontSize={12} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      formatter={(value: number | string, name: string) => {
                        const pct = formatPercentTooltip(value);
                        return [pct, name];
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="education"
                      stroke="hsl(200 65% 55%)"
                      strokeWidth={3}
                      name="Education %"
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="health"
                      stroke="hsl(174 55% 38%)"
                      strokeWidth={3}
                      name="Health %"
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
