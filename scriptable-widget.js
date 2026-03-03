// ============================================
// NIKKE ShiftyPad Widget for Scriptable
// ============================================
//
// Parameter 입력 형식:
//   openid|보고싶은항목,항목,항목
//
// 사용 가능한 항목:
//   프로필, 싱크로, 전투력, 타워, 캠페인,
//   작전인원, 코스튬, 오버클럭, 니케, 미션,
//   보관함, 유니온, 레이드
//
// 예시:
//   5811974927458150963|싱크로,전투력,타워,레이드
//   5811974927458150963|전체
//   5811974927458150963|니케,레이드
//   5811974927458150963            ← 기본(전투력+타워+레이드)

// ===== 설정 =====
const API_BASE_URL = "https://shifty-pad-widjet-server.vercel.app";
const DEFAULT_OPEN_ID = "5811974927458150963";

// ===== Parameter 파싱 =====
const param = (args.widgetParameter || "").trim();
const parts = param.split("|").map(s => s.trim());
const OPEN_ID = parts[0] || DEFAULT_OPEN_ID;
const fieldInput = parts[1] || "";

// 한국어 키워드 → 필드 매핑
const FIELD_MAP = {
  "프로필":   "profile",
  "싱크로":   "synchroLevel",
  "전투력":   "squadPower",
  "타워":     "tower",
  "캠페인":   "campaign",
  "작전인원": "nikkes",
  "코스튬":   "costumes",
  "오버클럭": "overclock",
  "니케":     "topNikkes",
  "미션":     "missions",
  "보관함":   "storage",
  "유니온":   "unionInfo",
  "레이드":   "unionRaid",
};

// 기본 표시 항목 (Parameter에 항목 미지정 시)
const DEFAULT_FIELDS = ["profile", "synchroLevel", "squadPower", "tower", "overclock", "unionRaid"];

function parseFields(input) {
  if (!input) return DEFAULT_FIELDS;
  if (input === "전체" || input === "all") return Object.values(FIELD_MAP);

  const requested = input.split(",").map(s => s.trim());
  const fields = [];
  for (const keyword of requested) {
    const mapped = FIELD_MAP[keyword];
    if (mapped) fields.push(mapped);
  }
  return fields.length > 0 ? ["profile", ...fields] : DEFAULT_FIELDS;
}

const ACTIVE_FIELDS = parseFields(fieldInput);

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
  if (!raid) return;

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
  const metaParts = [
    raid.difficulty || "",
    raid.level ? `Lv.${raid.level}` : "",
    raid.season ? raid.season.match(/\[S\d+\]/)?.[0] || "" : "",
  ].filter(Boolean);

  if (metaParts.length > 0) {
    const metaRow = widget.addStack();
    metaRow.layoutHorizontally();
    const mt = metaRow.addText(metaParts.join(" | "));
    mt.font = Font.systemFont(8);
    mt.textColor = new Color(COLORS.gray);
  }

  // 보스 데이터 없으면 시즌 종료 표시
  if (!raid.bosses || raid.bosses.length === 0) {
    widget.addSpacer(2);
    const noData = widget.addText("레이드 시즌 종료 또는 데이터 없음");
    noData.font = Font.systemFont(9);
    noData.textColor = new Color(COLORS.darkGray);
    return;
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

    // Boss name
    const nm = bossRow.addText(boss.name || "?");
    nm.font = Font.systemFont(9);
    nm.textColor = new Color(COLORS.white);
    nm.lineLimit = 1;
    nm.minimumScaleFactor = 0.7;

    bossRow.addSpacer();

    // Progress bar — 남은 공간을 채우도록 가변 폭
    const barWrap = bossRow.addStack();
    barWrap.layoutVertically();
    barWrap.centerAlignContent();

    const barOuter = barWrap.addStack();
    barOuter.size = new Size(80, 5);
    barOuter.cornerRadius = 2.5;
    barOuter.backgroundColor = new Color(COLORS.darkGray);

    const barInner = barOuter.addStack();
    barInner.size = new Size(Math.max(1, (progNum / 100) * 80), 5);
    barInner.cornerRadius = 2.5;
    barInner.backgroundColor = new Color(progColor);

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

// ===== 메인 위젯 빌드 =====
async function buildWidget(data) {
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

  const F = new Set(ACTIVE_FIELDS);

  // Header (profile 포함 시)
  if (F.has("profile")) addHeader(w, data);
  w.addSpacer(4);

  // 기본 스탯 행
  const info = data.userInfo;
  const stats = [];
  if (F.has("synchroLevel") && info["Synchro Level"])
    stats.push({ label: "싱크로", value: info["Synchro Level"], color: COLORS.accent });
  if (F.has("squadPower") && info["Squad Power"])
    stats.push({ label: "전투력", value: Number(info["Squad Power"]).toLocaleString(), color: COLORS.gold });
  if (F.has("tower") && info["Towers"])
    stats.push({ label: "타워", value: info["Towers"], color: COLORS.red });
  if (F.has("nikkes") && info["Nikkes"])
    stats.push({ label: "작전인원", value: info["Nikkes"], color: COLORS.green });
  if (F.has("overclock") && info["Overclock Mode"])
    stats.push({ label: "오버클럭", value: info["Overclock Mode"], color: COLORS.purple });
  if (F.has("costumes") && info["Costumes"])
    stats.push({ label: "코스튬", value: info["Costumes"], color: COLORS.white });

  if (stats.length > 0) addStatRow(w, stats);

  // 캠페인
  if (F.has("campaign")) {
    const camp = [];
    if (info["Campaign(NORMAL)"]) camp.push(`N:${info["Campaign(NORMAL)"]}`);
    if (info["Campaign(HARD)"]) camp.push(`H:${info["Campaign(HARD)"]}`);
    if (camp.length > 0) {
      w.addSpacer(2);
      const c = w.addText(`캠페인 ${camp.join(" | ")}`);
      c.font = Font.systemFont(9);
      c.textColor = new Color(COLORS.gray);
    }
  }

  // 보관함
  if (F.has("storage") && data.dailyMission?.storageCapacity) {
    const s = w.addText(`보관함 ${data.dailyMission.storageCapacity}`);
    s.font = Font.systemFont(9);
    s.textColor = new Color(COLORS.gray);
  }

  // 상위 니케
  if (F.has("topNikkes")) await addTopNikkes(w, data);

  // 미션
  if (F.has("missions")) addMissions(w, data);

  // 유니온 정보
  if (F.has("unionInfo")) addUnionInfo(w, data);

  // 유니온 레이드
  if (F.has("unionRaid")) addUnionRaid(w, data);

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
