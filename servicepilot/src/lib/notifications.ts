import { prisma } from "@/lib/prisma";
import { Prisma, type NotificationType } from "@prisma/client";

export type CreateNotificationInput = {
  businessId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  recipientId?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Create an in-app notification for a business.
 *
 * recipientId === null means the notification is visible to the whole business
 * (any member). Failures are swallowed so a notification can never break the
 * primary action that triggered it (e.g. an AI booking).
 */
export async function createNotification(input: CreateNotificationInput) {
  try {
    return await prisma.notification.create({
      data: {
        businessId: input.businessId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        recipientId: input.recipientId ?? null,
        ...(input.metadata
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {}),
      },
    });
  } catch (err) {
    console.error("createNotification failed", err);
    return null;
  }
}
