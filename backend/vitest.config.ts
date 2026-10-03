import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Loaded here, in the config file, rather than in a setup file: this runs
// before any test module is imported, and lib/prisma.ts reads DATABASE_URL at
// import time. A setup file would be too late — the client would already have
// connected to the development database.
const { parsed } = config({ path: '.env.test' });

export default defineConfig({
  test: {
    env: parsed,
    // These tests talk to a real Postgres and share tables. Running files in
    // parallel would have them truncating each other's rows mid-assertion.
    fileParallelism: false,
    // Concurrency tests fire a hundred requests and wait on real locks.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
