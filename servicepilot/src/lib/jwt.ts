// Edge-safe JWT helpers (used by middleware AND server code).
// Only depends on `jose`, which runs in the Edge runtime. No bcrypt/prisma here.
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-me",
);
const alg = "HS256";

export const SESSION_COOKIE = "sp_session";

export type Role = "OWNER" | "DISPATCHER" | "TECHNICIAN";

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  businessId: string | null;
  role: Role | null;
};

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN || "7d")
    .sign(secret);
}

export async function verifySession(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
