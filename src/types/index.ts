// ─── Auth ────────────────────────────────────────────────────
export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Extend Express Request so every route knows who the user is
// after the auth middleware runs
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ─── User ────────────────────────────────────────────────────
export interface User {
  usuario_id: number;
  role_id: number;
  nombre: string;
  apellido: string;
  password_hash: string;
  email: string;
  activo: boolean;
  creado_en: Date;
}

export interface UserWithRole extends User {
  rol_name: string;
}

// ─── Client ──────────────────────────────────────────────────
export interface Client {
  cliente_id: number;
  nombre: string;
  tipo: 'Fisica' | 'Juridica';
  cedula_rnc: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  creado_en: Date;
}

// ─── Case ────────────────────────────────────────────────────
export interface Case {
  case_id: number;
  client_id: number;
  case_type_id: number;
  case_status_id: number;
  case_number: string;
  title: string;
  description: string | null;
  opened_at: Date;
  fecha_cierre: Date | null;
  created_at: Date;
}

export interface CaseWithDetails extends Case {
  client_name: string;
  case_type: string;
  case_status: string;
  status_color: string;
}

// ─── Document ────────────────────────────────────────────────
export interface Document {
  document_id: number;
  case_id: number;
  category_id: number;
  uploaded_by: number;
  title: string;
  description: string | null;
  created_at: Date;
}

export interface DocumentWithDetails extends Document {
  category_name: string;
  uploader_name: string;
  latest_version: number;
  file_path: string;
  mime_type: string;
  file_size_bytes: number;
}

// ─── Document Version ────────────────────────────────────────
export interface DocumentVersion {
  version_id: number;
  document_id: number;
  uploaded_by: number;
  version_number: number;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size_bytes: number | null;
  created_at: Date;
}

// ─── Hearing ─────────────────────────────────────────────────
export interface Hearing {
  hearing_id: number;
  case_id: number;
  title: string;
  description: string | null;
  court: string | null;
  hearing_date: Date;
  status: 'Pending' | 'Held' | 'Postponed' | 'Cancelled';
  notes: string | null;
  created_at: Date;
}

export interface HearingWithCase extends Hearing {
  case_number: string;
  case_title: string;
  client_name: string;
}

// ─── API Response wrapper ────────────────────────────────────
// Consistent response format across all endpoints
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

// ─── Pagination ──────────────────────────────────────────────
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
