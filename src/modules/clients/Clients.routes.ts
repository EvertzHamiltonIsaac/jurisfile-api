import { Router } from 'express';
import * as clientsController from './Clientes.controller';
import { authenticate, authorize } from '../../middlewares/Auth.middleware';

const router = Router();

// All clients routes require authentication
router.use(authenticate);

// GET  /api/clients           → list all clients
// GET  /api/clients/:id       → get one client
// GET  /api/clients/:id/cases → get all cases of a client
router.get('/', clientsController.getAll);
router.get('/:id', clientsController.getOne);
router.get('/:id/cases', clientsController.getClientCases);

// POST   /api/clients     → create client (Admin, Senior, Assistant)
// PATCH  /api/clients/:id → update client (Admin, Senior, Assistant)
// DELETE /api/clients/:id → delete client (Admin only)
router.post(
  '/',
  authorize('Administrador', 'Abogado Senior', 'Asistente'),
  clientsController.create,
);
router.patch(
  '/:id',
  authorize('Administrador', 'Abogado Senior', 'Asistente'),
  clientsController.update,
);
router.delete('/:id', authorize('Administrador'), clientsController.remove);

export default router;
