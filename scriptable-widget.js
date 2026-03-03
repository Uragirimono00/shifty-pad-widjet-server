// ============================================
// NIKKE ShiftyPad Widget for Scriptable
// ============================================
// 설정 방법:
// 1. API_BASE_URL을 Vercel 배포 URL로 변경
// 2. OPEN_ID를 본인 openid로 변경
// 3. WIDGET_MODE를 원하는 모드로 설정
// 4. 홈화면에 Scriptable 위젯 추가

// ===== 설정 =====
const API_BASE_URL = "https://YOUR_VERCEL_URL.vercel.app";
const OPEN_ID = "5811974927458150963";

// 위젯 모드: "basic" | "raid" | "both" | "nikkes" | "custom"
const WIDGET_MODE = "both";

// custom 모드일 때 보여줄 항목 선택 (true/false)
const CUSTOM_FIELDS = {
  profile: true,        // 닉네임, 레벨
  synchroLevel: true,   // 싱크로 레벨
  squadPower: true,     // 스쿼드 전투력
  tower: true,          // 타워
  campaign: false,      // 캠페인 (노말/하드)
  nikkes: false,        // 작전 인원
  costumes: false,      // 코스튬
  overclock: true,      // 오버클럭
  topNikkes: true,      // 상위 니케 (이미지 포함)
  missions: false,      // 매일 미션
  storage: false,       // 보관함 용량
  unionInfo: false,     // 유니온 기본정보
  unionRaid: true,      // 유니온 레이드
};

// 상위 니케 표시 개수 (1~5)
const TOP_NIKKE_COUNT = 5;

// ===== 색상 테마 =====
const COLORS = {
  bg: "#0d1117",
  bgCard: "#161b22",
  accent: "#00b4d8",
  gold: "#ffd700",
  orange: "#FC6A37",
  red: "#ff6b6b",
  green: "#51cf66",
  purple: "#cc5de8",
  white: "#ffffff",
  gray: "#8b949e",
  darkGray: "#30363d",
};

// 영어→한국어 라벨 매핑
const LABEL_KR = {
  "Towers": "타워",
  "Campaign(NORMAL)": "캠페인(N)",
  "Campaign(HARD)": "캠페인(H)",
  "Nikkes": "작전 인원",
  "Squad Power": "전투력",
  "Costumes": "코스튬",
  "Registration Date": "가입일",
  "Synchro Level": "싱크로",
  "Overclock Mode": "오버클럭",
  "Interception": "요격전",
  "Rookie Arena": "루키 아레나",
  "SP Arena": "스페셜 아레나",
  "Advising": "상담",
  "Dispatch": "파견",
  "Manufacturer Tower": "기업 타워",
  "Simulation Room": "시뮬레이션",
  "Biweekly Reward Record": "격주 보상",
  "Season Best Record": "시즌 최고",
  "Union Members": "유니온 멤버",
  "Union Activity": "활약도",
  "Union Rank": "랭크",
};

function kr(label) {
  return LABEL_KR[label] || label;
}

// ===== 데이터 가져오기 =====
async function fetchData() {
  const url = `${API_BASE_URL}/api/nikke?openid=${OPEN_ID}`;
  const req = new Request(url);
  req.timeoutInterval = 120;
  try {
    const res = await req.loadJSON();
    if (res.success) return res.data;
    throw new Error(res.error || "API error");
  } catch (e) {
    console.error(e);
    return null;
  }
}

async function loadImage(url) {
  try {
    const req = new Request(url);
    return await req.loadImage();
  } catch {
    return null;
  }
}

// ===== 위젯 빌더 =====
function addHeader(widget, data) {
  const header = widget.addStack();
  header.layoutHorizontally();
  header.centerAlignContent();

  const titleStack = header.addStack();
  titleStack.layoutVertically();

  if (data.profile?.nickname) {
    const name = titleStack.addText(data.profile.nickname);
    name.font = Font.boldSystemFont(15);
    name.textColor = new Color(COLORS.white);
  }

  const sub = titleStack.addText(
    [data.profile?.level, data.profile?.server, `UID:${data.profile?.gameUid || ""}`]
      .filter(Boolean)
      .join(" | ")
  );
  sub.font = Font.systemFont(9);
  sub.textColor = new Color(COLORS.gray);

  header.addSpacer();

  const time = header.addText(formatTime(data.fetchedAt));
  time.font = Font.systemFont(8);
  time.textColor = new Color(COLORS.darkGray);
}

