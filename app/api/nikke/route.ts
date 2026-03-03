import { NextRequest, NextResponse } from "next/server";
import puppeteer, { Browser, Page } from "puppeteer-core";
import chromium from "@sparticuz/chromium-min";

export const maxDuration = 60;

// ===== 세션 캐시 (쿠키 + localStorage) =====
interface CachedSession {
  cookies: Array<{ name: string; value: string; domain: string; path: string }>;
  localStorage: Record<string, string>;
  expiry: number;
}
let cachedSession: CachedSession | null = null;
const SESSION_TTL = 60 * 60 * 1000; // 1시간

// SPA 인증에 필요한 localStorage 키
const ESSENTIAL_LS_KEYS = [
  "lip-user-info",
  "__ss_storage_ls_cache_login_meta__",
  "logined_account_cache_key",
  "__ss_storage_ls_cache_shiftyhint_v4__",
  "__ss_storage_ls_cache_shiftylist_hint_v2__",
];

// ===== 데이터 캐시 (openid별) =====
const DATA_CACHE_TTL = 1 * 60 * 1000; // 1분
const dataCache = new Map<string, { data: unknown; expiry: number }>();

function encodeOpenId(openId: string): string {
  const raw = `29080-${openId}`;
  return Buffer.from(raw).toString("base64");
}

const CHROMIUM_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-default-apps",
  "--disable-sync",
  "--no-first-run",
  "--disable-translate",
];

async function getBrowser(): Promise<Browser> {
  if (process.env.NODE_ENV === "development") {
    return puppeteer.launch({
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: true,
      args: CHROMIUM_ARGS,
    });
  }
  return puppeteer.launch({
    args: [...chromium.args, ...CHROMIUM_ARGS],
    defaultViewport: { width: 390, height: 844 },
    executablePath: await chromium.executablePath(
      "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar"
    ),
    headless: true,
  });
}

// 불필요한 리소스 차단 (스크래핑 시에만 활성화, 로그인 시에는 비활성화)
const BLOCKED_DOMAINS = ["aegis.qq.com", "google-analytics.com", "googletagmanager.com", "facebook.net", "doubleclick.net"];
const BLOCKED_TYPES = new Set(["image", "font", "media"]);
const pageBlocking = new WeakSet<Page>();

async function setupRequestInterception(page: Page) {
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (!pageBlocking.has(page)) { req.continue(); return; }
    const type = req.resourceType();
    const url = req.url();
    if (BLOCKED_TYPES.has(type) || BLOCKED_DOMAINS.some(d => url.includes(d))) {
      req.abort();
    } else {
      req.continue();
    }
  });
}

// 캐싱된 세션(쿠키+localStorage) 복원
async function restoreSession(page: Page): Promise<boolean> {
  if (!cachedSession || Date.now() >= cachedSession.expiry) return false;

  // 쿠키 설정
  if (cachedSession.cookies.length > 0) {
    await page.setCookie(...cachedSession.cookies.map(c => ({
      ...c,
      secure: true,
      sameSite: "None" as const,
    })));
  }

  // localStorage 설정 — 페이지 로드 전에 주입
  const lsData = cachedSession.localStorage;
  await page.evaluateOnNewDocument((data) => {
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, value);
    }
  }, lsData);

  return true;
}

// 로그인 성공 후 세션(쿠키+localStorage) 저장
async function saveSession(page: Page) {
  const cookies = await page.cookies();
  const localStorage = await page.evaluate((keys) => {
    const result: Record<string, string> = {};
    for (const key of keys) {
      const val = window.localStorage.getItem(key);
      if (val) result[key] = val;
    }
    return result;
  }, ESSENTIAL_LS_KEYS);

  cachedSession = {
    cookies: cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
    })),
    localStorage,
    expiry: Date.now() + SESSION_TTL,
  };
}

