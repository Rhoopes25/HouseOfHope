import { apiFetch } from './api';
import type {
  CounselingSession,
  Donation,
  InterventionPlan,
  Resident,
  SocialMediaPost,
  Supporter,
  Visitation,
} from './types';

export interface MonthlyTrendPoint {
  month: string;
  residents: number;
  donations: number;
  education: number;
  health: number;
}

export interface ImpactStats {
  totalResidentsServed: number;
  totalDonationsReceived: number;
  reintegrationSuccessRate: number;
  educationEnrollmentRate: number;
  healthImprovementRate: number;
  donorRetentionRate: number;
  monthlyTrends: MonthlyTrendPoint[];
}

export interface DonationTypeSlice {
  name: string;
  value: number;
}

export interface SafehousePerformance {
  name: string;
  residents: number;
  reintegration: number;
  education: number;
}

export interface ReintegrationByType {
  name: string;
  rate: number;
}

export interface IncidentStack {
  type: string;
  low: number;
  medium: number;
  high: number;
}

export interface ReportsAnalyticsPayload {
  summary: ImpactStats;
  donationsByType: DonationTypeSlice[];
  safehouseComparison: SafehousePerformance[];
  reintegrationByType: ReintegrationByType[];
  incidentsByType: IncidentStack[];
}

export interface UpcomingConference {
  id: string;
  residentCode: string;
  date: string;
  type: string;
}

export interface DashboardSummary {
  highRiskResidents: Resident[];
  recentDonations: Donation[];
  monthlyDonationsTotal: number;
  educationHealthTrend: MonthlyTrendPoint[];
  upcomingConferences: UpcomingConference[];
}

export const fetchResidents = () => apiFetch<Resident[]>('/Residents');

export const fetchResident = (id: string) => apiFetch<Resident>(`/Residents/${id}`);

export const fetchResidentSessions = (id: string) =>
  apiFetch<CounselingSession[]>(`/Residents/${id}/sessions`);

export const fetchResidentVisitations = (id: string) =>
  apiFetch<Visitation[]>(`/Residents/${id}/visitations`);

export const fetchAllVisitations = () =>
  apiFetch<Visitation[]>('/Residents/visitations');

export const fetchResidentPlans = (id: string) =>
  apiFetch<InterventionPlan[]>(`/Residents/${id}/intervention-plans`);

export const fetchCaseConferences = () =>
  apiFetch<UpcomingConference[]>('/Residents/case-conferences');

