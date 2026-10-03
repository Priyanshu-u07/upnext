import { RequestHandler } from 'express';
import * as queueService from '../services/queue.service.js';
import { requireParam } from '../utils/requireParam.js';
import { emitQueueUpdated } from '../socket/socketManager.js';

/**
 * Staff-facing controllers.
 * These handle staff actions: view queue, call next, complete, skip, recall.
 * In Phase 5, these routes will be protected by auth + authorize('STAFF').
 */

// GET /api/staff/queues/:serviceId — Get full queue for staff dashboard
export const getStaffQueue: RequestHandler = async (req, res, next) => {
  try {
    const serviceId = requireParam(req.params.serviceId, 'serviceId');
    const queue = await queueService.getStaffQueue(serviceId);
    res.json({ data: queue });
  } catch (error) {
    next(error);
  }
};

// POST /api/staff/queues/:serviceId/call-next — Call next customer
export const callNext: RequestHandler = async (req, res, next) => {
  try {
    const serviceId = requireParam(req.params.serviceId, 'serviceId');
    const ticket = await queueService.callNext(serviceId);
    await emitQueueUpdated(serviceId, 'CALLED', ticket.id);
    res.json({ data: ticket });
  } catch (error) {
    next(error);
  }
};

// POST /api/staff/tickets/:ticketId/complete — Mark ticket as completed
export const completeTicket: RequestHandler = async (req, res, next) => {
  try {
    const ticketId = requireParam(req.params.ticketId, 'ticketId');
    const ticket = await queueService.completeTicket(ticketId);
    await emitQueueUpdated(ticket.serviceId, 'COMPLETED', ticket.id);
    res.json({ data: ticket });
  } catch (error) {
    next(error);
  }
};

// POST /api/staff/tickets/:ticketId/skip — Skip (no-show) a ticket
export const skipTicket: RequestHandler = async (req, res, next) => {
  try {
    const ticketId = requireParam(req.params.ticketId, 'ticketId');
    const ticket = await queueService.skipTicket(ticketId);
    await emitQueueUpdated(ticket.serviceId, 'SKIPPED', ticket.id);
    res.json({ data: ticket });
  } catch (error) {
    next(error);
  }
};

// POST /api/staff/tickets/:ticketId/recall — Recall a skipped ticket
export const recallTicket: RequestHandler = async (req, res, next) => {
  try {
    const ticketId = requireParam(req.params.ticketId, 'ticketId');
    const ticket = await queueService.recallTicket(ticketId);
    await emitQueueUpdated(ticket.serviceId, 'RECALLED', ticket.id);
    res.json({ data: ticket });
  } catch (error) {
    next(error);
  }
};
