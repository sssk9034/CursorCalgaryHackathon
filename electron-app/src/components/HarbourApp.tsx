import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildPlan } from '../lib/planner';
import { useHarbourStore } from '../store/harbour-store';
import type {
  EmailPressureItem,
  HarbourTask,
  ManualCheckIn,
  ModeLabel,
  PlanBlock,
  SourceDescriptor,
} from '../types/harbour';

const modeStyles: Record<ModeLabel, string> = {
  'Focus Ready': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Caution: 'bg-amber-100 text-amber-800 border-amber-200',
  Overloaded: 'bg-rose-100 text-rose-800 border-rose-200',
  Recovery: 'bg-teal-100 text-teal-800 border-teal-200',
};

const blockStyles: Record<PlanBlock['type'], string> = {
  'fixed-meeting': 'border-l-slate-400 bg-slate-100/70',
  'protected-deep-work': 'border-l-teal-600 bg-teal-100/80',
  'flexible-work': 'border-l-emerald-600 bg-emerald-100/70',
  'break-recovery': 'border-l-amber-500 bg-amber-100/80',
  'email-admin': 'border-l-indigo-500 bg-indigo-100/80',
  'moved-replanned': 'border-l-rose-500 bg-rose-100/70',
};

const manualOptions: { label: string; value: ManualCheckIn }[] = [
  { label: 'No report', value: 'none' },
  { label: 'Steady', value: 'steady' },
  { label: 'Strained', value: 'strained' },
  { label: 'Overwhelmed', value: 'overwhelmed' },
  { label: 'Recovering', value: 'recovering' },
];

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
}

function pressureTone(value: number): string {
  if (value >= 8) {
    return 'text-rose-700';
  }

  if (value >= 6) {
    return 'text-amber-700';
  }

  return 'text-slate-600';
}

