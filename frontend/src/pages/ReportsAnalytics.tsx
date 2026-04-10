import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingDown, Users, Sparkles, RefreshCw, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchChurnRisks, fetchSafehousePerformance, fetchSupporters, type SafehousePerformanceMlRow } from '@/lib/api-endpoints';
import type { Supporter } from '@/lib/types';
import { displaySafehouseName } from '@/lib/safehouseDisplay';

interface ChurnResult {
  modelAvailable: boolean;
  supporterId: number;
  riskScore: number;
  riskTier: 'low' | 'medium' | 'high' | 'unknown';
  topDrivers: string[];
  recommendedActions: string[];
  scoredAtUtc: string;
}

function RiskBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    high: 'bg-red-100 text-red-700 border border-red-200',
    medium: 'bg-amber-50 text-amber-700 border border-amber-200',
    low: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    unknown: 'bg-gray-100 text-gray-500 border border-gray-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${styles[tier] ?? styles.unknown}`}>
      {tier}
    </span>
  );
}

function ScoreBar({ score, tier }: { score: number; tier: string }) {
  const pct = Math.round(score * 100);
  const color = tier === 'high' ? 'bg-red-400' : tier === 'medium' ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-7 text-right">{pct}%</span>
    </div>
  );
}

function removeOutdatedLighthouseTerm(value: string | undefined | null): string {
  if (!value) return '';
  return value.replace(/\bLighthouse\b/gi, 'Safehouse');
}

