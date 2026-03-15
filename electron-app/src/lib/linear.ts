import type { HarbourTask, SourceDescriptor, SourceSnapshot } from '../types/harbour';
import { defaultSources } from './source-defaults';

interface LinearViewer {
  name?: string | null;
  email?: string | null;
  organization?: {
    name?: string | null;
  } | null;
}

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  priority: number | null;
  dueDate: string | null;
  updatedAt: string;
  url?: string | null;
  state?: {
    name?: string | null;
    type?: string | null;
  } | null;
  team?: {
    key?: string | null;
    name?: string | null;
  } | null;
  project?: {
    name?: string | null;
  } | null;
  cycle?: {
    name?: string | null;
  } | null;
  assignee?: {
    name?: string | null;
  } | null;
}

interface LinearProject {
  id: string;
  name: string;
  issues?: {
    nodes?: LinearIssue[];
  };
}

interface LinearResponse {
  viewer?: LinearViewer;
  projects?: {
    nodes?: LinearProject[];
  };
  issues?: {
    nodes?: LinearIssue[];
  };
}

const LINEAR_PROJECT_NAME = process.env.LINEAR_PROJECT_NAME || 'Harbour Demo';

const LINEAR_QUERY = `
  query HarbourLinearSnapshot {
    viewer {
      name
      email
      organization {
        name
      }
    }
    projects(first: 20) {
      nodes {
        id
        name
        issues(first: 8) {
          nodes {
            id
            identifier
            title
            priority
            dueDate
            updatedAt
            url
            state {
              name
              type
            }
            team {
              key
              name
            }
            project {
              name
            }
            cycle {
              name
            }
            assignee {
              name
            }
          }
        }
      }
    }
    issues(first: 8) {
      nodes {
        id
        identifier
        title
        priority
        dueDate
        updatedAt
        url
        state {
          name
          type
        }
        team {
          key
          name
        }
        project {
          name
        }
        cycle {
          name
        }
        assignee {
          name
        }
      }
    }
  }
`;

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function mapPriority(priority: number | null): HarbourTask['priority'] {
  if (priority === 1) return 'P0';
  if (priority === 2) return 'P1';
  if (priority === 3) return 'P2';
  return 'P3';
}

