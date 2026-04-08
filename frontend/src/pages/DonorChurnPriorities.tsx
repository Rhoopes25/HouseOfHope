import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  fetchDonorChurnPriorities,
  fetchSupporters,
  type DonorChurnPriority,
} from '@/lib/api-endpoints';
import type { Supporter } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';

function segmentVariant(segment: string): 'destructive' | 'default' | 'secondary' {
  if (segment.toLowerCase().includes('high')) return 'destructive';
  if (segment.toLowerCase().includes('medium')) return 'default';
  return 'secondary';
}

export default function DonorChurnPriorities() {
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['donor-churn-priorities'],
    queryFn: fetchDonorChurnPriorities,
    retry: false,
  });

  const { data: supporters = [] } = useQuery({
    queryKey: ['supporters'],
    queryFn: fetchSupporters,
    enabled: !!data?.priorities?.length,
  });

  const bySupporterId = useMemo(() => {
    const m = new Map<string, Supporter>();
    for (const s of supporters) {
      m.set(s.id, s);
    }
    return m;
  }, [supporters]);

  const rows = useMemo(() => {
    if (!data?.priorities) return [];
    return data.priorities.map((p: DonorChurnPriority) => ({
      ...p,
      supporter: bySupporterId.get(String(p.supporter_id)),
    }));
  }, [data, bySupporterId]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Donor churn priorities
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Model-assisted list for 90-day lapse risk (staff only). Features use gifts through{' '}
            <span className="font-medium text-foreground">feature cutoff</span>; labels would use the following window
            in training. Use alongside stewardship judgment.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not load churn priorities</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
            <p className="text-sm">
              Ensure the Python ML service is running,{' '}
              <code className="rounded bg-muted px-1">HOUSE_OF_HOPE_CSV_DIR</code> points at your CSV export, and{' '}
              <code className="rounded bg-muted px-1">DonorChurnMl:BaseUrl</code> is set (e.g.{' '}
              <code className="rounded bg-muted px-1">http://127.0.0.1:5056</code>). See{' '}
              <code className="rounded bg-muted px-1">ml-pipelines/donor_churn/README.md</code>.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {isLoading && !error && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {data && !error && (
        <>
          <div className="text-xs text-muted-foreground space-y-1">
            {data.csv_dir ? (
              <p>
                Data snapshot: <span className="font-mono break-all">{data.csv_dir}</span>
              </p>
            ) : null}
            {data.as_of && data.feature_cutoff ? (
              <p>
                Observation as-of: <span className="font-mono">{data.as_of}</span>
                {' · '}
                Feature cutoff: <span className="font-mono">{data.feature_cutoff}</span>
              </p>
            ) : null}
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Supporter</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Churn probability</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Outreach</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="w-[120px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground text-center py-8">
                      No supporters with gift history at the feature cutoff.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.supporter_id}>
                      <TableCell className="font-medium">{row.supporter_id}</TableCell>
                      <TableCell>{row.supporter?.displayName ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(row.churn_probability * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <Badge variant={segmentVariant(row.churn_risk_segment)}>
                          {row.churn_risk_segment}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.in_outreach_top_k ? (
                          <Badge variant="outline">Top capacity</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.model}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to="/admin/donors">
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Donors
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
