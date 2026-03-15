import type { SourceDescriptor } from '../types/harbour';

export const defaultSources: SourceDescriptor[] = [
  {
    id: 'tasks',
    label: 'Tasks',
    kind: 'mock',
    summary: 'Mock task feed',
    detail: 'Using the built-in task sample shaped like a synced work tracker.',
  },
  {
    id: 'email',
    label: 'Email',
    kind: 'mock',
    summary: 'Mock inbox pressure',
    detail: 'Important email context is simulated for demo pacing.',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    kind: 'mock',
    summary: 'Mock schedule',
    detail: 'Meetings and focus windows are mocked to drive planning constraints.',
  },
  {
    id: 'wearable',
    label: 'Wearable state',
    kind: 'mock',
    summary: 'Simulated stress signal',
    detail: 'Stress, body battery, and trend are simulated inside the app.',
  },
];
