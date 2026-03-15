import type {
  CalendarEvent,
  EmailPressureItem,
  HarbourScenario,
  HarbourTask,
  WearableState,
} from '../types/harbour';

const today = new Date();

function isoDateOffset(days: number): string {
  const date = new Date(today);
  date.setDate(today.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function syncedAt(minutesAgo: number): string {
  const stamp = new Date();
  stamp.setMinutes(stamp.getMinutes() - minutesAgo);
  return stamp.toISOString();
}

const mockTasks: HarbourTask[] = [
  {
    id: 'ENG-482',
    project: 'Harbour Core',
    issueTitle: 'Draft adaptive planning ADR for investor demo',
    status: 'In Progress',
    priority: 'P1',
    dueDate: isoDateOffset(1),
    assignee: 'alexander',
    cycleHint: 'Sprint 12 / Platform',
    urgency: 7,
    clarity: 3,
    activationEnergy: 9,
    focusDepth: 10,
    metadata: {
      importance: 10,
      emotionalFriction: 7,
      expectedDurationMin: 110,
      dependencyRisk: 2,
      momentumValue: 9,
      fragmentability: 2,
    },
    strategicTag: true,
    syncedAt: syncedAt(4),
  },
  {
    id: 'ENG-517',
    project: 'Integrations',
    issueTitle: 'Patch calendar callback mismatch before noon walkthrough',
    status: 'Todo',
    priority: 'P0',
    dueDate: isoDateOffset(0),
    assignee: 'alexander',
    cycleHint: 'Sprint 12 / Demo Reliability',
    urgency: 10,
    clarity: 8,
    activationEnergy: 4,
    focusDepth: 5,
    metadata: {
      importance: 9,
      emotionalFriction: 4,
      expectedDurationMin: 40,
      dependencyRisk: 3,
      momentumValue: 8,
      fragmentability: 7,
    },
    syncedAt: syncedAt(2),
  },
  {
    id: 'ENG-503',
    project: 'Desktop Shell',
    issueTitle: 'Fix settings hydration warning and remove noisy logs',
    status: 'Todo',
    priority: 'P2',
    dueDate: isoDateOffset(2),
    assignee: 'alexander',
    cycleHint: 'Sprint 12 / UX Polish',
    urgency: 5,
    clarity: 10,
    activationEnergy: 1,
    focusDepth: 2,
    metadata: {
      importance: 4,
      emotionalFriction: 1,
      expectedDurationMin: 15,
      dependencyRisk: 1,
      momentumValue: 6,
      fragmentability: 10,
    },
    overwhelmedFriendly: true,
    syncedAt: syncedAt(11),
  },
  {
    id: 'ENG-491',
    project: 'Planner UI',
    issueTitle: 'Tune wizard copy and edge-state messaging for smoother recovery flow',
    status: 'Todo',
    priority: 'P1',
    dueDate: isoDateOffset(1),
    assignee: 'alexander',
    cycleHint: 'Sprint 12 / UX Polish',
    urgency: 7,
    clarity: 7,
    activationEnergy: 5,
    focusDepth: 6,
    metadata: {
      importance: 7,
      emotionalFriction: 3,
      expectedDurationMin: 50,
      dependencyRisk: 2,
      momentumValue: 8,
      fragmentability: 7,
    },
    syncedAt: syncedAt(16),
  },
  {
    id: 'ENG-526',
    project: 'Data Platform',
    issueTitle: 'Unblock missing wearable events after device bridge handoff',
    status: 'Blocked',
    priority: 'P1',
    dueDate: isoDateOffset(0),
    assignee: 'alexander',
    cycleHint: 'Sprint 12 / Data Reliability',
    urgency: 8,
    clarity: 4,
    activationEnergy: 8,
    focusDepth: 8,
    metadata: {
      importance: 8,
      emotionalFriction: 7,
      expectedDurationMin: 80,
      dependencyRisk: 10,
      momentumValue: 4,
      fragmentability: 2,
    },
    syncedAt: syncedAt(8),
  },
  {
    id: 'ENG-532',
    project: 'Comms',
    issueTitle: 'Reply to stakeholder thread with revised launch timing and risks',
    status: 'Todo',
    priority: 'P2',
    dueDate: isoDateOffset(0),
    assignee: 'alexander',
    cycleHint: 'Sprint 12 / Communication',
    urgency: 8,
    clarity: 9,
    activationEnergy: 2,
    focusDepth: 1,
    metadata: {
      importance: 6,
      emotionalFriction: 2,
      expectedDurationMin: 12,
      dependencyRisk: 1,
      momentumValue: 8,
      fragmentability: 10,
    },
    overwhelmedFriendly: true,
    syncedAt: syncedAt(6),
  },
];

const mockEmails: EmailPressureItem[] = [
  {
    id: 'mail-141',
    sender: 'Product Lead',
    subject: 'Need final timing call before 11:30 customer sync',
    type: 'deadline',
    urgency: 9,
    requiresResponseBy: '11:30',
    estimateReplyMin: 8,
  },
  {
    id: 'mail-142',
    sender: 'VP Engineering',
    subject: 'Send launch risk summary once the replan story is stable',
    type: 'stakeholder',
    urgency: 8,
    requiresResponseBy: '15:00',
    estimateReplyMin: 12,
  },
  {
    id: 'mail-143',
    sender: 'Design Ops',
    subject: 'Wizard review moved to 13:30 and needs updated copy',
    type: 'meeting-change',
    urgency: 6,
    estimateReplyMin: 3,
  },
  {
    id: 'mail-144',
    sender: 'Infra Bot',
    subject: 'Action requested: callback errors still above threshold',
    type: 'requires-action',
    urgency: 7,
    requiresResponseBy: '16:00',
    estimateReplyMin: 7,
  },
  {
    id: 'mail-145',
    sender: 'Customer Success',
    subject: 'Quick yes/no needed for pilot messaging',
    type: 'quick-reply',
    urgency: 5,
    estimateReplyMin: 5,
  },
];

const mockCalendar: CalendarEvent[] = [
  {
    id: 'cal-01',
    title: 'Daily engineering standup',
    kind: 'fixed-meeting',
    startTime: '09:30',
    endTime: '09:50',
    attendees: 8,
  },
  {
    id: 'cal-02',
    title: 'Deep work reserve',
    kind: 'focus-window',
    startTime: '10:00',
    endTime: '11:20',
    isMovable: true,
  },
  {
    id: 'cal-03',
    title: 'Customer sync',
    kind: 'fixed-meeting',
    startTime: '11:30',
    endTime: '12:00',
    attendees: 5,
  },
  {
    id: 'cal-04',
    title: 'Flexible build block',
    kind: 'flex-slot',
    startTime: '12:15',
    endTime: '13:00',
    isMovable: true,
  },
  {
    id: 'cal-05',
    title: 'Wizard review',
    kind: 'fixed-meeting',
    startTime: '13:30',
    endTime: '14:15',
    attendees: 6,
  },
  {
    id: 'cal-06',
    title: 'Recovery-friendly implementation block',
    kind: 'focus-window',
    startTime: '14:30',
    endTime: '15:30',
    isMovable: true,
  },
  {
    id: 'cal-07',
    title: 'Flexible closeout slot',
    kind: 'flex-slot',
    startTime: '16:00',
    endTime: '17:15',
    isMovable: true,
  },
];

const mockWearable: WearableState = {
  stress: 34,
  bodyBattery: 82,
  trend: 'steady',
  updatedAt: new Date().toISOString(),
};

export function createMockScenario(): HarbourScenario {
  return {
    tasks: mockTasks,
    emails: mockEmails,
    calendar: mockCalendar,
    wearable: mockWearable,
  };
}
