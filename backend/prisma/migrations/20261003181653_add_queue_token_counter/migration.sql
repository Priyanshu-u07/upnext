-- AlterTable
ALTER TABLE "Queue" ADD COLUMN     "lastTokenNumber" INTEGER NOT NULL DEFAULT 0;

-- Backfill. Queues that already exist have tickets, so the counter has to start
-- at the highest token already handed out. Left at the default of 0, the next
-- patient would be issued number 1 again and fail the unique constraint.
UPDATE "Queue" q
SET "lastTokenNumber" = COALESCE(
  (SELECT MAX(t."tokenNumber") FROM "Ticket" t WHERE t."queueId" = q.id),
  0
);
