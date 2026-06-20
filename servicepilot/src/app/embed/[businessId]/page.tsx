import { prisma } from "@/lib/prisma";
import { EmbedChat } from "@/components/EmbedChat";

export const dynamic = "force-dynamic";

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, status: true },
  });

  if (!business || business.status !== "ACTIVE") {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-500">
          This chat assistant is currently unavailable.
        </p>
      </div>
    );
  }

  const ai = await prisma.aiSetting.findUnique({
    where: { businessId: business.id },
    select: { greeting: true },
  });
  const greeting =
    ai?.greeting && ai.greeting.trim()
      ? ai.greeting.trim()
      : "Hi! How can we help you today?";

  return (
    <EmbedChat
      businessId={business.id}
      businessName={business.name}
      greeting={greeting}
    />
  );
}
