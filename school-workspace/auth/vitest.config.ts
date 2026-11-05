import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['school-workspace/auth/tests/**/*.test.ts'] } });
