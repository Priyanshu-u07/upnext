import { RequestHandler } from 'express';
import * as queueService from '../services/queue.service.js';
import { requireParam } from '../utils/requireParam.js';

/**
 * Customer-facing queue controllers.
 * These handle customer actions: join queue, view status, view ticket, cancel.
 */

// GET /api/services — List all available services
export const listServices: RequestHandler = async (_req, res, next) => {
  try {
    const services = await queueService.getServices();
    res.json({ data: services });
  } catch (error) {
    next(error);
  }
};

// POST /api/queues/:serviceId/join — Join a queue
export const joinQueue: RequestHandler = async (req, res, next) => {
  try {
    const serviceId = requireParam(req.params.serviceId, 'serviceId');
    // customerId will come from auth in Phase 5
    // For now, it's optional (anonymous joining)
    const ticket = await queueService.joinQueue(serviceId);
    res.status(201).json({ data: ticket });
  } catch (error) {
    next(error);
  }
};

// GET /api/queues/:serviceId/status — Get queue status
export const getQueueStatus: RequestHandler = async (req, res, next) => {
  try {
    const serviceId = requireParam(req.params.serviceId, 'serviceId');
    const status = await queueService.getQueueStatus(serviceId);
    res.json({ data: status });
  } catch (error) {
    next(error);
  }
};

// GET /api/tickets/:ticketId — Get ticket details with position
export const getTicket: RequestHandler = async (req, res, next) => {
  try {
    const ticketId = requireParam(req.params.ticketId, 'ticketId');
    const ticket = await queueService.getTicket(ticketId);
    res.json({ data: ticket });
  } catch (error) {
    next(error);
  }
};

// POST /api/tickets/:ticketId/cancel — Cancel a ticket
export const cancelTicket: RequestHandler = async (req, res, next) => {
  try {
    const ticketId = requireParam(req.params.ticketId, 'ticketId');
    const ticket = await queueService.cancelTicket(ticketId);
    res.json({ data: ticket });
  } catch (error) {
    next(error);
  }
};
