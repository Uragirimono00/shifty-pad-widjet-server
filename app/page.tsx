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

  return (
    <>
      <style>{`
        :root {
          --bg: #0d1117;
          --card: #161b22;
          --border: #30363d;
          --text: #e6edf3;
          --text-sub: #8b949e;
          --accent: #58a6ff;
          --code-bg: #0d1117;
          --input-bg: #0d1117;
          --input-border: #30363d;
          --tag-bg: #21262d;
        }
        @media (prefers-color-scheme: light) {
          :root {
            --bg: #ffffff;
            --card: #f6f8fa;
            --border: #d0d7de;
            --text: #1f2328;
            --text-sub: #656d76;
            --accent: #0969da;
            --code-bg: #1a1a2e;
            --input-bg: #ffffff;
            --input-border: #d0d7de;
            --tag-bg: #ddf4ff;
          }
        }
        * { box-sizing: border-box; }
        body { background: var(--bg); color: var(--text); margin: 0; }
      `}</style>
      <div style={{ maxWidth: 560, margin: "40px auto", padding: "0 20px", fontFamily: "system-ui", lineHeight: 1.6 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>NIKKE ShiftyPad Widget</h1>
        <p style={{ color: "var(--text-sub)", fontSize: 14, marginTop: 0 }}>
          Scriptable 위젯으로 iPhone 홈 화면에서 NIKKE 게임 데이터를 확인하세요.
        </p>

        {/* 1단계 */}
        <Section title="1. Scriptable 위젯 설치">
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
            <li>iPhone에서 <strong>Scriptable</strong> 앱 설치</li>
            <li>앱에서 + 버튼으로 새 스크립트 생성</li>
            <li><code style={{ color: "var(--accent)" }}>scriptable-widget.js</code> 코드를 붙여넣기</li>
            <li>홈 화면에 Scriptable 위젯 추가 후 해당 스크립트 선택</li>
          </ol>
        </Section>

        {/* 2단계 */}
        <Section title="2. OpenID 찾기">
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
            <li><a href="https://www.blablalink.com/shiftyspad" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>blablalink.com/shiftyspad</a> 에 로그인</li>
            <li>조회하고 싶은 프로필 페이지 URL 확인</li>
            <li>URL의 <code>uid</code> 파라미터를 base64 디코딩하면 <code>29080-<strong>OPENID</strong></code></li>
            <li><strong>OPENID</strong> 숫자 부분만 사용</li>
          </ol>
        </Section>

        {/* 3단계 */}
        <Section title="3. 인증키 발급 (선택)">
          <p style={{ fontSize: 13, color: "var(--text-sub)", margin: "0 0 12px" }}>
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
              style={{
                padding: 10, borderRadius: 6, fontSize: 14,
                background: "var(--input-bg)", color: "var(--text)",
                border: "1px solid var(--input-border)",
              }}
            />
            <input
              type="password"
              placeholder="blablalink 비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                padding: 10, borderRadius: 6, fontSize: 14,
                background: "var(--input-bg)", color: "var(--text)",
                border: "1px solid var(--input-border)",
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: 12, borderRadius: 6, border: "none",
                background: loading ? "var(--text-sub)" : "var(--accent)", color: "#fff",
                fontSize: 14, cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "발급 중..." : "인증키 발급"}
            </button>
          </form>

          {error && <p style={{ color: "#f85149", marginTop: 8, fontSize: 13 }}>{error}</p>}

          {authKey && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 13, color: "var(--accent)", fontWeight: "bold", margin: "0 0 8px" }}>
                발급 완료! 아래 인증키를 복사하세요.
              </p>
              <textarea
                readOnly
                value={authKey}
                rows={3}
                style={{
                  width: "100%", padding: 10, borderRadius: 6,
                  fontSize: 11, fontFamily: "monospace", wordBreak: "break-all", resize: "none",
                  background: "var(--code-bg)", color: "#e6edf3",
                  border: "1px solid var(--border)",
                }}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
              <p style={{ fontSize: 11, color: "var(--text-sub)", margin: "8px 0 0" }}>
                * 인증키는 서버에 저장되지 않습니다. 분실 시 다시 발급받으세요.<br />
                * 인증키에 로그인 정보가 암호화되어 있으므로 타인에게 공유하지 마세요.
              </p>
            </div>
          )}
        </Section>

        {/* 4단계 */}
        <Section title="4. 위젯 Parameter 설정">
          <p style={{ fontSize: 13, color: "var(--text-sub)", margin: "0 0 8px" }}>
            홈 화면 위젯을 길게 눌러 &quot;위젯 편집&quot; → Parameter에 아래 형식으로 입력하세요.
          </p>

          <CodeBlock>openid|항목1,항목2|인증키</CodeBlock>

          <h3 style={{ fontSize: 14, margin: "16px 0 6px", color: "var(--text)" }}>사용 가능한 항목</h3>
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 6, fontSize: 13,
          }}>
            {["프로필", "싱크로", "전투력", "타워", "캠페인", "작전인원", "코스튬", "오버클럭", "니케", "미션", "보관함", "유니온", "레이드"].map((f) => (
              <span key={f} style={{
                background: "var(--tag-bg)", borderRadius: 4, padding: "3px 10px",
                border: "1px solid var(--border)", color: "var(--text)",
              }}>
                {f}
              </span>
            ))}
          </div>

          <h3 style={{ fontSize: 14, margin: "16px 0 6px", color: "var(--text)" }}>예시</h3>
          <CodeBlock>5811974927458150963|싱크로,전투력,레이드|인증키</CodeBlock>
          <CodeBlock>5811974927458150963|전체|인증키</CodeBlock>
          <CodeBlock>
            5811974927458150963|미션,레이드
            <span style={{ color: "#8b949e" }}> ← 인증키 생략 시 서버 기본 계정</span>
          </CodeBlock>
        </Section>

        <p style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 32, textAlign: "center", paddingBottom: 20 }}>
          NIKKE ShiftyPad Widget Server
        </p>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "16px 20px",
      marginTop: 16,
    }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px", color: "var(--text)" }}>{title}</h2>
      {children}
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      display: "block",
      background: "var(--code-bg)",
      color: "#e6edf3",
      padding: 12,
      borderRadius: 6,
      fontSize: 12,
      fontFamily: "monospace",
      wordBreak: "break-all",
      marginTop: 6,
      border: "1px solid var(--border)",
    }}>
      {children}
    </code>
  );
}