export default function ReportsAnalytics() {
  const churnQ = useQuery({
    queryKey: ['churnRisks'],
    queryFn: fetchChurnRisks,
    staleTime: 1000 * 60 * 5,
  });

  const safehouseQ = useQuery({
    queryKey: ['safehousePerformance'],
    queryFn: fetchSafehousePerformance,
    staleTime: 1000 * 60 * 5,
  });

  const supportersQ = useQuery({
    queryKey: ['supporters'],
    queryFn: fetchSupporters,
    staleTime: 1000 * 60 * 5,
  });

  const results = Object.values(churnQ.data ?? {}) as ChurnResult[];
  const modelAvailable = results.length > 0 && results[0]?.modelAvailable;

  const highRisk = results.filter((r) => r.riskTier === 'high').sort((a, b) => b.riskScore - a.riskScore);
  const mediumRisk = results.filter((r) => r.riskTier === 'medium').sort((a, b) => b.riskScore - a.riskScore);
  const lowRisk = results.filter((r) => r.riskTier === 'low');

  const scoredAt = results[0]?.scoredAtUtc
    ? new Date(results[0].scoredAtUtc).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const safehouseRows = (safehouseQ.data ?? []) as SafehousePerformanceMlRow[];
  const safehouseModelAvailable = safehouseRows.length > 0 && safehouseRows[0]?.modelAvailable;
  const safehouseScoredAt = safehouseRows[0]?.scoredAtUtc
    ? new Date(safehouseRows[0].scoredAtUtc).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const supporters = (supportersQ.data ?? []) as Supporter[];
  const supporterNameById = new Map<number, string>(
    supporters
      .map((s) => [Number(s.id), s.displayName] as const)
      .filter(([id]) => !Number.isNaN(id)),
  );
  const donorName = (supporterId: number) => supporterNameById.get(supporterId) ?? `Donor #${supporterId}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary shrink-0" aria-hidden="true" />
          Reports &amp; Analytics
        </h1>
        {scoredAt && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <RefreshCw className="h-3 w-3" />
            <span>Churn model {scoredAt}</span>
          </p>
        )}
      </div>

      {/* Model summary card — matches Social Media "Best Post Strategy" style */}
      <Card className="border-2 border-primary bg-primary/5">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            Donor Churn Risk Model
          </CardTitle>
          <p className="text-sm text-foreground/70">
            Logistic regression model trained on RFM features — scores every active donor on their
            90-day lapse risk. Precision at top-20% outreach capacity: <strong>66.7%</strong> · ROC-AUC: <strong>0.65</strong>
          </p>
        </CardHeader>
        <CardContent>
          {churnQ.isLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : !modelAvailable ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg border border-dashed">
              <ShieldAlert className="h-4 w-4 text-muted-foreground shrink-0" />
              Model unavailable — ensure <code className="text-xs bg-background px-1 rounded mx-1">churn_model.onnx</code> is deployed to the backend Models folder.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{highRisk.length}</p>
                <p className="text-sm font-medium text-foreground mt-1">High Risk</p>
                <p className="text-xs text-muted-foreground mt-0.5">Priority outreach needed</p>
              </div>
              <div className="bg-card border rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-amber-500">{mediumRisk.length}</p>
                <p className="text-sm font-medium text-foreground mt-1">Medium Risk</p>
                <p className="text-xs text-muted-foreground mt-0.5">Monitor closely</p>
              </div>
              <div className="bg-card border rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-primary">{lowRisk.length}</p>
                <p className="text-sm font-medium text-foreground mt-1">Low Risk</p>
                <p className="text-xs text-muted-foreground mt-0.5">Maintain cadence</p>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            Risk scores are predictions, not guarantees. Validate outreach effectiveness with A/B testing.
          </p>

          {!churnQ.isLoading && modelAvailable && highRisk.length > 0 && (
            <div className="mt-5 p-4 rounded-lg border bg-card/60">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-primary" aria-hidden="true" />
                  Priority Outreach List
                </CardTitle>
                <span className="text-sm text-muted-foreground font-medium">
                  {highRisk.length} {highRisk.length === 1 ? 'donor' : 'donors'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                These donors have the highest predicted churn risk. Reach out before they lapse.
              </p>
              <div className="space-y-2">
                {highRisk.slice(0, 10).map((r, i) => (
                  <div
                    key={r.supporterId}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-card border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground w-6 shrink-0 font-medium">#{i + 1}</span>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{donorName(r.supporterId)}</span>
                          <RiskBadge tier={r.riskTier} />
                        </div>
                        <ScoreBar score={r.riskScore} tier={r.riskTier} />
                        {r.topDrivers.length > 0 && (
                          <p className="text-xs text-muted-foreground">{r.topDrivers.join(' · ')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {highRisk.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    + {highRisk.length - 10} more high-risk donors — filter by "High" risk on the Donors page.
                  </p>
                )}
              </div>
            </div>
          )}

          {!churnQ.isLoading && modelAvailable && mediumRisk.length > 0 && (
            <div className="mt-4 p-4 rounded-lg border bg-card/60">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" aria-hidden="true" />
                  Medium Risk Donors
                </CardTitle>
                <span className="text-sm text-muted-foreground font-medium">
                  {mediumRisk.length} {mediumRisk.length === 1 ? 'donor' : 'donors'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Send a personalized impact update within the next two weeks.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {mediumRisk.slice(0, 8).map((r) => (
                  <div key={r.supporterId} className="flex items-center gap-3 p-3 bg-card border rounded-lg">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{donorName(r.supporterId)}</span>
                        <RiskBadge tier={r.riskTier} />
                      </div>
                      <ScoreBar score={r.riskScore} tier={r.riskTier} />
                    </div>
                  </div>
                ))}
              </div>
              {mediumRisk.length > 8 && (
                <p className="text-xs text-muted-foreground text-center pt-3">
                  + {mediumRisk.length - 8} more — filter by "Medium" risk on the Donors page.
                </p>
              )}
            </div>
          )}

          {modelAvailable && (
            <div className="mt-4 p-4 rounded-lg border border-dashed bg-card/60 text-sm text-muted-foreground space-y-2">
              <CardTitle className="font-display text-base text-foreground">Model Methodology</CardTitle>
              <p>
                <strong className="text-foreground">Algorithm:</strong> Logistic Regression with standardized RFM features.
                Trained on a panel dataset of 90-day observation windows with a temporal train/test split — no future data leakage.
              </p>
              <p>
                <strong className="text-foreground">Key predictors:</strong> Days since last gift, 90-day gift frequency,
                frequency trend ratio (recent vs. prior quarter), recurring donation status, and acquisition channel.
              </p>
              <p>
                <strong className="text-foreground">Important:</strong> These are correlational findings, not causal proofs.
                A high risk score identifies <em>who</em> to contact — not <em>why</em> they are lapsing.
                Validate outreach effectiveness with A/B testing before reallocating significant resources.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Safehouse performance benchmark */}
      <Card className="border-2 border-primary bg-primary/5">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            Safehouse Performance Benchmark
          </CardTitle>
          <p className="text-sm text-foreground/70">
            Ridge benchmark model trained on SeedData CSV patterns (read-only in production). It estimates expected outcomes given operational intensity and caseload complexity.
          </p>
        </CardHeader>
        <CardContent>
          {safehouseQ.isLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : !safehouseModelAvailable ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg border border-dashed">
              <ShieldAlert className="h-4 w-4 text-muted-foreground shrink-0" />
              Model unavailable — ensure <code className="text-xs bg-background px-1 rounded mx-1">safehouse_performance_model.onnx</code> is deployed to the backend Models folder.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Sorted by biggest negative gap (actual − expected) first.
                </p>
                {safehouseScoredAt && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <RefreshCw className="h-3 w-3" />
                    <span>Safehouse model {safehouseScoredAt}</span>
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {safehouseRows.slice(0, 8).map((r) => (
                  <div key={r.safehouseId} className="p-3 bg-card border rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{displaySafehouseName(r.safehouseName || '')}</p>
                        <p className="text-xs text-muted-foreground">
                          {removeOutdatedLighthouseTerm(r.tierLabel)} · Gap: <span className="font-medium tabular-nums">{r.benchmarkGap.toFixed(2)}</span>
                          {' '}· Actual: <span className="tabular-nums">{r.outcomeIndexActual.toFixed(2)}</span>
                          {' '}· Expected: <span className="tabular-nums">{r.outcomeIndexExpected.toFixed(2)}</span>
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <RiskBadge tier={r.benchmarkGap <= -3 ? 'high' : r.benchmarkGap >= 3 ? 'low' : 'medium'} />
                      </div>
                    </div>
                    {r.topDrivers?.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {r.topDrivers.map((d) => removeOutdatedLighthouseTerm(d)).join(' · ')}
                      </p>
                    )}
                    {r.recommendedActions?.length > 0 && (
                      <ul className="mt-2 text-xs text-muted-foreground list-disc pl-5 space-y-1">
                        {r.recommendedActions.slice(0, 3).map((a) => (
                          <li key={a}>{removeOutdatedLighthouseTerm(a)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 p-4 rounded-lg border border-dashed bg-card/60 text-sm text-muted-foreground space-y-2">
                <CardTitle className="font-display text-base text-foreground">Model Methodology</CardTitle>
                <p>
                  <strong className="text-foreground">Algorithm:</strong> Ridge regression benchmark trained from
                  `SeedData` CSV patterns and deployed as ONNX for read-only scoring.
                </p>
                <p>
                  <strong className="text-foreground">Feature families:</strong> counseling cadence, visit cadence,
                  intervention plan completion, caseload complexity, high/critical risk mix, resident count, education progress,
                  and health score.
                </p>
                <p>
                  <strong className="text-foreground">Interpretation:</strong> the model estimates expected outcome index for each
                  safehouse’s operational profile. <em>Gap = actual − expected</em> is for benchmarking, not causal proof.
                  Use this to prioritize operational coaching and then validate interventions over time.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}