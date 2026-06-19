import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Super-admin: permanently remove a business and all of its data. Used to
// decline a pending signup or fully offboard a former customer.
const schema = z.object({ businessId: z.string().min(1) });

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
  const { businessId } = parsed.data;

  // Don't delete the business the admin is currently acting inside.
  if (user.session.businessId === businessId) {
    return NextResponse.json(
      { error: "Exit this business's workspace before deleting it." },
      { status: 400 },
    );
  }

  try {
    await prisma.business.delete({ where: { id: businessId } });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not delete this business. It may have related records that block deletion.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
