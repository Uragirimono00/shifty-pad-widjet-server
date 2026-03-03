export default function Home() {
  return (
    <div style={{ maxWidth: 600, margin: "40px auto", padding: "0 20px", fontFamily: "system-ui" }}>
      <h1>NIKKE ShiftyPad Widget API</h1>
      <p>Scriptable 위젯용 NIKKE 게임 데이터 API 서버</p>

      <h2>API Endpoint</h2>
      <code style={{ display: "block", background: "#f0f0f0", padding: 12, borderRadius: 6 }}>
        GET /api/nikke?openid=YOUR_OPENID
      </code>

      <h3 style={{ marginTop: 24 }}>openid 찾는 방법</h3>
      <ol>
        <li>blablalink.com/shiftyspad 에 로그인</li>
        <li>프로필 페이지 URL에서 uid 파라미터 확인</li>
        <li>base64 디코딩하면 <code>29080-OPENID</code> 형태</li>
        <li>OPENID 부분만 사용</li>
      </ol>

      <h3>환경변수 설정</h3>
      <ul>
        <li><code>BLABLA_EMAIL</code> - blablalink 로그인 이메일</li>
        <li><code>BLABLA_PASSWORD</code> - blablalink 로그인 비밀번호</li>
      </ul>

      <h3>Scriptable 위젯</h3>
      <p>
        <code>scriptable-widget.js</code> 파일을 Scriptable 앱에 추가하고,
        API URL과 OPENID를 설정하세요.
      </p>
    </div>
  );
}
