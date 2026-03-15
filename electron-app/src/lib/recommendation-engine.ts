import { diffMinutes, timeToMinutes } from './time';
import type {
  CalendarEvent,
  EmailPressureItem,
  HarbourTask,
  ManualCheckIn,
  ModeLabel,
  RecommendationChoice,
  RecommendationResult,
  StrategicSafeguard,
  TaskRanking,
  WearableState,
} from '../types/harbour';

interface EngineInputs {
  tasks: HarbourTask[];
  emails: EmailPressureItem[];
  calendar: CalendarEvent[];
  wearable: WearableState;
  manualCheckIn: ManualCheckIn;
}

interface StateProfile {
  targetClarity: number;
  targetActivation: number;
  targetFocusDepth: number;
  urgencyWeight: number;
  clarityWeight: number;
  activationWeight: number;
  focusWeight: number;
  durationWeight: number;
  modeBonus: (task: HarbourTask, availableWindowMin: number) => number;
}

const profiles: Record<ModeLabel, StateProfile> = {
  'Focus Ready': {
    targetClarity: 5,
    targetActivation: 8,
    targetFocusDepth: 9,
    urgencyWeight: 0.22,
    clarityWeight: 0.18,
    activationWeight: 0.18,
    focusWeight: 0.34,
    durationWeight: 0.08,
    modeBonus: (task, availableWindowMin) => {
      let bonus = 0;

      if (task.strategicTag) bonus += 2.8;
      if (task.focusDepth >= 8) bonus += 1.4;
      if (task.activationEnergy >= 8) bonus += 0.7;
      if (task.overwhelmedFriendly) bonus -= 1.2;
      if (task.metadata.expectedDurationMin > availableWindowMin + 25) bonus -= 1.4;

      return bonus;
    },
  },
  Caution: {
    targetClarity: 7,
    targetActivation: 5,
    targetFocusDepth: 5,
    urgencyWeight: 0.3,
    clarityWeight: 0.28,
    activationWeight: 0.18,
    focusWeight: 0.16,
    durationWeight: 0.08,
    modeBonus: (task, availableWindowMin) => {
      let bonus = 0;

      if (task.metadata.expectedDurationMin <= availableWindowMin) bonus += 0.8;
      if (task.focusDepth >= 4 && task.focusDepth <= 6) bonus += 1.2;
      if (task.activationEnergy >= 4 && task.activationEnergy <= 6) bonus += 1.0;
      if (task.strategicTag) bonus -= 0.8;
      if (task.overwhelmedFriendly) bonus -= 0.3;

      return bonus;
    },
  },
  Overloaded: {
    targetClarity: 9,
    targetActivation: 2,
    targetFocusDepth: 2,
    urgencyWeight: 0.16,
    clarityWeight: 0.38,
    activationWeight: 0.26,
    focusWeight: 0.12,
    durationWeight: 0.08,
    modeBonus: (task, availableWindowMin) => {
      let bonus = 0;

      if (task.overwhelmedFriendly) bonus += 2.4;
      if (task.metadata.expectedDurationMin <= 20) bonus += 1.3;
      if (task.focusDepth <= 2) bonus += 1.1;
      if (task.activationEnergy <= 2) bonus += 1.1;
      if (task.strategicTag) bonus -= 3.4;
      if (task.metadata.expectedDurationMin > Math.min(availableWindowMin, 40)) bonus -= 1.5;

      return bonus;
    },
  },
  Recovery: {
    targetClarity: 7,
    targetActivation: 5,
    targetFocusDepth: 6,
    urgencyWeight: 0.14,
    clarityWeight: 0.28,
    activationWeight: 0.22,
    focusWeight: 0.26,
    durationWeight: 0.1,
    modeBonus: (task, availableWindowMin) => {
      let bonus = 0;

      if (task.metadata.momentumValue >= 8) bonus += 1.5;
      if (task.focusDepth >= 5 && task.focusDepth <= 7) bonus += 1.6;
      if (task.activationEnergy >= 4 && task.activationEnergy <= 6) bonus += 1.3;
      if (task.metadata.expectedDurationMin >= 35 && task.metadata.expectedDurationMin <= 60) {
        bonus += 1.0;
      }
      if (task.urgency >= 9) bonus -= 1.8;
      if (task.overwhelmedFriendly) bonus -= 1.1;
      if (task.strategicTag) bonus -= 1.3;
      if (task.metadata.expectedDurationMin <= availableWindowMin) bonus += 0.7;

      return bonus;
    },
  },
};

