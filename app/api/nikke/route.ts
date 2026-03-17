import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/crypto";
import {
  dataCache,
  registeredUsers,
  scrapeWithLogin,
} from "@/lib/scraper";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const openId = searchParams.get("openid");
  const authKey = searchParams.get("key");

  // 인증키가 있으면 복호화, 없으면 환경변수 사용
  let email = "";
  let password = "";
  if (authKey) {
    try {
      const cred = JSON.parse(decrypt(authKey));
      email = cred.email || "";
      password = cred.password || "";
    } catch {
      return NextResponse.json({ error: "유효하지 않은 인증키입니다." }, { status: 401 });
    }
  } else {
    email = process.env.BLABLA_EMAIL || "";
    password = process.env.BLABLA_PASSWORD || "";
  }

  if (!openId) {
    return NextResponse.json({
      error: "openid parameter is required.",
      example: "/api/nikke?openid=5811974927458150963&key=YOUR_AUTH_KEY",
    }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({
      error: "인증 정보가 없습니다. 인증키(key)를 발급받거나 환경변수를 설정해주세요.",
    }, { status: 401 });
  }

  // 사용자 등록 (자동 갱신 대상)
  registeredUsers.set(openId, { openId, email, password });

  // 캐싱된 데이터가 있으면 바로 반환
  const cacheKey = `${email}:${openId}`;
  const cached = dataCache.get(cacheKey);
  if (cached) {
    return NextResponse.json({ success: true, openId, data: cached.data, cached: true });
  }

  // 캐시 없으면 스크래핑
  try {
    const data = await scrapeWithLogin(openId, email, password);
    return NextResponse.json({ success: true, openId, data });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