async function dismissPopups(page: Page) {
  await page.evaluate(() => {
    // Accept cookies + dismiss popups in one pass
    const buttons = document.querySelectorAll("button, a, div");
    for (const btn of buttons) {
      const text = btn.textContent?.trim() || "";
      if (text.includes("Accept all optional")) {
        (btn as HTMLElement).click();
      }
      if (text === "Confirm" && btn.closest("[class*='note'], [class*='popup'], [class*='modal']")) {
        (btn as HTMLElement).click();
      }
    }
  });
}

async function loginWithPuppeteer(page: Page, email: string, password: string): Promise<boolean> {
  // 로그인 시에는 리소스 차단 OFF (SPA가 완전히 렌더링되어야 함)
  pageBlocking.delete(page);

  await page.goto("https://www.blablalink.com/login?to=/shiftyspad/home", {
    waitUntil: "networkidle2",
    timeout: 20000,
  });

  // 로그인 폼이 나타날 때까지 대기
  try {
    await page.waitForSelector("#loginPwdForm_account", { timeout: 8000 });
  } catch {
    // 폼이 안 보이면 팝업/탭 전환 필요할 수 있음
    await new Promise((r) => setTimeout(r, 2000));
  }

  await dismissPopups(page);

  // 리전 선택
  await page.evaluate(() => {
    const els = document.querySelectorAll("*");
    for (const el of els) {
      if (el.textContent?.trim() === "JP/KR/NA/SEA/Global" && el.children.length <= 2) {
        (el as HTMLElement).click();
        return;
      }
    }
  });
  await new Promise((r) => setTimeout(r, 500));

  // 비밀번호 로그인 탭 전환
  await page.evaluate(() => {
    const els = document.querySelectorAll("*");
    for (const el of els) {
      if (el.textContent?.trim() === "Password login" && el.children.length === 0) {
        (el as HTMLElement).click();
        return;
      }
    }
  });
  await new Promise((r) => setTimeout(r, 500));

  // 이메일 입력
  const emailInput = await page.$("#loginPwdForm_account");
  if (emailInput) {
    await emailInput.click({ clickCount: 3 });
    await emailInput.type(email, { delay: 30 });
  }

  // 비밀번호 입력
  const pwdInput = await page.$("#loginPwdForm_password");
  if (pwdInput) {
    await pwdInput.click({ clickCount: 3 });
    await pwdInput.type(password, { delay: 30 });
  }

  // 로그인 버튼 클릭
  await page.evaluate(() => {
    const buttons = document.querySelectorAll("button, div[class*='btn'], span");
    for (const btn of buttons) {
      const text = btn.textContent?.trim();
      if (text === "Log in" && btn.closest("form, [class*='login']")) {
        (btn as HTMLElement).click();
        return;
      }
    }
    for (const btn of buttons) {
      if (btn.textContent?.trim() === "Log in") {
        (btn as HTMLElement).click();
        return;
      }
    }
  });

  // 리디렉트 대기 (로그인 완료)
  try {
    await page.waitForFunction(() => !window.location.href.includes("/login"), { timeout: 15000 });
  } catch {
    // fallback
  }

  await new Promise((r) => setTimeout(r, 1000));

  const currentUrl = page.url();
  return !currentUrl.includes("/login");
}

