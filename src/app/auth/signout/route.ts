import { NextResponse, type NextRequest } from "next/server";
import { clearAuthSession } from "@/lib/auth/sign-out";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const result = await clearAuthSession(supabase);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
