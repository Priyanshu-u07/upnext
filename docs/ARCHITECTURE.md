# Architecture

## Shape

```
  patient phone ─┐
  reception desk ┼─ REST   "what is true"  ─┐
  wall display  ─┘                           ├─ Express ─ Prisma ─ PostgreSQL
                 └─ Socket.IO "what changed" ┘
```

Three browser clients, one Express process, one database. The socket and the
REST API share a port, because Socket.IO attaches to the same HTTP server that
Express is mounted on.

### Layers

```
routes/        paths, and Zod validation of params
controllers/   unwrap the request, call the service, emit the event
services/      all business logic; owns every transaction
socket/        rooms, sequence numbers, broadcasting
lib/prisma     one client for the process
```

`queue.service.ts` never imports the socket layer. It returns results;
controllers broadcast afterwards. That keeps the business logic runnable with no
listening port, which is what lets the concurrency tests hammer it directly.

## Data model

```
Organization ──< Service ──< Queue ──< Ticket
                    │                    │
                    └──< Counter <───────┘
User ──< Ticket
```

| | |
|---|---|
| **Organization** | The venue. One per deployment today; the schema allows more. |
| **Service** | Something you queue for. Carries the token prefix (`A`) and the average service time. |
| **Queue** | One per service per day, `@@unique([serviceId, date])`. Holds `lastTokenNumber`. |
| **Ticket** | One patient's place. `@@unique([queueId, tokenNumber])`. |
| **Counter** | A desk. Present in the schema; the UI does not use it yet. |
| **User** | Staff, and optionally patients. A ticket's `customerId` is nullable. |

## What a Service means, and what it cannot express

A `Service` is **a line that advances independently of other lines** — not simply
a thing a customer can ask for. Two services means two queues moving in parallel,
which means two people serving: `A-01` and `B-01` can be called in the same
moment because the clinic has both a doctor and a lab technician.

The opposite case is two doctors sharing one waiting list. That is **one**
service with two `Counter` rows — one line, and the next patient goes to
whichever doctor is free.

Getting it backwards would be visible immediately. Split one line into two
services and the system starts calling two patients at once, as though the
clinic had grown a second doctor.

Which exposes a limitation: **`averageServiceTime` belongs to the service, not
the ticket.** Every person in a queue is assumed to take about the same time. A
single line where one customer needs 25 minutes and the next needs 10 cannot be
estimated accurately here — the wait shown would be an average that is wrong for
nearly everyone in it.

Fixing it properly would mean a service time per ticket, chosen when joining,
with the estimate summing the people ahead rather than multiplying a constant.
That is a real change to how `getPositionInQueue` computes the wait, and it is
not built.

It matters more than it first appears, because the wait estimate is the whole
reason a customer feels safe leaving. An estimate that is wrong for most people
in the line undermines the thing the project exists to do.

### Things deliberately not stored

**The display token.** `A-07` is derived from the service prefix plus the padded
number every time it is returned. Stored, it could drift from the number it
claims to represent.

**The position in line.** Counted at read time from how many waiting tickets
have a lower number. Stored, every call would have to renumber everyone behind
it, and any missed update would be invisible.

### Indexes that do real work

```sql
UNIQUE (queueId, tokenNumber)          -- no two patients hold one token
UNIQUE (serviceId, date)               -- one queue per service per day

CREATE UNIQUE INDEX "Ticket_one_active_per_customer"
ON "Ticket" ("queueId", "customerId")
WHERE "customerId" IS NOT NULL
  AND status IN ('WAITING', 'CALLED', 'SERVING');
```

The last one is hand-written SQL: Prisma's schema language cannot express a
partial index, so it does not appear in `schema.prisma` and `prisma migrate dev`
will report drift. It is partial because the rule only applies while a ticket is
live — once a visit is finished the same patient must be free to join again.

## Ticket state machine

```
                 ┌──────────────── cancel ────────────────┐
                 │                                        ▼
   (join) ──> WAITING ──> CALLED ──> SERVING ──> COMPLETED
                           │   ▲
                      skip │   │ recall
                           ▼   │
                         SKIPPED
```

- `WAITING → CALLED` happens only through **call next**, which claims the lowest
  waiting ticket.
- **Call next also completes whoever was called before.** One button per patient,
  because a busy reception desk will not reliably press two. It is also what
  keeps "currently serving" meaningful: without it, every call leaves another
  ticket stuck in `CALLED`, and since the status query picks the most recently
  called, finishing the newest makes the display fall *backwards* to a patient
  who went home an hour ago.
- `SKIPPED → CALLED` via **recall**, keeping the original token. That is the
  whole point: in the clinic this models, missing your name sends you to the back
  of the line.
- `COMPLETED`, `CANCELLED` and `EXPIRED` are terminal.

## Concurrency

Three races, found by a test that fired 100 simultaneous joins. See the README
for the measured progression.

### Queue of the day

All 100 requests look for today's queue, none find it, all try to create it.
Fixed with `upsert`.

One catch: Prisma only compiles an upsert into a single `INSERT … ON CONFLICT`
when the `update` clause is **non-empty**. Written `update: {}` it falls back to
find-then-create — the same race wearing the word "upsert".

