import { execFileSync } from 'node:child_process';
import { config } from 'dotenv';

/**
 * Brings the test database up to date before `npm test`.
 *
 * Runs as `pretest`, so a clean clone can run the test suite with no setup:
 * `prisma migrate deploy` creates the database if it does not exist.
 *
 * This is a script rather than `dotenv-cli -e .env.test -- prisma ...` because
 * dotenv-cli and the dotenv package both install a binary named `dotenv`, and
 * they take different flags. Whichever npm happens to link wins, so the command
 * worked on one machine and failed on a fresh install with a usage error.
 */
config({ path: '.env.test' });

if (!process.env.DATABASE_URL) {
  console.error('No DATABASE_URL in backend/.env.test — cannot prepare the test database.');
  process.exit(1);
}

execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});