export function deriveMode(
  wearable: WearableState,
  manualCheckIn: ManualCheckIn,
): ModeLabel {
  if (manualCheckIn === 'overwhelmed') {
    return 'Overloaded';
  }

  if (manualCheckIn === 'recovering') {
    return 'Recovery';
  }

  if (
    wearable.stress >= 72 ||
    wearable.bodyBattery <= 28 ||
    (wearable.trend === 'rising' && wearable.stress >= 64)
  ) {
    return 'Overloaded';
  }

  if (manualCheckIn === 'strained') {
    return 'Caution';
  }

  if (wearable.trend === 'falling' && wearable.bodyBattery >= 40) {
    return 'Recovery';
  }

  if (wearable.stress <= 42 && wearable.bodyBattery >= 72) {
    return 'Focus Ready';
  }

  return 'Caution';
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(10, value));
}

function fitToTarget(value: number, target: number): number {
  return clampScore(10 - Math.abs(value - target) * 1.9);
}

function classifyPressure(avgUrgency: number, count: number): 'low' | 'medium' | 'high' {
  const signal = avgUrgency + count * 0.5;

  if (signal >= 10) {
    return 'high';
  }

  if (signal >= 6) {
    return 'medium';
  }

  return 'low';
}

function summarizeEmailPressure(emails: EmailPressureItem[]): 'low' | 'medium' | 'high' {
  const avgUrgency =
    emails.reduce((total, email) => total + email.urgency, 0) / Math.max(1, emails.length);
  return classifyPressure(avgUrgency, emails.length);
}

function summarizeMeetingDensity(calendar: CalendarEvent[]): 'low' | 'medium' | 'high' {
  const fixedMeetings = calendar.filter((event) => event.kind === 'fixed-meeting');
  const totalMeetingMinutes = fixedMeetings.reduce((total, event) => {
    return total + diffMinutes(event.startTime, event.endTime);
  }, 0);

  if (fixedMeetings.length >= 4 || totalMeetingMinutes >= 180) {
    return 'high';
  }

  if (fixedMeetings.length >= 2 || totalMeetingMinutes >= 90) {
    return 'medium';
  }

  return 'low';
}

