"use client";

import { useState } from "react";

export default function RegisterPage() {
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
    <div style={{ maxWidth: 520, margin: "40px auto", padding: "0 20px", fontFamily: "system-ui" }}>
      <h1>인증키 발급</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        blablalink.com 로그인 정보를 입력하면 암호화된 인증키를 발급합니다.<br />
        인증키를 Scriptable 위젯 Parameter에 넣으면 본인 계정으로 데이터를 조회합니다.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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

      {error && (
        <p style={{ color: "red", marginTop: 12 }}>{error}</p>
      )}

      {authKey && (
        <div style={{ marginTop: 20 }}>
          <h3>발급 완료</h3>
          <p style={{ fontSize: 13, color: "#666" }}>
            아래 인증키를 Scriptable 위젯 Parameter에 입력하세요.
          </p>

          <h4>Parameter 형식</h4>
          <code style={{ display: "block", background: "#f0f0f0", padding: 12, borderRadius: 6, fontSize: 12, wordBreak: "break-all" }}>
            openid|항목1,항목2|인증키
          </code>

          <h4 style={{ marginTop: 16 }}>인증키</h4>
          <div style={{ position: "relative" }}>
            <textarea
              readOnly
              value={authKey}
              rows={3}
              style={{
                width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ccc",
                fontSize: 11, fontFamily: "monospace", wordBreak: "break-all", resize: "none",
              }}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
          </div>

          <h4 style={{ marginTop: 16 }}>예시</h4>
          <code style={{ display: "block", background: "#f0f0f0", padding: 12, borderRadius: 6, fontSize: 11, wordBreak: "break-all" }}>
            5811974927458150963|싱크로,전투력,레이드|{authKey.substring(0, 20)}...
          </code>

          <p style={{ fontSize: 12, color: "#999", marginTop: 12 }}>
            * 인증키는 서버에 저장되지 않습니다. 분실 시 다시 발급받으세요.<br />
            * 인증키에 로그인 정보가 암호화되어 있으므로 타인에게 공유하지 마세요.
          </p>
        </div>
      )}
    </div>
  );
}
