import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  fetchCaseRiskPriorities,
  fetchResidents,
  type CaseRiskPriority,
} from '@/lib/api-endpoints';
import type { Resident } from '@/lib/types';
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

export default function CaseRiskPriorities() {
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['case-risk-priorities'],
    queryFn: fetchCaseRiskPriorities,
    retry: false,
  });

  const { data: residents = [] } = useQuery({
    queryKey: ['residents'],
    queryFn: fetchResidents,
    enabled: !!data?.priorities?.length,
  });

  const byResidentId = useMemo(() => {
    const m = new Map<number, Resident>();
    for (const r of residents) {
      const n = Number(r.id);
      if (!Number.isNaN(n)) m.set(n, r);
    }
    return m;
  }, [residents]);

  const rows = useMemo(() => {
    if (!data?.priorities) return [];
    return data.priorities.map((p: CaseRiskPriority) => ({
      ...p,
      resident: byResidentId.get(p.resident_id),
    }));
  }, [data, byResidentId]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Case risk priorities
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Model-assisted triage for near-term escalation risk (staff only). Scores come from
            the case-management ML service via the API. Use alongside clinical judgment.
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
          <AlertTitle>Could not load risk priorities</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
            <p className="text-sm">
              Ensure the Python ML service is running, <code className="rounded bg-muted px-1">HOUSE_OF_HOPE_CSV_DIR</code>{' '}
              points at your CSV export, and the API setting{' '}
              <code className="rounded bg-muted px-1">CaseManagementMl:BaseUrl</code> is set (e.g.{' '}
              <code className="rounded bg-muted px-1">http://127.0.0.1:5055</code>). See{' '}
              <code className="rounded bg-muted px-1">ml-pipelines/case_management/README.md</code>.
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
          {data.csv_dir ? (
            <p className="text-xs text-muted-foreground">
              Data snapshot: <span className="font-mono break-all">{data.csv_dir}</span>
            </p>
          ) : null}

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Resident</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Risk probability</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground text-center py-8">
                      No priority rows returned.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.resident_id}>
                      <TableCell className="font-medium">{row.resident_id}</TableCell>
                      <TableCell>
                        {row.resident?.internalCode ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(row.risk_probability * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <Badge variant={segmentVariant(row.risk_segment)}>
                          {row.risk_segment}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.model}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/admin/resident/${row.resident_id}`}>
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Open
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
