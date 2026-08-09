import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e-results',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  // Both servers, torn down together. The API reseeds its store on boot.
  webServer: [
    {
      // The backend is Python now. See AgentPlatform-BackEnd/README.md for setup.
      command: 'uv run uvicorn app.main:app --port 4000',
      cwd: '../../AgentPlatform-BackEnd/server',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
