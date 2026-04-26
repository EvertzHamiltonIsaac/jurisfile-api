import { query, sql } from '../../config/database';
import { DocumentWithDetails, DocumentVersion } from '../../types';

// ─── GET ALL DOCUMENTS OF A CASE ─────────────────────────────
export async function getCaseDocuments(caseId: number): Promise<DocumentWithDetails[]> {
  const req = await query();
  const result = await req.input('expediente_id', sql.Int, caseId).query<DocumentWithDetails>(`
      SELECT
        d.documento_id,
        d.expediente_id,
        d.titulo,
        d.descripcion,
        d.creado_en,
        dc.nombre                          AS category_name,
        u.nombre + ' ' + u.apellido AS uploader_name,
        MAX(v.numero_version)            AS latest_version,
        MAX(v.ruta_archivo)                 AS file_path,
        MAX(v.tipo_mime)                 AS mime_type,
        MAX(v.tamano_bytes)           AS file_size_bytes
      FROM Documento d
        INNER JOIN CategoriaDocumento dc ON d.categoria_id = dc.categoria_id
        INNER JOIN Usuario           u  ON d.subido_por  = u.usuario_id
        LEFT  JOIN VersionDocumento  v  ON d.documento_id  = v.documento_id
      WHERE d.expediente_id = @expediente_id
      GROUP BY
        d.documento_id, d.expediente_id, d.titulo, d.descripcion,
        d.creado_en, dc.nombre, u.nombre, u.apellido
      ORDER BY d.creado_en DESC
    `);
  return result.recordset;
}

// ─── GET DOCUMENT VERSIONS ────────────────────────────────────
export async function getDocumentVersions(documentId: number): Promise<DocumentVersion[]> {
  const req = await query();
  const result = await req.input('documentId', sql.Int, documentId).query<DocumentVersion>(`
      SELECT
        v.version_id,
        v.documento_id,
        v.numero_version,
        v.nombre_archivo,
        v.ruta_archivo,
        v.tipo_mime,
        v.tamano_bytes,
        v.creado_en,
        u.nombre + ' ' + u.apellido AS uploaded_by_name
      FROM VersionDocumento v
        INNER JOIN [Usuario] u ON v.subido_por = u.usuario_id
      WHERE v.documento_id = @documentId
      ORDER BY v.numero_version DESC
    `);
  return result.recordset;
}

// ─── UPLOAD NEW DOCUMENT (first version) ─────────────────────
// We only receive the URL and metadata — never the file itself.
export async function uploadDocument(data: {
  case_id: number;
  category_id: number;
  uploaded_by: number;
  title: string;
  description?: string;
  file_url: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
}): Promise<DocumentWithDetails> {
  const req1 = await query();
  const docResult = await req1
    .input('expediente_id', sql.Int, data.case_id)
    .input('categoria_id', sql.Int, data.category_id)
    .input('subido_por', sql.Int, data.uploaded_by)
    .input('titulo', sql.VarChar(300), data.title)
    .input('descripcion', sql.Text, data.description ?? null).query<{ documento_id: number }>(`
      INSERT INTO Documento (expediente_id, categoria_id, subido_por, titulo, descripcion)
      OUTPUT INSERTED.documento_id
      VALUES (@expediente_id, @categoria_id, @subido_por, @titulo, @descripcion)
    `);

  const documentId = docResult.recordset[0].documento_id;
  // file_path stores the Firebase download URL
  const req2 = await query();
  await req2
    .input('documento_id', sql.Int, documentId)
    .input('subido_por', sql.Int, data.uploaded_by)
    .input('numero_version', sql.Int, 1)
    .input('nombre_archivo', sql.VarChar(255), data.file_name)
    .input('ruta_archivo', sql.VarChar(500), data.file_url)
    .input('tipo_mime', sql.VarChar(100), data.mime_type)
    .input('tamano_bytes', sql.Int, data.file_size_bytes).query(`
      INSERT INTO VersionDocumento
        (documento_id, subido_por, numero_version, nombre_archivo, ruta_archivo, tipo_mime, tamano_bytes)
      VALUES
        (@documento_id, @subido_por, @numero_version, @nombre_archivo, @ruta_archivo, @tipo_mime, @tamano_bytes)
    `);

  const docs = await getCaseDocuments(data.case_id);
  return docs.find((d) => d.document_id === documentId)!;
}

// ─── UPLOAD NEW VERSION ───────────────────────────────────────
export async function uploadNewVersion(data: {
  document_id: number;
  uploaded_by: number;
  file_url: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
}): Promise<DocumentVersion> {
  const req1 = await query();
  const versionResult = await req1.input('documentId', sql.Int, data.document_id).query<{ max_version: number }>(`
      SELECT ISNULL(MAX(numero_version), 0) AS max_version
      FROM VersionDocumento
      WHERE documento_id = @documentId
    `);

  const nextVersion = versionResult.recordset[0].max_version + 1;

  const req2 = await query();
  const result = await req2
    .input('documentId', sql.Int, data.document_id)
    .input('uploadedBy', sql.Int, data.uploaded_by)
    .input('versionNumber', sql.Int, nextVersion)
    .input('fileName', sql.VarChar(255), data.file_name)
    .input('filePath', sql.VarChar(500), data.file_url)
    .input('mimeType', sql.VarChar(100), data.mime_type)
    .input('fileSizeBytes', sql.Int, data.file_size_bytes).query<DocumentVersion>(`
      INSERT INTO VersionDocumento
        (documento_id, subido_por, numero_version, nombre_archivo, ruta_archivo, tipo_mime, tamano_bytes)
      OUTPUT INSERTED.*
      VALUES
        (@documentId, @uploadedBy, @versionNumber, @fileName, @filePath, @mimeType, @fileSizeBytes)
    `);

  return result.recordset[0];
}

// ─── DELETE DOCUMENT ──────────────────────────────────────────
// Firebase file deletion is handled from the frontend.
// Here we only remove the DB records.
export async function deleteDocument(documentId: number): Promise<void> {
  const req1 = await query();
  const check = await req1.input('documentId', sql.Int, documentId).query<{ document_id: number }>(`
      SELECT documento_id FROM Documento WHERE documento_id = @documentId
    `);

  if (!check.recordset[0]) {
    throw new Error('Document not found.');
  }

  const req2 = await query();
  await req2.input('documentId', sql.Int, documentId).query('DELETE FROM VersionDocumento WHERE documento_id = @documentId');

  const req3 = await query();
  await req3.input('documentId', sql.Int, documentId).query('DELETE FROM Documento WHERE documento_id = @documentId');
}
