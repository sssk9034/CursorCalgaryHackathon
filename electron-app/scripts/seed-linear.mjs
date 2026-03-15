import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(repoRoot, '.env') });

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const LINEAR_TEAM_KEY = process.env.LINEAR_TEAM_KEY;
const LINEAR_PROJECT_NAME = process.env.LINEAR_PROJECT_NAME || 'Harbour Demo';

if (!LINEAR_API_KEY) {
  console.error('Missing LINEAR_API_KEY in the repo root .env.');
  process.exit(1);
}

const seedIssues = [
  {
    title: 'Harbour Demo: Draft adaptive planning ADR for investor demo',
    priority: 2,
    dueDate: offsetDate(1),
    description:
      'Imported by Harbour.\n\nDeep strategic work item used to show Focus Ready mode.',
  },
  {
    title: 'Harbour Demo: Patch calendar callback mismatch before noon walkthrough',
    priority: 1,
    dueDate: offsetDate(0),
    description:
      'Imported by Harbour.\n\nBounded urgent issue used to show Caution mode.',
  },
  {
    title: 'Harbour Demo: Fix settings hydration warning and remove noisy logs',
    priority: 3,
    dueDate: offsetDate(2),
    description:
      'Imported by Harbour.\n\nQuick low-activation cleanup used as an overwhelmed-safe task.',
  },
  {
    title: 'Harbour Demo: Tune wizard copy and edge-state messaging for smoother recovery flow',
    priority: 2,
    dueDate: offsetDate(1),
    description:
      'Imported by Harbour.\n\nModerate implementation task used to show Recovery mode.',
  },
  {
    title: 'Harbour Demo: Unblock missing wearable events after device bridge handoff',
    priority: 2,
    dueDate: offsetDate(0),
    description:
      'Imported by Harbour.\n\nDependency-heavy task kept for blocked-state realism.',
  },
  {
    title: 'Harbour Demo: Reply to stakeholder thread with revised launch timing and risks',
    priority: 3,
    dueDate: offsetDate(0),
    description:
      'Imported by Harbour.\n\nLow-startup communication task used in Overloaded mode.',
  },
];

function offsetDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function linearRequest(query, variables = {}) {
  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: LINEAR_API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json();

  if (!response.ok || payload.errors?.length) {
    const message =
      payload.errors?.map((error) => error.message).join('; ') ||
      `Linear responded with ${response.status}`;
    throw new Error(message);
  }

  return payload.data;
}

async function getTeam() {
  const data = await linearRequest(`
    query HarbourLinearTeams {
      teams {
        nodes {
          id
          key
          name
        }
      }
    }
  `);

  if (LINEAR_TEAM_KEY) {
    const configuredTeam = data.teams.nodes.find((node) => node.key === LINEAR_TEAM_KEY);

    if (!configuredTeam) {
      throw new Error(`Could not find team with key "${LINEAR_TEAM_KEY}".`);
    }

    return configuredTeam;
  }

  if (data.teams.nodes.length === 1) {
    return data.teams.nodes[0];
  }

  throw new Error(
    `Multiple teams found. Set LINEAR_TEAM_KEY in the repo root .env to one of: ${data.teams.nodes
      .map((node) => node.key)
      .join(', ')}`,
  );
}

async function getProject(teamId) {
  const data = await linearRequest(`
    query HarbourProjects {
      projects(first: 50) {
        nodes {
          id
          name
          teams {
            nodes {
              id
            }
          }
        }
      }
    }
  `);

  const existingProject = data.projects.nodes.find(
    (project) =>
      project.name === LINEAR_PROJECT_NAME &&
      project.teams.nodes.some((team) => team.id === teamId),
  );

  if (existingProject) {
    return existingProject;
  }

  const created = await linearRequest(
    `
      mutation HarbourCreateProject($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          success
          project {
            id
            name
          }
        }
      }
    `,
    {
      input: {
        name: LINEAR_PROJECT_NAME,
        description: 'Seeded by Harbour for adaptive planning demo data.',
        teamIds: [teamId],
      },
    },
  );

  return created.projectCreate.project;
}

async function getExistingTitles(projectId) {
  const data = await linearRequest(
    `
      query HarbourProjectIssues($projectId: String!) {
        project(id: $projectId) {
          issues(first: 100) {
            nodes {
              title
            }
          }
        }
      }
    `,
    { projectId },
  );

  return new Set(data.project.issues.nodes.map((issue) => issue.title));
}

async function createIssue(teamId, projectId, issue) {
  const data = await linearRequest(
    `
      mutation HarbourCreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            title
            url
          }
        }
      }
    `,
    {
      input: {
        teamId,
        projectId,
        title: issue.title,
        description: issue.description,
        priority: issue.priority,
        dueDate: issue.dueDate,
      },
    },
  );

  return data.issueCreate.issue;
}

async function main() {
  const team = await getTeam();
  const project = await getProject(team.id);
  const existingTitles = await getExistingTitles(project.id);
  const created = [];
  const skipped = [];

  for (const issue of seedIssues) {
    if (existingTitles.has(issue.title)) {
      skipped.push(issue.title);
      continue;
    }

    const createdIssue = await createIssue(team.id, project.id, issue);
    created.push(createdIssue);
  }

  console.log(`Team: ${team.name} (${team.key})`);
  console.log(`Project: ${project.name}`);

  if (created.length) {
    console.log('Created issues:');
    for (const issue of created) {
      console.log(`- ${issue.identifier}: ${issue.title}`);
    }
  }

  if (skipped.length) {
    console.log('Skipped existing issues:');
    for (const title of skipped) {
      console.log(`- ${title}`);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
