import { Router } from 'express';
import * as documentsController from './Documents.controller';
import { authenticate, authorize } from '../../middlewares/Auth.middleware';

const router = Router();

router.use(authenticate);

// GET  /api/documents/case/:caseId   → all documents of a case
// GET  /api/documents/:id/versions   → version history
router.get('/case/:caseId', documentsController.getCaseDocuments);
router.get('/:id/versions', documentsController.getVersions);

// POST /api/documents/upload         → upload new document
// POST /api/documents/:id/versions   → upload new version
router.post('/upload', documentsController.uploadDocument);
router.post('/:id/versions', documentsController.uploadVersion);

// DELETE /api/documents/:id → Admin only
router.delete('/:id', authorize('Administrador', 'Abogado Senior'), documentsController.remove);

export default router;
