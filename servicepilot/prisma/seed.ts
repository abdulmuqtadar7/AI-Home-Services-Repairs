import { PrismaClient, MemberRole, ServiceNiche } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMERGENCY_KEYWORDS = [
  "burst pipe", "flooding", "gas smell", "electrical sparks", "burning smell",
  "no heat", "no ac", "locked out", "sewer backup", "roof leak", "water everywhere",
];

async function main() {
  const password = await bcrypt.hash("Password123!", 10);

  // Platform super admin
  await prisma.user.upsert({
    where: { email: "admin@servicepilot.app" },
    update: {},
    create: {
      email: "admin@servicepilot.app",
      passwordHash: password,
      name: "Platform Admin",
      isSuperAdmin: true,
    },
  });

  // Demo business with full config
  const business = await prisma.business.create({
    data: {
      name: "Rapid Plumbing Co",
      niche: ServiceNiche.PLUMBING,
      email: "hello@rapidplumbing.test",
      phone: "+15550100100",
      website: "https://rapidplumbing.test",
      emergencyAvailable: true,
      diagnosticFee: 89.0,
      googleReviewLink: "https://g.page/r/rapid-plumbing/review",
      onboardingCompleted: true,
      openingHours: {
        mon: { open: "08:00", close: "18:00" },
        tue: { open: "08:00", close: "18:00" },
        wed: { open: "08:00", close: "18:00" },
        thu: { open: "08:00", close: "18:00" },
        fri: { open: "08:00", close: "18:00" },
        sat: { open: "09:00", close: "14:00" },
        sun: null,
      },
      aiSetting: {
        create: {
          greeting: "Hi! Thanks for reaching out to Rapid Plumbing. How can we help today?",
          tone: "friendly",
          personaName: "Riley",
          emergencyKeywords: EMERGENCY_KEYWORDS,
        },
      },
      integrationSetting: { create: {} },
      services: {
        create: [
          { name: "Leak Repair", basePrice: 150.0, durationMin: 60 },
          { name: "Drain Cleaning", basePrice: 120.0, durationMin: 45 },
          { name: "Water Heater Install", basePrice: 950.0, durationMin: 180 },
          { name: "Emergency Call-out", basePrice: 250.0, durationMin: 90 },
        ],
      },
      serviceAreas: {
        create: [
          { zipCode: "90001", city: "Los Angeles" },
          { zipCode: "90002", city: "Los Angeles" },
          { zipCode: "90210", city: "Beverly Hills" },
        ],
      },
    },
  });

  // Users + memberships (roles)
  const owner = await prisma.user.create({
    data: { email: "owner@rapidplumbing.test", passwordHash: password, name: "Olivia Owner", phone: "+15550100101" },
  });
  const dispatcher = await prisma.user.create({
    data: { email: "dispatch@rapidplumbing.test", passwordHash: password, name: "Dana Dispatch", phone: "+15550100102" },
  });
  const techUser = await prisma.user.create({
    data: { email: "tech@rapidplumbing.test", passwordHash: password, name: "Tom Technician", phone: "+15550100103" },
  });

  await prisma.businessMember.createMany({
    data: [
      { businessId: business.id, userId: owner.id, role: MemberRole.OWNER },
      { businessId: business.id, userId: dispatcher.id, role: MemberRole.DISPATCHER },
      { businessId: business.id, userId: techUser.id, role: MemberRole.TECHNICIAN },
    ],
  });

  const technician = await prisma.technician.create({
    data: {
      businessId: business.id,
      userId: techUser.id,
      name: "Tom Technician",
      phone: "+15550100103",
      skills: ["plumbing", "water heaters"],
    },
  });

  // Customers
  const cust1 = await prisma.customer.create({
    data: { businessId: business.id, name: "Carlos Reyes", phone: "+15550111222", email: "carlos@example.com", address: "123 Oak St", zipCode: "90001" },
  });
  const cust2 = await prisma.customer.create({
    data: { businessId: business.id, name: "Mina Park", phone: "+15550113344", address: "55 Pine Ave", zipCode: "90210", isReturning: true },
  });

  // Conversation + messages
  const convo = await prisma.conversation.create({
    data: {
      businessId: business.id,
      customerId: cust1.id,
      channel: "WEB_CHAT",
      status: "AI_HANDLING",
      messages: {
        create: [
          { businessId: business.id, sender: "AI", content: "Hi! Thanks for reaching out to Rapid Plumbing. How can we help today?" },
          { businessId: business.id, sender: "CUSTOMER", content: "My kitchen sink is leaking under the cabinet." },
          { businessId: business.id, sender: "AI", content: "Got it. Is the leak constant or only when the water runs?" },
        ],
      },
    },
  });

  // Jobs
  await prisma.job.create({
    data: {
      businessId: business.id,
      customerId: cust1.id,
      conversationId: convo.id,
      title: "Kitchen sink leak",
      problem: "Leak under kitchen cabinet, possibly the trap.",
      address: "123 Oak St",
      zipCode: "90001",
      urgency: "NORMAL",
      status: "QUALIFIED",
    },
  });
  await prisma.job.create({
    data: {
      businessId: business.id,
      customerId: cust2.id,
      technicianId: technician.id,
      title: "No hot water - emergency",
      problem: "Water heater failed, no hot water in the house.",
      address: "55 Pine Ave",
      zipCode: "90210",
      urgency: "EMERGENCY",
      status: "DISPATCHED",
    },
  });

  console.log("Seed complete. Login emails (password: Password123!):");
  console.log("  admin@servicepilot.app (super admin)");
  console.log("  owner@rapidplumbing.test | dispatch@rapidplumbing.test | tech@rapidplumbing.test");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
