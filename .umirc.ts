import { defineConfig } from 'umi';

export default defineConfig({
  routes: [
    { path: '/', component: 'home/index' },
  ],
  npmClient: 'pnpm',
  publicPath: '/',
});
