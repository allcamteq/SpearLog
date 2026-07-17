import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listOptions, addOption } from "@/db/queries/options";
import { OPTION_CATEGORIES, type OptionCategory } from "@/lib/constants";
import { getUserId } from "@/lib/auth-helpers";

const categorySchema = z.enum(OPTION_CATEGORIES);

const addOptionSchema = z.object({
  category: categorySchema,
  value: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categoryParam = request.nextUrl.searchParams.get("category");
  const parsedCategory = categorySchema.safeParse(categoryParam);

  if (parsedCategory.success) {
    const options = await listOptions(userId, parsedCategory.data);
    return NextResponse.json(options);
  }

  const all: Record<OptionCategory, Awaited<ReturnType<typeof listOptions>>> = {} as never;
  for (const category of OPTION_CATEGORIES) {
    all[category] = await listOptions(userId, category);
  }
  return NextResponse.json(all);
}

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = addOptionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await addOption(userId, parsed.data.category, parsed.data.value);
  return NextResponse.json({ ok: true }, { status: 201 });
}
