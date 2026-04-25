import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as casesService from './Cases.service';
import { ApiResponse } from '../../types';

const createCaseSchema = z.object({
  client_id: z.number().int().positive(),
  case_type_id: z.number().int().positive(),
  case_status_id: z.number().int().positive(),
  case_number: z.string().min(1).max(20),
  title: z.string().min(2).max(300),
  description: z.string().optional(),
  opened_at: z.string().optional(),
});

const updateCaseSchema = z.object({
  case_type_id: z.number().int().positive().optional(),
  case_status_id: z.number().int().positive().optional(),
  title: z.string().min(2).max(300).optional(),
  description: z.string().optional(),
  fecha_cierre: z.string().optional(),
});

const assignUserSchema = z.object({
  user_id: z.number().int().positive(),
  case_role: z.enum(['Responsable', 'Colaborador', 'Supervisor']),
});

// ─── GET /api/cases ───────────────────────────────────────────
export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, role } = req.user!;
    const cases = await casesService.getAllCases(userId, role);
    res.json({ success: true, data: cases } as ApiResponse);
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/cases/:id ───────────────────────────────────────
export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = +req.params.id;
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid case ID.' });
      return;
    }

    const c = await casesService.getCaseById(id);
    res.json({ success: true, data: c } as ApiResponse);
  } catch (error) {
    if (error instanceof Error && error.message === 'Case not found.') {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

// ─── GET /api/cases/:id/team ──────────────────────────────────
export async function getTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = +req.params.id;
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid case ID.' });
      return;
    }

    const team = await casesService.getCaseTeam(id);
    res.json({ success: true, data: team } as ApiResponse);
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/cases ──────────────────────────────────────────
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createCaseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Validation failed.', errors: parsed.error.issues.map((e) => e.message) });
      return;
    }

    const newCase = await casesService.createCase(parsed.data, req.user!.userId);
    res.status(201).json({ success: true, data: newCase, message: 'Case created successfully.' } as ApiResponse);
  } catch (error) {
    next(error);
  }
}

// ─── PATCH /api/cases/:id ─────────────────────────────────────
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = +req.params.id;
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid case ID.' });
      return;
    }

    const parsed = updateCaseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Validation failed.', errors: parsed.error.issues.map((e) => e.message) });
      return;
    }

    const updated = await casesService.updateCase(id, parsed.data);
    res.json({ success: true, data: updated, message: 'Case updated successfully.' } as ApiResponse);
  } catch (error) {
    if (error instanceof Error && error.message === 'Case not found.') {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

// ─── POST /api/cases/:id/team ─────────────────────────────────
export async function assignUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = +req.params.id;
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid case ID.' });
      return;
    }

    const parsed = assignUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Validation failed.', errors: parsed.error.issues.map((e) => e.message) });
      return;
    }

    await casesService.assignUserToCase(id, parsed.data.user_id, parsed.data.case_role);
    res.json({ success: true, message: 'User assigned to case successfully.' } as ApiResponse);
  } catch (error) {
    next(error);
  }
}
