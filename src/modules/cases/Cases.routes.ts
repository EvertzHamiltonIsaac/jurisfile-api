import { Router } from 'express';
import * as casesController from './Cases.controller';
import { authenticate, authorize } from '../../middlewares/Auth.middleware';

const router = Router();

router.use(authenticate);

// GET  /api/cases          → all cases (filtered by role)
// GET  /api/cases/:id      → case detail
// GET  /api/cases/:id/team → assigned attorneys
router.get('/', casesController.getAll);
router.get('/:id', casesController.getOne);
router.get('/:id/team', casesController.getTeam);

// POST  /api/cases             → create case
// PATCH /api/cases/:id         → update case
// POST  /api/cases/:id/team    → assign attorney
router.post('/', authorize('Administrador', 'Abogado Senior', 'Asistente'), casesController.create);
router.patch('/:id', authorize('Administrador', 'Abogado Senior', 'Asistente'), casesController.update);
router.post('/:id/team', authorize('Administrador', 'Abogado Senior'), casesController.assignUser);

export default router;
