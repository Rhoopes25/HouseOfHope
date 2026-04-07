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

export const fetchResidentPlans = (id: string) =>
  apiFetch<InterventionPlan[]>(`/Residents/${id}/intervention-plans`);

export const fetchSupporters = () => apiFetch<Supporter[]>('/Supporters');

export const fetchDonations = () => apiFetch<Donation[]>('/Donations');

export const fetchSocialPosts = () => apiFetch<SocialMediaPost[]>('/social-media-posts');

export const fetchImpactStats = () => apiFetch<ImpactStats>('/Analytics/impact');

export const fetchReportsAnalytics = () => apiFetch<ReportsAnalyticsPayload>('/Analytics/reports');

export const fetchDashboard = () => apiFetch<DashboardSummary>('/Analytics/dashboard');
