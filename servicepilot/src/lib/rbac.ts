// Role-based access control helpers. Super admin passes every role check.
import type { Role, SessionPayload } from "@/lib/jwt";

export function isAuthenticated(
  session: SessionPayload | null,
): session is SessionPayload {
  return session !== null;
}

export function hasRole(
  session: SessionPayload | null,
  roles: Role[],
): boolean {
  if (!session) return false;
  if (session.isSuperAdmin) return true;
  return session.role !== null && roles.includes(session.role);
}

export function requireBusinessId(session: SessionPayload | null): string | null {
  return session?.businessId ?? null;
}