async function scrapeUserData(page: Page, openId: string) {
  // 스크래핑 시에는 리소스 차단 ON (속도 최적화)
  pageBlocking.add(page);

  const encodedId = encodeOpenId(openId);
  const targetUrl = `https://www.blablalink.com/shiftyspad/home?uid=${encodeURIComponent(encodedId)}&openid=${encodeURIComponent(encodedId)}`;

  await page.setExtraHTTPHeaders({ "Accept-Language": "ko-KR,ko;q=0.9" });

  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20000 });

  // SPA 데이터 렌더링 대기 — 고정 5초 대신 셀렉터 감지
  try {
    await page.waitForSelector('[data-cname="UserGameInfo"], [data-cname="my-nikkes"]', { timeout: 12000 });
  } catch {
    // fallback: 짧은 대기 후 시도
    await new Promise((r) => setTimeout(r, 2000));
  }

  await dismissPopups(page);

  // Expand section + 짧은 대기
  await page.evaluate(() => {
    const expandBtn = document.querySelector(".expand-btn");
    if (expandBtn) (expandBtn as HTMLElement).click();
  });
  await new Promise((r) => setTimeout(r, 500));

  return page.evaluate(() => {
    const getText = (el: Element | null): string => el?.textContent?.trim() ?? "";

    // Check if page loaded data
    const hasData = !!document.querySelector('[data-cname="UserGameInfo"]') ||
      !!document.querySelector('[data-cname="my-nikkes"]');

    if (!hasData) {
      return {
        error: "Data not loaded. Page might require login or the profile is private.",
        pageText: document.body?.innerText?.substring(0, 500),
      };
    }

    // 0. Profile header (nickname, level, server, uid)
    const profile: Record<string, string> = {};
    // Nickname is usually in a bold/large text near the top
    const userBaseInfo = document.querySelector('[data-cname="UserBaseInfo"], [data-cname="user-base-info"]');
    if (userBaseInfo) {
      const nameEl = userBaseInfo.querySelector("[class*='font-bold'], [class*='text-\\[18px\\]'], [class*='text-\\[16px\\]']");
      if (nameEl) profile.nickname = getText(nameEl);
      const levelEl = userBaseInfo.querySelector("[class*='bg-\\[\\#3EAFFF\\]'], [class*='bg-\\[var(--brand']");
      if (levelEl) profile.level = getText(levelEl);
    }
    // Fallback: look for Lv. pattern and UID pattern in page text
    const bodyText = document.body?.innerText || "";
    const uidMatch = bodyText.match(/UID[:\s]*(\d+)/i);
    if (uidMatch) profile.gameUid = uidMatch[1];
    const serverMatch = bodyText.match(/(Japan|Korea|Global|Asia|NA|SEA|EU)/i);
    if (serverMatch) profile.server = serverMatch[1];

    // 1. User Info - parse the stat grid
    const userInfo: Record<string, string> = {};
    // Each stat cell has: optional badge (NORMAL/HARD), value, label
    const statGrid = document.querySelector(".flex.flex-wrap");
    if (statGrid) {
      const cells = statGrid.querySelectorAll(":scope > div");
      cells.forEach((cell) => {
        const divs = Array.from(cell.querySelectorAll("div"));
        if (divs.length < 2) return;

        // Label is the last div (smallest text)
        const label = getText(divs[divs.length - 1]);
        if (!label || label.length > 20) return;

        // Check for badge (NORMAL/HARD)
        const badgeEl = cell.querySelector("[class*='bg-\\[var(--brand']");
        const badge = badgeEl ? getText(badgeEl) : "";

        // Value is the DINNextLTProBold element
        const valueEl = cell.querySelector("[class*='DINNextLTProBold']");
        const value = valueEl ? getText(valueEl) : "";

        if (badge && label) {
          // Campaign with difficulty badge
          userInfo[`${label}(${badge})`] = value;
        } else if (label && value) {
          userInfo[label] = value;
        }
      });
    }

    // 2. Top Nikkes
    const topNikkes: Array<{ level: string; power: string; stars: number; evolve: number; imageUrl: string }> = [];
    const nikkeItems = document.querySelectorAll('[data-cname="my-nikkes"] li, [user_nikkelist_info] li');
    nikkeItems.forEach((li) => {
      const levelEl = li.querySelector("[class*='text-stroke']");
      const powerEls = li.querySelectorAll("[class*='DINNextLTProBold']");
      const imgEl = li.querySelector("[data-cname='role-img'], img[crossorigin]") as HTMLImageElement | null;
      const starGolds = li.querySelectorAll("img[src*='star-gold']");
      const evolveEl = li.querySelector("p[class*='icon-evolve'] span");

      const powerEl = powerEls.length > 0 ? powerEls[powerEls.length - 1] : null;

      topNikkes.push({
        level: getText(levelEl),
        power: getText(powerEl),
        stars: starGolds.length,
        evolve: evolveEl ? parseInt(getText(evolveEl)) || 0 : 0,
        imageUrl: imgEl?.src ?? "",
      });
    });

    // 3. Daily Missions
    const missions: Array<{ label: string; value: string; subLabel?: string }> = [];
    const missionContainers = document.querySelectorAll("[class*='bg-'][class*='fill-5']");
    missionContainers.forEach((row) => {
      const cells = row.querySelectorAll(":scope > .flex-1, :scope > div > .flex-1");
      cells.forEach((cell) => {
        const mainLabel = cell.querySelector("[class*='text-\\[11px\\]'], .font-medium");
        const subLabel = cell.querySelector("[class*='text-\\[9px\\]']");
        const valueEl = cell.querySelector("[class*='DINNextLTProBold']");
        if (mainLabel && valueEl) {
          const m: { label: string; value: string; subLabel?: string } = {
            label: getText(mainLabel),
            value: getText(valueEl),
          };
          if (subLabel) m.subLabel = getText(subLabel);
          missions.push(m);
        }
      });
    });

    // 4. Storage capacity
    let storageCapacity = "";
    const storageRow = document.querySelector("[class*='outpost-defense']");
    if (storageRow) {
      const container = storageRow.closest("[class*='border']");
      if (container) {
        const valEl = container.querySelector("[class*='DINNextLTProBold']");
        storageCapacity = getText(valEl);
      }
    }

    // 5. Union
    const union: Record<string, string> = {};
    // Union name
    const unionContainer = document.querySelector("[data-cname='UserGameInfo'] [class*='bg-team'], [data-cname='UserGameInfo'] [class*='min-h-\\[89px\\]']");
    if (unionContainer) {
      const nameEl = unionContainer.querySelector("[class*='font-bold'][class*='truncate'], [class*='text-\\[14px\\]']");
      if (nameEl) {
        // Name might contain level badge inline - split it
        const badge = nameEl.querySelector("[class*='bg-\\[\\#3EAFFF\\]']");
        if (badge) {
          union.level = getText(badge);
          const fullText = getText(nameEl);
          union.name = fullText.replace(union.level, "").trim();
        } else {
          union.name = getText(nameEl);
        }
      }
      const uidEl = unionContainer.querySelector("[class*='text-\\[10px\\]'][class*='truncate'], [class*='text-\\[length\\:10px\\]']");
      if (uidEl) union.uid = getText(uidEl);
    }
    // Union stats
    const flexStats = document.querySelectorAll("[class*='flex-\\[5\\]'], [class*='flex-\\[6\\]']");
    flexStats.forEach(stat => {
      const labelEl = stat.querySelector("[class*='text-\\[8px\\]'], [class*='text-\\[length\\:8px\\]']");
      const valueEl = stat.querySelector("[class*='DINNextLTProBold']");
      if (labelEl && valueEl) {
        union[getText(labelEl)] = getText(valueEl);
      }
    });

    // 6. Union Raid
    const raidMeta: Record<string, string> = {};
    const guildSection = document.querySelector("[guild_info]");
    if (guildSection) {
      // Season text
      const seasonEl = guildSection.querySelector("[class*='text-\\[10px\\]'] span, [class*='cursor-pointer'] span");
      if (seasonEl) raidMeta.season = getText(seasonEl);

      // Raid cards (difficulty, level, total progress)
      const cards = guildSection.querySelectorAll(".flex.items-stretch .flex-1");
      cards.forEach(card => {
        const valEl = card.querySelector("[class*='text-\\[12px\\]']");
        const labelEl = card.querySelector("[class*='text-\\[10px\\]']");
        if (valEl && labelEl) {
          const label = getText(labelEl);
          const value = getText(valEl);
          if (label.includes("난이도") || label.includes("Difficulty")) raidMeta.difficulty = value;
          else if (label.includes("레벨") || label.includes("Level")) raidMeta.level = value;
          else if (label.includes("진행도") || label.includes("Progress")) raidMeta.totalProgress = value;
        }
      });
    }

    const bosses: Array<{ name: string; progress: string; damage: string; hp: string; imageUrl: string }> = [];
    const bossRows = document.querySelectorAll("[guild_info] .shadow-md");
    bossRows.forEach((row) => {
      const nameEl = row.querySelector("[class*='text-\\[16px\\]']");
      const progressEl = row.querySelector("[class*='text-\\[\\#FC6A37\\]']");
      const numSpans = row.querySelectorAll("[class*='text-\\[8px\\]']");
      const bgImg = row.querySelector("img[loading='lazy']") as HTMLImageElement | null;
      bosses.push({
        name: getText(nameEl),
        progress: getText(progressEl),
        damage: numSpans[0] ? getText(numSpans[0]) : "",
        hp: numSpans[1] ? getText(numSpans[1]) : "",
        imageUrl: bgImg?.src ?? "",
      });
    });

    return {
      profile,
      userInfo,
      topNikkes: topNikkes.slice(0, 10),
      dailyMission: {
        storageCapacity,
        missions,
      },
      union,
      unionRaid: { ...raidMeta, bosses },
      fetchedAt: new Date().toISOString(),
    };
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const openId = searchParams.get("openid");
  const email = searchParams.get("email") || process.env.BLABLA_EMAIL || "";
  const password = searchParams.get("password") || process.env.BLABLA_PASSWORD || "";

  if (!openId) {
    return NextResponse.json({
      error: "openid parameter is required.",
      example: "/api/nikke?openid=5811974927458150963",
      setup: "Set BLABLA_EMAIL and BLABLA_PASSWORD environment variables for auto-login.",
    }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({
      error: "Login credentials not configured.",
      setup: "Set BLABLA_EMAIL and BLABLA_PASSWORD as environment variables (Vercel or .env.local)",
    }, { status: 401 });
  }

  // 캐싱된 데이터가 있으면 바로 반환
  const cached = dataCache.get(openId);
  if (cached && Date.now() < cached.expiry) {
    return NextResponse.json({ success: true, openId, data: cached.data, cached: true });
  }

  let browser: Browser | undefined;
  try {
    browser = await getBrowser();
    let page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    );
    await setupRequestInterception(page);

    // 1단계: 캐싱된 세션(쿠키+localStorage)으로 바로 시도
    const hasSession = await restoreSession(page);
    if (hasSession) {
      const data = await scrapeUserData(page, openId);
      if (data && !("error" in data)) {
        dataCache.set(openId, { data, expiry: Date.now() + DATA_CACHE_TTL });
        return NextResponse.json({ success: true, openId, data });
      }
      // 세션 만료 → evaluateOnNewDocument가 오염된 page 폐기, 새 page로 로그인
      cachedSession = null;
      await page.close();
      page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844 });
      await page.setUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      );
      await setupRequestInterception(page);
    }

    // 2단계: 로그인 필요
    const loggedIn = await loginWithPuppeteer(page, email, password);
    if (!loggedIn) {
      return NextResponse.json({
        success: false,
        error: "Login failed. Check credentials.",
        currentUrl: page.url(),
      }, { status: 401 });
    }

    // 세션 저장 (쿠키 + localStorage)
    await saveSession(page);

    // 3단계: 데이터 스크래핑
    const data = await scrapeUserData(page, openId);

    if (data && !("error" in data)) {
      dataCache.set(openId, { data, expiry: Date.now() + DATA_CACHE_TTL });
    }

    return NextResponse.json({ success: true, openId, data });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