function sourceKindTone(kind: SourceDescriptor['kind']): string {
  if (kind === 'live') {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }

  if (kind === 'hybrid') {
    return 'bg-amber-100 text-amber-800 border-amber-200';
  }

  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function Card({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[12px] border border-harbour-border bg-harbour-surface p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-harbour-muted">{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}

function EmailItem({ email }: { email: EmailPressureItem }) {
  return (
    <div className="rounded-[10px] border border-harbour-border bg-white px-3 py-2.5">
      <p className="text-xs font-medium text-slate-500">{email.sender}</p>
      <p className="text-sm text-slate-900">{email.subject}</p>
      <p className={`text-xs ${pressureTone(email.urgency)}`}>
        {email.type.replace('-', ' ')} · urgency {email.urgency}/10
      </p>
    </div>
  );
}

const integrationProfiles: Record<
  SourceDescriptor['id'],
  {
    provider: string;
    title: string;
    summary: string;
    capability: string;
    status: string;
  }
> = {
  tasks: {
    provider: 'Linear',
    title: 'Task Sync',
    summary: 'Issue metadata, priorities, due dates, and project context stay available to the planner.',
    capability: 'Live issue sample, assignees, cycle hints, and planning heuristics',
    status: 'Connected',
  },
  email: {
    provider: 'Gmail',
    title: 'Email Pressure',
    summary: 'Actionable threads and stakeholder-sensitive requests are surfaced into the work recommendation layer.',
    capability: 'Priority thread filtering, urgency signals, and quick-reply opportunities',
    status: 'Connected',
  },
  calendar: {
    provider: 'Google Calendar',
    title: 'Calendar Context',
    summary: 'Fixed meetings, focus windows, and fragmented time slots inform the plan in real time.',
    capability: 'Meeting density, open windows, and protected focus blocks',
    status: 'Connected',
  },
  wearable: {
    provider: 'Garmin',
    title: 'Readiness Signal',
    summary: 'Stress, body battery, and current trend shape whether Harbour pushes deep work or lighter actions.',
    capability: 'Stress trend, body battery, and recovery-aware state transitions',
    status: 'Connected',
  },
};

function IntegrationsView({
  sources,
  tasks,
}: {
  sources: SourceDescriptor[];
  tasks: HarbourTask[];
}) {
  const taskSource = sources.find((source) => source.id === 'tasks');
  const latestTask = tasks
    .map((task) => new Date(task.syncedAt).getTime())
    .reduce((max, value) => Math.max(max, value), 0);
  const lastSyncLabel = new Date(latestTask || Date.now()).toLocaleString();

  return (
    <div className="space-y-4">
      <Card title="Integrations">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-slate-700">
              Harbour is configured like a connected desktop workspace. Tasks, inbox pressure,
              calendar constraints, and readiness signals are all available to the planner.
            </p>
            <p className="text-xs text-slate-500">
              Current task feed: {taskSource?.label || 'Tasks'} synced {lastSyncLabel}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="font-semibold text-emerald-900">4 sources</p>
              <p className="text-emerald-700">connected</p>
            </div>
            <div className="rounded-[10px] border border-harbour-border bg-white px-3 py-2">
              <p className="font-semibold text-slate-900">{tasks.length} tasks</p>
              <p className="text-slate-500">available</p>
            </div>
            <div className="rounded-[10px] border border-harbour-border bg-white px-3 py-2">
              <p className="font-semibold text-slate-900">Healthy</p>
              <p className="text-slate-500">sync state</p>
            </div>
            <div className="rounded-[10px] border border-harbour-border bg-white px-3 py-2">
              <p className="font-semibold text-slate-900">Ready</p>
              <p className="text-slate-500">for planning</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {sources.map((source) => {
          const profile = integrationProfiles[source.id];
          return (
            <section
              key={source.id}
              className="rounded-[14px] border border-harbour-border bg-harbour-surface p-4"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                    {profile.provider}
                  </p>
                  <h2 className="text-base font-semibold text-slate-900">{profile.title}</h2>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  {profile.status}
                </span>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-slate-700">{profile.summary}</p>
                <div className="rounded-[10px] border border-harbour-border bg-white px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.06em] text-slate-400">Capabilities</p>
                  <p className="mt-1 text-sm text-slate-700">{profile.capability}</p>
                </div>
                <div className="flex items-center justify-between rounded-[10px] border border-harbour-border bg-white px-3 py-2.5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.06em] text-slate-400">Last sync</p>
                    <p className="text-sm font-medium text-slate-900">
                      {source.updatedAt
                        ? new Date(source.updatedAt).toLocaleString()
                        : lastSyncLabel}
                    </p>
                  </div>
                  <button className="rounded-full border border-harbour-border bg-harbour-panel px-3 py-1.5 text-xs font-medium text-slate-700">
                    Manage
                  </button>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DiagnosticsView({
  sources,
  tasks,
}: {
  sources: SourceDescriptor[];
  tasks: HarbourTask[];
}) {
  const taskSource = sources.find((source) => source.id === 'tasks');

  return (
    <div className="space-y-4">
      <Card title="Diagnostics">
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            This view exposes the actual app-side source state used by Harbour. It is intended for
            debugging the demo environment, not for the main product surface.
          </p>
          <p className="text-xs text-slate-500">
            {taskSource?.kind === 'mock'
              ? 'Live task import is optional. Add LINEAR_API_KEY to the repo root .env to replace the mock task feed.'
              : 'Task import is currently reading from Linear. If Linear becomes unavailable, Harbour falls back to the mock task feed.'}
          </p>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {sources.map((source) => (
          <Card
            key={source.id}
            title={source.label}
            actions={
              <span
                className={`rounded-md border px-2 py-1 text-xs font-semibold capitalize ${sourceKindTone(source.kind)}`}
              >
                {source.kind}
              </span>
            }
          >
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-900">{source.summary}</p>
              <p className="text-sm text-slate-600">{source.detail}</p>
              {source.updatedAt ? (
                <p className="text-xs text-slate-500">
                  Updated {new Date(source.updatedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      <Card title="Task sample in use">
        <div className="space-y-2">
          {tasks.slice(0, 5).map((task) => (
            <div
              key={task.id}
              className="rounded-md border border-harbour-border bg-white px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">
                  {task.id} · {task.issueTitle}
                </p>
                <span className="text-xs text-slate-500">{task.project}</span>
              </div>
              <p className="text-xs text-slate-500">
                {task.status} · clarity {task.clarity}/10 · activation {task.activationEnergy}/10
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function WizardOverlay() {
  const {
    wizard,
    mode,
    wearable,
    manualCheckIn,
    pendingRecommendation,
    recommendation,
    calendar,
    tasks,
    closeWizard,
    nextWizardStep,
    previousWizardStep,
    applyReplan,
    setManualCheckIn,
  } = useHarbourStore(
    useShallow((state) => ({
      wizard: state.wizard,
      mode: state.mode,
      wearable: state.wearable,
      manualCheckIn: state.manualCheckIn,
      pendingRecommendation: state.pendingRecommendation,
      recommendation: state.recommendation,
      calendar: state.calendar,
      tasks: state.tasks,
      closeWizard: state.closeWizard,
      nextWizardStep: state.nextWizardStep,
      previousWizardStep: state.previousWizardStep,
      applyReplan: state.applyReplan,
      setManualCheckIn: state.setManualCheckIn,
    })),
  );

  if (!wizard.isOpen) {
    return null;
  }

  const preview = pendingRecommendation || recommendation;
  const previewPlan = buildPlan({ calendar, tasks, recommendation: preview });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-3 py-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-harbour-border bg-white p-5 shadow-xl">
        <header className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-harbour-muted">
              {wizard.mode === 'overwhelmed' ? 'Overwhelmed replan' : 'Morning planning'}
            </p>
            <h3 className="text-lg font-semibold text-slate-900">
              {wizard.mode === 'overwhelmed'
                ? 'Replan around current load'
                : 'Build adaptive plan'}
            </h3>
          </div>
          <button
            className="rounded-md border border-harbour-border px-2 py-1 text-xs text-slate-600"
            onClick={closeWizard}
          >
            Close
          </button>
        </header>

        <div className="mb-4 grid grid-cols-4 gap-2">
          {['Check-in', 'Snapshot', 'Recommendation', 'Commit'].map((label, index) => (
            <div
              key={label}
              className={`rounded-md border px-2 py-2 text-center text-xs ${
                wizard.step === index
                  ? 'border-teal-600 bg-teal-50 text-teal-900'
                  : 'border-harbour-border bg-harbour-panel text-slate-600'
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {wizard.step === 0 ? (
          <div className="space-y-3 text-sm text-slate-700">
            <p>Quick self-check to calibrate the recommendation engine.</p>
            <div className="flex flex-wrap gap-2">
              {manualOptions.map((option) => (
                <button
                  key={option.value}
                  className={`rounded-md border px-3 py-1.5 text-xs ${
                    manualCheckIn === option.value
                      ? 'border-teal-600 bg-teal-100 text-teal-900'
                      : 'border-harbour-border bg-white text-slate-700'
                  }`}
                  onClick={() => setManualCheckIn(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {wizard.step === 1 ? (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-md border border-harbour-border bg-harbour-panel p-3">
              <p className="text-xs uppercase text-harbour-muted">Current mode</p>
              <p className="text-base font-semibold text-slate-900">{mode}</p>
            </div>
            <div className="rounded-md border border-harbour-border bg-harbour-panel p-3">
              <p className="text-xs uppercase text-harbour-muted">Stress / body battery</p>
              <p className="text-base font-semibold text-slate-900">
                {wearable.stress}% / {wearable.bodyBattery}%
              </p>
            </div>
            <div className="rounded-md border border-harbour-border bg-harbour-panel p-3">
              <p className="text-xs uppercase text-harbour-muted">Meeting density</p>
              <p className="text-base font-semibold text-slate-900">{preview.meetingDensity}</p>
            </div>
            <div className="rounded-md border border-harbour-border bg-harbour-panel p-3">
              <p className="text-xs uppercase text-harbour-muted">Email pressure</p>
              <p className="text-base font-semibold text-slate-900">{preview.emailPressure}</p>
            </div>
          </div>
        ) : null}

        {wizard.step === 2 ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
              <p className="text-xs uppercase text-teal-700">Best next move</p>
              <p className="text-base font-semibold text-teal-900">{preview.primary.label}</p>
              <p className="text-xs text-teal-700">{preview.primary.explanation}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {preview.backups.map((backup) => (
                <div
                  key={backup.taskId}
                  className="rounded-md border border-harbour-border bg-white px-3 py-2"
                >
                  <p className="text-xs uppercase text-harbour-muted">Backup</p>
                  <p className="text-sm font-medium text-slate-900">{backup.label}</p>
                </div>
              ))}
            </div>
            <div className="rounded-md border border-harbour-border bg-harbour-panel p-3">
              <p className="mb-1 text-xs uppercase text-harbour-muted">Next few hours</p>
              <div className="space-y-1">
                {previewPlan.slice(0, 4).map((block) => (
                  <p key={block.id} className="text-xs text-slate-700">
                    {block.startTime}-{block.endTime} · {block.title}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {wizard.step === 3 ? (
          <div className="space-y-3 text-sm text-slate-700">
            <div className="rounded-md border border-harbour-border bg-harbour-panel p-3">
              <p className="text-xs uppercase text-harbour-muted">Commit summary</p>
              <p className="text-sm text-slate-900">{preview.primary.label}</p>
              <p className="text-xs text-slate-600">{preview.safeguard.detail}</p>
            </div>
            <p>
              Applying this will update recommendation ordering, create a new plan, and keep
              strategic work visible.
            </p>
          </div>
        ) : null}

        <footer className="mt-5 flex justify-between">
          <button
            className="rounded-md border border-harbour-border px-3 py-1.5 text-xs text-slate-700"
            disabled={wizard.step === 0}
            onClick={previousWizardStep}
          >
            Back
          </button>

          {wizard.step < 3 ? (
            <button
              className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white"
              onClick={nextWizardStep}
            >
              Continue
            </button>
          ) : (
            <button
              className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white"
              onClick={applyReplan}
            >
              Commit plan
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

export function HarbourApp() {
  const [activeView, setActiveView] = React.useState<'overview' | 'integrations' | 'diagnostics'>(
    'overview',
  );
  const [demoNotice, setDemoNotice] = React.useState<string | null>(null);
  const planSectionRef = React.useRef<HTMLDivElement | null>(null);
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const {
    tasks,
    emails,
    calendar,
    wearable,
    manualCheckIn,
    mode,
    recommendation,
    pendingRecommendation,
    plan,
    replanDiff,
    needsReplan,
    syncStatus,
    sources,
    openWizard,
    setManualCheckIn,
    triggerOverload,
    triggerRecovery,
    refreshSources,
  } = useHarbourStore(
    useShallow((state) => ({
      tasks: state.tasks,
      emails: state.emails,
      calendar: state.calendar,
      wearable: state.wearable,
      manualCheckIn: state.manualCheckIn,
      mode: state.mode,
      recommendation: state.recommendation,
      pendingRecommendation: state.pendingRecommendation,
      plan: state.plan,
      replanDiff: state.replanDiff,
      needsReplan: state.needsReplan,
      syncStatus: state.syncStatus,
      sources: state.sources,
      openWizard: state.openWizard,
      setManualCheckIn: state.setManualCheckIn,
      triggerOverload: state.triggerOverload,
      triggerRecovery: state.triggerRecovery,
      refreshSources: state.refreshSources,
    })),
  );

  const rankingMap = new Map(recommendation.rankings.map((entry) => [entry.taskId, entry]));

  const orderedTasks = [...tasks].sort((a, b) => {
    const scoreA = rankingMap.get(a.id)?.score || 0;
    const scoreB = rankingMap.get(b.id)?.score || 0;
    return scoreB - scoreA;
  });

  const recommendationPreview = pendingRecommendation || recommendation;
  const nowDate = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  React.useEffect(() => {
    refreshSources().catch(() => undefined);
  }, [refreshSources]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'o') {
        event.preventDefault();
        triggerOverload();
        setDemoNotice('Overload trigger received');
      }

      if (key === 'r') {
        event.preventDefault();
        triggerRecovery();
        setDemoNotice('Recovery trigger received');
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [triggerOverload, triggerRecovery]);

  React.useEffect(() => {
    if (!demoNotice) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setDemoNotice(null);
    }, 1800);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [demoNotice]);

  const navItems = [
    {
      label: 'Overview',
      isActive: activeView === 'overview',
      onClick: () => setActiveView('overview'),
    },
    {
      label: 'Check-in',
      isActive: false,
      onClick: () => openWizard(mode === 'Overloaded' ? 'overwhelmed' : 'morning'),
    },
    {
      label: 'Integrations',
      isActive: activeView === 'integrations',
      onClick: () => setActiveView('integrations'),
    },
    {
      label: 'Diagnostics',
      isActive: activeView === 'diagnostics',
      onClick: () => setActiveView('diagnostics'),
    },
  ];

  return (
    <div className="h-screen overflow-hidden bg-harbour-bg text-harbour-text">
      <div className="flex h-full overflow-hidden">
        <aside className="flex h-full w-[252px] shrink-0 flex-col border-r border-harbour-border bg-harbour-bg">
          <div className="drag-region flex h-14 shrink-0 items-center border-b border-harbour-border px-3">
            <div className={`flex flex-1 items-center gap-3 ${isMac ? 'pl-16' : ''}`}>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-harbour-text text-[11px] font-semibold text-white">
                H
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-900">Harbour</p>
                <p className="text-[11px] text-slate-500">Adaptive planning</p>
              </div>
            </div>
          </div>

          <div className="flex-1 px-3 py-4">
            <nav className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  className={`flex w-full items-center justify-between rounded-[10px] px-2.5 py-2 text-left text-[14px] no-drag ${
                    item.isActive
                      ? 'border border-harbour-accent/20 bg-harbour-accentSoft font-medium text-slate-900'
                      : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
                  }`}
                  onClick={item.onClick}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="drag-region flex h-14 shrink-0 items-center justify-between border-b border-harbour-border bg-harbour-surface/95 px-4 backdrop-blur">
            <div className={`flex items-center gap-3 ${isMac ? 'pl-20' : ''}`}>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                  {activeView === 'integrations'
                    ? 'Integrations'
                    : activeView === 'diagnostics'
                      ? 'Diagnostics'
                      : 'Overview'}
                </p>
                <div className="flex items-center gap-2">
                  <h1 className="text-[15px] font-semibold text-slate-900">
                    {activeView === 'integrations'
                      ? 'Connected integrations'
                      : activeView === 'diagnostics'
                        ? 'Runtime diagnostics'
                        : nowDate}
                  </h1>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${modeStyles[mode]}`}
                  >
                    {mode}
                  </span>
                </div>
              </div>
            </div>

            <div className="no-drag flex items-center gap-2">
              <p className="rounded-full border border-harbour-border bg-white px-3 py-1 text-xs text-slate-600">
                {syncStatus}
              </p>
              <button
                className="rounded-full bg-harbour-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0d5f59]"
                onClick={() => openWizard(mode === 'Overloaded' ? 'overwhelmed' : 'morning')}
              >
                Start check-in
              </button>
            </div>
          </header>

          {activeView === 'integrations' ? (
            <main className="harbour-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <IntegrationsView sources={sources} tasks={tasks} />
            </main>
          ) : activeView === 'diagnostics' ? (
            <main className="harbour-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <DiagnosticsView sources={sources} tasks={tasks} />
            </main>
          ) : (
            <main className="harbour-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.95fr)]">
            <div className="space-y-4">
              <Card title="State summary">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-[10px] border border-harbour-border bg-harbour-panel p-3">
                    <p className="text-xs uppercase text-harbour-muted">Mode</p>
                    <span
                      className={`mt-1 inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${modeStyles[mode]}`}
                    >
                      {mode}
                    </span>
                  </div>
                  <div className="rounded-[10px] border border-harbour-border bg-harbour-panel p-3">
                    <p className="text-xs uppercase text-harbour-muted">Stress</p>
                    <p className="text-base font-semibold text-slate-900">{wearable.stress}%</p>
                  </div>
                  <div className="rounded-[10px] border border-harbour-border bg-harbour-panel p-3">
                    <p className="text-xs uppercase text-harbour-muted">Body battery</p>
                    <p className="text-base font-semibold text-slate-900">{wearable.bodyBattery}%</p>
                  </div>
                  <div className="rounded-[10px] border border-harbour-border bg-harbour-panel p-3">
                    <label className="text-xs uppercase text-harbour-muted" htmlFor="self-report">
                      Self report
                    </label>
                    <select
                      id="self-report"
                      className="mt-1 w-full rounded-[8px] border border-harbour-border bg-white px-2 py-1 text-xs text-slate-700"
                      value={manualCheckIn}
                      onChange={(event) => setManualCheckIn(event.target.value as ManualCheckIn)}
                    >
                      {manualOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </Card>

              <Card
                title="Best next action"
                actions={
                  <span className="rounded-full bg-harbour-accentSoft px-2.5 py-1 text-xs font-semibold text-harbour-accent">
                    {recommendation.primary.estimateMin}m
                  </span>
                }
              >
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-harbour-muted">Primary</p>
                    <h3 className="text-[28px] leading-8 font-semibold tracking-[-0.02em] text-slate-900">
                      {recommendation.primary.label}
                    </h3>
                    <p className="text-sm text-slate-600">{recommendation.primary.explanation}</p>
                  </div>

                  {needsReplan ? (
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                      State changed. Plan mismatch detected. Pending recommendation:
                      <span className="ml-1 font-semibold">{recommendationPreview.primary.label}</span>
                    </div>
                  ) : null}

                  {replanDiff ? (
                    <p className="text-xs text-slate-500">
                      Previous: {replanDiff.previousRecommendation}
                    </p>
                  ) : null}

                  <button className="rounded-full bg-harbour-accent px-3 py-1.5 text-xs font-semibold text-white">
                    {recommendation.primary.cta}
                  </button>
                </div>
              </Card>

              <div ref={planSectionRef}>
                <Card title="Adaptive day plan">
                <div className="space-y-2">
                  {plan.map((block) => (
                    <div
                      key={block.id}
                      className={`rounded-[10px] border border-harbour-border border-l-4 px-3 py-2.5 ${blockStyles[block.type]}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">{block.title}</p>
                        <span className="text-xs text-slate-600">
                          {block.startTime}-{block.endTime}
                        </span>
                      </div>
                      {block.note ? <p className="text-xs text-slate-600">{block.note}</p> : null}
                    </div>
                  ))}
                </div>
                </Card>
              </div>

            </div>

            <div className="space-y-4">
              <Card title="Tasks">
                <div className="space-y-2">
                  {orderedTasks.map((task, index) => {
                    const ranking = rankingMap.get(task.id);
                    return (
                      <div
                        key={task.id}
                        className={`rounded-[10px] border p-3 transition ${
                          index === 0
                            ? 'border-[#c9ddff] bg-[#f7faff]'
                            : 'border-harbour-border bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-5 text-slate-900">
                            {task.id} · {task.issueTitle}
                          </p>
                          <span className="rounded-full border border-harbour-border px-2 py-0.5 text-[11px] text-slate-500">
                            {task.priority}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          {task.project} · due {task.dueDate} · {task.status}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          fit {ranking ? ranking.score.toFixed(1) : '0.0'}
                          {index === 0 ? ' · best now' : ''}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card title="Important email pressure">
                <div className="space-y-2">
                  {emails.slice(0, 4).map((email) => (
                    <EmailItem key={email.id} email={email} />
                  ))}
                </div>
              </Card>

              <Card title="Calendar pressure">
                <div className="space-y-2 text-sm">
                  {calendar.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-[10px] border border-harbour-border bg-white px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-slate-900">{event.title}</p>
                        <span className="text-xs text-slate-600">
                          {event.startTime}-{event.endTime}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{event.kind.replace('-', ' ')}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Recommendation rationale">
                <ul className="space-y-2 text-sm text-slate-700">
                  {recommendation.rationale.map((line) => (
                    <li key={line} className="rounded-[10px] bg-harbour-panel px-3 py-2">
                      {line}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
            </div>
            </main>
          )}
        </div>
      </div>

      {demoNotice ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-30 rounded-md border border-harbour-border bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-lg backdrop-blur-sm">
          {demoNotice}
        </div>
      ) : null}

      <WizardOverlay />
    </div>
  );
}
