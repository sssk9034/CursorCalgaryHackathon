import { addMinutes, diffMinutes, timeToMinutes } from './time';
import type {
  CalendarEvent,
  HarbourTask,
  PlanBlock,
  RecommendationResult,
  ReplanDiff,
} from '../types/harbour';

interface PlanInput {
  calendar: CalendarEvent[];
  tasks: HarbourTask[];
  recommendation: RecommendationResult;
}

interface Slot {
  id: string;
  startTime: string;
  endTime: string;
}

function blockTypeLabel(block: PlanBlock): string {
  if (block.taskId) {
    return `${block.taskId} @ ${block.startTime}`;
  }

  return `${block.title} @ ${block.startTime}`;
}

function toSlots(calendar: CalendarEvent[]): Slot[] {
  return calendar
    .filter((entry) => entry.kind !== 'fixed-meeting')
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
    .map((entry) => ({
      id: entry.id,
      startTime: entry.startTime,
      endTime: entry.endTime,
    }));
}

function taskTitle(taskId: string, tasks: HarbourTask[]): string {
  const task = tasks.find((candidate) => candidate.id === taskId);
  return task ? `${task.id} · ${task.issueTitle}` : taskId;
}

export function buildPlan({ calendar, tasks, recommendation }: PlanInput): PlanBlock[] {
  const fixedBlocks: PlanBlock[] = calendar
    .filter((event) => event.kind === 'fixed-meeting')
    .map((event) => ({
      id: `plan-${event.id}`,
      type: 'fixed-meeting',
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      note: 'Fixed',
    }));

  const slots = toSlots(calendar);
  const blocks: PlanBlock[] = [...fixedBlocks];

  if (!slots.length) {
    return blocks.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }

  let slotIndex = 0;

  const nextSlot = (): Slot => {
    const chosen = slots[Math.min(slotIndex, slots.length - 1)];
    slotIndex += 1;
    return chosen;
  };

  const firstSlot = nextSlot();

  if (recommendation.mode === 'Overloaded') {
    const recoveryEnd = addMinutes(firstSlot.startTime, 12);

    blocks.push({
      id: 'plan-recovery',
      type: 'break-recovery',
      title: 'Reset: breathe + reduce cognitive load',
      startTime: firstSlot.startTime,
      endTime: recoveryEnd,
      note: 'Mandatory recovery when overloaded.',
    });

    const workingEnd = addMinutes(
      recoveryEnd,
      Math.min(recommendation.primary.estimateMin, diffMinutes(recoveryEnd, firstSlot.endTime)),
    );

    blocks.push({
      id: 'plan-primary',
      type: 'moved-replanned',
      title: recommendation.primary.label,
      startTime: recoveryEnd,
      endTime: workingEnd,
      taskId: recommendation.primary.taskId,
      note: 'Replanned for overwhelmed mode.',
    });
  } else {
    const workingEnd = addMinutes(
      firstSlot.startTime,
      Math.min(
        recommendation.primary.estimateMin,
        diffMinutes(firstSlot.startTime, firstSlot.endTime),
      ),
    );

    blocks.push({
      id: 'plan-primary',
      type: 'flexible-work',
      title: recommendation.primary.label,
      startTime: firstSlot.startTime,
      endTime: workingEnd,
      taskId: recommendation.primary.taskId,
      note: 'Best next move.',
    });
  }

  recommendation.backups.forEach((backup, index) => {
    const slot = nextSlot();
    const blockLength = Math.min(backup.estimateMin, diffMinutes(slot.startTime, slot.endTime));

    blocks.push({
      id: `plan-backup-${index + 1}`,
      type: 'flexible-work',
      title: backup.label,
      startTime: slot.startTime,
      endTime: addMinutes(slot.startTime, blockLength),
      taskId: backup.taskId,
      note: 'Backup option.',
    });
  });

  const strategicSlot = slots[slots.length - 1];

  if (recommendation.safeguard.action === 'protected') {
    blocks.push({
      id: 'plan-safeguard',
      type: 'protected-deep-work',
      title: taskTitle(recommendation.safeguard.taskId, tasks),
      startTime: strategicSlot.startTime,
      endTime: strategicSlot.endTime,
      taskId: recommendation.safeguard.taskId,
      note: 'Protected strategic block.',
    });
  }

  if (recommendation.safeguard.action === 'sliced') {
    blocks.push({
      id: 'plan-safeguard',
      type: 'moved-replanned',
      title: `Slice: ${taskTitle(recommendation.safeguard.taskId, tasks)}`,
      startTime: strategicSlot.startTime,
      endTime: addMinutes(strategicSlot.startTime, 25),
      taskId: recommendation.safeguard.taskId,
      note: recommendation.safeguard.detail,
    });
  }

  if (recommendation.safeguard.action === 'deferred') {
    blocks.push({
      id: 'plan-safeguard',
      type: 'moved-replanned',
      title: `Deferred: ${taskTitle(recommendation.safeguard.taskId, tasks)}`,
      startTime: strategicSlot.startTime,
      endTime: addMinutes(strategicSlot.startTime, 20),
      taskId: recommendation.safeguard.taskId,
      note: recommendation.safeguard.detail,
    });
  }

  blocks.push({
    id: 'plan-email',
    type: 'email-admin',
    title: 'Email pressure sweep + replies',
    startTime: '12:00',
    endTime: '12:15',
    note: 'Respond only to deadline-sensitive threads.',
  });

  return blocks.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

export function diffPlans(before: PlanBlock[], after: PlanBlock[]): string[] {
  const beforeByTask = new Map(
    before.filter((block) => block.taskId).map((block) => [block.taskId as string, block]),
  );

  return after
    .filter((block) => block.taskId)
    .flatMap((block) => {
      const previous = beforeByTask.get(block.taskId as string);

      if (!previous) {
        return [];
      }

      if (previous.startTime !== block.startTime || previous.type !== block.type) {
        return [blockTypeLabel(block)];
      }

      return [];
    });
}

export function buildReplanDiff(
  beforeRecommendationLabel: string,
  afterRecommendationLabel: string,
  beforePlan: PlanBlock[],
  afterPlan: PlanBlock[],
  safeguardSummary: string,
): ReplanDiff {
  return {
    previousRecommendation: beforeRecommendationLabel,
    currentRecommendation: afterRecommendationLabel,
    movedTaskLabels: diffPlans(beforePlan, afterPlan),
    protectedSummary: safeguardSummary,
    changedAt: new Date().toISOString(),
  };
}
