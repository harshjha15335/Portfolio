import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
// Vercel exposes the deployed commit at build time; the visitor benchmark stamps it on every report.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
export default defineConfig({ plugins: [react()], define: { __COMMIT__: JSON.stringify(env.VERCEL_GIT_COMMIT_SHA ?? env.GITHUB_SHA ?? 'local') }, test: { include: ['tests/**/*.test.ts'] }, build: { rollupOptions: { output: { manualChunks: { three: ['three'], physics: ['cannon-es'] } } } } });
