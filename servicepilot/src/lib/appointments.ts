import { prisma } from "@/lib/prisma";

// All valid appointment statuses (mirrors the AppointmentStatus enum).
export const APPOINTMENT_STATUSES = [
  "SCHEDULED",
  "CONFIRMED",
  "RESCHEDULED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
] as const;

export type AppointmentStatusName = (typeof APPOINTMENT_STATUSES)[number];

// Statuses that still hold a technician's calendar slot. Cancelled, completed,
// and no-show appointments free the slot so they never block new bookings.
export const BLOCKING_STATUSES = [
  "SCHEDULED",
  "CONFIRMED",
  "RESCHEDULED",
] as const;

// Shared relation selection for appointment responses.
export const apptInclude = {
  technician: { select: { id: true, name: true } },
  job: { select: { id: true, title: true, status: true } },
  customer: { select: { id: true, name: true, phone: true } },
} as const;

export function isAppointmentStatus(
  value: string,
): value is AppointmentStatusName {
  return (APPOINTMENT_STATUSES as readonly string[]).includes(value);
}

export function isBlockingStatus(value: string): boolean {
  return (BLOCKING_STATUSES as readonly string[]).includes(value);
}

// Finds an existing appointment that overlaps [startAt, endAt) for the same
// technician. Overlap = existing.startAt < newEnd AND existing.endAt > newStart.
// Cancelled / completed / no-show appointments are ignored.
export async function findTechnicianConflict(args: {
  businessId: string;
  technicianId: string;
  startAt: Date;
  endAt: Date;
  excludeId?: string;
}) {
  const { businessId, technicianId, startAt, endAt, excludeId } = args;
  return prisma.appointment.findFirst({
    where: {
      businessId,
      technicianId,
      status: { in: [...BLOCKING_STATUSES] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, startAt: true, endAt: true },
  });
}
