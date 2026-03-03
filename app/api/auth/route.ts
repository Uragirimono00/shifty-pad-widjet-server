import { NextRequest, NextResponse } from "next/server";
import { encrypt, decrypt } from "@/lib/crypto";

// POST: 인증키 발급
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "email과 password를 입력해주세요." },
        { status: 400 }
      );
    }

    const token = encrypt(JSON.stringify({ email, password }));

    return NextResponse.json({
      success: true,
      key: token,
      usage: `위젯 Parameter에 입력: openid|항목|${token}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "암호화 실패" },
      { status: 500 }
    );
  }
}

// GET: 인증키 검증 (키가 유효한지 확인)
export async function GET(request: NextRequest) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "key 파라미터가 필요합니다." }, { status: 400 });
  }

  try {
    const data = JSON.parse(decrypt(key));
    return NextResponse.json({
      valid: true,
      email: data.email?.replace(/(.{3}).*(@.*)/, "$1***$2"), // 이메일 마스킹
    });
  } catch {
    return NextResponse.json({ valid: false, error: "유효하지 않은 키입니다." }, { status: 400 });
  }
}
