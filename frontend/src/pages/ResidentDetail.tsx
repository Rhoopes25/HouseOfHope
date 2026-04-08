import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createResidentSession,
  createResidentVisitation,
  fetchResident,
  fetchResidentPlans,
  fetchResidentSessions,
  fetchResidentVisitations,
} from '@/lib/api-endpoints';
import { RiskBadge } from '@/components/RiskBadge';
import { StatusPill } from '@/components/StatusPill';
import { PaginationControl, usePagination } from '@/components/PaginationControl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Calendar, User, Clock, MapPin } from 'lucide-react';
export default function ResidentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [openSession, setOpenSession] = useState(false);
  const [openVisit, setOpenVisit] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    sessionDate: new Date().toISOString().slice(0, 10),
    socialWorker: '',
    sessionType: 'individual' as 'individual' | 'group',
    durationMinutes: 60,
    emotionalStateStart: '',
    emotionalStateEnd: '',
    narrative: '',
    interventions: '',
    followUpActions: '',
    progressNoted: false,
    concernsFlagged: false,
  });
  const [visitForm, setVisitForm] = useState({
    visitDate: new Date().toISOString().slice(0, 10),
    socialWorker: '',
    visitType: '',
    location: '',
    familyMembersPresent: '',
    purpose: '',
    observations: '',
    familyCooperationLevel: '',
    safetyConcernsNoted: false,
    followUpNeeded: false,
    visitOutcome: '',
  });

  const residentQ = useQuery({
    queryKey: ['resident', id],
    queryFn: () => fetchResident(id!),
    enabled: !!id,
  });
  const sessionsQ = useQuery({
    queryKey: ['resident', id, 'sessions'],
    queryFn: () => fetchResidentSessions(id!),
    enabled: !!id,
  });
  const visitsQ = useQuery({
    queryKey: ['resident', id, 'visitations'],
    queryFn: () => fetchResidentVisitations(id!),
    enabled: !!id,
  });
  const plansQ = useQuery({
    queryKey: ['resident', id, 'plans'],
    queryFn: () => fetchResidentPlans(id!),
    enabled: !!id,
  });

  const resident = residentQ.data;
  const sessions = sessionsQ.data ?? [];
  const visitations = visitsQ.data ?? [];
  const plans = plansQ.data ?? [];
  const createSessionMutation = useMutation({
    mutationFn: () => createResidentSession(id!, sessionForm),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resident', id, 'sessions'] });
      setOpenSession(false);
      toast({ title: 'Session saved', description: 'Process recording was added.' });
    },
    onError: () => toast({ title: 'Save failed', description: 'Could not add counseling session.', variant: 'destructive' }),
  });
  const createVisitMutation = useMutation({
    mutationFn: () => createResidentVisitation(id!, visitForm),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resident', id, 'visitations'] });
      setOpenVisit(false);
      toast({ title: 'Visitation saved', description: 'Home visitation record was added.' });
    },
    onError: () => toast({ title: 'Save failed', description: 'Could not add visitation.', variant: 'destructive' }),
  });

  const sessionPagination = usePagination(sessions.length, 5);
  const visitPagination = usePagination(visitations.length, 5);

  const loading = residentQ.isLoading;
  const notFound = !residentQ.isLoading && (residentQ.isError || !resident);

  if (notFound) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-display font-bold">Resident Not Found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/caseload')}>Back to Caseload</Button>
      </div>
    );
  }

  const planStatusColors: Record<string, string> = {
    'pending': 'bg-risk-medium text-foreground',
    'in-progress': 'bg-accent text-accent-foreground',
    'completed': 'bg-risk-low text-white',
    'on-hold': 'bg-status-closed text-white',
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/admin/caseload')} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Caseload
      </Button>

      {loading || !resident ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : (
        <>
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h1 className="text-2xl font-display font-bold text-foreground">{resident.internalCode}</h1>
                  <p className="text-muted-foreground">{resident.safehouse} · Admitted {resident.admissionDate}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={resident.caseStatus} />
                  <RiskBadge level={resident.riskLevel} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-1">Reintegration Readiness Score</p>
                <div className="flex items-center gap-3">
                  <Progress value={resident.reintegrationReadinessScore} className="flex-1 h-3" />
                  <span className="text-sm font-semibold text-primary">{resident.reintegrationReadinessScore}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Derived from latest education and health records in the database</p>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="overview">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="counseling">Counseling Sessions</TabsTrigger>
              <TabsTrigger value="visitations">Visitations</TabsTrigger>
              <TabsTrigger value="interventions">Intervention Plans</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-6">
              <Card>
                <CardHeader><CardTitle className="font-display text-lg">Demographics</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Date of Birth:</span> <span className="font-medium ml-1">{resident.dateOfBirth}</span></div>
                    <div><span className="text-muted-foreground">Religion:</span> <span className="font-medium ml-1">{resident.religion}</span></div>
                    <div><span className="text-muted-foreground">Birth Status:</span> <span className="font-medium ml-1">{resident.birthStatus}</span></div>
                    <div><span className="text-muted-foreground">Place of Birth:</span> <span className="font-medium ml-1">{resident.placeOfBirth}</span></div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="font-display text-lg">Case Categories</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{resident.caseCategory}</Badge>
                    {resident.caseSubcategories.map(cat => (
                      <Badge key={cat} variant="outline" className="capitalize">{cat.replace('-', ' ')}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="font-display text-lg">Family Information</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div><span className="text-muted-foreground">4Ps Beneficiary:</span> <span className="font-medium ml-1">{resident.is4PsBeneficiary ? 'Yes' : 'No'}</span></div>
                    <div><span className="text-muted-foreground">Solo Parent:</span> <span className="font-medium ml-1">{resident.isSoloParent ? 'Yes' : 'No'}</span></div>
                    <div><span className="text-muted-foreground">Indigenous Group:</span> <span className="font-medium ml-1">{resident.indigenousGroup || 'N/A'}</span></div>
                    <div><span className="text-muted-foreground">Informal Settler:</span> <span className="font-medium ml-1">{resident.isInformalSettler ? 'Yes' : 'No'}</span></div>
                    <div><span className="text-muted-foreground">Parent w/ Disability:</span> <span className="font-medium ml-1">{resident.parentWithDisability ? 'Yes' : 'No'}</span></div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="font-display text-lg">Referral & Assessment</CardTitle></CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div><span className="text-muted-foreground">Referral Source:</span> <span className="font-medium ml-1">{resident.referralSource}</span></div>
                    <div><span className="text-muted-foreground">Referring Agency:</span> <span className="font-medium ml-1">{resident.referringAgency}</span></div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Initial Assessment</p>
                    <p className="text-foreground leading-relaxed">{resident.initialAssessment}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="counseling" className="mt-6 space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setOpenSession(true)}>Add Session</Button>
              </div>
              {sessionsQ.isLoading ? <Skeleton className="h-40 w-full" /> : sessions.slice(sessionPagination.startIndex, sessionPagination.endIndex).map(s => (
                <Card key={s.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base font-display flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" /> {s.sessionDate}
                      </CardTitle>
                      <Badge variant="outline" className="capitalize">{s.sessionType}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-4 text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {s.socialWorker}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.durationMinutes} min</span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <div><span className="text-muted-foreground">Start:</span> {s.emotionalStateStart}</div>
                      <div><span className="text-muted-foreground">End:</span> {s.emotionalStateEnd}</div>
                    </div>
                    <p className="text-foreground leading-relaxed">{s.narrative}</p>
                    <div><span className="text-muted-foreground">Interventions:</span> {s.interventions}</div>
                    <div><span className="text-muted-foreground">Follow-up:</span> {s.followUpActions}</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {s.progressNoted && (
                          <Badge className="bg-green-100 text-green-800 border-green-300">Progress Noted</Badge>
                      )}
                      {s.concernsFlagged && (
                          <Badge className="bg-red-100 text-red-800 border-red-300">Concerns Flagged</Badge>
                      )}
                      {s.referralMade && (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-300">Referral Made</Badge>
                      )}
                    </div>                  </CardContent>
                </Card>
              ))}
              <PaginationControl totalItems={sessions.length} pageSize={sessionPagination.pageSize} currentPage={sessionPagination.currentPage} onPageChange={sessionPagination.setCurrentPage} />
            </TabsContent>

            <TabsContent value="visitations" className="mt-6 space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setOpenVisit(true)}>Log Visitation</Button>
              </div>
              {visitsQ.isLoading ? <Skeleton className="h-40 w-full" /> : visitations.slice(visitPagination.startIndex, visitPagination.endIndex).map(v => (
                <Card key={v.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" /> {v.visitDate} · {v.visitType}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div><span className="text-muted-foreground">Location:</span> {v.location}</div>
                    <div><span className="text-muted-foreground">Family present:</span> {v.familyMembersPresent}</div>
                    <p className="text-foreground">{v.observations}</p>
                    <div><span className="text-muted-foreground">Outcome:</span> {v.visitOutcome}</div>
                    <div><span className="text-muted-foreground">Cooperation:</span> {v.familyCooperationLevel}</div>
                    {v.safetyConcernsNoted && (
                        <Badge className="bg-red-100 text-red-800 border-red-300">Safety Concerns Noted</Badge>
                    )}
                    {v.followUpNeeded && (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Follow-up Needed</Badge>
                    )}                  </CardContent>
                </Card>
              ))}
              <PaginationControl totalItems={visitations.length} pageSize={visitPagination.pageSize} currentPage={visitPagination.currentPage} onPageChange={visitPagination.setCurrentPage} />
            </TabsContent>

            <TabsContent value="interventions" className="mt-6 space-y-4">
              {plansQ.isLoading ? <Skeleton className="h-40 w-full" /> : plans.map(p => (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base font-display">{p.planCategory}</CardTitle>
                      <span className={`text-xs px-2 py-1 rounded-full capitalize ${planStatusColors[p.status] ?? ''}`}>{p.status}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>{p.description}</p>
                    <div><span className="text-muted-foreground">Services:</span> {p.servicesProvided}</div>
                    <div><span className="text-muted-foreground">Target:</span> {p.targetDate}</div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </>
      )}

      <Dialog open={openSession} onOpenChange={setOpenSession}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="font-display">Add Counseling Session</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Session Date</Label><Input type="date" value={sessionForm.sessionDate} onChange={(e) => setSessionForm({ ...sessionForm, sessionDate: e.target.value })} /></div>
              <div><Label>Social Worker</Label><Input value={sessionForm.socialWorker} onChange={(e) => setSessionForm({ ...sessionForm, socialWorker: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Type</Label><Input value={sessionForm.sessionType} onChange={(e) => setSessionForm({ ...sessionForm, sessionType: e.target.value === 'group' ? 'group' : 'individual' })} /></div>
              <div><Label>Duration (min)</Label><Input type="number" value={sessionForm.durationMinutes} onChange={(e) => setSessionForm({ ...sessionForm, durationMinutes: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Emotional State (Start)</Label><Input value={sessionForm.emotionalStateStart} onChange={(e) => setSessionForm({ ...sessionForm, emotionalStateStart: e.target.value })} /></div>
              <div><Label>Emotional State (End)</Label><Input value={sessionForm.emotionalStateEnd} onChange={(e) => setSessionForm({ ...sessionForm, emotionalStateEnd: e.target.value })} /></div>
            </div>
            <div><Label>Narrative</Label><Textarea value={sessionForm.narrative} onChange={(e) => setSessionForm({ ...sessionForm, narrative: e.target.value })} /></div>
            <div><Label>Interventions</Label><Textarea value={sessionForm.interventions} onChange={(e) => setSessionForm({ ...sessionForm, interventions: e.target.value })} /></div>
            <div><Label>Follow-up Actions</Label><Textarea value={sessionForm.followUpActions} onChange={(e) => setSessionForm({ ...sessionForm, followUpActions: e.target.value })} /></div>
            <label className="text-sm"><input type="checkbox" checked={sessionForm.progressNoted} onChange={(e) => setSessionForm({ ...sessionForm, progressNoted: e.target.checked })} /> Progress noted</label>
            <label className="text-sm"><input type="checkbox" checked={sessionForm.concernsFlagged} onChange={(e) => setSessionForm({ ...sessionForm, concernsFlagged: e.target.checked })} /> Concerns flagged</label>
            <Button onClick={() => createSessionMutation.mutate()} disabled={createSessionMutation.isPending || !sessionForm.sessionDate || !sessionForm.socialWorker}>
              {createSessionMutation.isPending ? 'Saving...' : 'Save Session'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openVisit} onOpenChange={setOpenVisit}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="font-display">Log Home Visitation</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Visit Date</Label><Input type="date" value={visitForm.visitDate} onChange={(e) => setVisitForm({ ...visitForm, visitDate: e.target.value })} /></div>
              <div><Label>Social Worker</Label><Input value={visitForm.socialWorker} onChange={(e) => setVisitForm({ ...visitForm, socialWorker: e.target.value })} /></div>
            </div>
            <div><Label>Visit Type</Label><Input value={visitForm.visitType} onChange={(e) => setVisitForm({ ...visitForm, visitType: e.target.value })} /></div>
            <div><Label>Location</Label><Input value={visitForm.location} onChange={(e) => setVisitForm({ ...visitForm, location: e.target.value })} /></div>
            <div><Label>Family Members Present</Label><Input value={visitForm.familyMembersPresent} onChange={(e) => setVisitForm({ ...visitForm, familyMembersPresent: e.target.value })} /></div>
            <div><Label>Purpose</Label><Input value={visitForm.purpose} onChange={(e) => setVisitForm({ ...visitForm, purpose: e.target.value })} /></div>
            <div><Label>Observations</Label><Textarea value={visitForm.observations} onChange={(e) => setVisitForm({ ...visitForm, observations: e.target.value })} /></div>
            <div><Label>Family Cooperation Level</Label><Input value={visitForm.familyCooperationLevel} onChange={(e) => setVisitForm({ ...visitForm, familyCooperationLevel: e.target.value })} /></div>
            <div><Label>Visit Outcome</Label><Textarea value={visitForm.visitOutcome} onChange={(e) => setVisitForm({ ...visitForm, visitOutcome: e.target.value })} /></div>
            <label className="text-sm"><input type="checkbox" checked={visitForm.safetyConcernsNoted} onChange={(e) => setVisitForm({ ...visitForm, safetyConcernsNoted: e.target.checked })} /> Safety concerns noted</label>
            <label className="text-sm"><input type="checkbox" checked={visitForm.followUpNeeded} onChange={(e) => setVisitForm({ ...visitForm, followUpNeeded: e.target.checked })} /> Follow-up needed</label>
            <Button onClick={() => createVisitMutation.mutate()} disabled={createVisitMutation.isPending || !visitForm.visitDate || !visitForm.socialWorker || !visitForm.visitType}>
              {createVisitMutation.isPending ? 'Saving...' : 'Save Visitation'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
