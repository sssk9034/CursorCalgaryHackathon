import { create } from 'zustand';
import { createMockScenario } from '../data/mockData';
import { buildPlan, buildReplanDiff } from '../lib/planner';
import { deriveMode, generateRecommendation } from '../lib/recommendation-engine';
import { defaultSources } from '../lib/source-defaults';
import type {
  ManualCheckIn,
  ModeLabel,
  PlanBlock,
  RecommendationResult,
  ReplanDiff,
  SourceDescriptor,
  WearableState,
} from '../types/harbour';

export type WizardMode = 'morning' | 'overwhelmed';

interface WizardState {
  isOpen: boolean;
  mode: WizardMode;
  step: number;
}

interface HarbourStoreState {
  tasks: ReturnType<typeof createMockScenario>['tasks'];
  emails: ReturnType<typeof createMockScenario>['emails'];
  calendar: ReturnType<typeof createMockScenario>['calendar'];
  wearable: WearableState;
  manualCheckIn: ManualCheckIn;
  mode: ModeLabel;
  recommendation: RecommendationResult;
  plan: PlanBlock[];
  pendingRecommendation: RecommendationResult | null;
  needsReplan: boolean;
  wizard: WizardState;
  replanDiff: ReplanDiff | null;
  lastTaskSyncAt: number;
  sources: SourceDescriptor[];
}

interface HarbourStoreActions {
  openWizard: (mode: WizardMode) => void;
  closeWizard: () => void;
  nextWizardStep: () => void;
  previousWizardStep: () => void;
  setManualCheckIn: (checkIn: ManualCheckIn) => void;
  triggerOverload: () => void;
  triggerRecovery: () => void;
  applyReplan: () => void;
  refreshSources: () => Promise<void>;
}

type HarbourStore = HarbourStoreState & HarbourStoreActions;

const scenario = createMockScenario();
const initialManualCheckIn: ManualCheckIn = 'steady';

const initialRecommendation = generateRecommendation({
  tasks: scenario.tasks,
  emails: scenario.emails,
  calendar: scenario.calendar,
  wearable: scenario.wearable,
  manualCheckIn: initialManualCheckIn,
});

const initialPlan = buildPlan({
  calendar: scenario.calendar,
  tasks: scenario.tasks,
  recommendation: initialRecommendation,
});

function buildTaskSignature(tasks: HarbourStoreState['tasks']): string {
  return JSON.stringify(
    tasks.map((task) => ({
      id: task.id,
      issueTitle: task.issueTitle,
      issueUrl: task.issueUrl,
      status: task.status,
      sourceStatusLabel: task.sourceStatusLabel,
      priority: task.priority,
      sourcePriorityLabel: task.sourcePriorityLabel,
      dueDate: task.dueDate,
      assignee: task.assignee,
      cycleHint: task.cycleHint,
      syncedAt: task.syncedAt,
    })),
  );
}

