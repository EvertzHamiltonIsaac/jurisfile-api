import { string } from 'zod';
import { query, sql } from '../../config/database';
import { CaseWithDetails } from '../../types';
import { AppError } from '../../config/AppError';

// ─── GET ALL ─────────────────────────────────────────────────
// Junior attorneys only see cases they are assigned to.
// Senior attorneys and admins see everything.
export async function getAllCases(userId: number, role: string): Promise<CaseWithDetails[]> {
  const req = await query();

  const isRestricted = role === 'Abogado Junior';

  const result = await req.input('userId', sql.Int, userId).query<CaseWithDetails>(`
      SELECT
        c.expediente_id,
        c.numero,
        c.titulo,
        c.descripcion,
        c.fecha_apertura,
        c.fecha_cierre,
        c.creado_en,
        cl.nombre       AS client_name,
        ct.nombre       AS case_type,
        cs.nombre       AS case_status,
        cs.color_hex
      FROM [Expediente] c
        INNER JOIN Cliente     cl ON c.cliente_id      = cl.cliente_id
        INNER JOIN TipoExpediente   ct ON c.tipo_id   = ct.tipo_id
        INNER JOIN EstadoExpediente cs ON c.estado_id = cs.estado_id
      ${isRestricted ? 'INNER JOIN ExpedienteUsuario cu ON c.expediente_id = cu.expediente_id AND cu.usuario_id = @usuario_id' : ''}
      ORDER BY c.creado_en DESC
    `);

  return result.recordset;
}

// ─── GET ONE ──────────────────────────────────────────────────
export async function getCaseById(caseId: number): Promise<CaseWithDetails> {
  const req = await query();
  const result = await req.input('caseId', sql.Int, caseId).query<CaseWithDetails>(`
      SELECT
        c.expediente_id,
        c.numero,
        c.titulo,
        c.descripcion,
        c.fecha_apertura,
        c.fecha_cierre,
        c.creado_en,
        c.cliente_id,
        c.tipo_id,
        c.estado_id,
        cl.nombre       AS client_name,
        ct.nombre       AS case_type,
        cs.nombre       AS case_status,
        cs.color_hex
      FROM [Expediente] c
        INNER JOIN Cliente     cl ON c.cliente_id      = cl.cliente_id
        INNER JOIN TipoExpediente   ct ON c.tipo_id   = ct.tipo_id
        INNER JOIN EstadoExpediente cs ON c.estado_id = cs.estado_id
      WHERE c.expediente_id = @caseId
    `);

  const found = result.recordset[0];
  if (!found) throw new Error('Case not found.');
  return found;
}

// ─── CREATE ───────────────────────────────────────────────────
export async function createCase(
  data: {
    client_id: number;
    case_type_id: number;
    case_status_id: number;
    case_number: string;
    title: string;
    description?: string;
    opened_at?: string;
  },
  assignedUserId: number,
): Promise<CaseWithDetails> {
  const req = await query();
  const result = await req
    .input('cliente_id', sql.Int, data.client_id)
    .input('tipo_id', sql.Int, data.case_type_id)
    .input('estado_id', sql.Int, data.case_status_id)
    .input('numero', sql.VarChar(20), data.case_number)
    .input('titulo', sql.VarChar(300), data.title)
    .input('descripcion', sql.Text, data.description ?? null)
    .input('fecha_apertura', sql.Date, data.opened_at ?? new Date()).query<{ expediente_id: number }>(`
      INSERT INTO [Expediente] (cliente_id, tipo_id, estado_id, numero, titulo, descripcion, fecha_apertura)
      OUTPUT INSERTED.expediente_id
      VALUES (@cliente_id, @tipo_id, @estado_id, @numero, @titulo, @descripcion, @fecha_apertura)
    `);

  const newCaseId = result.recordset[0].expediente_id;

  // Auto-assign the creator as Lead attorney
  const req2 = await query();
  await req2.input('expediente_id', sql.Int, newCaseId).input('usuario_id', sql.Int, assignedUserId).input('rol_en_caso', sql.VarChar(50), 'Responsable').query(`
      INSERT INTO ExpedienteUsuario (expediente_id, usuario_id, rol_en_caso)
      VALUES (@expediente_id, @usuario_id, @rol_en_caso)
    `);

  return getCaseById(newCaseId);
}

// ─── UPDATE ───────────────────────────────────────────────────
export async function updateCase(
  caseId: number,
  data: Partial<{
    case_type_id: number;
    case_status_id: number;
    title: string;
    description: string;
    fecha_cierre: string;
  }>,
): Promise<CaseWithDetails> {
  await getCaseById(caseId);

  const req = await query();
  await req
    .input('Expediente_id', sql.Int, caseId)
    .input('tipo_id', sql.Int, data.case_type_id ?? null)
    .input('estado_id', sql.Int, data.case_status_id ?? null)
    .input('titulo', sql.VarChar(300), data.title ?? null)
    .input('descripcion', sql.Text, data.description ?? null)
    .input('fecha_cierre', sql.Date, data.fecha_cierre).query(`
      UPDATE [Expediente] SET
        tipo_id   = COALESCE(@tipo_id,   tipo_id),
        estado_id = COALESCE(@estado_id, estado_id),
        titulo          = COALESCE(@titulo,         titulo),
        descripcion    = COALESCE(@descripcion,   descripcion),
        fecha_cierre      = COALESCE(@fecha_cierre,      fecha_cierre)
      WHERE Expediente_id = @Expediente_id
    `);

  return getCaseById(caseId);
}

// ─── GET CASE TEAM ────────────────────────────────────────────
export async function getCaseTeam(caseId: number) {
  const req = await query();
  const result = await req.input('expediente_id', sql.Int, caseId).query(`
      SELECT
        u.usuario_id,
        u.nombre,
        u.apellido,
        u.email,
        r.nombre      AS role_name,
        cu.rol_en_caso,
        cu.asignado_en
      FROM ExpedienteUsuario cu
        INNER JOIN [Usuario] u ON cu.usuario_id = u.usuario_id
        INNER JOIN Rol   r ON u.rol_id  = r.rol_id
      WHERE cu.expediente_id = @expediente_id
      ORDER BY cu.asignado_en ASC
    `);
  return result.recordset;
}

// ─── ASSIGN USER TO CASE ─────────────────────────────────────
export async function assignUserToCase(caseId: number, userId: number, caseRole: string) {
  await getCaseById(caseId);

  // type responsableValidationTypes = {usuario_id: number, nombre: String, apellido: String, email: String, role_name:String, rol_en_canso: String, asignado_en: Date}
  const CaseTeam = await getCaseTeam(caseId);
  const already_responsible = CaseTeam.some((member) => member.rol_en_caso === 'Responsable');
  if (already_responsible) {
    throw new AppError('The case already has a lawyer assigned as responsible', 409);
  }

  const req = await query();
  await req.input('expediente_id', sql.Int, caseId).input('usuario_id', sql.Int, userId).input('rol_en_caso', sql.VarChar(50), caseRole).query(`
      IF NOT EXISTS (SELECT 1 FROM ExpedienteUsuario WHERE expediente_id = @expediente_id AND usuario_id = @usuario_id)
        INSERT INTO ExpedienteUsuario (expediente_id, usuario_id, rol_en_caso)
        VALUES (@expediente_id, @usuario_id, @rol_en_caso)
      ELSE
        UPDATE ExpedienteUsuario SET rol_en_caso = @rol_en_caso
        WHERE expediente_id = @expediente_id AND usuario_id = @usuario_id
    `);
}
