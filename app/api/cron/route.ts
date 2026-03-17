import { NextRequest, NextResponse } from "next/server";
import { refreshAllUsers } from "@/lib/scraper";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Vercel Cron 인증 (선택)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshAllUsers();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[cron] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
