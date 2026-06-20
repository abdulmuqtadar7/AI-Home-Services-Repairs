// Central role-based access control. Pure and dependency-free so it is safe to
// import from Edge middleware, client components (Sidebar), and server code.

export type Role = "OWNER" | "DISPATCHER" | "TECHNICIAN";

export type Capability =
  | "viewDashboard"
  | "viewAllJobs"
  | "createJobs"
  | "editJobs"
  | "viewCustomers"
  | "viewInbox"
  | "viewChatbot"
  | "manageTechnicians"
  | "manageSettings"
  | "manageBilling";

const ROLE_CAPS: Record<Role, Capability[]> = {
  OWNER: [
    "viewDashboard",
    "viewAllJobs",
    "createJobs",
    "editJobs",
    "viewCustomers",
    "viewInbox",
    "viewChatbot",
    "manageTechnicians",
    "manageSettings",
    "manageBilling",
  ],
  DISPATCHER: [
    "viewDashboard",
    "viewAllJobs",
    "createJobs",
    "editJobs",
    "viewCustomers",
    "viewInbox",
    "viewChatbot",
    "manageTechnicians",
  ],
  // Technicians have no business-management capabilities. They get a filtered
  // "My Jobs" view (handled explicitly), not the capabilities below.
  TECHNICIAN: [],
};

export function normalizeRole(role?: string | null): Role {
  if (role === "OWNER" || role === "DISPATCHER" || role === "TECHNICIAN") {
    return role;
  }
  // Least privilege by default.
  return "TECHNICIAN";
}

export function can(
  role: string | null | undefined,
  capability: Capability,
  opts?: { isSuperAdmin?: boolean },
): boolean {
  if (opts?.isSuperAdmin) return true;
  return ROLE_CAPS[normalizeRole(role)].includes(capability);
}

// Where a given role should land after login / when redirected out of a page
// they cannot access.
export function landingPath(
  role?: string | null,
  isSuperAdmin?: boolean,
): string {
  if (isSuperAdmin) return "/dashboard";
  return normalizeRole(role) === "TECHNICIAN" ? "/jobs" : "/dashboard";
}

// Route prefix -> capability required to view it. Used by middleware (coarse
// route gating) and the sidebar (nav visibility). "/jobs" (the list) is
// intentionally omitted: every role can open it (technicians see a filtered
// "My Jobs"), while "/jobs/new" requires createJobs.
export const ROUTE_CAPABILITY: ReadonlyArray<{
  prefix: string;
  capability: Capability;
}> = [
  { prefix: "/dashboard", capability: "viewDashboard" },
  { prefix: "/inbox", capability: "viewInbox" },
  { prefix: "/chatbot", capability: "viewChatbot" },
  { prefix: "/customers", capability: "viewCustomers" },
  { prefix: "/calendar", capability: "viewDashboard" },
  { prefix: "/technicians", capability: "manageTechnicians" },
  { prefix: "/payments", capability: "manageBilling" },
  { prefix: "/settings", capability: "manageSettings" },
  { prefix: "/services", capability: "manageSettings" },
  { prefix: "/jobs/new", capability: "createJobs" },
];

// The capability required for a pathname, or null if the route is open to all
// authenticated roles (e.g. the "/jobs" list).
export function requiredCapabilityForPath(pathname: string): Capability | null {
  // Longest prefix first so "/jobs/new" beats any "/jobs" entry.
  const sorted = [...ROUTE_CAPABILITY].sort(
    (a, b) => b.prefix.length - a.prefix.length,
  );
  for (const { prefix, capability } of sorted) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return capability;
    }
  }
  return null;
}

export function canAccessPath(
  pathname: string,
  role: string | null | undefined,
  isSuperAdmin?: boolean,
): boolean {
  const cap = requiredCapabilityForPath(pathname);
  if (!cap) return true;
  return can(role, cap, { isSuperAdmin });
}