function recomputePending(
  state: Pick<
    HarbourStore,
    'tasks' | 'emails' | 'calendar' | 'wearable' | 'manualCheckIn'
  >,
): RecommendationResult {
  return generateRecommendation({
    tasks: state.tasks,
    emails: state.emails,
    calendar: state.calendar,
    wearable: state.wearable,
    manualCheckIn: state.manualCheckIn,
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export const useHarbourStore = create<HarbourStore>((set, get) => ({
  tasks: scenario.tasks,
  emails: scenario.emails,
  calendar: scenario.calendar,
  wearable: scenario.wearable,
  manualCheckIn: initialManualCheckIn,
  mode: initialRecommendation.mode,
  recommendation: initialRecommendation,
  plan: initialPlan,
  pendingRecommendation: null,
  needsReplan: false,
  wizard: {
    isOpen: false,
    mode: 'morning',
    step: 0,
  },
  replanDiff: null,
  lastTaskSyncAt: Date.now(),
  sources: defaultSources,

  openWizard: (mode) => {
    const state = get();
    const pendingRecommendation = recomputePending(state);

    set({
      wizard: {
        isOpen: true,
        mode,
        step: 0,
      },
      pendingRecommendation,
      needsReplan: true,
      mode: deriveMode(state.wearable, state.manualCheckIn),
    });
  },

  closeWizard: () => {
    set((state) => ({
      wizard: {
        ...state.wizard,
        isOpen: false,
      },
    }));
  },

  nextWizardStep: () => {
    set((state) => ({
      wizard: {
        ...state.wizard,
        step: Math.min(3, state.wizard.step + 1),
      },
    }));
  },

  previousWizardStep: () => {
    set((state) => ({
      wizard: {
        ...state.wizard,
        step: Math.max(0, state.wizard.step - 1),
      },
    }));
  },

  setManualCheckIn: (checkIn) => {
    set((state) => {
      const nextState = {
        ...state,
        manualCheckIn: checkIn,
      };

      const nextMode = deriveMode(nextState.wearable, checkIn);
      const pendingRecommendation = recomputePending(nextState);

      if (state.needsReplan || state.wizard.isOpen) {
        return {
          manualCheckIn: checkIn,
          mode: nextMode,
          pendingRecommendation,
        };
      }

      const plan = buildPlan({
        calendar: state.calendar,
        tasks: state.tasks,
        recommendation: pendingRecommendation,
      });

      return {
        manualCheckIn: checkIn,
        mode: nextMode,
        recommendation: pendingRecommendation,
        plan,
        pendingRecommendation: null,
      };
    });
  },

  triggerOverload: () => {
    set((state) => {
      const wearable: WearableState = {
        stress: clamp(state.wearable.stress + 28, 0, 100),
        bodyBattery: clamp(state.wearable.bodyBattery - 24, 0, 100),
        trend: 'rising',
        updatedAt: new Date().toISOString(),
      };

      const mode = deriveMode(wearable, state.manualCheckIn);
      const pendingRecommendation = generateRecommendation({
        tasks: state.tasks,
        emails: state.emails,
        calendar: state.calendar,
        wearable,
        manualCheckIn: state.manualCheckIn,
      });

      return {
        wearable,
        mode,
        pendingRecommendation,
        needsReplan: true,
        wizard: {
          isOpen: true,
          mode: mode === 'Overloaded' ? 'overwhelmed' : 'morning',
          step: 0,
        },
      };
    });
  },

  triggerRecovery: () => {
    set((state) => {
      const wearable: WearableState = {
        stress: clamp(state.wearable.stress - 22, 0, 100),
        bodyBattery: clamp(state.wearable.bodyBattery + 20, 0, 100),
        trend: 'falling',
        updatedAt: new Date().toISOString(),
      };

      const mode = deriveMode(wearable, state.manualCheckIn);
      const pendingRecommendation = generateRecommendation({
        tasks: state.tasks,
        emails: state.emails,
        calendar: state.calendar,
        wearable,
        manualCheckIn: state.manualCheckIn,
      });

      return {
        wearable,
        mode,
        pendingRecommendation,
        needsReplan: true,
        wizard: {
          isOpen: true,
          mode: 'morning',
          step: 0,
        },
      };
    });
  },

  applyReplan: () => {
    set((state) => {
      const nextRecommendation = state.pendingRecommendation || recomputePending(state);
      const nextPlan = buildPlan({
        calendar: state.calendar,
        tasks: state.tasks,
        recommendation: nextRecommendation,
      });

      const replanDiff = buildReplanDiff(
        state.recommendation.primary.label,
        nextRecommendation.primary.label,
        state.plan,
        nextPlan,
        nextRecommendation.safeguard.detail,
      );

      return {
        recommendation: nextRecommendation,
        plan: nextPlan,
        mode: nextRecommendation.mode,
        pendingRecommendation: null,
        needsReplan: false,
        replanDiff,
        wizard: {
          ...state.wizard,
          isOpen: false,
          step: 0,
        },
      };
    });
  },

  refreshSources: async () => {
    const snapshot = await window.harbourDesktop?.getSources?.();

    if (!snapshot) {
      return;
    }

    set((state) => {
      const tasks = snapshot.tasks !== undefined ? snapshot.tasks : state.tasks;
      const tasksChanged =
        snapshot.tasks !== undefined &&
        buildTaskSignature(tasks) !== buildTaskSignature(state.tasks);
      const recommendation = generateRecommendation({
        tasks,
        emails: state.emails,
        calendar: state.calendar,
        wearable: state.wearable,
        manualCheckIn: state.manualCheckIn,
      });

      return {
        tasks,
        recommendation,
        plan: buildPlan({
          calendar: state.calendar,
          tasks,
          recommendation,
        }),
        pendingRecommendation: null,
        lastTaskSyncAt: tasksChanged ? Date.now() : state.lastTaskSyncAt,
        sources: snapshot.sources,
      };
    });
  },
}));
