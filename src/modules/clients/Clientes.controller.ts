import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as clientsService from './Clients.service';
import { ApiResponse } from '../../types';

// ─── Validation schemas ───────────────────────────────────────
const createClientSchema = z.object({
  name: z.string().min(2).max(200),
  type: z.enum(['Fisica', 'Juridica']),
  id_number: z.string().max(20).optional(),
  email: z.string().email().max(150).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().optional(),
});

const updateClientSchema = createClientSchema.partial();

// ─── GET /api/clients ─────────────────────────────────────────
export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clients = await clientsService.getAllClients();
    res.json({ success: true, data: clients } as ApiResponse);
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/clients/:id ─────────────────────────────────────
export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = +req.params.id;
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid client ID.' });
      return;
    }

    const client = await clientsService.getClientById(id);
    res.json({ success: true, data: client } as ApiResponse);
  } catch (error) {
    if (error instanceof Error && error.message === 'Client not found.') {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

// ─── GET /api/clients/:id/cases ───────────────────────────────
export async function getClientCases(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = +req.params.id;
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid client ID.' });
      return;
    }

    const cases = await clientsService.getClientCases(id);
    res.json({ success: true, data: cases } as ApiResponse);
  } catch (error) {
    if (error instanceof Error && error.message === 'Client not found.') {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

// ─── POST /api/clients ────────────────────────────────────────
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createClientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: parsed.error.issues.map((e) => e.message),
      } as ApiResponse);
      return;
    }

    const client = await clientsService.createClient(parsed.data);
    res.status(201).json({
      success: true,
      data: client,
      message: 'Client created successfully.',
    } as ApiResponse);
  } catch (error) {
    next(error);
  }
}

// ─── PATCH /api/clients/:id ───────────────────────────────────
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = +req.params.id;
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid client ID.' });
      return;
    }

    const parsed = updateClientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: parsed.error.issues.map((e) => e.message),
      } as ApiResponse);
      return;
    }

    const client = await clientsService.updateClient(id, parsed.data);
    res.json({
      success: true,
      data: client,
      message: 'Client updated successfully.',
    } as ApiResponse);
  } catch (error) {
    if (error instanceof Error && error.message === 'Client not found.') {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

// ─── DELETE /api/clients/:id ──────────────────────────────────
export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = +req.params.id;
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid client ID.' });
      return;
    }

    await clientsService.deleteClient(id);
    res.json({
      success: true,
      message: 'Client deleted successfully.',
    } as ApiResponse);
  } catch (error) {
    if (error instanceof Error && (error.message === 'Client not found.' || error.message.includes('associated cases'))) {
      res.status(400).json({ success: false, message: (error as Error).message });
      return;
    }
    next(error);
  }
}
