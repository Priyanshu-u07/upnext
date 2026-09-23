import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { serviceIdParamSchema, ticketIdParamSchema } from '../types/index.js';
import * as staffController from '../controllers/staff.controller.js';

const router = Router();

/**
 * Staff-facing routes.
 * In Phase 5, all routes will be wrapped with: auth + authorize('STAFF')
 *
 * GET  /api/staff/queues/:serviceId          → Full queue view
 * POST /api/staff/queues/:serviceId/call-next → Call next customer
 * POST /api/staff/tickets/:ticketId/complete  → Mark as completed
 * POST /api/staff/tickets/:ticketId/skip      → Mark as no-show
 * POST /api/staff/tickets/:ticketId/recall    → Recall skipped ticket
 */

// Get full queue for staff dashboard
router.get(
  '/queues/:serviceId',
  validate(serviceIdParamSchema),
  staffController.getStaffQueue
);

// Call next customer
router.post(
  '/queues/:serviceId/call-next',
  validate(serviceIdParamSchema),
  staffController.callNext
);

// Complete a ticket
router.post(
  '/tickets/:ticketId/complete',
  validate(ticketIdParamSchema),
  staffController.completeTicket
);

// Skip (no-show) a ticket
router.post(
  '/tickets/:ticketId/skip',
  validate(ticketIdParamSchema),
  staffController.skipTicket
);

// Recall a skipped ticket
router.post(
  '/tickets/:ticketId/recall',
  validate(ticketIdParamSchema),
  staffController.recallTicket
);

export default router;
