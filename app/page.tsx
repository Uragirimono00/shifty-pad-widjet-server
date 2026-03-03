"use client";

import { useState } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authKey, setAuthKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAuthKey("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        setAuthKey(data.key);
      } else {
        setError(data.error || "발급 실패");
      }
    } catch {
      setError("서버 오류");
    } finally {
      setLoading(false);
    }
  }

  const sectionStyle = {
    background: "#f8f9fa",
    borderRadius: 8,
    padding: "16px 20px",
    marginTop: 16,
  };

  const codeStyle = {
    display: "block" as const,
    background: "#1a1a2e",
    color: "#e0e0e0",
    padding: 12,
    borderRadius: 6,
    fontSize: 13,
    fontFamily: "monospace",
    wordBreak: "break-all" as const,
    marginTop: 8,
  };

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", padding: "0 20px", fontFamily: "system-ui", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>NIKKE ShiftyPad Widget</h1>
      <p style={{ color: "#666", fontSize: 14, marginTop: 0 }}>
        Scriptable 위젯으로 iPhone 홈 화면에서 NIKKE 게임 데이터를 확인하세요.
      </p>

      {/* 1단계: 위젯 설치 */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>1. Scriptable 위젯 설치</h2>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
          <li>iPhone에서 <strong>Scriptable</strong> 앱 설치</li>
          <li>앱에서 + 버튼으로 새 스크립트 생성</li>
          <li><code>scriptable-widget.js</code> 코드를 붙여넣기</li>
          <li>홈 화면에 Scriptable 위젯 추가 후 해당 스크립트 선택</li>
        </ol>
      </div>

      {/* 2단계: OpenID */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>2. OpenID 찾기</h2>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
          <li><a href="https://www.blablalink.com/shiftyspad" target="_blank" rel="noreferrer">blablalink.com/shiftyspad</a> 에 로그인</li>
          <li>조회하고 싶은 프로필 페이지 URL 확인</li>
          <li>URL의 <code>uid</code> 파라미터를 base64 디코딩하면 <code>29080-<strong>OPENID</strong></code></li>
          <li><strong>OPENID</strong> 숫자 부분만 사용</li>
        </ol>
      </div>

      {/* 3단계: 인증키 */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>3. 인증키 발급 (선택)</h2>
        <p style={{ fontSize: 13, color: "#666", margin: "0 0 12px" }}>
          유니온 레이드 등 본인 계정 전용 데이터를 조회하려면 인증키가 필요합니다.<br />
          blablalink.com 로그인 정보를 입력하면 암호화된 인증키를 발급합니다.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="email"
            placeholder="blablalink 이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: 10, borderRadius: 6, border: "1px solid #ccc", fontSize: 14 }}
          />
          <input
            type="password"
            placeholder="blablalink 비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: 10, borderRadius: 6, border: "1px solid #ccc", fontSize: 14 }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: 12, borderRadius: 6, border: "none",
              background: loading ? "#999" : "#0070f3", color: "#fff",
              fontSize: 14, cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "발급 중..." : "인증키 발급"}
          </button>
        </form>

        {error && <p style={{ color: "red", marginTop: 8, fontSize: 13 }}>{error}</p>}

        {authKey && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 13, color: "#0070f3", fontWeight: "bold", margin: "0 0 8px" }}>
              발급 완료! 아래 인증키를 복사하세요.
            </p>
            <textarea
              readOnly
              value={authKey}
              rows={3}
              style={{
                width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ccc",
                fontSize: 11, fontFamily: "monospace", wordBreak: "break-all", resize: "none",
                boxSizing: "border-box",
              }}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <p style={{ fontSize: 11, color: "#999", margin: "8px 0 0" }}>
              * 인증키는 서버에 저장되지 않습니다. 분실 시 다시 발급받으세요.<br />
              * 인증키에 로그인 정보가 암호화되어 있으므로 타인에게 공유하지 마세요.
            </p>
          </div>
        )}
      </div>

      {/* 4단계: Parameter 설정 */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>4. 위젯 Parameter 설정</h2>
        <p style={{ fontSize: 13, color: "#666", margin: "0 0 8px" }}>
          홈 화면 위젯을 길게 눌러 &quot;위젯 편집&quot; → Parameter에 아래 형식으로 입력하세요.
        </p>

        <code style={codeStyle}>openid|항목1,항목2|인증키</code>

        <h3 style={{ fontSize: 14, margin: "16px 0 4px" }}>사용 가능한 항목</h3>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 4, fontSize: 13, marginTop: 4,
        }}>
          {["프로필", "싱크로", "전투력", "타워", "캠페인", "작전인원", "코스튬", "오버클럭", "니케", "미션", "보관함", "유니온", "레이드"].map((f) => (
            <span key={f} style={{ background: "#e8e8e8", borderRadius: 4, padding: "2px 8px", textAlign: "center" }}>
              {f}
            </span>
          ))}
        </div>

        <h3 style={{ fontSize: 14, margin: "16px 0 4px" }}>예시</h3>
        <code style={{ ...codeStyle, fontSize: 11 }}>
          5811974927458150963|싱크로,전투력,레이드|인증키
        </code>
        <code style={{ ...codeStyle, fontSize: 11, marginTop: 4 }}>
          5811974927458150963|전체|인증키
        </code>
        <code style={{ ...codeStyle, fontSize: 11, marginTop: 4 }}>
          5811974927458150963|미션,레이드
          <span style={{ color: "#888" }}> ← 인증키 생략 시 서버 기본 계정</span>
        </code>
      </div>

      <p style={{ fontSize: 11, color: "#bbb", marginTop: 24, textAlign: "center" }}>
        NIKKE ShiftyPad Widget Server
      </p>
    </div>
  );
}
