import { RequestHandler } from 'express';
import * as queueService from '../services/queue.service.js';
import { requireParam } from '../utils/requireParam.js';

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
    res.json({ data: ticket });
  } catch (error) {
    next(error);
  }
};
