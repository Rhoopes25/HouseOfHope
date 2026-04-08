import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createResidentPlan,
  createResidentSession,
  createResidentVisitation,
  deleteResident,
  deleteResidentPlan,
  deleteResidentSession,
  deleteResidentVisitation,
  fetchResident,
  fetchResidents,
  fetchResidentPlans,
  fetchResidentSessions,
  fetchResidentVisitations,
  updateResident,
  updateResidentPlan,
  updateResidentSession,
  updateResidentVisitation,
} from '@/lib/api-endpoints';
import { formatCaseCategoryLabel } from '@/lib/caseCategoryDisplay';
import { displaySafehouseName } from '@/lib/safehouseDisplay';
import { EditableSelect } from '@/components/EditableSelect';
import type { Resident } from '@/lib/types';
import { RiskBadge } from '@/components/RiskBadge';
import { StatusPill } from '@/components/StatusPill';
import { PAGE_SIZE_OPTIONS, PaginationControl, usePagination } from '@/components/PaginationControl';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Calendar, Pencil, User, Clock, MapPin, Trash2 } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';

function matchSelectOption(value: string, options: string[]): { select: string; other: string } {
  const n = value.trim().toLowerCase();
  const hit = options.find((o) => o.trim().toLowerCase() === n);
  if (hit) return { select: hit, other: '' };
  if (!value.trim()) return { select: '', other: '' };
  return { select: 'other', other: value };
}

