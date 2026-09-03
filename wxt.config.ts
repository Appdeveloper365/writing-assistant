import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Writing Assistant',
    description: 'AI-powered writing assistant for grammar, spelling, and rewrite controls.',
    version: '0.1.0',
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Writing Assistant',
      default_popup: 'popup.html',
    },
    browser_specific_settings: {
      edge: {
        minimum_edge_version: '122.0.0.0',
      },
    },
  },
});
