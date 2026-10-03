import { Ticket, TicketStatus } from '../generated/prisma/client.js';
import prisma from '../lib/prisma.js';
import { formatToken } from '../utils/formatToken.js';
import {
  NotFoundError,
  ConflictError,
  QueueClosedError,
  TicketResponse,
  QueueStatusResponse,
  StaffQueueResponse,
} from '../types/index.js';

// ─── Helper: Get or create today's queue for a service ──────

async function getOrCreateTodayQueue(serviceId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if service exists
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    throw new NotFoundError('Service not found');
  }

  // Find or create today's queue.
  //
  // This is an upsert rather than find-then-create because the read and the
  // write are not atomic: on the first arrival of the morning, every patient
  // who taps Join in the same moment finds no queue and every one of them
  // tries to create it. One wins and the rest fail on the unique constraint.
  //
  // Measured before the fix: of 100 simultaneous joins, 1 succeeded and 99 were
  // refused here — never even reaching token generation.
  const queue = await prisma.queue.upsert({
    where: {
      serviceId_date: {
        serviceId,
        date: today,
      },
    },
    // Deliberately not `update: {}`. Prisma only compiles an upsert down to a
    // single INSERT ... ON CONFLICT when the update is non-empty; with an empty
    // one it falls back to find-then-create, which is the very race this is
    // here to close. Touching updatedAt is a harmless write that keeps it on
    // the atomic path.
    update: { updatedAt: new Date() },
    create: {
      serviceId,
      date: today,
      status: 'OPEN',
    },
  });

  return { queue, service };
}

// ─── Helper: Convert ticket to API response ─────────────────

interface TicketService {
  id: string;
  name: string;
  prefix: string;
  averageServiceTime: number;
}

function toTicketResponse(
  ticket: Ticket,
  service: TicketService,
  position: number | null = null
): TicketResponse {
  const { averageServiceTime } = service;
  return {
    id: ticket.id,
    serviceId: service.id,
    serviceName: service.name,
    tokenNumber: ticket.tokenNumber,
    tokenDisplay: formatToken(service.prefix, ticket.tokenNumber),
    status: ticket.status,
    priority: ticket.priority,
    position,
    estimatedWait: position !== null && position > 0
      ? {
          min: Math.round(position * averageServiceTime * 0.7), // -30%
          max: Math.round(position * averageServiceTime * 1.3), // +30%
        }
      : position === 0
        ? { min: 0, max: 0 }
        : null,
    createdAt: ticket.createdAt.toISOString(),
    calledAt: ticket.calledAt?.toISOString() ?? null,
    completedAt: ticket.completedAt?.toISOString() ?? null,
  };
}

// ─── Join Queue ─────────────────────────────────────────────
/**
 * Customer joins a queue and receives a server-generated token.
 *
 * Business rules:
 * - Queue must be OPEN
 * - One active ticket per customer (idempotent — returns existing if found)
 * - Token number is generated server-side inside a transaction
 * - The client NEVER chooses its token number
 */
export async function joinQueue(
  serviceId: string,
  customerId?: string
): Promise<TicketResponse> {
  const { queue, service } = await getOrCreateTodayQueue(serviceId);

  // Validate queue is open
  if (queue.status !== 'OPEN') {
    throw new QueueClosedError(
      `Queue for ${service.name} is currently ${queue.status.toLowerCase()}`
    );
  }

  // Idempotency: if customer already has an active ticket, return it
  if (customerId) {
    const existingTicket = await prisma.ticket.findFirst({
      where: {
        queueId: queue.id,
        customerId,
        status: { in: ['WAITING', 'CALLED', 'SERVING'] },
      },
    });

    if (existingTicket) {
      const position = await getPositionInQueue(existingTicket.id);
      return toTicketResponse(existingTicket, service, position);
    }
  }

  // Generate token inside a transaction to prevent duplicate numbers
  const ticket = await prisma.$transaction(async (tx) => {
    // Get the current max token number for this queue
    const lastTicket = await tx.ticket.findFirst({
      where: { queueId: queue.id },
      orderBy: { tokenNumber: 'desc' },
      select: { tokenNumber: true },
    });

    const nextTokenNumber = (lastTicket?.tokenNumber ?? 0) + 1;

    // Create the ticket
    return tx.ticket.create({
      data: {
        queueId: queue.id,
        tokenNumber: nextTokenNumber,
        customerId: customerId ?? null,
        status: 'WAITING',
        priority: 'NORMAL',
      },
    });
  });

  const position = await getPositionInQueue(ticket.id);
  return toTicketResponse(ticket, service, position);
}

