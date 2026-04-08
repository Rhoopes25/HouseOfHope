import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchAllVisitations, fetchCaseConferences, fetchResidents } from '@/lib/api-endpoints';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search } from 'lucide-react';

export default function HomeVisitCaseConferences() {
  const [search, setSearch] = useState('');
  const visitQ = useQuery({ queryKey: ['visitations-all'], queryFn: fetchAllVisitations });
  const confQ = useQuery({ queryKey: ['case-conferences'], queryFn: fetchCaseConferences });
  const residentQ = useQuery({ queryKey: ['residents'], queryFn: fetchResidents });

  const residentsById = useMemo(
    () => Object.fromEntries((residentQ.data ?? []).map((r) => [r.id, r])),
    [residentQ.data],
  );

  const visitRows = (visitQ.data ?? []).filter((v) => {
    const resident = residentsById[v.residentId];
    const target = `${resident?.internalCode ?? ''} ${v.socialWorker} ${v.visitType} ${v.visitDate}`.toLowerCase();
    return target.includes(search.toLowerCase());
  });

  const conferenceRows = (confQ.data ?? []).filter((c) => {
    const target = `${c.residentCode} ${c.type} ${c.date}`.toLowerCase();
    return target.includes(search.toLowerCase());
  });

  if (visitQ.error || confQ.error) {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-bold text-foreground">Home Visitations & Case Conferences</h1>
        <p className="text-destructive text-sm">Could not load records from the API.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold text-foreground">Home Visitations & Case Conferences</h1>
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Search by resident code, worker, type, or date..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Tabs defaultValue="visitations">
        <TabsList>
          <TabsTrigger value="visitations">Visitations</TabsTrigger>
          <TabsTrigger value="conferences">Case Conferences</TabsTrigger>
        </TabsList>

        <TabsContent value="visitations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Home/Field Visit Records</CardTitle>
            </CardHeader>
            <CardContent>
              {visitQ.isLoading || residentQ.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Resident</TableHead>
                      <TableHead>Worker</TableHead>
                      <TableHead>Visit Type</TableHead>
                      <TableHead>Outcome</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visitRows.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>{v.visitDate}</TableCell>
                        <TableCell>
                          <Link className="text-primary underline-offset-4 hover:underline" to={`/admin/resident/${v.residentId}`}>
                            {residentsById[v.residentId]?.internalCode ?? `Resident ${v.residentId}`}
                          </Link>
                        </TableCell>
                        <TableCell>{v.socialWorker}</TableCell>
                        <TableCell>{v.visitType}</TableCell>
                        <TableCell>{v.visitOutcome || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conferences" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming and Historical Conferences</CardTitle>
            </CardHeader>
            <CardContent>
              {confQ.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Resident Code</TableHead>
                      <TableHead>Conference Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conferenceRows.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.date}</TableCell>
                        <TableCell>{c.residentCode}</TableCell>
                        <TableCell>{c.type}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