function addDivider(widget) {
  const d = widget.addStack();
  d.size = new Size(0, 1);
  d.backgroundColor = new Color(COLORS.darkGray);
  widget.addSpacer(4);
}

function addStatRow(container, items) {
  const row = container.addStack();
  row.layoutHorizontally();
  row.spacing = 0;

  items.forEach((item, i) => {
    if (i > 0) row.addSpacer();
    const box = row.addStack();
    box.layoutVertically();
    box.centerAlignContent();

    const label = box.addText(item.label);
    label.font = Font.systemFont(8);
    label.textColor = new Color(COLORS.gray);

    const val = box.addText(String(item.value));
    val.font = Font.boldSystemFont(13);
    val.textColor = new Color(item.color || COLORS.white);
  });
}

// ===== 기본정보 섹션 =====
function addBasicInfo(widget, data) {
  const info = data.userInfo;
  const stats = [];

  if (info["Synchro Level"])
    stats.push({ label: "싱크로", value: info["Synchro Level"], color: COLORS.accent });
  if (info["Squad Power"])
    stats.push({ label: "전투력", value: Number(info["Squad Power"]).toLocaleString(), color: COLORS.gold });
  if (info["Towers"])
    stats.push({ label: "타워", value: info["Towers"], color: COLORS.red });
  if (info["Nikkes"])
    stats.push({ label: "작전인원", value: info["Nikkes"], color: COLORS.green });
  if (info["Overclock Mode"])
    stats.push({ label: "오버클럭", value: info["Overclock Mode"], color: COLORS.purple });

  if (stats.length > 0) addStatRow(widget, stats);

  // Campaign row
  const campaign = [];
  if (info["Campaign(NORMAL)"]) campaign.push(`N:${info["Campaign(NORMAL)"]}`);
  if (info["Campaign(HARD)"]) campaign.push(`H:${info["Campaign(HARD)"]}`);
  if (campaign.length > 0) {
    widget.addSpacer(2);
    const cRow = widget.addStack();
    cRow.layoutHorizontally();
    const ct = cRow.addText(`캠페인 ${campaign.join(" | ")}`);
    ct.font = Font.systemFont(9);
    ct.textColor = new Color(COLORS.gray);
  }
}

// ===== 상위 니케 섹션 (이미지 포함) =====
async function addTopNikkes(widget, data) {
  const nikkes = (data.topNikkes || []).slice(0, TOP_NIKKE_COUNT);
  if (nikkes.length === 0) return;

  widget.addSpacer(4);
  const title = widget.addText("나의 니케");
  title.font = Font.boldSystemFont(10);
  title.textColor = new Color(COLORS.accent);
  widget.addSpacer(2);

  const row = widget.addStack();
  row.layoutHorizontally();
  row.spacing = 6;

  for (const nikke of nikkes) {
    const col = row.addStack();
    col.layoutVertically();
    col.centerAlignContent();
    col.size = new Size(48, 64);
    col.cornerRadius = 4;
    col.backgroundColor = new Color(COLORS.bgCard);
    col.setPadding(2, 2, 2, 2);

    // Load and display character image
    if (nikke.imageUrl) {
      const img = await loadImage(nikke.imageUrl);
      if (img) {
        const imgWidget = col.addImage(img);
        imgWidget.imageSize = new Size(44, 40);
        imgWidget.cornerRadius = 2;
      }
    }

    // Power text
    const pwr = col.addText(nikke.power || "?");
    pwr.font = Font.boldSystemFont(8);
    pwr.textColor = new Color(COLORS.gold);
    pwr.centerAlignText();
    pwr.lineLimit = 1;

    // Stars/Evolve indicator
    const starText = "★".repeat(Math.min(nikke.stars || 0, 3)) +
      (nikke.evolve > 0 ? `+${nikke.evolve}` : "");
    if (starText) {
      const st = col.addText(starText);
      st.font = Font.systemFont(6);
      st.textColor = new Color(COLORS.gold);
      st.centerAlignText();
      st.lineLimit = 1;
    }
  }
}

