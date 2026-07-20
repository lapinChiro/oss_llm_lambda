import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
  stories: [
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  addons: [
    "@storybook/addon-vitest"
  ],
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      docgen: 'vue-docgen-api',
    },
  },
  core: {
    disableTelemetry: true,
  },
};
export default config;
