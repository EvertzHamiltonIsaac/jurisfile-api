import { query, sql } from '../../config/database';
import { Client } from '../../types';

// ─── GET ALL ─────────────────────────────────────────────────
export async function getAllClients(): Promise<Client[]> {
  const req = await query();
  const result = await req.query<Client>(`
    SELECT
      cliente_id,
      nombre,
      tipo,
      cedula_rnc,
      email,
      telefono,
      direccion,
      creado_en
    FROM Cliente
    ORDER BY creado_en ASC
  `);
  return result.recordset;
}

// ─── GET ONE ──────────────────────────────────────────────────
export async function getClientById(clientId: number): Promise<Client> {
  const req = await query();
  const result = await req.input('clientId', sql.Int, clientId).query<Client>(`
      SELECT
        cliente_id,
        nombre,
        tipo,
        cedula_rnc,
        email,
        telefono,
        direccion,
        creado_en
      FROM Cliente
      WHERE cliente_id = @clientId
    `);

  const client = result.recordset[0];
  if (!client) throw new Error('Client not found.');
  return client;
}

// ─── CREATE ───────────────────────────────────────────────────
type data_create_client = { name: string; type: 'Fisica' | 'Juridica'; id_number?: string; email?: string; phone?: string; address?: string };
export async function createClient(data: data_create_client): Promise<Client> {
  const req = await query();
  const result = await req
    .input('nombre', sql.VarChar(200), data.name)
    .input('tipo', sql.VarChar(20), data.type)
    .input('cedula_rnc', sql.VarChar(20), data.id_number ?? null)
    .input('email', sql.VarChar(150), data.email ?? null)
    .input('telefono', sql.VarChar(20), data.phone ?? null)
    .input('direccion', sql.Text, data.address ?? null).query<Client>(`
      INSERT INTO Cliente (nombre, tipo, cedula_rnc, email, telefono, direccion)
      OUTPUT INSERTED.*
      VALUES (@nombre, @tipo, @cedula_rnc, @email, @telefono, @direccion)
    `);

  return result.recordset[0];
}

// ─── UPDATE ───────────────────────────────────────────────────
export async function updateClient(
  clientId: number,
  data: Partial<{
    name: string;
    type: 'Fisica' | 'Juridica';
    id_number: string;
    email: string;
    phone: string;
    address: string;
  }>,
): Promise<Client> {
  // First verify client exists
  await getClientById(clientId);

  const req = await query();
  const result = await req
    .input('cliente_id', sql.Int, clientId)
    .input('nombre', sql.VarChar(200), data.name)
    .input('tipo', sql.VarChar(20), data.type)
    .input('cedula_rnc', sql.VarChar(20), data.id_number ?? null)
    .input('email', sql.VarChar(150), data.email ?? null)
    .input('telefono', sql.VarChar(20), data.phone ?? null)
    .input('direccion', sql.Text, data.address ?? null).query<Client>(`
      UPDATE Cliente SET
        nombre      = COALESCE(@nombre,     nombre),
        tipo      = COALESCE(@tipo,     tipo),
        cedula_rnc = COALESCE(@cedula_rnc, cedula_rnc),
        email     = COALESCE(@email,    email),
        telefono     = COALESCE(@telefono,    telefono),
        direccion   = COALESCE(@direccion,  direccion)
      OUTPUT INSERTED.*
      WHERE cliente_id = @cliente_id
    `);

  return result.recordset[0];
}

// ─── DELETE ───────────────────────────────────────────────────
// We check for active cases before deleting.
// A client with open cases should not be removed from the system.
export async function deleteClient(clientId: number): Promise<void> {
  await getClientById(clientId);

  const req = await query();
  const check = await req.input('cliente_id', sql.Int, clientId).query<{
    total: number;
  }>(`
      SELECT COUNT(*) AS total
      FROM [Expediente]
      WHERE cliente_id = @cliente_id
    `);

  if (check.recordset[0].total > 0) {
    throw new Error('Cannot delete a client that has associated cases.');
  }

  const req2 = await query();
  await req2.input('cliente_id', sql.Int, clientId).query('DELETE FROM Cliente WHERE cliente_id = @cliente_id');
}

// ─── GET CLIENT CASES ─────────────────────────────────────────
// Useful for the client detail page — list all their cases
export async function getClientCases(clientId: number) {
  await getClientById(clientId);

  const req = await query();
  const result = await req.input('cliente_id', sql.Int, clientId).query(`
      SELECT
        c.expediente_id,
        c.numero,
        c.titulo,
        c.fecha_apertura,
        c.fecha_cierre,
        ct.nombre  AS case_type,
        cs.nombre  AS case_status,
        cs.color_hex
      FROM [Expediente] c
        INNER JOIN TipoExpediente   ct ON c.tipo_id   = ct.tipo_id
        INNER JOIN EstadoExpediente cs ON c.estado_id = cs.estado_id
      WHERE c.cliente_id = @cliente_id
      ORDER BY c.fecha_apertura DESC
    `);

  return result.recordset;
}
