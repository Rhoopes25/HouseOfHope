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
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Calendar, Pencil, User, Users, Clock, MapPin, Trash2 } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { toTitleCase } from '@/lib/titleCase';
import {
  COOPERATION_LEVEL_OPTIONS,
  DEFAULT_PLAN_CATEGORY_SLUGS,
  EMOTIONAL_STATE_SEEDS,
  SESSION_DURATION_PRESETS,
  VISIT_OUTCOME_OPTIONS,
  VISIT_TYPE_OPTIONS,
  labelFromCooperationSlug,
  labelFromVisitOutcomeSlug,
  labelFromVisitTypeSlug,
  mergeDistinctOptions,
  planCategoryLabel,
  PLAN_STATUS_LABELS,
  slugForCooperation,
  slugForVisitOutcome,
  slugForVisitType,
} from '@/lib/residentFieldOptions';

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
    referralSourceOther: '',
    referringAgency: '',
    referringAgencyOther: '',
    initialAssessment: '',
    admissionDate: '',
    dateOfBirth: '',
    religion: '',
    birthStatus: '',
    placeOfBirth: '',
    placeOfBirthOther: '',
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
    socialWorkerOther: '',
    sessionType: 'individual' as 'individual' | 'group',
    durationPreset: '60' as string,
    durationMinutes: 60,
    emotionalStateStart: '',
    emotionalStateStartOther: '',
    emotionalStateEnd: '',
    emotionalStateEndOther: '',
    narrative: '',
    interventions: '',
    followUpActions: '',
    progressNoted: false,
    concernsFlagged: false,
  });
  const [visitForm, setVisitForm] = useState({
    visitDate: new Date().toISOString().slice(0, 10),
    socialWorker: '',
    socialWorkerOther: '',
    visitType: '',
    visitTypeOther: '',
    location: '',
    locationOther: '',
    familyMembersPresent: '',
    familyMembersPresentOther: '',
    purpose: '',
    purposeOther: '',
    observations: '',
    familyCooperationLevel: '',
    cooperationOther: '',
    safetyConcernsNoted: false,
    followUpNeeded: false,
    visitOutcome: '',
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
  const referralSourceOptions = useMemo(
    () =>
      [...new Set(allResidents.map((r: Resident) => r.referralSource).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    [allResidents],
  );
  const referringAgencyOptions = useMemo(
    () =>
      [...new Set(allResidents.map((r: Resident) => r.referringAgency).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    [allResidents],
  );
  const placeOfBirthOptions = useMemo(
    () =>
      [...new Set(allResidents.map((r: Resident) => r.placeOfBirth).filter(Boolean))].sort((a, b) =>
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

  const emotionalStateOptions = useMemo(
    () =>
      mergeDistinctOptions(
        sessions.flatMap((s) => [s.emotionalStateStart, s.emotionalStateEnd]),
        [...EMOTIONAL_STATE_SEEDS],
      ),
    [sessions],
  );
  const visitLocationOptions = useMemo(() => mergeDistinctOptions(visitations.map((v) => v.location)), [visitations]);
  const visitPurposeOptions = useMemo(() => mergeDistinctOptions(visitations.map((v) => v.purpose)), [visitations]);
  const visitFamilyPresentOptions = useMemo(
    () => mergeDistinctOptions(visitations.map((v) => v.familyMembersPresent)),
    [visitations],
  );
  const planCategoryOptions = useMemo(
    () => mergeDistinctOptions(plans.map((p) => p.planCategory), [...DEFAULT_PLAN_CATEGORY_SLUGS]),
    [plans],
  );

  const buildSessionApiPayload = () => {
    const socialWorker =
      sessionForm.socialWorker === 'other'
        ? sessionForm.socialWorkerOther.trim()
        : sessionForm.socialWorker.trim();
    const emotionalStateStart =
      sessionForm.emotionalStateStart === 'other'
        ? toTitleCase(sessionForm.emotionalStateStartOther)
        : sessionForm.emotionalStateStart.trim();
    const emotionalStateEnd =
      sessionForm.emotionalStateEnd === 'other'
        ? toTitleCase(sessionForm.emotionalStateEndOther)
        : sessionForm.emotionalStateEnd.trim();
    const durationMinutes =
      sessionForm.durationPreset === 'other' ? sessionForm.durationMinutes : Number(sessionForm.durationPreset);
    return {
      sessionDate: sessionForm.sessionDate,
      socialWorker,
      sessionType: sessionForm.sessionType,
      durationMinutes,
      emotionalStateStart,
      emotionalStateEnd,
      narrative: sessionForm.narrative.trim(),
      interventions: sessionForm.interventions.trim(),
      followUpActions: sessionForm.followUpActions.trim(),
      progressNoted: sessionForm.progressNoted,
      concernsFlagged: sessionForm.concernsFlagged,
    };
  };

  const buildVisitApiPayload = () => {
    const socialWorker =
      visitForm.socialWorker === 'other'
        ? visitForm.socialWorkerOther.trim()
        : visitForm.socialWorker.trim();
    const visitType = labelFromVisitTypeSlug(visitForm.visitType, visitForm.visitTypeOther);
    const location =
      visitForm.location === 'other'
        ? toTitleCase(visitForm.locationOther)
        : visitForm.location.trim();
    const familyMembersPresent =
      visitForm.familyMembersPresent === 'other'
        ? toTitleCase(visitForm.familyMembersPresentOther)
        : visitForm.familyMembersPresent.trim();
    const purpose =
      visitForm.purpose === 'other' ? toTitleCase(visitForm.purposeOther) : visitForm.purpose.trim();
    const familyCooperationLevel = labelFromCooperationSlug(visitForm.familyCooperationLevel, visitForm.cooperationOther);
    const visitOutcome = labelFromVisitOutcomeSlug(visitForm.visitOutcome, visitForm.outcomeOther);
    return {
      visitDate: visitForm.visitDate,
      socialWorker,
      visitType,
      location,
      familyMembersPresent,
      purpose,
      observations: visitForm.observations.trim(),
      familyCooperationLevel,
      safetyConcernsNoted: visitForm.safetyConcernsNoted,
      followUpNeeded: visitForm.followUpNeeded,
      visitOutcome,
    };
  };

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
      referralSource:
        residentForm.referralSource === 'other' ? residentForm.referralSourceOther : residentForm.referralSource,
      referringAgency:
        residentForm.referringAgency === 'other' ? residentForm.referringAgencyOther : residentForm.referringAgency,
      initialAssessment: residentForm.initialAssessment,
      admissionDate: residentForm.admissionDate,
      dateOfBirth: residentForm.dateOfBirth,
      religion: residentForm.religion === 'other' ? residentForm.religionOther : residentForm.religion,
      birthStatus: residentForm.birthStatus === 'other' ? residentForm.birthStatusOther : residentForm.birthStatus,
      placeOfBirth: residentForm.placeOfBirth === 'other' ? residentForm.placeOfBirthOther : residentForm.placeOfBirth,
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
    mutationFn: () => {
      const payload = buildSessionApiPayload();
      return editingSessionId
        ? updateResidentSession(id!, editingSessionId, payload)
        : createResidentSession(id!, payload);
    },
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
      const payload = buildVisitApiPayload();
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
      const planCategory =
        planForm.planCategory === 'other'
          ? toTitleCase(planForm.planCategoryOther)
          : planForm.planCategory.trim();
      const payload = {
        planCategory,
        description: planForm.description.trim(),
        servicesProvided: planForm.servicesProvided.trim(),
        targetDate: planForm.targetDate,
        status: planForm.status,
        caseConferenceDate: planForm.caseConferenceDate,
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

  const sessionPagination = usePagination(sessions.length);
  const visitPagination = usePagination(visitations.length);

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
                  <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
                    <Users className="h-8 w-8 text-primary shrink-0" />
                    {resident.internalCode}
                  </h1>
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
                    const refSrc = matchSelectOption(resident.referralSource, referralSourceOptions);
                    const refAg = matchSelectOption(resident.referringAgency, referringAgencyOptions);
                    const pob = matchSelectOption(resident.placeOfBirth, placeOfBirthOptions);
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
                      referralSource: refSrc.select === 'other' ? 'other' : refSrc.select,
                      referralSourceOther: refSrc.other,
                      referringAgency: refAg.select === 'other' ? 'other' : refAg.select,
                      referringAgencyOther: refAg.other,
                      initialAssessment: resident.initialAssessment,
                      admissionDate: resident.admissionDate,
                      dateOfBirth: resident.dateOfBirth,
                      religion: rel.select === 'other' ? 'other' : rel.select,
                      religionOther: rel.other,
                      birthStatus: bs.select === 'other' ? 'other' : bs.select,
                      birthStatusOther: bs.other,
                      placeOfBirth: pob.select === 'other' ? 'other' : pob.select,
                      placeOfBirthOther: pob.other,
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
              <div className="mt-4 border rounded-lg p-3 bg-muted/20">
                <p className="text-sm font-medium text-foreground">Case Management Prediction</p>
                {resident.casePrediction?.modelAvailable ? (
                  <div className="space-y-1 mt-2 text-sm">
                    <p>
                      Risk escalation (30d):{' '}
                      <span className="font-semibold">
                        {Math.round((resident.casePrediction.riskEscalationProbability ?? 0) * 100)}%
                      </span>{' '}
                      · tier <span className="capitalize">{resident.casePrediction.riskEscalationTier}</span>
                    </p>
                    <p>
                      Reintegration success (90d):{' '}
                      <span className="font-semibold">
                        {Math.round((resident.casePrediction.reintegrationSuccessProbability ?? 0) * 100)}%
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Model {resident.casePrediction.modelVersion} · scored {new Date(resident.casePrediction.scoredAtUtc).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">
                    Prediction model unavailable. Caseload still uses operational records.
                  </p>
                )}
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

              <Card>
                <CardHeader><CardTitle className="font-display text-lg">Prediction Recommendations</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {resident.casePrediction?.modelAvailable ? (
                    <>
                      {resident.casePrediction.recommendedActions.map((action, idx) => (
                        <p key={`${action}-${idx}`} className="text-foreground">- {action}</p>
                      ))}
                    </>
                  ) : (
                    <p className="text-muted-foreground">No model recommendations available for this resident.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="counseling" className="mt-6 space-y-4">
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setEditingSessionId(null);
                    setSessionForm({
                      sessionDate: new Date().toISOString().slice(0, 10),
                      socialWorker: '',
                      socialWorkerOther: '',
                      sessionType: 'individual',
                      durationPreset: '60',
                      durationMinutes: 60,
                      emotionalStateStart: '',
                      emotionalStateStartOther: '',
                      emotionalStateEnd: '',
                      emotionalStateEndOther: '',
                      narrative: '',
                      interventions: '',
                      followUpActions: '',
                      progressNoted: false,
                      concernsFlagged: false,
                    });
                    setOpenSession(true);
                  }}
                >
                  Add Session
                </Button>
              </div>
              {sessionsQ.isLoading ? <Skeleton className="h-40 w-full" /> : sessions.slice(sessionPagination.startIndex, sessionPagination.endIndex).map(s => (
                <Card key={s.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base font-display flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" /> {s.sessionDate}
                      </CardTitle>
                      <Badge variant="outline">{toTitleCase(s.sessionType)}</Badge>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingSessionId(s.id);
                          const sw = matchSelectOption(s.socialWorker, socialWorkerOptions);
                          const es = matchSelectOption(s.emotionalStateStart, emotionalStateOptions);
                          const ee = matchSelectOption(s.emotionalStateEnd, emotionalStateOptions);
                          const inPreset = SESSION_DURATION_PRESETS.includes(
                            s.durationMinutes as (typeof SESSION_DURATION_PRESETS)[number],
                          );
                          setSessionForm({
                            sessionDate: s.sessionDate,
                            socialWorker: sw.select === 'other' ? 'other' : sw.select,
                            socialWorkerOther: sw.select === 'other' ? sw.other : '',
                            sessionType: s.sessionType,
                            durationPreset: inPreset ? String(s.durationMinutes) : 'other',
                            durationMinutes: s.durationMinutes,
                            emotionalStateStart: es.select === 'other' ? 'other' : es.select,
                            emotionalStateStartOther: es.select === 'other' ? es.other : '',
                            emotionalStateEnd: ee.select === 'other' ? 'other' : ee.select,
                            emotionalStateEndOther: ee.select === 'other' ? ee.other : '',
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
                <Button
                  onClick={() => {
                    setEditingVisitId(null);
                    setVisitForm({
                      visitDate: new Date().toISOString().slice(0, 10),
                      socialWorker: '',
                      socialWorkerOther: '',
                      visitType: '',
                      visitTypeOther: '',
                      location: '',
                      locationOther: '',
                      familyMembersPresent: '',
                      familyMembersPresentOther: '',
                      purpose: '',
                      purposeOther: '',
                      observations: '',
                      familyCooperationLevel: '',
                      cooperationOther: '',
                      safetyConcernsNoted: false,
                      followUpNeeded: false,
                      visitOutcome: '',
                      outcomeOther: '',
                    });
                    setOpenVisit(true);
                  }}
                >
                  Log Visitation
                </Button>
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
                        const sw = matchSelectOption(v.socialWorker, socialWorkerOptions);
                        const loc = matchSelectOption(v.location, visitLocationOptions);
                        const fam = matchSelectOption(v.familyMembersPresent, visitFamilyPresentOptions);
                        const pur = matchSelectOption(v.purpose, visitPurposeOptions);
                        const vt = slugForVisitType(v.visitType);
                        const coop = slugForCooperation(v.familyCooperationLevel || '');
                        const out = slugForVisitOutcome(v.visitOutcome || '');
                        setVisitForm({
                          visitDate: v.visitDate,
                          socialWorker: sw.select === 'other' ? 'other' : sw.select,
                          socialWorkerOther: sw.select === 'other' ? sw.other : '',
                          visitType: vt,
                          visitTypeOther: vt === 'other' ? v.visitType : '',
                          location: loc.select === 'other' ? 'other' : loc.select,
                          locationOther: loc.select === 'other' ? loc.other : '',
                          familyMembersPresent: fam.select === 'other' ? 'other' : fam.select,
                          familyMembersPresentOther: fam.select === 'other' ? fam.other : '',
                          purpose: pur.select === 'other' ? 'other' : pur.select,
                          purposeOther: pur.select === 'other' ? pur.other : '',
                          observations: v.observations,
                          familyCooperationLevel: coop,
                          cooperationOther: coop === 'other' ? (v.familyCooperationLevel || '') : '',
                          safetyConcernsNoted: v.safetyConcernsNoted,
                          followUpNeeded: v.followUpNeeded,
                          visitOutcome: out,
                          outcomeOther: out === 'other' ? (v.visitOutcome || '') : '',
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
                <Button
                  onClick={() => {
                    setEditingPlanId(null);
                    setPlanForm({
                      planCategory: '',
                      planCategoryOther: '',
                      description: '',
                      servicesProvided: '',
                      targetDate: '',
                      status: 'pending',
                      caseConferenceDate: '',
                    });
                    setOpenPlan(true);
                  }}
                >
                  Add Plan
                </Button>
              </div>
              {plansQ.isLoading ? <Skeleton className="h-40 w-full" /> : plans.map(p => (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base font-display">{planCategoryLabel(p.planCategory)}</CardTitle>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full capitalize ${planStatusColors[p.status] ?? ''}`}>{p.status}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingPlanId(p.id);
                            const pc = matchSelectOption(p.planCategory, planCategoryOptions);
                            setPlanForm({
                              planCategory: pc.select === 'other' ? 'other' : pc.select,
                              planCategoryOther: pc.select === 'other' ? pc.other : '',
                              description: p.description,
                              servicesProvided: p.servicesProvided,
                              targetDate: p.targetDate,
                              status: p.status,
                              caseConferenceDate: p.caseConferenceDate,
                            });
                            setOpenPlan(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
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
        <DialogContent className="sm:max-w-xl w-[min(100vw-2rem,36rem)] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="font-display">
              {editingSessionId ? 'Edit Counseling Session' : 'Add Counseling Session'}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto px-6 pb-4 flex-1 min-h-0 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Session Date</Label>
                <Input type="date" value={sessionForm.sessionDate} onChange={(e) => setSessionForm({ ...sessionForm, sessionDate: e.target.value })} />
              </div>
              <EditableSelect
                label="Social Worker"
                allowEmpty
                placeholder="Select social worker"
                value={sessionForm.socialWorker}
                customValue={sessionForm.socialWorkerOther}
                options={socialWorkerOptions}
                onChange={(v) => setSessionForm({ ...sessionForm, socialWorker: v })}
                onCustomChange={(v) => setSessionForm({ ...sessionForm, socialWorkerOther: v })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={sessionForm.sessionType}
                  onValueChange={(v: 'individual' | 'group') => setSessionForm({ ...sessionForm, sessionType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Duration</Label>
                <Select
                  value={sessionForm.durationPreset}
                  onValueChange={(v) =>
                    setSessionForm({
                      ...sessionForm,
                      durationPreset: v,
                      durationMinutes: v === 'other' ? sessionForm.durationMinutes : Number(v),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_DURATION_PRESETS.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {m} Minutes
                      </SelectItem>
                    ))}
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {sessionForm.durationPreset === 'other' && (
                  <Input
                    type="number"
                    min={1}
                    className="mt-1"
                    value={sessionForm.durationMinutes || ''}
                    onChange={(e) => setSessionForm({ ...sessionForm, durationMinutes: Number(e.target.value) })}
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <EditableSelect
                label="Emotional State (Start)"
                allowEmpty
                placeholder="Select observed state"
                value={sessionForm.emotionalStateStart}
                customValue={sessionForm.emotionalStateStartOther}
                options={emotionalStateOptions}
                onChange={(v) => setSessionForm({ ...sessionForm, emotionalStateStart: v })}
                onCustomChange={(v) => setSessionForm({ ...sessionForm, emotionalStateStartOther: v })}
              />
              <EditableSelect
                label="Emotional State (End)"
                allowEmpty
                placeholder="Select observed state"
                value={sessionForm.emotionalStateEnd}
                customValue={sessionForm.emotionalStateEndOther}
                options={emotionalStateOptions}
                onChange={(v) => setSessionForm({ ...sessionForm, emotionalStateEnd: v })}
                onCustomChange={(v) => setSessionForm({ ...sessionForm, emotionalStateEndOther: v })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Narrative</Label>
              <Textarea rows={4} value={sessionForm.narrative} onChange={(e) => setSessionForm({ ...sessionForm, narrative: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Interventions</Label>
              <Textarea rows={3} value={sessionForm.interventions} onChange={(e) => setSessionForm({ ...sessionForm, interventions: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Follow-Up Actions</Label>
              <Textarea rows={3} value={sessionForm.followUpActions} onChange={(e) => setSessionForm({ ...sessionForm, followUpActions: e.target.value })} />
            </div>
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={sessionForm.progressNoted} onChange={(e) => setSessionForm({ ...sessionForm, progressNoted: e.target.checked })} />
              Progress Noted
            </label>
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={sessionForm.concernsFlagged} onChange={(e) => setSessionForm({ ...sessionForm, concernsFlagged: e.target.checked })} />
              Concerns Flagged
            </label>
          </div>
          <div className="border-t px-6 py-4 shrink-0 flex justify-end gap-2 bg-muted/30">
            <Button variant="outline" type="button" onClick={() => setOpenSession(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => saveSessionMutation.mutate()}
              disabled={
                saveSessionMutation.isPending ||
                !sessionForm.sessionDate ||
                !(sessionForm.socialWorker === 'other'
                  ? sessionForm.socialWorkerOther.trim()
                  : sessionForm.socialWorker.trim())
              }
            >
              {saveSessionMutation.isPending ? 'Saving...' : 'Save Session'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openVisit} onOpenChange={setOpenVisit}>
        <DialogContent className="sm:max-w-xl w-[min(100vw-2rem,36rem)] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="font-display">
              {editingVisitId ? 'Edit Home Visitation' : 'Log Home Visitation'}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto px-6 pb-4 flex-1 min-h-0 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Visit Date</Label>
                <Input type="date" value={visitForm.visitDate} onChange={(e) => setVisitForm({ ...visitForm, visitDate: e.target.value })} />
              </div>
              <EditableSelect
                label="Social Worker"
                allowEmpty
                placeholder="Select social worker"
                value={visitForm.socialWorker}
                customValue={visitForm.socialWorkerOther}
                options={socialWorkerOptions}
                onChange={(v) => setVisitForm({ ...visitForm, socialWorker: v })}
                onCustomChange={(v) => setVisitForm({ ...visitForm, socialWorkerOther: v })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Visit Type</Label>
              <Select
                value={visitForm.visitType || '__none__'}
                onValueChange={(v) => setVisitForm({ ...visitForm, visitType: v === '__none__' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select visit type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-muted-foreground">
                    Select visit type
                  </SelectItem>
                  {VISIT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.slug} value={o.slug}>
                      {o.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">Add New…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {visitForm.visitType === 'other' && (
              <div className="grid gap-2">
                <Label>New Visit Type</Label>
                <Input
                  value={visitForm.visitTypeOther}
                  onChange={(e) => setVisitForm({ ...visitForm, visitTypeOther: e.target.value })}
                  placeholder="Describe visit type"
                />
              </div>
            )}
            <EditableSelect
              label="Location"
              allowEmpty
              placeholder="Select location"
              value={visitForm.location}
              customValue={visitForm.locationOther}
              options={visitLocationOptions}
              onChange={(v) => setVisitForm({ ...visitForm, location: v })}
              onCustomChange={(v) => setVisitForm({ ...visitForm, locationOther: v })}
            />
            <EditableSelect
              label="Family Members Present"
              allowEmpty
              placeholder="Select or describe"
              value={visitForm.familyMembersPresent}
              customValue={visitForm.familyMembersPresentOther}
              options={visitFamilyPresentOptions}
              onChange={(v) => setVisitForm({ ...visitForm, familyMembersPresent: v })}
              onCustomChange={(v) => setVisitForm({ ...visitForm, familyMembersPresentOther: v })}
            />
            <EditableSelect
              label="Purpose"
              allowEmpty
              placeholder="Select purpose"
              value={visitForm.purpose}
              customValue={visitForm.purposeOther}
              options={visitPurposeOptions}
              onChange={(v) => setVisitForm({ ...visitForm, purpose: v })}
              onCustomChange={(v) => setVisitForm({ ...visitForm, purposeOther: v })}
            />
            <div className="grid gap-2">
              <Label>Observations</Label>
              <Textarea rows={4} value={visitForm.observations} onChange={(e) => setVisitForm({ ...visitForm, observations: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Family Cooperation Level</Label>
              <Select
                value={visitForm.familyCooperationLevel || '__none__'}
                onValueChange={(v) => setVisitForm({ ...visitForm, familyCooperationLevel: v === '__none__' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select cooperation level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-muted-foreground">
                    Select cooperation level
                  </SelectItem>
                  {COOPERATION_LEVEL_OPTIONS.map((o) => (
                    <SelectItem key={o.slug} value={o.slug}>
                      {o.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">Add New…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {visitForm.familyCooperationLevel === 'other' && (
              <div className="grid gap-2">
                <Label>New Cooperation Value</Label>
                <Input
                  value={visitForm.cooperationOther}
                  onChange={(e) => setVisitForm({ ...visitForm, cooperationOther: e.target.value })}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label>Visit Outcome</Label>
              <Select
                value={visitForm.visitOutcome || '__none__'}
                onValueChange={(v) => setVisitForm({ ...visitForm, visitOutcome: v === '__none__' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-muted-foreground">
                    Select outcome
                  </SelectItem>
                  {VISIT_OUTCOME_OPTIONS.map((o) => (
                    <SelectItem key={o.slug} value={o.slug}>
                      {o.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">Add New…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {visitForm.visitOutcome === 'other' && (
              <div className="grid gap-2">
                <Label>New Outcome</Label>
                <Input value={visitForm.outcomeOther} onChange={(e) => setVisitForm({ ...visitForm, outcomeOther: e.target.value })} />
              </div>
            )}
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={visitForm.safetyConcernsNoted} onChange={(e) => setVisitForm({ ...visitForm, safetyConcernsNoted: e.target.checked })} />
              Safety Concerns Noted
            </label>
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={visitForm.followUpNeeded} onChange={(e) => setVisitForm({ ...visitForm, followUpNeeded: e.target.checked })} />
              Follow-Up Needed
            </label>
          </div>
          <div className="border-t px-6 py-4 shrink-0 flex justify-end gap-2 bg-muted/30">
            <Button variant="outline" type="button" onClick={() => setOpenVisit(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => saveVisitMutation.mutate()}
              disabled={
                saveVisitMutation.isPending ||
                !visitForm.visitDate ||
                !(visitForm.socialWorker === 'other'
                  ? visitForm.socialWorkerOther.trim()
                  : visitForm.socialWorker.trim()) ||
                !visitForm.visitType ||
                (visitForm.visitType === 'other' && !visitForm.visitTypeOther.trim()) ||
                (visitForm.familyCooperationLevel === 'other' && !visitForm.cooperationOther.trim()) ||
                (visitForm.visitOutcome === 'other' && !visitForm.outcomeOther.trim())
              }
            >
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
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={residentForm.caseStatus} onValueChange={(v) => setResidentForm({ ...residentForm, caseStatus: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="transferred">Transferred</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Risk</Label>
                  <Select value={residentForm.riskLevel} onValueChange={(v) => setResidentForm({ ...residentForm, riskLevel: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
              <EditableSelect
                label="Place of birth"
                allowEmpty
                placeholder="Select place of birth"
                value={residentForm.placeOfBirth}
                customValue={residentForm.placeOfBirthOther}
                options={placeOfBirthOptions}
                onChange={(v) => setResidentForm({ ...residentForm, placeOfBirth: v })}
                onCustomChange={(v) => setResidentForm({ ...residentForm, placeOfBirthOther: v })}
              />
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
                <EditableSelect
                  label="Referral source"
                  allowEmpty
                  placeholder="Select referral source"
                  value={residentForm.referralSource}
                  customValue={residentForm.referralSourceOther}
                  options={referralSourceOptions}
                  onChange={(v) => setResidentForm({ ...residentForm, referralSource: v })}
                  onCustomChange={(v) => setResidentForm({ ...residentForm, referralSourceOther: v })}
                />
                <EditableSelect
                  label="Referring agency / person"
                  allowEmpty
                  placeholder="Select agency or person"
                  value={residentForm.referringAgency}
                  customValue={residentForm.referringAgencyOther}
                  options={referringAgencyOptions}
                  onChange={(v) => setResidentForm({ ...residentForm, referringAgency: v })}
                  onCustomChange={(v) => setResidentForm({ ...residentForm, referringAgencyOther: v })}
                />
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
        <DialogContent className="sm:max-w-xl w-[min(100vw-2rem,36rem)] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="font-display">
              {editingPlanId ? 'Edit Intervention Plan' : 'Add Intervention Plan'}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto px-6 pb-4 flex-1 min-h-0 space-y-3">
            <EditableSelect
              label="Plan Category"
              allowEmpty
              placeholder="Select plan category"
              value={planForm.planCategory}
              customValue={planForm.planCategoryOther}
              options={planCategoryOptions}
              getOptionLabel={(o) => planCategoryLabel(o)}
              onChange={(v) => setPlanForm({ ...planForm, planCategory: v })}
              onCustomChange={(v) => setPlanForm({ ...planForm, planCategoryOther: v })}
            />
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea rows={4} value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Services Provided</Label>
              <Textarea rows={3} value={planForm.servicesProvided} onChange={(e) => setPlanForm({ ...planForm, servicesProvided: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Target Date</Label>
                <Input type="date" value={planForm.targetDate} onChange={(e) => setPlanForm({ ...planForm, targetDate: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Case Conference Date</Label>
                <Input type="date" value={planForm.caseConferenceDate} onChange={(e) => setPlanForm({ ...planForm, caseConferenceDate: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={planForm.status}
                onValueChange={(v: 'pending' | 'in-progress' | 'completed' | 'on-hold') => setPlanForm({ ...planForm, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PLAN_STATUS_LABELS) as (keyof typeof PLAN_STATUS_LABELS)[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {PLAN_STATUS_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="border-t px-6 py-4 shrink-0 flex justify-end gap-2 bg-muted/30">
            <Button variant="outline" type="button" onClick={() => setOpenPlan(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => savePlanMutation.mutate()}
              disabled={
                savePlanMutation.isPending ||
                !planForm.planCategory ||
                (planForm.planCategory === 'other' && !planForm.planCategoryOther.trim())
              }
            >
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
