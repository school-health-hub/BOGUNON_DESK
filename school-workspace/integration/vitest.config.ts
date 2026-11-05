import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'node',include:['school-workspace/integration/tests/**/*.test.ts','school-workspace/integration/tests/**/*.test.tsx'],fileParallelism:false}});
