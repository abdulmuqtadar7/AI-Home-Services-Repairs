import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InboxClient } from "@/components/InboxClient";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const businessId = user.session.businessId;
  if (!businessId) redirect("/onboarding");

  const conversations = await prisma.conversation.findMany({
    where: { businessId },
    orderBy: { lastMessageAt: "desc" },
    take: 200,
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, sender: true },
      },
      _count: { select: { messages: true } },
    },
  });

  const initialConversations = conversations.map((c) => ({
    id: c.id,
    channel: c.channel,
    status: c.status,
    aiActive: c.aiActive,
    lastMessageAt: c.lastMessageAt.toISOString(),
    customer: c.customer,
    messageCount: c._count.messages,
    preview: c.messages[0]?.content ?? "",
    previewSender: c.messages[0]?.sender ?? null,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Inbox</h1>
        <p className="text-sm text-slate-500">
          All customer conversations across every channel.
        </p>
      </div>
      <InboxClient initialConversations={initialConversations} />
    </div>
  );
}
