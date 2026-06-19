import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChatWidget } from "@/components/ChatWidget";

export const dynamic = "force-dynamic";

export default async function ChatbotPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const businessId = user.session.businessId;
  if (!businessId) redirect("/onboarding");

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true },
  });
  const aiSetting = await prisma.aiSetting.findUnique({
    where: { businessId },
    select: { greeting: true },
  });

  const name = business?.name ?? "us";
  const greeting =
    aiSetting?.greeting?.trim() ||
    `Hi! Thanks for contacting ${name}. How can we help today?`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">
        AI Website Chatbot
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        This is your live AI receptionist. Click the chat bubble in the
        bottom-right corner to test it. Every conversation appears in your{" "}
        <a href="/inbox" className="font-medium text-gray-900 underline">
          Inbox
        </a>
        .
      </p>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">How it works</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>Greets visitors and qualifies leads automatically.</li>
          <li>
            Detects emergency keywords and instantly flags the conversation for
            a human.
          </li>
          <li>
            Hands off to your team — replying from the Inbox pauses the AI for
            that conversation.
          </li>
        </ul>
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Try it now</h2>
        <p className="mt-1 text-sm text-gray-600">
          Use the bubble at the bottom-right. Send a normal request first, then
          try something urgent like “my pipe burst and water is everywhere” to
          see the emergency flag. Then open the{" "}
          <a href="/inbox" className="font-medium text-gray-900 underline">
            Inbox
          </a>{" "}
          to see the conversation.
        </p>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Running in fallback mode until an OpenAI API key is added. Responses are
        rule-based for now and upgrade to GPT automatically once the key is set.
      </p>

      <ChatWidget
        businessId={business?.id ?? businessId}
        businessName={business?.name ?? "Our team"}
        greeting={greeting}
      />
    </div>
  );
}
