import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { serviceIdParamSchema, ticketIdParamSchema, joinQueueSchema } from '../types/index.js';
import * as queueController from '../controllers/queue.controller.js';

const router = Router();

/**
 * Customer-facing queue routes.
 *
 * GET  /api/services                    → List available services
 * POST /api/queues/:serviceId/join      → Join a queue
 * GET  /api/queues/:serviceId/status    → Get queue status
 * GET  /api/tickets/:ticketId           → Get ticket details + position
 * POST /api/tickets/:ticketId/cancel    → Cancel a ticket
 */

// List all available services
router.get('/services', queueController.listServices);

// Join a queue
router.post(
  '/queues/:serviceId/join',
  validate(joinQueueSchema),
  queueController.joinQueue
);

// Get queue status (currently serving, waiting count)
router.get(
  '/queues/:serviceId/status',
  validate(serviceIdParamSchema),
  queueController.getQueueStatus
);

// Get ticket details with position
router.get(
  '/tickets/:ticketId',
  validate(ticketIdParamSchema),
  queueController.getTicket
);

// Cancel a ticket
router.post(
  '/tickets/:ticketId/cancel',
  validate(ticketIdParamSchema),
  queueController.cancelTicket
);

export default router;