export default function ResidentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [openSession, setOpenSession] = useState(false);
  const [openVisit, setOpenVisit] = useState(false);
  const [openResidentEdit, setOpenResidentEdit] = useState(false);
  const [openPlan, setOpenPlan] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [deleteVisitId, setDeleteVisitId] = useState<string | null>(null);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [confirmResidentDelete, setConfirmResidentDelete] = useState(false);
  const [residentForm, setResidentForm] = useState({
    caseControlNumber: '',
    internalCode: '',
    safehouseName: '',
    caseStatus: 'active',
    caseCategory: '',
    caseCategoryOther: '',
    riskLevel: 'medium',
    assignedSocialWorker: '',
    reintegrationStatus: '',
    reintegrationType: '',
    referralSource: '',
    referringAgency: '',
    initialAssessment: '',
    admissionDate: '',
    dateOfBirth: '',
    religion: '',
    birthStatus: '',
    placeOfBirth: '',
    subCatOrphaned: false,
    subCatTrafficked: false,
    subCatChildLabor: false,
    subCatPhysicalAbuse: false,
    subCatSexualAbuse: false,
    subCatOsaec: false,
    subCatCicl: false,
    subCatAtRisk: false,
    subCatStreetChild: false,
    subCatChildWithHiv: false,
    familyIs4ps: false,
    familySoloParent: false,
    familyIndigenous: false,
    familyInformalSettler: false,
    familyParentPwd: false,
    assignedSocialWorkerOther: '',
    reintegrationStatusOther: '',
    reintegrationTypeOther: '',
    religionOther: '',
    birthStatusOther: '',
  });
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
    visitTypeOther: '',
    cooperationOther: '',
    outcomeOther: '',
  });
  const [planForm, setPlanForm] = useState({
    planCategory: '',
    planCategoryOther: '',
    description: '',
    servicesProvided: '',
    targetDate: '',
    status: 'pending' as 'pending' | 'in-progress' | 'completed' | 'on-hold',
    caseConferenceDate: '',
  });

  const residentQ = useQuery({
    queryKey: ['resident', id],
    queryFn: () => fetchResident(id!),
    enabled: !!id,
  });
  const residentsRosterQ = useQuery({ queryKey: ['residents'], queryFn: fetchResidents });
  const allResidents = residentsRosterQ.data ?? [];

  const safehouseOptions = useMemo(
    () =>
      [...new Set(allResidents.map((r: Resident) => r.safehouse).filter(Boolean))].sort((a, b) =>
        displaySafehouseName(a).localeCompare(displaySafehouseName(b), undefined, { numeric: true }),
      ),
    [allResidents],
  );
  const socialWorkerOptions = useMemo(
    () =>
      [...new Set(allResidents.map((r: Resident) => r.assignedSocialWorker).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    [allResidents],
  );
  const reintStatusOptions = useMemo(
    () =>
      [...new Set(allResidents.map((r: Resident) => r.reintegrationStatus).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    [allResidents],
  );
  const reintTypeOptions = useMemo(
    () =>
      [...new Set(allResidents.map((r: Resident) => r.reintegrationType).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    [allResidents],
  );
  const religionOptions = useMemo(
    () =>
      [...new Set(allResidents.map((r: Resident) => r.religion).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    [allResidents],
  );
  const birthStatusOptions = useMemo(
    () =>
      [...new Set(allResidents.map((r: Resident) => r.birthStatus).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    [allResidents],
  );
  const caseCategoryOptions = useMemo(
    () =>
      [...new Set(allResidents.map((r: Resident) => r.caseCategory).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    [allResidents],
  );
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
      setEditingSessionId(null);
      toast({ title: 'Session saved', description: 'Process recording was added.' });
    },
    onError: () => toast({ title: 'Save failed', description: 'Could not add counseling session.', variant: 'destructive' }),
  });
  const createVisitMutation = useMutation({
    mutationFn: () => createResidentVisitation(id!, visitForm),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resident', id, 'visitations'] });
      setOpenVisit(false);
      setEditingVisitId(null);
      toast({ title: 'Visitation saved', description: 'Home visitation record was added.' });
    },
    onError: () => toast({ title: 'Save failed', description: 'Could not add visitation.', variant: 'destructive' }),
  });
  const updateResidentMutation = useMutation({
    mutationFn: () => updateResident(id!, {
      caseControlNumber: residentForm.caseControlNumber,
      internalCode: residentForm.internalCode,
      safehouseName: residentForm.safehouseName,
      caseStatus: residentForm.caseStatus,
      caseCategory: residentForm.caseCategory === 'other' ? residentForm.caseCategoryOther : residentForm.caseCategory,
      riskLevel: residentForm.riskLevel,
      assignedSocialWorker:
        residentForm.assignedSocialWorker === 'other' ? residentForm.assignedSocialWorkerOther : residentForm.assignedSocialWorker,
      reintegrationStatus:
        residentForm.reintegrationStatus === 'other' ? residentForm.reintegrationStatusOther : residentForm.reintegrationStatus,
      reintegrationType:
        residentForm.reintegrationType === 'other' ? residentForm.reintegrationTypeOther : residentForm.reintegrationType,
      referralSource: residentForm.referralSource,
      referringAgency: residentForm.referringAgency,
      initialAssessment: residentForm.initialAssessment,
      admissionDate: residentForm.admissionDate,
      dateOfBirth: residentForm.dateOfBirth,
      religion: residentForm.religion === 'other' ? residentForm.religionOther : residentForm.religion,
      birthStatus: residentForm.birthStatus === 'other' ? residentForm.birthStatusOther : residentForm.birthStatus,
      placeOfBirth: residentForm.placeOfBirth,
      subCatOrphaned: residentForm.subCatOrphaned,
      subCatTrafficked: residentForm.subCatTrafficked,
      subCatChildLabor: residentForm.subCatChildLabor,
      subCatPhysicalAbuse: residentForm.subCatPhysicalAbuse,
      subCatSexualAbuse: residentForm.subCatSexualAbuse,
      subCatOsaec: residentForm.subCatOsaec,
      subCatCicl: residentForm.subCatCicl,
      subCatAtRisk: residentForm.subCatAtRisk,
      subCatStreetChild: residentForm.subCatStreetChild,
      subCatChildWithHiv: residentForm.subCatChildWithHiv,
      familyIs4ps: residentForm.familyIs4ps,
      familySoloParent: residentForm.familySoloParent,
      familyIndigenous: residentForm.familyIndigenous,
      familyInformalSettler: residentForm.familyInformalSettler,
      familyParentPwd: residentForm.familyParentPwd,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resident', id] });
      setOpenResidentEdit(false);
      toast({ title: 'Resident updated', description: 'Resident profile changes saved.' });
    },
    onError: () => toast({ title: 'Update failed', description: 'Could not update resident.', variant: 'destructive' }),
  });
  const saveSessionMutation = useMutation({
    mutationFn: () => (editingSessionId
      ? updateResidentSession(id!, editingSessionId, sessionForm)
      : createResidentSession(id!, sessionForm)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resident', id, 'sessions'] });
      setOpenSession(false);
      setEditingSessionId(null);
      toast({ title: 'Session saved', description: 'Counseling session updated.' });
    },
    onError: () => toast({ title: 'Save failed', description: 'Could not save session.', variant: 'destructive' }),
  });
  const saveVisitMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...visitForm,
        visitType: visitForm.visitType === 'other' ? visitForm.visitTypeOther : visitForm.visitType,
        familyCooperationLevel: visitForm.familyCooperationLevel === 'other' ? visitForm.cooperationOther : visitForm.familyCooperationLevel,
        visitOutcome: visitForm.visitOutcome === 'other' ? visitForm.outcomeOther : visitForm.visitOutcome,
      };
      return editingVisitId
        ? updateResidentVisitation(id!, editingVisitId, payload)
        : createResidentVisitation(id!, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resident', id, 'visitations'] });
      setOpenVisit(false);
      setEditingVisitId(null);
      toast({ title: 'Visitation saved', description: 'Visitation record updated.' });
    },
    onError: () => toast({ title: 'Save failed', description: 'Could not save visitation.', variant: 'destructive' }),
  });
  const savePlanMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...planForm,
        planCategory: planForm.planCategory === 'other' ? planForm.planCategoryOther : planForm.planCategory,
      };
      return editingPlanId
        ? updateResidentPlan(id!, editingPlanId, payload)
        : createResidentPlan(id!, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resident', id, 'plans'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setOpenPlan(false);
      setEditingPlanId(null);
      toast({ title: 'Plan saved', description: 'Intervention plan updated.' });
    },
    onError: () => toast({ title: 'Save failed', description: 'Could not save intervention plan.', variant: 'destructive' }),
  });
  const deleteResidentMutation = useMutation({
    mutationFn: () => deleteResident(id!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['residents'] });
      toast({ title: 'Resident deleted', description: 'Resident record removed.' });
      navigate('/admin/caseload');
    },
    onError: () => toast({ title: 'Delete failed', description: 'Could not delete resident.', variant: 'destructive' }),
  });
  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) => deleteResidentSession(id!, sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resident', id, 'sessions'] });
      setDeleteSessionId(null);
      toast({ title: 'Session deleted', description: 'Counseling session removed.' });
    },
    onError: () => toast({ title: 'Delete failed', description: 'Could not delete session.', variant: 'destructive' }),
  });
  const deleteVisitMutation = useMutation({
    mutationFn: (visitId: string) => deleteResidentVisitation(id!, visitId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resident', id, 'visitations'] });
      setDeleteVisitId(null);
      toast({ title: 'Visitation deleted', description: 'Visitation removed.' });
    },
    onError: () => toast({ title: 'Delete failed', description: 'Could not delete visitation.', variant: 'destructive' }),
  });
  const deletePlanMutation = useMutation({
    mutationFn: (planId: string) => deleteResidentPlan(id!, planId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resident', id, 'plans'] });
      setDeletePlanId(null);
      toast({ title: 'Plan deleted', description: 'Intervention plan removed.' });
    },
    onError: () => toast({ title: 'Delete failed', description: 'Could not delete plan.', variant: 'destructive' }),
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
                  <p className="text-muted-foreground">{displaySafehouseName(resident.safehouse)} · Admitted {resident.admissionDate}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={resident.caseStatus} />
                  <RiskBadge level={resident.riskLevel} />
                  <Button variant="outline" size="sm" onClick={() => {
                    const sc = resident.caseSubcategories;
                    const hasSub = (slug: string) => sc.some((c) => c.toLowerCase() === slug.toLowerCase());
                    const sw = matchSelectOption(resident.assignedSocialWorker, socialWorkerOptions);
                    const rs = matchSelectOption(resident.reintegrationStatus, reintStatusOptions);
                    const rt = matchSelectOption(resident.reintegrationType, reintTypeOptions);
                    const rel = matchSelectOption(resident.religion, religionOptions);
                    const bs = matchSelectOption(resident.birthStatus, birthStatusOptions);
                    const cc = matchSelectOption(resident.caseCategory, caseCategoryOptions);
                    setResidentForm({
                      caseControlNumber: resident.caseControlNumber,
                      internalCode: resident.internalCode,
                      safehouseName: resident.safehouse,
                      caseStatus: resident.caseStatus,
                      caseCategory: cc.select === 'other' ? 'other' : cc.select,
                      caseCategoryOther: cc.other,
                      riskLevel: resident.riskLevel,
                      assignedSocialWorker: sw.select === 'other' ? 'other' : sw.select,
                      assignedSocialWorkerOther: sw.other,
                      reintegrationStatus: rs.select === 'other' ? 'other' : rs.select,
                      reintegrationStatusOther: rs.other,
                      reintegrationType: rt.select === 'other' ? 'other' : rt.select,
                      reintegrationTypeOther: rt.other,
                      referralSource: resident.referralSource,
                      referringAgency: resident.referringAgency,
                      initialAssessment: resident.initialAssessment,
                      admissionDate: resident.admissionDate,
                      dateOfBirth: resident.dateOfBirth,
                      religion: rel.select === 'other' ? 'other' : rel.select,
                      religionOther: rel.other,
                      birthStatus: bs.select === 'other' ? 'other' : bs.select,
                      birthStatusOther: bs.other,
                      placeOfBirth: resident.placeOfBirth,
                      subCatOrphaned: hasSub('orphaned'),
                      subCatTrafficked: hasSub('trafficked'),
                      subCatChildLabor: hasSub('child-labor'),
                      subCatPhysicalAbuse: hasSub('physical-abuse'),
                      subCatSexualAbuse: hasSub('sexual-abuse'),
                      subCatOsaec: hasSub('OSAEC'),
                      subCatCicl: hasSub('cicl'),
                      subCatAtRisk: hasSub('at-risk'),
                      subCatStreetChild: hasSub('street-child'),
                      subCatChildWithHiv: hasSub('child-with-hiv'),
                      familyIs4ps: resident.is4PsBeneficiary,
                      familySoloParent: resident.isSoloParent,
                      familyIndigenous: !!resident.indigenousGroup && resident.indigenousGroup !== 'N/A',
                      familyInformalSettler: resident.isInformalSettler,
                      familyParentPwd: resident.parentWithDisability,
                    });
                    setOpenResidentEdit(true);
                  }}>
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setConfirmResidentDelete(true)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
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
                    <Badge variant="secondary">{formatCaseCategoryLabel(resident.caseCategory)}</Badge>
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
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingSessionId(s.id);
                          setSessionForm({
                            sessionDate: s.sessionDate,
                            socialWorker: s.socialWorker,
                            sessionType: s.sessionType,
                            durationMinutes: s.durationMinutes,
                            emotionalStateStart: s.emotionalStateStart,
                            emotionalStateEnd: s.emotionalStateEnd,
                            narrative: s.narrative,
                            interventions: s.interventions,
                            followUpActions: s.followUpActions,
                            progressNoted: s.progressNoted,
                            concernsFlagged: s.concernsFlagged,
                          });
                          setOpenSession(true);
                        }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteSessionId(s.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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
                    </div>                  </CardContent>
                </Card>
              ))}
              <PaginationControl
                totalItems={sessions.length}
                pageSize={sessionPagination.pageSize}
                currentPage={sessionPagination.currentPage}
                onPageChange={sessionPagination.setCurrentPage}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageSizeChange={sessionPagination.setPageSize}
              />
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
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => {
                        setEditingVisitId(v.id);
                        setVisitForm({
                          visitDate: v.visitDate,
                          socialWorker: v.socialWorker,
                          visitType: ['initial assessment', 'routine follow-up', 'reintegration assessment', 'post-placement monitoring', 'emergency'].includes(v.visitType.toLowerCase()) ? v.visitType.toLowerCase() : 'other',
                          location: v.location,
                          familyMembersPresent: v.familyMembersPresent,
                          purpose: v.purpose,
                          observations: v.observations,
                          familyCooperationLevel: ['high', 'moderate', 'low', 'other'].includes((v.familyCooperationLevel || '').toLowerCase()) ? v.familyCooperationLevel.toLowerCase() : 'other',
                          safetyConcernsNoted: v.safetyConcernsNoted,
                          followUpNeeded: v.followUpNeeded,
                          visitOutcome: ['completed', 'follow-up required', 'escalated', 'other'].includes((v.visitOutcome || '').toLowerCase()) ? v.visitOutcome.toLowerCase() : 'other',
                          visitTypeOther: ['initial assessment', 'routine follow-up', 'reintegration assessment', 'post-placement monitoring', 'emergency'].includes(v.visitType.toLowerCase()) ? '' : v.visitType,
                          cooperationOther: ['high', 'moderate', 'low', 'other'].includes((v.familyCooperationLevel || '').toLowerCase()) ? '' : v.familyCooperationLevel,
                          outcomeOther: ['completed', 'follow-up required', 'escalated', 'other'].includes((v.visitOutcome || '').toLowerCase()) ? '' : v.visitOutcome,
                        });
                        setOpenVisit(true);
                      }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteVisitId(v.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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
              <PaginationControl
                totalItems={visitations.length}
                pageSize={visitPagination.pageSize}
                currentPage={visitPagination.currentPage}
                onPageChange={visitPagination.setCurrentPage}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageSizeChange={visitPagination.setPageSize}
              />
            </TabsContent>

            <TabsContent value="interventions" className="mt-6 space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => { setEditingPlanId(null); setPlanForm({ planCategory: '', planCategoryOther: '', description: '', servicesProvided: '', targetDate: '', status: 'pending', caseConferenceDate: '' }); setOpenPlan(true); }}>Add Plan</Button>
              </div>
              {plansQ.isLoading ? <Skeleton className="h-40 w-full" /> : plans.map(p => (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base font-display">{p.planCategory}</CardTitle>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full capitalize ${planStatusColors[p.status] ?? ''}`}>{p.status}</span>
                        <Button variant="ghost" size="icon" onClick={() => { setEditingPlanId(p.id); setPlanForm({ planCategory: p.planCategory, planCategoryOther: '', description: p.description, servicesProvided: p.servicesProvided, targetDate: p.targetDate, status: p.status, caseConferenceDate: p.caseConferenceDate }); setOpenPlan(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletePlanId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
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
          <DialogHeader><DialogTitle className="font-display">{editingSessionId ? 'Edit Counseling Session' : 'Add Counseling Session'}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Session Date</Label><Input type="date" value={sessionForm.sessionDate} onChange={(e) => setSessionForm({ ...sessionForm, sessionDate: e.target.value })} /></div>
              <div><Label>Social Worker</Label><Input value={sessionForm.socialWorker} onChange={(e) => setSessionForm({ ...sessionForm, socialWorker: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Type</Label>
                <Select value={sessionForm.sessionType} onValueChange={(v: 'individual' | 'group') => setSessionForm({ ...sessionForm, sessionType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="individual">individual</SelectItem><SelectItem value="group">group</SelectItem></SelectContent>
                </Select>
              </div>
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
            <Button onClick={() => saveSessionMutation.mutate()} disabled={saveSessionMutation.isPending || !sessionForm.sessionDate || !sessionForm.socialWorker}>
              {saveSessionMutation.isPending ? 'Saving...' : 'Save Session'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openVisit} onOpenChange={setOpenVisit}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="font-display">{editingVisitId ? 'Edit Home Visitation' : 'Log Home Visitation'}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Visit Date</Label><Input type="date" value={visitForm.visitDate} onChange={(e) => setVisitForm({ ...visitForm, visitDate: e.target.value })} /></div>
              <div><Label>Social Worker</Label><Input value={visitForm.socialWorker} onChange={(e) => setVisitForm({ ...visitForm, socialWorker: e.target.value })} /></div>
            </div>
            <div><Label>Visit Type</Label>
              <Select value={visitForm.visitType} onValueChange={(v) => setVisitForm({ ...visitForm, visitType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="initial assessment">initial assessment</SelectItem>
                  <SelectItem value="routine follow-up">routine follow-up</SelectItem>
                  <SelectItem value="reintegration assessment">reintegration assessment</SelectItem>
                  <SelectItem value="post-placement monitoring">post-placement monitoring</SelectItem>
                  <SelectItem value="emergency">emergency</SelectItem>
                  <SelectItem value="other">other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {visitForm.visitType === 'other' && <div><Label>New Visit Type</Label><Input value={visitForm.visitTypeOther} onChange={(e) => setVisitForm({ ...visitForm, visitTypeOther: e.target.value })} /></div>}
            <div><Label>Location</Label><Input value={visitForm.location} onChange={(e) => setVisitForm({ ...visitForm, location: e.target.value })} /></div>
            <div><Label>Family Members Present</Label><Input value={visitForm.familyMembersPresent} onChange={(e) => setVisitForm({ ...visitForm, familyMembersPresent: e.target.value })} /></div>
            <div><Label>Purpose</Label><Input value={visitForm.purpose} onChange={(e) => setVisitForm({ ...visitForm, purpose: e.target.value })} /></div>
            <div><Label>Observations</Label><Textarea value={visitForm.observations} onChange={(e) => setVisitForm({ ...visitForm, observations: e.target.value })} /></div>
            <div><Label>Family Cooperation Level</Label>
              <Select value={visitForm.familyCooperationLevel} onValueChange={(v) => setVisitForm({ ...visitForm, familyCooperationLevel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">high</SelectItem>
                  <SelectItem value="moderate">moderate</SelectItem>
                  <SelectItem value="low">low</SelectItem>
                  <SelectItem value="other">other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {visitForm.familyCooperationLevel === 'other' && <div><Label>New Cooperation Value</Label><Input value={visitForm.cooperationOther} onChange={(e) => setVisitForm({ ...visitForm, cooperationOther: e.target.value })} /></div>}
            <div><Label>Visit Outcome</Label>
              <Select value={visitForm.visitOutcome} onValueChange={(v) => setVisitForm({ ...visitForm, visitOutcome: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">completed</SelectItem>
                  <SelectItem value="follow-up required">follow-up required</SelectItem>
                  <SelectItem value="escalated">escalated</SelectItem>
                  <SelectItem value="other">other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {visitForm.visitOutcome === 'other' && <div><Label>New Outcome</Label><Input value={visitForm.outcomeOther} onChange={(e) => setVisitForm({ ...visitForm, outcomeOther: e.target.value })} /></div>}
            <label className="text-sm"><input type="checkbox" checked={visitForm.safetyConcernsNoted} onChange={(e) => setVisitForm({ ...visitForm, safetyConcernsNoted: e.target.checked })} /> Safety concerns noted</label>
            <label className="text-sm"><input type="checkbox" checked={visitForm.followUpNeeded} onChange={(e) => setVisitForm({ ...visitForm, followUpNeeded: e.target.checked })} /> Follow-up needed</label>
            <Button onClick={() => saveVisitMutation.mutate()} disabled={saveVisitMutation.isPending || !visitForm.visitDate || !visitForm.socialWorker || !visitForm.visitType}>
              {saveVisitMutation.isPending ? 'Saving...' : 'Save Visitation'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openResidentEdit} onOpenChange={setOpenResidentEdit}>
        <DialogContent className="sm:max-w-4xl w-[min(100vw-2rem,56rem)] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="font-display">Edit resident profile</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto px-6 pb-4 flex-1 min-h-0 space-y-6">
            <div className="grid gap-3">
              <p className="text-sm font-medium text-foreground">Case &amp; placement</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Case #</Label><Input value={residentForm.caseControlNumber} onChange={(e) => setResidentForm({ ...residentForm, caseControlNumber: e.target.value })} /></div>
                <div><Label>Internal code</Label><Input value={residentForm.internalCode} onChange={(e) => setResidentForm({ ...residentForm, internalCode: e.target.value })} /></div>
              </div>
              <EditableSelect
                label="Safehouse"
                value={residentForm.safehouseName}
                customValue={residentForm.safehouseName}
                options={safehouseOptions}
                getOptionLabel={displaySafehouseName}
                onChange={(v) => setResidentForm({ ...residentForm, safehouseName: v === 'other' ? '' : v })}
                onCustomChange={(v) => setResidentForm({ ...residentForm, safehouseName: v })}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Status</Label><Select value={residentForm.caseStatus} onValueChange={(v) => setResidentForm({ ...residentForm, caseStatus: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">active</SelectItem><SelectItem value="closed">closed</SelectItem><SelectItem value="transferred">transferred</SelectItem></SelectContent></Select></div>
                <div><Label>Risk</Label><Select value={residentForm.riskLevel} onValueChange={(v) => setResidentForm({ ...residentForm, riskLevel: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">low</SelectItem><SelectItem value="medium">medium</SelectItem><SelectItem value="high">high</SelectItem><SelectItem value="critical">critical</SelectItem></SelectContent></Select></div>
              </div>
              <EditableSelect
                label="Case category"
                value={residentForm.caseCategory}
                customValue={residentForm.caseCategoryOther}
                options={caseCategoryOptions}
                getOptionLabel={formatCaseCategoryLabel}
                onChange={(v) => setResidentForm({ ...residentForm, caseCategory: v })}
                onCustomChange={(v) => setResidentForm({ ...residentForm, caseCategoryOther: v })}
              />
              <EditableSelect
                label="Assigned social worker"
                value={residentForm.assignedSocialWorker}
                customValue={residentForm.assignedSocialWorkerOther}
                options={socialWorkerOptions}
                onChange={(v) => setResidentForm({ ...residentForm, assignedSocialWorker: v })}
                onCustomChange={(v) => setResidentForm({ ...residentForm, assignedSocialWorkerOther: v })}
              />
            </div>
            <div className="grid gap-3">
              <p className="text-sm font-medium text-foreground">Demographics</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Date of birth</Label><Input type="date" value={residentForm.dateOfBirth} onChange={(e) => setResidentForm({ ...residentForm, dateOfBirth: e.target.value })} /></div>
                <div><Label>Admission date</Label><Input type="date" value={residentForm.admissionDate} onChange={(e) => setResidentForm({ ...residentForm, admissionDate: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <EditableSelect
                  label="Religion"
                  value={residentForm.religion}
                  customValue={residentForm.religionOther}
                  options={religionOptions}
                  onChange={(v) => setResidentForm({ ...residentForm, religion: v })}
                  onCustomChange={(v) => setResidentForm({ ...residentForm, religionOther: v })}
                />
                <EditableSelect
                  label="Birth status"
                  value={residentForm.birthStatus}
                  customValue={residentForm.birthStatusOther}
                  options={birthStatusOptions}
                  onChange={(v) => setResidentForm({ ...residentForm, birthStatus: v })}
                  onCustomChange={(v) => setResidentForm({ ...residentForm, birthStatusOther: v })}
                />
              </div>
              <div><Label>Place of birth</Label><Input value={residentForm.placeOfBirth} onChange={(e) => setResidentForm({ ...residentForm, placeOfBirth: e.target.value })} /></div>
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium text-foreground">Case subcategories</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {([
                  ['subCatOrphaned', 'Orphaned'],
                  ['subCatTrafficked', 'Trafficked'],
                  ['subCatChildLabor', 'Child labor'],
                  ['subCatPhysicalAbuse', 'Physical abuse'],
                  ['subCatSexualAbuse', 'Sexual abuse'],
                  ['subCatOsaec', 'OSAEC / CSAEM'],
                  ['subCatCicl', 'CICL'],
                  ['subCatAtRisk', 'At risk'],
                  ['subCatStreetChild', 'Street child'],
                  ['subCatChildWithHiv', 'Child with HIV'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={residentForm[key]}
                      onChange={(e) => setResidentForm({ ...residentForm, [key]: e.target.checked })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium text-foreground">Family profile</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {([
                  ['familyIs4ps', '4Ps beneficiary'],
                  ['familySoloParent', 'Solo parent'],
                  ['familyIndigenous', 'Indigenous group'],
                  ['familyInformalSettler', 'Informal settler'],
                  ['familyParentPwd', 'Parent with disability'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={residentForm[key]}
                      onChange={(e) => setResidentForm({ ...residentForm, [key]: e.target.checked })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-3">
              <p className="text-sm font-medium text-foreground">Referral &amp; reintegration</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Referral source</Label><Input value={residentForm.referralSource} onChange={(e) => setResidentForm({ ...residentForm, referralSource: e.target.value })} /></div>
                <div><Label>Referring agency / person</Label><Input value={residentForm.referringAgency} onChange={(e) => setResidentForm({ ...residentForm, referringAgency: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <EditableSelect
                  label="Reintegration status"
                  value={residentForm.reintegrationStatus}
                  customValue={residentForm.reintegrationStatusOther}
                  options={reintStatusOptions}
                  onChange={(v) => setResidentForm({ ...residentForm, reintegrationStatus: v })}
                  onCustomChange={(v) => setResidentForm({ ...residentForm, reintegrationStatusOther: v })}
                />
                <EditableSelect
                  label="Reintegration type"
                  value={residentForm.reintegrationType}
                  customValue={residentForm.reintegrationTypeOther}
                  options={reintTypeOptions}
                  onChange={(v) => setResidentForm({ ...residentForm, reintegrationType: v })}
                  onCustomChange={(v) => setResidentForm({ ...residentForm, reintegrationTypeOther: v })}
                />
              </div>
              <div><Label>Initial assessment</Label><Textarea rows={4} value={residentForm.initialAssessment} onChange={(e) => setResidentForm({ ...residentForm, initialAssessment: e.target.value })} /></div>
            </div>
          </div>
          <div className="border-t px-6 py-4 shrink-0 flex justify-end gap-2 bg-muted/30">
            <Button variant="outline" onClick={() => setOpenResidentEdit(false)}>Cancel</Button>
            <Button onClick={() => updateResidentMutation.mutate()} disabled={updateResidentMutation.isPending || !residentForm.caseControlNumber || !residentForm.internalCode || !residentForm.safehouseName}>
              {updateResidentMutation.isPending ? 'Saving...' : 'Save resident'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openPlan} onOpenChange={setOpenPlan}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="font-display">{editingPlanId ? 'Edit Intervention Plan' : 'Add Intervention Plan'}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Plan Category</Label><Select value={planForm.planCategory} onValueChange={(v) => setPlanForm({ ...planForm, planCategory: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="caring">caring</SelectItem><SelectItem value="healing">healing</SelectItem><SelectItem value="teaching">teaching</SelectItem><SelectItem value="other">other</SelectItem></SelectContent></Select></div>
            {planForm.planCategory === 'other' && <div><Label>New Category</Label><Input value={planForm.planCategoryOther} onChange={(e) => setPlanForm({ ...planForm, planCategoryOther: e.target.value })} /></div>}
            <div><Label>Description</Label><Textarea value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} /></div>
            <div><Label>Services Provided</Label><Textarea value={planForm.servicesProvided} onChange={(e) => setPlanForm({ ...planForm, servicesProvided: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Target Date</Label><Input type="date" value={planForm.targetDate} onChange={(e) => setPlanForm({ ...planForm, targetDate: e.target.value })} /></div>
              <div><Label>Case Conference Date</Label><Input type="date" value={planForm.caseConferenceDate} onChange={(e) => setPlanForm({ ...planForm, caseConferenceDate: e.target.value })} /></div>
            </div>
            <div><Label>Status</Label><Select value={planForm.status} onValueChange={(v: 'pending' | 'in-progress' | 'completed' | 'on-hold') => setPlanForm({ ...planForm, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">pending</SelectItem><SelectItem value="in-progress">in-progress</SelectItem><SelectItem value="completed">completed</SelectItem><SelectItem value="on-hold">on-hold</SelectItem></SelectContent></Select></div>
            <Button onClick={() => savePlanMutation.mutate()} disabled={savePlanMutation.isPending || !planForm.planCategory || (planForm.planCategory === 'other' && !planForm.planCategoryOther)}>
              {savePlanMutation.isPending ? 'Saving...' : 'Save Plan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={confirmResidentDelete}
        onClose={() => setConfirmResidentDelete(false)}
        onConfirm={() => deleteResidentMutation.mutate()}
        title="Delete resident?"
        description="This will permanently remove the resident record."
      />
      <ConfirmDeleteDialog
        open={!!deleteSessionId}
        onClose={() => setDeleteSessionId(null)}
        onConfirm={() => deleteSessionId && deleteSessionMutation.mutate(deleteSessionId)}
        title="Delete counseling session?"
        description="This process recording entry will be permanently removed."
      />
      <ConfirmDeleteDialog
        open={!!deleteVisitId}
        onClose={() => setDeleteVisitId(null)}
        onConfirm={() => deleteVisitId && deleteVisitMutation.mutate(deleteVisitId)}
        title="Delete visitation?"
        description="This home visitation record will be permanently removed."
      />
      <ConfirmDeleteDialog
        open={!!deletePlanId}
        onClose={() => setDeletePlanId(null)}
        onConfirm={() => deletePlanId && deletePlanMutation.mutate(deletePlanId)}
        title="Delete intervention plan?"
        description="This case plan will be permanently removed."
      />
    </div>
  );
}