export const fetchSupporters = () => apiFetch<Supporter[]>('/Supporters');
export const createSupporter = (payload: {
  displayName: string;
  supporterType: string;
  status: string;
  country?: string;
  region?: string;
  email?: string;
  acquisitionChannel?: string;
  firstDonationDate?: string;
}) => apiFetch<Supporter>('/Supporters', { method: 'POST', body: JSON.stringify(payload) });
export const updateSupporter = (id: string, payload: {
  displayName: string;
  supporterType: string;
  status: string;
  country?: string;
  region?: string;
  email?: string;
  acquisitionChannel?: string;
  firstDonationDate?: string;
}) => apiFetch<void>(`/Supporters/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteSupporter = (id: string) => apiFetch<void>(`/Supporters/${id}?confirm=true`, { method: 'DELETE' });

export const fetchDonations = () => apiFetch<Donation[]>('/Donations');
export const fetchMyDonations = () => apiFetch<Donation[]>('/Donations/my');
export const createMyDonation = (payload: {
  donationType: 'Monetary' | 'InKind' | 'Time' | 'Skills' | 'SocialMedia';
  donationDate: string;
  amount?: number;
  estimatedValue?: number;
  currencyCode?: string;
  campaignName?: string;
  notes?: string;
}) =>
  apiFetch<Donation>('/Donations/my', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
export const createDonation = (payload: {
  supporterId: number;
  donationType: string;
  donationDate: string;
  amount?: number;
  estimatedValue?: number;
  currencyCode?: string;
  campaignName?: string;
  notes?: string;
}) => apiFetch<Donation>('/Donations', { method: 'POST', body: JSON.stringify(payload) });
export const updateDonation = (id: string, payload: {
  supporterId: number;
  donationType: string;
  donationDate: string;
  amount?: number;
  estimatedValue?: number;
  currencyCode?: string;
  campaignName?: string;
  notes?: string;
}) => apiFetch<void>(`/Donations/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteDonation = (id: string) => apiFetch<void>(`/Donations/${id}?confirm=true`, { method: 'DELETE' });

export type ResidentUpsertPayload = {
  caseControlNumber: string;
  internalCode: string;
  safehouseName: string;
  caseStatus: string;
  caseCategory: string;
  riskLevel: string;
  assignedSocialWorker: string;
  reintegrationStatus?: string;
  reintegrationType?: string;
  admissionDate?: string;
  dateOfBirth?: string;
  referralSource?: string;
  referringAgency?: string;
  initialAssessment?: string;
  religion?: string;
  birthStatus?: string;
  placeOfBirth?: string;
  subCatOrphaned?: boolean;
  subCatTrafficked?: boolean;
  subCatChildLabor?: boolean;
  subCatPhysicalAbuse?: boolean;
  subCatSexualAbuse?: boolean;
  subCatOsaec?: boolean;
  subCatCicl?: boolean;
  subCatAtRisk?: boolean;
  subCatStreetChild?: boolean;
  subCatChildWithHiv?: boolean;
  familyIs4ps?: boolean;
  familySoloParent?: boolean;
  familyIndigenous?: boolean;
  familyInformalSettler?: boolean;
  familyParentPwd?: boolean;
};

export const createResident = (payload: ResidentUpsertPayload) =>
  apiFetch<Resident>('/Residents', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateResident = (id: string, payload: ResidentUpsertPayload) =>
  apiFetch<void>(`/Residents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const deleteResident = (id: string) =>
  apiFetch<void>(`/Residents/${id}?confirm=true`, { method: 'DELETE' });

export const createResidentSession = (
  id: string,
  payload: {
    sessionDate: string;
    socialWorker: string;
    sessionType: 'individual' | 'group';
    durationMinutes?: number;
    emotionalStateStart?: string;
    emotionalStateEnd?: string;
    narrative?: string;
    interventions?: string;
    followUpActions?: string;
    progressNoted?: boolean;
    concernsFlagged?: boolean;
  },
) =>
  apiFetch<CounselingSession>(`/Residents/${id}/sessions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
export const updateResidentSession = (
  id: string,
  sessionId: string,
  payload: {
    sessionDate: string;
    socialWorker: string;
    sessionType: 'individual' | 'group';
    durationMinutes?: number;
    emotionalStateStart?: string;
    emotionalStateEnd?: string;
    narrative?: string;
    interventions?: string;
    followUpActions?: string;
    progressNoted?: boolean;
    concernsFlagged?: boolean;
  },
) =>
  apiFetch<void>(`/Residents/${id}/sessions/${sessionId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const deleteResidentSession = (id: string, sessionId: string) =>
  apiFetch<void>(`/Residents/${id}/sessions/${sessionId}?confirm=true`, {
    method: 'DELETE',
  });

export const createResidentVisitation = (
  id: string,
  payload: {
    visitDate: string;
    socialWorker: string;
    visitType: string;
    location?: string;
    familyMembersPresent?: string;
    purpose?: string;
    observations?: string;
    familyCooperationLevel?: string;
    safetyConcernsNoted?: boolean;
    followUpNeeded?: boolean;
    visitOutcome?: string;
  },
) =>
  apiFetch<Visitation>(`/Residents/${id}/visitations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
export const updateResidentVisitation = (
  id: string,
  visitationId: string,
  payload: {
    visitDate: string;
    socialWorker: string;
    visitType: string;
    location?: string;
    familyMembersPresent?: string;
    purpose?: string;
    observations?: string;
    familyCooperationLevel?: string;
    safetyConcernsNoted?: boolean;
    followUpNeeded?: boolean;
    visitOutcome?: string;
  },
) =>
  apiFetch<void>(`/Residents/${id}/visitations/${visitationId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const deleteResidentVisitation = (id: string, visitationId: string) =>
  apiFetch<void>(`/Residents/${id}/visitations/${visitationId}?confirm=true`, {
    method: 'DELETE',
  });

export const createResidentPlan = (
  id: string,
  payload: {
    planCategory?: string;
    description?: string;
    servicesProvided?: string;
    targetDate?: string;
    status?: 'pending' | 'in-progress' | 'completed' | 'on-hold';
    caseConferenceDate?: string;
  },
) =>
  apiFetch<InterventionPlan>(`/Residents/${id}/intervention-plans`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateResidentPlan = (
  id: string,
  planId: string,
  payload: {
    planCategory?: string;
    description?: string;
    servicesProvided?: string;
    targetDate?: string;
    status?: 'pending' | 'in-progress' | 'completed' | 'on-hold';
    caseConferenceDate?: string;
  },
) =>
  apiFetch<void>(`/Residents/${id}/intervention-plans/${planId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const deleteResidentPlan = (id: string, planId: string) =>
  apiFetch<void>(`/Residents/${id}/intervention-plans/${planId}?confirm=true`, {
    method: 'DELETE',
  });

export const fetchSocialPosts = () => apiFetch<SocialMediaPost[]>('/social-media-posts');

export const fetchImpactStats = () => apiFetch<ImpactStats>('/Analytics/impact');

export const fetchReportsAnalytics = () => apiFetch<ReportsAnalyticsPayload>('/Analytics/reports');

export const fetchDashboard = () => apiFetch<DashboardSummary>('/Analytics/dashboard');
