import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as documentsService from './Documents.service';
import { ApiResponse } from '../../types';

// ─── Validation schemas ───────────────────────────────────────
const uploadDocumentSchema = z.object({
  case_id: z.coerce.number().int().positive(),
  category_id: z.coerce.number().int().positive(),
  title: z.string().min(1).max(300),
  description: z.string().optional(),
  file_url: z.string().url('file_url must be a valid URL.'),
  file_name: z.string().min(1).max(255),
  mime_type: z.string().min(1).max(100),
  file_size_bytes: z.coerce.number().int().positive(),
});

const uploadVersionSchema = z.object({
  file_url: z.string().url('file_url must be a valid URL.'),
  file_name: z.string().min(1).max(255),
  mime_type: z.string().min(1).max(100),
  file_size_bytes: z.coerce.number().int().positive(),
});

// ─── GET /api/documents/case/:caseId ─────────────────────────
export async function getCaseDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const caseId = +req.params.caseId;
    if (isNaN(caseId)) {
      res.status(400).json({ success: false, message: 'Invalid case ID.' });
      return;
    }

    const docs = await documentsService.getCaseDocuments(caseId);
    res.json({ success: true, data: docs } as ApiResponse);
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/documents/:id/versions ─────────────────────────
export async function getVersions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = +req.params.id;
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid document ID.' });
      return;
    }

    const versions = await documentsService.getDocumentVersions(id);
    res.json({ success: true, data: versions } as ApiResponse);
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/documents/upload ───────────────────────────────
// Frontend uploads file to Firebase first, then sends us
// the download URL + metadata. We save the record to the DB.
export async function uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = uploadDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: parsed.error.issues.map((e) => e.message),
      } as ApiResponse);
      return;
    }

    const doc = await documentsService.uploadDocument({
      ...parsed.data,
      uploaded_by: req.user!.userId,
    });

    res.status(201).json({ success: true, data: doc, message: 'Document uploaded successfully.' } as ApiResponse);
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/documents/:id/versions ────────────────────────
export async function uploadVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = +req.params.id;
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid document ID.' });
      return;
    }

    const parsed = uploadVersionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: parsed.error.issues.map((e) => e.message),
      } as ApiResponse);
      return;
    }

    const version = await documentsService.uploadNewVersion({
      document_id: id,
      uploaded_by: req.user!.userId,
      ...parsed.data,
    });

    res.status(201).json({ success: true, data: version, message: 'New version uploaded successfully.' } as ApiResponse);
  } catch (error) {
    next(error);
  }
}

// ─── DELETE /api/documents/:id ────────────────────────────────
export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = +req.params.id;
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid document ID.' });
      return;
    }

    await documentsService.deleteDocument(id);
    res.json({ success: true, message: 'Document deleted successfully.' } as ApiResponse);
  } catch (error) {
    if (error instanceof Error && error.message === 'Document not found.') {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}