### Token numbers

`MAX(tokenNumber) + 1` is a read-modify-write. At PostgreSQL's default **Read
Committed** isolation, concurrent transactions see the same maximum and compute
the same next number. `@@unique([queueId, tokenNumber])` then rejects the
losers, so the data stays correct and the patients get errors.

Fixed with a counter on the queue row:

```ts
const { lastTokenNumber } = await tx.queue.update({
  where: { id: queue.id },
  data: { lastTokenNumber: { increment: 1 } },
  select: { lastTokenNumber: true },
});
```

PostgreSQL takes a row lock for the `UPDATE` and re-reads the value under it, so
simultaneous joins serialise. One statement, no retry loop.

Rejected: `Serializable` isolation with a retry wrapper (correct, but puts a
retry path on every join); catching `23505` and retrying (retries grow with
contention); a per-queue advisory lock (works, but is a hand-managed lock).

### Calling the next patient

The dangerous one, because **no constraint catches it**. Both transactions read
the lowest waiting ticket, both update it, the second write wins silently. Two
counters call the same person; another is never called.

```sql
SELECT id FROM "Ticket"
WHERE "queueId" = $1 AND status = 'WAITING'
ORDER BY "tokenNumber" ASC
LIMIT 1
FOR UPDATE SKIP LOCKED
```

Raw SQL, because Prisma cannot express the locking clause. `SKIP LOCKED` rather
than plain `FOR UPDATE` so counter 2 steps over the row counter 1 holds and takes
the *next* patient instead of blocking — which is what two counters working side
by side should do.

### One ticket per patient

The service checks for an existing active ticket before inserting, but the check
and the insert are separate statements. A double-tap on a slow connection sends
two requests that both pass. The partial unique index closes the window; the
insert catches `P2002` and returns the ticket that won. The token increment is
inside the same transaction, so the rollback takes it back and leaves no gap.

## Real-time

### Event flow

```
receptionist presses Call next
  └─ POST /api/staff/queues/:id/call-next   (x-staff-key)
      └─ transaction: complete previous, claim next with SKIP LOCKED
          └─ emitQueueUpdated(serviceId, 'CALLED', ticketId)
              └─ re-reads queue status from the database
                  └─ io.to("queue:{serviceId}").emit('QUEUE_UPDATED', …)
                      ├─ wall display   renders from the payload, no request
                      ├─ reception      re-reads the ticket list
                      └─ patient phones re-read their own ticket
```

`emitQueueUpdated` reads the state itself rather than taking it from the caller,
so a broadcast can never disagree with the database. A failure to broadcast does
not fail the HTTP request: the write has committed and the patient has their
ticket, and every client converges anyway because it re-reads on reconnect.

### One event, not six

```ts
interface QueueUpdatedPayload {
  serviceId: string
  status: QueueStatus
  currentlyServing: { tokenNumber: number; tokenDisplay: string } | null
  totalWaiting: number
  totalServedToday: number
  seq: number
  action: 'JOINED' | 'CALLED' | 'COMPLETED' | 'SKIPPED' | 'RECALLED' | 'CANCELLED'
  ticketId: string | null
}
```

Every screen wants the same thing — the current state of the queue. Fine-grained
events mean each client must handle every type, and any type someone forgets
becomes a screen that silently goes stale.

The payload carries what is **identical for every viewer**, so the wall display
updates without making a request. It cannot carry a patient's own position,
which differs per viewer, so phones refetch their own ticket — but only when the
action could have moved them. Someone joining *behind* you does not change your
position, so `JOINED` is skipped. At a hundred connected phones that is the
difference between one button press and a hundred simultaneous requests.

### The socket is a hint, not the truth

Clients read over REST when they mount and **again after every reconnect**, and
treat events as updates on top of state they already trust.

Without it, a phone that loses signal reconnects to a live socket and shows a
ten-minute-old queue — no error, no spinner, just confidently wrong.

Two ordering guards:

- Events carry a per-service `seq`. Anything not newer than what was already
  applied is dropped, so a late delivery cannot walk the queue backwards.
- A REST read that started *before* the last applied event is discarded, so a
  slow read cannot overwrite a fresher event that landed while it was in flight.

### Rooms

Clients join `queue:{serviceId}`, so calling the next patient at the lab does not
wake every phone waiting for general consultation.

## Testing

Tests run against a real PostgreSQL in a separate database
(`queue_management_test`). The races under test are properties of the database's
isolation level, so a mocked client would prove nothing — it would happily report
that the code is correct when it is not.

`vitest.config.ts` loads `.env.test` in the config file rather than a setup file,
because `lib/prisma.ts` reads `DATABASE_URL` at import time and a setup file
would run too late.

## Known limits

- One Socket.IO process holds every connection. More instances need a Redis
  adapter and sticky sessions for the handshake.
- The day boundary uses the server's local midnight, so a UTC host serving an
  IST clinic rolls over at 05:30 local time.
- `Counter` exists in the schema but nothing assigns tickets to one.
- The staff key authenticates the desk, not a person, so there is no audit trail.
- No push notification; the socket only updates an open page.
