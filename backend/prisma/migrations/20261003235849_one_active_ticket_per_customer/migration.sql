-- One active ticket per customer, enforced by the database.
--
-- The service already checks for an existing active ticket before creating a
-- new one, but that check and the insert are two separate statements. A patient
-- who double-taps Join on a slow connection sends two requests that both pass
-- the check before either inserts, and both get a ticket. The customer then
-- holds two places in one queue.
--
-- A partial index is the right shape here: the constraint only applies while a
-- ticket is live. Once it is COMPLETED, CANCELLED, SKIPPED or EXPIRED the same
-- customer must be free to join again later the same day.
--
-- Written by hand because Prisma's schema language cannot express a partial
-- index, so it will not appear in schema.prisma. Anyone running
-- `prisma migrate dev` after this should expect it to report drift.
--
-- customerId is nullable: anyone without a smartphone is added by the
-- receptionist and has no account. Postgres treats NULLs as distinct, so those
-- rows would not collide anyway, but excluding them explicitly says so.
CREATE UNIQUE INDEX "Ticket_one_active_per_customer"
ON "Ticket" ("queueId", "customerId")
WHERE "customerId" IS NOT NULL
  AND status IN ('WAITING', 'CALLED', 'SERVING');
