import { z } from 'zod';

// ─── API Response Types ─────────────────────────────────────

export interface TicketResponse {
  id: string;
  tokenNumber: number;
  tokenDisplay: string; // Derived: prefix + tokenNumber
  status: string;
  priority: string;
  position: number | null;    // How many people ahead
  estimatedWait: {
    min: number;              // minutes
    max: number;              // minutes
  } | null;
  createdAt: string;
  calledAt: string | null;
  completedAt: string | null;
}

export interface QueueStatusResponse {
  serviceId: string;
  serviceName: string;
  queueId: string;
  status: string;             // OPEN, CLOSED, PAUSED
  currentlyServing: {
    tokenNumber: number;
    tokenDisplay: string;
  } | null;
  totalWaiting: number;
  totalServedToday: number;
}

export interface StaffQueueResponse {
  serviceId: string;
  serviceName: string;
  queueId: string;
  status: string;
  currentlyServing: TicketResponse | null;
  tickets: TicketResponse[];
  totalWaiting: number;
  totalServedToday: number;
}

// ─── Zod Validation Schemas ─────────────────────────────────

export const joinQueueSchema = z.object({
  params: z.object({
    serviceId: z.string().uuid('Invalid service ID'),
  }),
  body: z.object({
    customerName: z.string().min(1, 'Customer name is required').max(100).optional(),
  }).optional(),
});

export const serviceIdParamSchema = z.object({
  params: z.object({
    serviceId: z.string().uuid('Invalid service ID'),
  }),
});

export const ticketIdParamSchema = z.object({
  params: z.object({
    ticketId: z.string().uuid('Invalid ticket ID'),
  }),
});

// ─── Error Classes ──────────────────────────────────────────

export class AppError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed') {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class QueueClosedError extends AppError {
  constructor(message: string = 'Queue is not open') {
    super(message, 400, 'QUEUE_CLOSED');
    this.name = 'QueueClosedError';
  }
}
