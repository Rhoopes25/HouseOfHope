export type UserRole = 'admin' | 'donor' | 'public';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type CaseStatus = 'active' | 'closed' | 'transferred';

export interface CaseManagementPrediction {
  modelAvailable: boolean;
  modelVersion: string;
  scoredAtUtc: string;
  riskEscalationProbability: number;
  riskEscalationTier: 'low' | 'medium' | 'high' | 'unknown';
  riskEscalationFlag: boolean;
  reintegrationSuccessProbability: number;
  reintegrationLikelyWithin90d: boolean;
  recommendedActions: string[];
}

export interface Resident {
  id: string;
  caseControlNumber: string;
  internalCode: string;
  safehouse: string;
  caseStatus: CaseStatus;
  caseCategory: string;
  caseSubcategories: string[];
  riskLevel: RiskLevel;
  /** Intake risk; empty if not recorded */
  initialRiskLevel: RiskLevel | '';
  assignedSocialWorker: string;
  reintegrationStatus: string;
  reintegrationType: string;
  admissionDate: string;
  dateOfBirth: string;
  religion: string;
  birthStatus: string;
  placeOfBirth: string;
  referralSource: string;
  referringAgency: string;
  initialAssessment: string;
  is4PsBeneficiary: boolean;
  isSoloParent: boolean;
  indigenousGroup: string;
  isInformalSettler: boolean;
  parentWithDisability: boolean;
  reintegrationReadinessScore: number | null;
  casePrediction?: CaseManagementPrediction | null;
}

export interface CounselingSession {
  id: string;
  residentId: string;
  /** Present on organization-wide list responses. */
  residentInternalCode?: string;
  sessionDate: string;
  socialWorker: string;
  sessionType: 'individual' | 'group';
  durationMinutes: number;
  emotionalStateStart: string;
  emotionalStateEnd: string;
  narrative: string;
  interventions: string;
  followUpActions: string;
  progressNoted: boolean;
  concernsFlagged: boolean;
}

export interface Visitation {
  id: string;
  residentId: string;
  visitDate: string;
  socialWorker: string;
  visitType: string;
  location: string;
  familyMembersPresent: string;
  purpose: string;
  observations: string;
  familyCooperationLevel: string;
  safetyConcernsNoted: boolean;
  followUpNeeded: boolean;
  visitOutcome: string;
}

export interface InterventionPlan {
  id: string;
  residentId: string;
  /** Present on organization-wide list responses. */
  residentInternalCode?: string;
  planCategory: string;
  description: string;
  servicesProvided: string;
  targetDate: string;
  status: 'pending' | 'in-progress' | 'completed' | 'on-hold';
  caseConferenceDate: string;
}

export type SupporterType = 'monetary' | 'in-kind' | 'volunteer' | 'skills' | 'social-media' | 'partner';

export interface Supporter {
  id: string;
  displayName: string;
  email?: string;
  hasLinkedLogin?: boolean;
  hasAdminRole?: boolean;
  supporterType: SupporterType;
  status: 'active' | 'inactive';
  country: string;
  acquisitionChannel: string;
  firstDonationDate: string;
  churnRisk: RiskLevel;
}

export interface Donation {
  id: string;
  supporterId: string;
  donorName: string;
  date: string;
  type: 'monetary' | 'in-kind' | 'time' | 'skills' | 'social-media';
  amount?: number;
  currency?: string;
  itemDetails?: string;
  hours?: number;
  skillDescription?: string;
  campaignName?: string;
  notes?: string;
}

export interface SocialMediaPost {
  id: string;
  platform: string;
  postType: string;
  mediaType: string;
  date: string;
  impressions: number;
  reach: number;
  engagementRate: number;
  donationReferrals: number;
  estimatedDonationValue: number;
  contentTopic: string;
  sentimentTone: string;
}
