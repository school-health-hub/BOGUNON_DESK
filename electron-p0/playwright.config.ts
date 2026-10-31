import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'**/*.e2e.ts',workers:1,timeout:60000,retries:0,reporter:'list',outputDir:'../artifacts/electron-p0-e2e',use:{trace:'retain-on-failure'}});
