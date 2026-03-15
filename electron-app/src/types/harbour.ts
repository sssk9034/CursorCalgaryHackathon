export type ModeLabel = 'Focus Ready' | 'Caution' | 'Overloaded' | 'Recovery';

export type ManualCheckIn =
  | 'none'
  | 'steady'
  | 'strained'
  | 'overwhelmed'
  | 'recovering';

export interface WearableState {
  stress: number;
  bodyBattery: number;
  trend: 'rising' | 'steady' | 'falling';
  updatedAt: string;
}

export interface TaskMetadata {
  importance: number;
  emotionalFriction: number;
  expectedDurationMin: number;
  dependencyRisk: number;
  momentumValue: number;
  fragmentability: number;
}

export interface HarbourTask {
  id: string;
  project: string;
  issueTitle: string;
  status: 'Todo' | 'In Progress' | 'Blocked' | 'Review';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  dueDate: string;
  assignee: string;
  cycleHint: string;
  urgency: number;
  clarity: number;
  activationEnergy: number;
  focusDepth: number;
  metadata: TaskMetadata;
  syncedAt: string;
  strategicTag?: boolean;
  overwhelmedFriendly?: boolean;
}

export interface EmailPressureItem {
  id: string;
  sender: string;
  subject: string;
  type:
    | 'requires-action'
    | 'deadline'
    | 'meeting-change'
    | 'stakeholder'
    | 'quick-reply';
  urgency: number;
  requiresResponseBy?: string;
  estimateReplyMin: number;
}

export type CalendarKind = 'fixed-meeting' | 'focus-window' | 'flex-slot';

export interface CalendarEvent {
  id: string;
  title: string;
  kind: CalendarKind;
  startTime: string;
  endTime: string;
  attendees?: number;
  isMovable?: boolean;
}

export interface TaskRanking {
  taskId: string;
  score: number;
  fitReason: string;
  timeFit: 'fit' | 'tight' | 'oversize';
}

export interface RecommendationChoice {
  taskId: string;
  label: string;
  estimateMin: number;
  explanation: string;
  cta: string;
}

export interface StrategicSafeguard {
  taskId: string;
  action: 'protected' | 'sliced' | 'deferred';
  detail: string;
}

export interface RecommendationResult {
  mode: ModeLabel;
  primary: RecommendationChoice;
  backups: RecommendationChoice[];
  rankings: TaskRanking[];
  rationale: string[];
  safeguard: StrategicSafeguard;
  availableWindowMin: number;
  meetingDensity: 'low' | 'medium' | 'high';
  emailPressure: 'low' | 'medium' | 'high';
  generatedAt: string;
}

export type PlanBlockType =
  | 'fixed-meeting'
  | 'protected-deep-work'
  | 'flexible-work'
  | 'break-recovery'
  | 'email-admin'
  | 'moved-replanned';

export interface PlanBlock {
  id: string;
  type: PlanBlockType;
  title: string;
  startTime: string;
  endTime: string;
  taskId?: string;
  note?: string;
}

export interface ReplanDiff {
  previousRecommendation: string;
  currentRecommendation: string;
  movedTaskLabels: string[];
  protectedSummary: string;
  changedAt: string;
}

export interface HarbourScenario {
  tasks: HarbourTask[];
  emails: EmailPressureItem[];
  calendar: CalendarEvent[];
  wearable: WearableState;
}

export type SourceKind = 'mock' | 'live' | 'hybrid';

export interface SourceDescriptor {
  id: 'tasks' | 'email' | 'calendar' | 'wearable';
  label: string;
  kind: SourceKind;
  summary: string;
  detail: string;
  updatedAt?: string;
}

export interface SourceSnapshot {
  tasks?: HarbourTask[];
  sources: SourceDescriptor[];
}
