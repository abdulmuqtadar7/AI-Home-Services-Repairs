import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Super-admin: approve (ACTIVE), suspend (SUSPENDED), or reactivate (ACTIVE) a
// business. This is what unlocks a paying customer or cuts off service.
const schema = z.object({
  businessId: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { businessId, status } = parsed.data;

  await prisma.business.update({
    where: { id: businessId },
    data: { status },
  });

  return NextResponse.json({ ok: true, status });
}
