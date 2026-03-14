import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'My Extension',
    description: 'A browser extension that reads active tab content',
    permissions: ['activeTab', 'scripting'],
  },
});