function findAvailableWindowMinutes(calendar: CalendarEvent[]): number {
  const openSlots = calendar
    .filter((event) => event.kind !== 'fixed-meeting')
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  if (!openSlots.length) {
    return 25;
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const currentOrNext =
    openSlots.find((slot) => timeToMinutes(slot.endTime) > nowMinutes) || openSlots[0];

  return diffMinutes(currentOrNext.startTime, currentOrNext.endTime);
}

function createChoice(task: HarbourTask, summary: string): RecommendationChoice {
  const estimateMin = Math.max(10, Math.min(task.metadata.expectedDurationMin, 90));

  return {
    taskId: task.id,
    label: `${task.id} · ${task.issueTitle}`,
    estimateMin,
    explanation: summary,
    cta: 'Start now',
  };
}

function describeModeFit(mode: ModeLabel, task: HarbourTask): string {
  if (mode === 'Focus Ready') {
    return task.strategicTag
      ? 'Energy is high enough to tackle the hardest strategic work.'
      : 'Current state can support deeper work, but this is the best bounded option.';
  }

  if (mode === 'Caution') {
    return 'This keeps progress moving without demanding a full deep-work ramp.';
  }

  if (mode === 'Overloaded') {
    return task.overwhelmedFriendly
      ? 'Low startup cost and high clarity make this safe to begin while overloaded.'
      : 'This is the lightest viable move that still reduces risk.';
  }

  return 'Recovery mode favors moderate, momentum-building work instead of extremes.';
}

function buildStrategicSafeguard(
  mode: ModeLabel,
  strategicTask: HarbourTask,
  primaryTask: HarbourTask,
): StrategicSafeguard {
  if (mode === 'Overloaded') {
    if (primaryTask.id === strategicTask.id) {
      return {
        taskId: strategicTask.id,
        action: 'sliced',
        detail:
          'Reduce the strategic task to a 25-minute outline pass, then protect the real deep block later.',
      };
    }

    return {
      taskId: strategicTask.id,
      action: 'protected',
      detail:
        'Keep the strategic deliverable parked in the late deep-work block so overload does not erase it.',
    };
  }

  if (mode === 'Caution') {
    return {
      taskId: strategicTask.id,
      action: 'sliced',
      detail: 'Hold the strategic thread with a smaller next step, then return when focus is stronger.',
    };
  }

  if (mode === 'Recovery') {
    return {
      taskId: strategicTask.id,
      action: 'deferred',
      detail: 'Delay the deepest strategic work until recovery stabilizes, but keep it visible in the plan.',
    };
  }

  return {
    taskId: strategicTask.id,
    action: 'protected',
    detail: 'Use the strongest focus window to protect strategic work while energy is still high.',
  };
}

export function generateRecommendation(input: EngineInputs): RecommendationResult {
  const mode = deriveMode(input.wearable, input.manualCheckIn);
  const profile = profiles[mode];
  const availableWindowMin = findAvailableWindowMinutes(input.calendar);
  const meetingDensity = summarizeMeetingDensity(input.calendar);
  const emailPressure = summarizeEmailPressure(input.emails);

  const rankings: TaskRanking[] = input.tasks.map((task) => {
    const clarityFit = fitToTarget(task.clarity, profile.targetClarity);
    const activationFit = fitToTarget(task.activationEnergy, profile.targetActivation);
    const focusFit = fitToTarget(task.focusDepth, profile.targetFocusDepth);
    const durationFit = clampScore(
      10 - Math.max(0, task.metadata.expectedDurationMin - availableWindowMin) / 8,
    );

    const weightedDimensions =
      task.urgency * profile.urgencyWeight +
      clarityFit * profile.clarityWeight +
      activationFit * profile.activationWeight +
      focusFit * profile.focusWeight +
      durationFit * profile.durationWeight;

    const timeDelta = availableWindowMin - task.metadata.expectedDurationMin;
    const timeFit: TaskRanking['timeFit'] =
      timeDelta >= 10 ? 'fit' : timeDelta >= -15 ? 'tight' : 'oversize';

    const timeBias = timeFit === 'fit' ? 0.9 : timeFit === 'tight' ? 0.2 : -1.0;
    const blockedPenalty = task.status === 'Blocked' ? 4.2 : 0;
    const dependencyPenalty = task.metadata.dependencyRisk >= 8 ? 0.9 : 0;
    const modeBonus = profile.modeBonus(task, availableWindowMin);

    const score =
      weightedDimensions + timeBias + modeBonus - blockedPenalty - dependencyPenalty;

    const reasonParts: string[] = [];

    if (clarityFit >= 8) reasonParts.push('clarity matches current state');
    if (activationFit >= 8) reasonParts.push('startup cost fits');
    if (focusFit >= 8) reasonParts.push('focus depth matches');
    if (timeFit === 'fit') reasonParts.push('fits the current window');
    if (task.status === 'Blocked') reasonParts.push('blocked by dependency');

    return {
      taskId: task.id,
      score,
      fitReason: reasonParts.join(', ') || 'balanced against current state',
      timeFit,
    };
  });

  rankings.sort((a, b) => b.score - a.score);

  const rankedTasks = rankings
    .map((ranking) => {
      const task = input.tasks.find((candidate) => candidate.id === ranking.taskId);
      if (!task) {
        return null;
      }

      return { task, ranking };
    })
    .filter((entry): entry is { task: HarbourTask; ranking: TaskRanking } => Boolean(entry));

  const viableTasks = rankedTasks.filter((entry) => entry.task.status !== 'Blocked');
  const primaryTask = viableTasks[0]?.task || rankedTasks[0].task;
  const backupTasks = viableTasks.slice(1, 3).map((entry) => entry.task);
  const primaryRanking = rankings.find((ranking) => ranking.taskId === primaryTask.id);

  const strategicTask =
    input.tasks.find((task) => task.strategicTag) ||
    input.tasks.reduce((current, task) => {
      if (!current || task.metadata.importance > current.metadata.importance) {
        return task;
      }

      return current;
    }, input.tasks[0]);

  const safeguard = buildStrategicSafeguard(mode, strategicTask, primaryTask);

  const rationale = [
    `Mode is ${mode}, so Harbour is biasing toward ${
      mode === 'Focus Ready'
        ? 'deep strategic work'
        : mode === 'Caution'
        ? 'bounded progress'
        : mode === 'Overloaded'
        ? 'high-clarity, low-startup work'
        : 'moderate recovery-safe momentum'
    }.`,
    `Current open window is about ${availableWindowMin} minutes with ${meetingDensity} meeting density.`,
    `Email pressure is ${emailPressure}; quick-response work only wins when the mode supports it.`,
    `Strategic safeguard: ${safeguard.detail}`,
  ];

  return {
    mode,
    primary: createChoice(
      primaryTask,
      `${describeModeFit(mode, primaryTask)} ${primaryRanking?.fitReason ?? 'Best fit.'}`,
    ),
    backups: backupTasks.map((task) => {
      const ranking = rankings.find((entry) => entry.taskId === task.id);
      return createChoice(
        task,
        `${describeModeFit(mode, task)} ${ranking?.fitReason ?? 'Fallback option.'}`,
      );
    }),
    rankings,
    rationale,
    safeguard,
    availableWindowMin,
    meetingDensity,
    emailPressure,
    generatedAt: new Date().toISOString(),
  };
}