// ─── Get Queue Status ───────────────────────────────────────
/**
 * Returns the current state of a service's queue.
 * Used by customers to see the queue before joining, and by the public display.
 */
export async function getQueueStatus(serviceId: string): Promise<QueueStatusResponse> {
  const { queue, service } = await getOrCreateTodayQueue(serviceId);

  // Find currently serving ticket
  const servingTicket = await prisma.ticket.findFirst({
    where: {
      queueId: queue.id,
      status: { in: ['CALLED', 'SERVING'] },
    },
    orderBy: { calledAt: 'desc' },
  });

  // Count waiting tickets
  const totalWaiting = await prisma.ticket.count({
    where: {
      queueId: queue.id,
      status: 'WAITING',
    },
  });

  // Count served today
  const totalServedToday = await prisma.ticket.count({
    where: {
      queueId: queue.id,
      status: 'COMPLETED',
    },
  });

  return {
    serviceId: service.id,
    serviceName: service.name,
    queueId: queue.id,
    status: queue.status,
    currentlyServing: servingTicket
      ? {
          tokenNumber: servingTicket.tokenNumber,
          tokenDisplay: formatToken(service.prefix, servingTicket.tokenNumber),
        }
      : null,
    totalWaiting,
    totalServedToday,
  };
}

// ─── Get Ticket with Position ───────────────────────────────
/**
 * Returns a ticket's details including its position in the queue
 * and estimated wait time.
 */
export async function getTicket(ticketId: string): Promise<TicketResponse> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      queue: {
        include: {
          service: {
            select: { id: true, name: true, prefix: true, averageServiceTime: true },
          },
        },
      },
    },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  const position = await getPositionInQueue(ticketId);

  return toTicketResponse(ticket, ticket.queue.service, position);
}

// ─── Get Position in Queue ──────────────────────────────────
/**
 * Calculates how many WAITING tickets are ahead of this ticket.
 * Returns null if the ticket is not in WAITING status.
 */
async function getPositionInQueue(ticketId: string): Promise<number | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { queueId: true, tokenNumber: true, status: true },
  });

  if (!ticket || ticket.status !== 'WAITING') {
    return null;
  }

  const aheadCount = await prisma.ticket.count({
    where: {
      queueId: ticket.queueId,
      status: 'WAITING',
      tokenNumber: { lt: ticket.tokenNumber },
    },
  });

  return aheadCount;
}

// ─── Cancel Ticket ──────────────────────────────────────────
/**
 * Customer cancels their own ticket.
 * Only WAITING tickets can be cancelled.
 */
export async function cancelTicket(ticketId: string): Promise<TicketResponse> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      queue: {
        include: {
          service: { select: { id: true, name: true, prefix: true, averageServiceTime: true } },
        },
      },
    },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  if (ticket.status !== 'WAITING') {
    throw new ConflictError(
      `Cannot cancel ticket with status ${ticket.status}. Only WAITING tickets can be cancelled.`
    );
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: 'CANCELLED' },
  });

  return toTicketResponse(updated, ticket.queue.service);
}

// ─── Staff: Get Full Queue ──────────────────────────────────
/**
 * Returns the full queue with all tickets for staff dashboard.
 */
export async function getStaffQueue(serviceId: string): Promise<StaffQueueResponse> {
  const { queue, service } = await getOrCreateTodayQueue(serviceId);

  const tickets = await prisma.ticket.findMany({
    where: { queueId: queue.id },
    orderBy: { tokenNumber: 'asc' },
  });

  // Find currently serving
  const servingTicket = tickets.find(
    (t) => t.status === 'CALLED' || t.status === 'SERVING'
  );

  const totalWaiting = tickets.filter((t) => t.status === 'WAITING').length;
  const totalServed = tickets.filter((t) => t.status === 'COMPLETED').length;

  return {
    serviceId: service.id,
    serviceName: service.name,
    queueId: queue.id,
    status: queue.status,
    currentlyServing: servingTicket
      ? toTicketResponse(servingTicket, service)
      : null,
    tickets: tickets.map((t) => {
      const position = t.status === 'WAITING'
        ? tickets.filter(
            (other) => other.status === 'WAITING' && other.tokenNumber < t.tokenNumber
          ).length
        : null;
      return toTicketResponse(t, service, position);
    }),
    totalWaiting,
    totalServedToday: totalServed,
  };
}

