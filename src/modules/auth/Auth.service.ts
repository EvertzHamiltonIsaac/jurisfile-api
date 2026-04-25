import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, sql } from '../../config/database';
import { JwtPayload, UserWithRole } from '../../types';

// ─── Login ───────────────────────────────────────────────────
// Returns a signed JWT token if credentials are valid.
// Throws a descriptive error if not — controller will catch it.
export async function login(email: string, password: string): Promise<string> {
  // Step 1: Find user by email — join Role to get the role name
  const req = await query();
  const result = await req.input('email', sql.VarChar(150), email)
    .query<UserWithRole>(`
        SELECT
            u.usuario_id,
            u.nombre,
            u.apellido,
            u.email,
            u.password_hash,
            u.activo,
            r.nombre AS role_name
        FROM [Usuario] u
            INNER JOIN Rol r ON u.rol_id = r.rol_id
        WHERE u.email = @email
    `);

  const user = result.recordset[0];
  console.log(user);
  // Step 2: User not found
  // IMPORTANT: we give the same error message whether the email
  // doesn't exist or the password is wrong. Never tell an attacker
  // which part of the credentials failed.
  if (!user) {
    throw new Error('Invalid email or password.');
  }

  // Step 3: Check if account is active
  if (!user.activo) {
    throw new Error(
      'Your account has been deactivated. Contact your administrator.',
    );
  }

  // Step 4: Compare password against stored hash
  // bcrypt.compare handles the salt automatically
  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    throw new Error('Invalid email or password.'); // same message as step 2
  }

  // Step 5: Build JWT payload — only include what is necessary
  // Never put sensitive data (password, SSN, etc.) in the token
  const payload: JwtPayload = {
    userId: user.usuario_id,
    email: user.email,
    role: user.role_name,
  };

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured.');
  const expiresvalue = process.env.JWT_EXPIRES_IN;
  if (!expiresvalue) throw new Error('JWT_EXPIRES_IN not configured.');

  console.log(process.env.JWT_SECRET, process.env.JWT_EXPIRES_IN);

  const token = jwt.sign(payload, secret, {
    expiresIn: `24h`,
  });

  return token;
}

// ─── Get current user profile ─────────────────────────────────
// Used by the frontend to restore session on page refresh.
// The token is already verified by the auth middleware —
// we just fetch fresh data from the DB.
export async function getProfile(userId: number): Promise<UserWithRole> {
  const req = await query();
  const result = await req.input('userId', sql.Int, userId)
    .query<UserWithRole>(`
      SELECT
          u.usuario_id,
          u.nombre,
          u.apellido,
          u.email,
          u.password_hash,
          u.activo,
          r.nombre AS role_name
      FROM [Usuario] u
          INNER JOIN Rol r ON u.rol_id = r.rol_id
      WHERE u.usuario_id = @userId
    `);

  const user = result.recordset[0];
  if (!user) throw new Error('User not found.');

  return user;
}

// ─── Hash password ────────────────────────────────────────────
// Utility used when creating users (will be used in users module)
// saltRounds = 12 is the recommended balance between security and speed
export async function hashPassword(plainPassword: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(plainPassword, saltRounds);
}