// ===== 미션 섹션 =====
function addMissions(widget, data) {
  const missions = data.dailyMission?.missions || [];
  if (missions.length === 0) return;

  widget.addSpacer(4);
  const title = widget.addText("매일 미션");
  title.font = Font.boldSystemFont(10);
  title.textColor = new Color(COLORS.accent);
  widget.addSpacer(2);

  // Show missions in 2-column layout
  for (let i = 0; i < Math.min(missions.length, 6); i += 3) {
    const row = widget.addStack();
    row.layoutHorizontally();
    row.spacing = 8;

    for (let j = i; j < Math.min(i + 3, missions.length); j++) {
      const m = missions[j];
      const cell = row.addStack();
      cell.layoutVertically();

      const lbl = cell.addText(kr(m.label));
      lbl.font = Font.systemFont(8);
      lbl.textColor = new Color(COLORS.gray);
      lbl.lineLimit = 1;

      const val = cell.addText(m.value);
      val.font = Font.boldSystemFont(10);
      val.textColor = new Color(COLORS.white);
    }
    widget.addSpacer(1);
  }
}

// ===== 유니온 레이드 섹션 =====
function addUnionRaid(widget, data) {
  const raid = data.unionRaid;
  if (!raid?.bosses?.length) return;

  widget.addSpacer(4);

  // Title + total progress
  const titleRow = widget.addStack();
  titleRow.layoutHorizontally();
  titleRow.centerAlignContent();

  const title = titleRow.addText("유니온 레이드");
  title.font = Font.boldSystemFont(10);
  title.textColor = new Color(COLORS.accent);

  titleRow.addSpacer();

  if (raid.totalProgress) {
    const prog = titleRow.addText(raid.totalProgress);
    prog.font = Font.boldSystemFont(11);
    prog.textColor = new Color(COLORS.orange);
  }

  // Metadata row
  if (raid.difficulty || raid.level) {
    const metaRow = widget.addStack();
    metaRow.layoutHorizontally();
    const metaText = [
      raid.difficulty ? `${raid.difficulty}` : "",
      raid.level ? `Lv.${raid.level}` : "",
      raid.season ? raid.season.match(/\[S\d+\]/)?.[0] || "" : "",
    ].filter(Boolean).join(" | ");

    const mt = metaRow.addText(metaText);
    mt.font = Font.systemFont(8);
    mt.textColor = new Color(COLORS.gray);
  }

  widget.addSpacer(2);

  // Boss list
  for (const boss of raid.bosses) {
    const bossRow = widget.addStack();
    bossRow.layoutHorizontally();
    bossRow.centerAlignContent();
    bossRow.spacing = 4;

    // Progress percentage (colored)
    const progText = boss.progress || "0%";
    const progNum = parseInt(progText) || 0;
    const progColor = progNum >= 50 ? COLORS.green
      : progNum > 0 ? COLORS.orange
      : COLORS.gray;

    const pct = bossRow.addText(progText.padStart(4));
    pct.font = Font.boldMonospacedSystemFont(10);
    pct.textColor = new Color(progColor);
    pct.minimumScaleFactor = 0.8;

    // Progress bar
    const barOuter = bossRow.addStack();
    barOuter.size = new Size(40, 4);
    barOuter.cornerRadius = 2;
    barOuter.backgroundColor = new Color(COLORS.darkGray);

    const barInner = barOuter.addStack();
    barInner.size = new Size(Math.max(1, (progNum / 100) * 40), 4);
    barInner.cornerRadius = 2;
    barInner.backgroundColor = new Color(progColor);

    bossRow.addSpacer(2);

    // Boss name
    const nm = bossRow.addText(boss.name || "?");
    nm.font = Font.systemFont(9);
    nm.textColor = new Color(COLORS.white);
    nm.lineLimit = 1;
    nm.minimumScaleFactor = 0.7;

    widget.addSpacer(1);
  }
}

// ===== 유니온 정보 =====
function addUnionInfo(widget, data) {
  const u = data.union;
  if (!u?.name) return;

  widget.addSpacer(4);
  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();

  const text = row.addText(`유니온: ${u.name} ${u.level || ""}`);
  text.font = Font.systemFont(9);
  text.textColor = new Color(COLORS.gray);

  row.addSpacer();

  if (u["Union Rank"] || u["유니온 랭크"]) {
    const rank = row.addText(u["Union Rank"] || u["유니온 랭크"]);
    rank.font = Font.boldSystemFont(9);
    rank.textColor = new Color(COLORS.gold);
  }

  // Union stats
  const statsRow = widget.addStack();
  statsRow.layoutHorizontally();
  statsRow.spacing = 12;

  const members = u["Union Members"] || u["유니온 멤버"];
  if (members) {
    const mt = statsRow.addText(`멤버 ${members}`);
    mt.font = Font.systemFont(8);
    mt.textColor = new Color(COLORS.gray);
  }

  const activity = u["Union Activity"] || u["유니온 활약도"];
  if (activity) {
    const at = statsRow.addText(`활약도 ${Number(activity).toLocaleString()}`);
    at.font = Font.systemFont(8);
    at.textColor = new Color(COLORS.gray);
  }
}