function mapStatus(stateName: string | null | undefined): HarbourTask['status'] {
  const value = (stateName || '').toLowerCase();

  if (value.includes('block')) return 'Blocked';
  if (value.includes('progress') || value.includes('started')) return 'In Progress';
  if (value.includes('review')) return 'Review';
  return 'Todo';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function daysUntil(dateValue: string | null): number | null {
  if (!dateValue) {
    return null;
  }

  const target = new Date(dateValue);
  const now = new Date();
  const deltaMs = target.getTime() - now.getTime();
  return Math.round(deltaMs / (1000 * 60 * 60 * 24));
}

function deriveTaskHeuristics(issue: LinearIssue, index: number, total: number): HarbourTask {
  const priorityValue = issue.priority ?? 4;
  const dueInDays = daysUntil(issue.dueDate);
  const title = issue.title.toLowerCase();
  const status = mapStatus(issue.state?.name);
  const isCommunication = /reply|comment|follow up|follow-up|update|message/.test(title);
  const isFix = /fix|patch|bug|error|callback|crash/.test(title);
  const isStrategic = /adr|architecture|design|strategy|plan|roadmap|migration/.test(title);
  const isPolish = /copy|polish|tune|cleanup|refactor|messaging/.test(title);

  let urgency = 10 - Math.min(priorityValue, 4) * 1.5;
  if (dueInDays !== null) {
    urgency += dueInDays <= 0 ? 2 : dueInDays <= 1 ? 1 : dueInDays <= 3 ? 0.4 : -0.4;
  }

  let clarity = isFix || isCommunication ? 8 : isStrategic ? 4 : isPolish ? 7 : 6;
  let activationEnergy = isStrategic ? 8 : isCommunication ? 2 : isFix ? 4 : isPolish ? 5 : 6;
  const focusDepth = isStrategic ? 9 : isCommunication ? 1 : isFix ? 5 : isPolish ? 6 : 6;
  const expectedDurationMin = isCommunication ? 15 : isFix ? 40 : isStrategic ? 95 : isPolish ? 50 : 45;
  const momentumValue = isPolish ? 8 : isFix ? 7 : isCommunication ? 8 : 6;
  const importance = isStrategic ? 10 : 7 - Math.min(index, 3);
  const fragmentability = isCommunication ? 10 : isFix ? 7 : isStrategic ? 3 : 6;

  if (status === 'Blocked') {
    activationEnergy += 2;
    clarity -= 1;
  }

  const fallbackStrategic = index === 0 || (priorityValue <= 2 && total > 3);
  const fallbackOverwhelmedFriendly = index === total - 1 || expectedDurationMin <= 20;

  return {
    id: issue.identifier,
    project: issue.project?.name || issue.team?.name || 'Linear',
    issueTitle: issue.title,
    status,
    priority: mapPriority(issue.priority),
    dueDate: issue.dueDate || isoDateOffset(index + 1),
    assignee: issue.assignee?.name || 'Unassigned',
    cycleHint: issue.cycle?.name || issue.team?.key || 'Linear',
    urgency: clamp(Math.round(urgency), 1, 10),
    clarity: clamp(Math.round(clarity), 1, 10),
    activationEnergy: clamp(Math.round(activationEnergy), 1, 10),
    focusDepth: clamp(Math.round(focusDepth), 1, 10),
    metadata: {
      importance: clamp(Math.round(importance), 1, 10),
      emotionalFriction: clamp(isStrategic ? 6 : isCommunication ? 2 : 4, 1, 10),
      expectedDurationMin,
      dependencyRisk: status === 'Blocked' ? 9 : isStrategic ? 4 : 2,
      momentumValue: clamp(momentumValue, 1, 10),
      fragmentability: clamp(fragmentability, 1, 10),
    },
    syncedAt: issue.updatedAt,
    strategicTag: isStrategic || fallbackStrategic,
    overwhelmedFriendly: isCommunication || fallbackOverwhelmedFriendly,
  };
}

function buildSources(
  kind: SourceDescriptor['kind'],
  summary: string,
  detail: string,
  updatedAt?: string,
): SourceDescriptor[] {
  return defaultSources.map((source) => {
    if (source.id !== 'tasks') {
      return source;
    }

    return {
      ...source,
      kind,
      summary,
      detail,
      updatedAt,
    };
  });
}

export async function getSourceSnapshot(): Promise<SourceSnapshot> {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    return {
      sources: buildSources(
        'mock',
        'Mock task feed',
        'Set LINEAR_API_KEY in the repo root .env to pull a live issue sample from Linear.',
      ),
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify({ query: LINEAR_QUERY }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Linear responded with ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: LinearResponse;
      errors?: Array<{ message?: string }>;
    };

    if (payload.errors?.length) {
      throw new Error(payload.errors[0].message || 'Unknown Linear GraphQL error');
    }

    const preferredProject = payload.data?.projects?.nodes?.find(
      (project) => project.name === LINEAR_PROJECT_NAME,
    );
    const preferredIssues = preferredProject?.issues?.nodes?.filter(Boolean) || [];
    const fallbackIssues = payload.data?.issues?.nodes?.filter(Boolean) || [];
    const issues = preferredIssues.length ? preferredIssues : fallbackIssues;

    if (!issues.length) {
      return {
        sources: buildSources(
          'hybrid',
          'Linear connected, no issues found',
          'Linear auth succeeded, but no issues were returned. Falling back to mock tasks.',
        ),
      };
    }

    const tasks = issues.map((issue, index) => deriveTaskHeuristics(issue, index, issues.length));
    const viewer = payload.data?.viewer;
    const workspace = viewer?.organization?.name || 'Linear workspace';
    const actor = viewer?.name || viewer?.email || 'Authenticated user';
    const updatedAt = tasks[0]?.syncedAt;
    const sourceScope = preferredIssues.length
      ? `${LINEAR_PROJECT_NAME} in ${workspace}`
      : workspace;

    return {
      tasks,
      sources: buildSources(
        'hybrid',
        'Live Linear issue sample',
        `Tasks are loaded from ${sourceScope} as ${actor}. Harbour still infers planning dimensions locally.`,
        updatedAt,
      ),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Linear error';

    return {
      sources: buildSources(
        'hybrid',
        'Linear connection failed',
        `Falling back to mock tasks. ${message}`,
      ),
    };
  } finally {
    clearTimeout(timeout);
  }
}
