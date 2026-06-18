import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const business = await prisma.business.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!business) {
    throw new Error("No business found. Run the main seed first.");
  }
  const businessId = business.id;

  const customers = await prisma.customer.findMany({
    where: { businessId },
    take: 5,
    orderBy: { createdAt: "asc" },
  });
  const cust = (i: number) => customers[i]?.id ?? null;

  const now = Date.now();
  const min = (m: number) => new Date(now - m * 60000);

  const demos = [
    {
      id: "seed_conv_1",
      customerId: cust(0),
      channel: "WEB_CHAT" as const,
      status: "AI_HANDLING" as const,
      aiActive: true,
      messages: [
        {
          sender: "CUSTOMER" as const,
          content: "Hi, my kitchen sink is leaking under the cabinet.",
          at: min(58),
        },
        {
          sender: "AI" as const,
          content:
            "I'm sorry to hear that! Is the water actively dripping right now, or just damp?",
          at: min(57),
        },
        {
          sender: "CUSTOMER" as const,
          content: "Actively dripping, there's a small puddle.",
          at: min(55),
        },
        {
          sender: "AI" as const,
          content:
            "Got it. I can get a plumber out today. What's the best address and a phone number to confirm?",
          at: min(54),
        },
      ],
    },
    {
      id: "seed_conv_2",
      customerId: cust(1),
      channel: "SMS" as const,
      status: "HUMAN_NEEDED" as const,
      aiActive: false,
      messages: [
        {
          sender: "CUSTOMER" as const,
          content: "Do you do emergency water heater replacement? Mine burst.",
          at: min(120),
        },
        {
          sender: "AI" as const,
          content:
            "Yes, we handle emergency water heater jobs. Roughly how much water has leaked?",
          at: min(119),
        },
        {
          sender: "CUSTOMER" as const,
          content: "A lot, the whole garage floor. I need someone NOW.",
          at: min(118),
        },
        {
          sender: "SYSTEM" as const,
          content: "Emergency keywords detected. Routed to a human agent.",
          at: min(118),
        },
        {
          sender: "HUMAN_AGENT" as const,
          content:
            "This is Dana from Rapid Plumbing, I'm dispatching a tech to you within the hour.",
          at: min(116),
        },
      ],
    },
    {
      id: "seed_conv_3",
      customerId: cust(2) ?? cust(0),
      channel: "WHATSAPP" as const,
      status: "BOOKED" as const,
      aiActive: true,
      messages: [
        {
          sender: "CUSTOMER" as const,
          content: "Can I book a drain cleaning for Saturday morning?",
          at: min(300),
        },
        {
          sender: "AI" as const,
          content:
            "Absolutely! I have 9am or 11am open on Saturday. Which works best?",
          at: min(299),
        },
        { sender: "CUSTOMER" as const, content: "9am please.", at: min(298) },
        {
          sender: "AI" as const,
          content:
            "Booked for Saturday 9am. You'll get a reminder the day before. Anything else?",
          at: min(297),
        },
      ],
    },
  ];

  for (const d of demos) {
    await prisma.message.deleteMany({ where: { conversationId: d.id } });
    await prisma.conversation.deleteMany({ where: { id: d.id } });
    const last = d.messages[d.messages.length - 1];
    await prisma.conversation.create({
      data: {
        id: d.id,
        businessId,
        customerId: d.customerId,
        channel: d.channel,
        status: d.status,
        aiActive: d.aiActive,
        lastMessageAt: last.at,
        messages: {
          create: d.messages.map((m) => ({
            businessId,
            sender: m.sender,
            content: m.content,
            createdAt: m.at,
          })),
        },
      },
    });
  }

  console.log("Seeded " + demos.length + " demo conversations.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