// ===== Custom 모드 =====
async function buildCustomWidget(widget, data) {
  const F = CUSTOM_FIELDS;

  if (F.profile) addHeader(widget, data);
  widget.addSpacer(4);

  // Basic stats
  const info = data.userInfo;
  const customStats = [];
  if (F.synchroLevel && info["Synchro Level"])
    customStats.push({ label: "싱크로", value: info["Synchro Level"], color: COLORS.accent });
  if (F.squadPower && info["Squad Power"])
    customStats.push({ label: "전투력", value: Number(info["Squad Power"]).toLocaleString(), color: COLORS.gold });
  if (F.tower && info["Towers"])
    customStats.push({ label: "타워", value: info["Towers"], color: COLORS.red });
  if (F.nikkes && info["Nikkes"])
    customStats.push({ label: "작전인원", value: info["Nikkes"], color: COLORS.green });
  if (F.overclock && info["Overclock Mode"])
    customStats.push({ label: "오버클럭", value: info["Overclock Mode"], color: COLORS.purple });
  if (F.costumes && info["Costumes"])
    customStats.push({ label: "코스튬", value: info["Costumes"], color: COLORS.white });

  if (customStats.length > 0) addStatRow(widget, customStats);

  if (F.campaign) {
    const camp = [];
    if (info["Campaign(NORMAL)"]) camp.push(`N:${info["Campaign(NORMAL)"]}`);
    if (info["Campaign(HARD)"]) camp.push(`H:${info["Campaign(HARD)"]}`);
    if (camp.length > 0) {
      widget.addSpacer(2);
      const c = widget.addText(`캠페인 ${camp.join(" | ")}`);
      c.font = Font.systemFont(9);
      c.textColor = new Color(COLORS.gray);
    }
  }

  if (F.storage && data.dailyMission?.storageCapacity) {
    const s = widget.addText(`보관함 ${data.dailyMission.storageCapacity}`);
    s.font = Font.systemFont(9);
    s.textColor = new Color(COLORS.gray);
  }

  if (F.topNikkes) await addTopNikkes(widget, data);
  if (F.missions) addMissions(widget, data);
  if (F.unionInfo) addUnionInfo(widget, data);
  if (F.unionRaid) addUnionRaid(widget, data);
}

// ===== 메인 위젯 빌드 =====
async function buildWidget(data) {
  const widgetSize = config.widgetFamily || "medium";
  const w = new ListWidget();
  w.backgroundColor = new Color(COLORS.bg);
  w.setPadding(10, 12, 10, 12);

  if (!data) {
    const err = w.addText("NIKKE 데이터 로딩 실패");
    err.font = Font.boldSystemFont(14);
    err.textColor = new Color(COLORS.red);
    const sub = w.addText("API 서버를 확인해주세요");
    sub.font = Font.systemFont(11);
    sub.textColor = new Color(COLORS.gray);
    return w;
  }

  const mode = WIDGET_MODE;

  if (mode === "custom") {
    await buildCustomWidget(w, data);
    return w;
  }

  // Header (always shown)
  addHeader(w, data);
  w.addSpacer(4);

  if (mode === "basic" || mode === "both") {
    addBasicInfo(w, data);

    if (widgetSize === "large") {
      await addTopNikkes(w, data);
      addMissions(w, data);
    }
  }

  if (mode === "raid" || mode === "both") {
    if (mode === "both") {
      w.addSpacer(4);
      addDivider(w);
    }
    addUnionRaid(w, data);
  }

  if (mode === "nikkes") {
    await addTopNikkes(w, data);
  }

  // Union footer (for large widget or both mode)
  if (widgetSize === "large" || mode === "both") {
    addUnionInfo(w, data);
  }

  return w;
}

// ===== 유틸리티 =====
function formatTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${h}:${m}`;
}

// ===== 실행 =====
async function main() {
  const data = await fetchData();
  const widget = await buildWidget(data);

  if (config.runsInWidget) {
    Script.setWidget(widget);
  } else {
    const size = config.widgetFamily || "medium";
    if (size === "small") widget.presentSmall();
    else if (size === "large") widget.presentLarge();
    else widget.presentMedium();
  }

  Script.complete();
}

await main();