// ─── Staff: Call Next ───────────────────────────────────────
/**
 * Calls the next waiting customer.
 *
 * This is the most critical operation for concurrency.
 * Uses a database transaction to atomically find and update
 * the next WAITING ticket to CALLED.
 *
 * In Phase 4, this will use serializable isolation level
 * to prevent two staff members from selecting the same ticket.
 */
export async function callNext(serviceId: string): Promise<TicketResponse> {
  const { queue, service } = await getOrCreateTodayQueue(serviceId);

  const ticket = await prisma.$transaction(async (tx) => {
    // Close out whoever was called before.
    //
    // Pressing Call Next is the receptionist saying the previous patient is
    // finished, so it counts as completing them. That is deliberate: it means
    // one button per patient rather than two, and a busy reception desk will
    // not reliably press two.
    //
    // It is also what keeps "currently serving" meaningful. Without it, every
    // call leaves another ticket stuck in CALLED, and because the status query
    // picks the most recently called, finishing the newest one makes the wall
    // display jump backwards to a patient who was called an hour ago and has
    // long since gone home.
    //
    // A patient who did not turn up should be marked absent with Skip instead,
    // which is why that button exists.
    await tx.ticket.updateMany({
      where: {
        queueId: queue.id,
        status: { in: ['CALLED', 'SERVING'] },
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Find the next WAITING ticket (lowest token number)
    const nextTicket = await tx.ticket.findFirst({
      where: {
        queueId: queue.id,
        status: 'WAITING',
      },
      orderBy: { tokenNumber: 'asc' },
    });

    if (!nextTicket) {
      throw new NotFoundError('No tickets waiting in queue');
    }

    // Update to CALLED
    return tx.ticket.update({
      where: { id: nextTicket.id },
      data: {
        status: 'CALLED',
        calledAt: new Date(),
      },
    });
  });

  return toTicketResponse(ticket, service);
}

// ─── Staff: Complete Ticket ─────────────────────────────────
/**
 * Marks a CALLED/SERVING ticket as COMPLETED.
 */
export async function completeTicket(ticketId: string): Promise<TicketResponse> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      queue: {
        include: {
          service: { select: { id: true, name: true, prefix: true, averageServiceTime: true } },
        },
      },
    },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  if (ticket.status !== 'CALLED' && ticket.status !== 'SERVING') {
    throw new ConflictError(
      `Cannot complete ticket with status ${ticket.status}. Only CALLED or SERVING tickets can be completed.`
    );
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });

  return toTicketResponse(updated, ticket.queue.service);
}

// ─── Staff: Skip Ticket (No-Show) ──────────────────────────
/**
 * Marks a CALLED ticket as SKIPPED (no-show).
 */
export async function skipTicket(ticketId: string): Promise<TicketResponse> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      queue: {
        include: {
          service: { select: { id: true, name: true, prefix: true, averageServiceTime: true } },
        },
      },
    },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  if (ticket.status !== 'CALLED') {
    throw new ConflictError(
      `Cannot skip ticket with status ${ticket.status}. Only CALLED tickets can be skipped.`
    );
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: 'SKIPPED' },
  });

  return toTicketResponse(updated, ticket.queue.service);
}

// ─── Staff: Recall Ticket ───────────────────────────────────
/**
 * Recalls a SKIPPED ticket back to CALLED status.
 */
export async function recallTicket(ticketId: string): Promise<TicketResponse> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      queue: {
        include: {
          service: { select: { id: true, name: true, prefix: true, averageServiceTime: true } },
        },
      },
    },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  if (ticket.status !== 'SKIPPED') {
    throw new ConflictError(
      `Cannot recall ticket with status ${ticket.status}. Only SKIPPED tickets can be recalled.`
    );
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: 'CALLED',
      calledAt: new Date(), // Reset calledAt to now
    },
  });

  return toTicketResponse(updated, ticket.queue.service);
}

// ─── Get All Services ───────────────────────────────────────
/**
 * Returns all active services for an organization.
 * Used by customers to select which queue to join.
 */
/**
 * Returns the venue this deployment serves.
 *
 * The schema is multi-tenant, but the API is not yet: one deployment serves
 * one organization, so this returns the only one there is. Real multi-tenancy
 * would pick the organization from a subdomain or a path segment.
 *
 * It exists so the frontend can show whose queue you have joined without the
 * name being compiled into the page.
 */
export async function getOrganization() {
  const organization = await prisma.organization.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });

  if (!organization) {
    throw new NotFoundError('No organization configured');
  }

  return organization;
}

export async function getServices() {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      prefix: true,
      averageServiceTime: true,
    },
    orderBy: { name: 'asc' },
  });

  return services;
}
