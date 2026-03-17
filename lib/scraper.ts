import puppeteer, { Browser, Page } from "puppeteer-core";
import chromium from "@sparticuz/chromium-min";

// ===== 세션 캐시 (쿠키 + localStorage) =====
interface CachedSession {
  cookies: Array<{ name: string; value: string; domain: string; path: string }>;
  localStorage: Record<string, string>;
  expiry: number;
}
export const sessionCache = new Map<string, CachedSession>();
const SESSION_TTL = 60 * 60 * 1000; // 1시간

const ESSENTIAL_LS_KEYS = [
  "lip-user-info",
  "__ss_storage_ls_cache_login_meta__",
  "logined_account_cache_key",
  "__ss_storage_ls_cache_shiftyhint_v4__",
  "__ss_storage_ls_cache_shiftylist_hint_v2__",
];

// ===== 데이터 캐시 (만료 없음 — cron이 갱신) =====
export const dataCache = new Map<string, { data: unknown; updatedAt: number }>();

// ===== 등록된 사용자 (자동 갱신 대상) =====
export interface RegisteredUser {
  openId: string;
  email: string;
  password: string;
}
export const registeredUsers = new Map<string, RegisteredUser>();

// ===== 스크래핑 진행 중 플래그 =====
let isRefreshing = false;
export function getIsRefreshing() { return isRefreshing; }

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

async function restoreSession(page: Page, sessionKey: string): Promise<boolean> {
  const session = sessionCache.get(sessionKey);
  if (!session || Date.now() >= session.expiry) return false;

  if (session.cookies.length > 0) {
    await page.setCookie(...session.cookies.map(c => ({
      ...c,
      secure: true,
      sameSite: "None" as const,
    })));
  }

  const lsData = session.localStorage;
  await page.evaluateOnNewDocument((data) => {
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, value);
    }
  }, lsData);

  return true;
}

async function saveSession(page: Page, sessionKey: string) {
  const cookies = await page.cookies();
  const localStorage = await page.evaluate((keys) => {
    const result: Record<string, string> = {};
    for (const key of keys) {
      const val = window.localStorage.getItem(key);
      if (val) result[key] = val;
    }
    return result;
  }, ESSENTIAL_LS_KEYS);

  sessionCache.set(sessionKey, {
    cookies: cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
    })),
    localStorage,
    expiry: Date.now() + SESSION_TTL,
  });
}

async function dismissPopups(page: Page) {
  await page.evaluate(() => {
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
  pageBlocking.delete(page);

  await page.goto("https://www.blablalink.com/login?to=/shiftyspad/home", {
    waitUntil: "networkidle2",
    timeout: 20000,
  });

  try {
    await page.waitForSelector("#loginPwdForm_account", { timeout: 8000 });
  } catch {
    await new Promise((r) => setTimeout(r, 2000));
  }

  await dismissPopups(page);

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

  const emailInput = await page.$("#loginPwdForm_account");
  if (emailInput) {
    await emailInput.click({ clickCount: 3 });
    await emailInput.type(email, { delay: 30 });
  }

  const pwdInput = await page.$("#loginPwdForm_password");
  if (pwdInput) {
    await pwdInput.click({ clickCount: 3 });
    await pwdInput.type(password, { delay: 30 });
  }

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

  try {
    await page.waitForFunction(() => !window.location.href.includes("/login"), { timeout: 15000 });
  } catch {
    // fallback
  }

  await new Promise((r) => setTimeout(r, 1000));
  return !page.url().includes("/login");
}

async function scrapeUserData(page: Page, openId: string) {
  pageBlocking.add(page);

  const encodedId = encodeOpenId(openId);
  const targetUrl = `https://www.blablalink.com/shiftyspad/home?uid=${encodeURIComponent(encodedId)}&openid=${encodeURIComponent(encodedId)}`;

  await page.setExtraHTTPHeaders({ "Accept-Language": "ko-KR,ko;q=0.9" });
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20000 });

  try {
    await page.waitForSelector('[data-cname="UserGameInfo"], [data-cname="my-nikkes"]', { timeout: 12000 });
  } catch {
    await new Promise((r) => setTimeout(r, 2000));
  }

  await dismissPopups(page);

  await page.evaluate(() => {
    const expandBtn = document.querySelector(".expand-btn");
    if (expandBtn) (expandBtn as HTMLElement).click();
    window.scrollTo(0, document.body.scrollHeight);
  });
  await new Promise((r) => setTimeout(r, 1500));

  return page.evaluate(() => {
    const getText = (el: Element | null): string => el?.textContent?.trim() ?? "";

    const hasData = !!document.querySelector('[data-cname="UserGameInfo"]') ||
      !!document.querySelector('[data-cname="my-nikkes"]');

    if (!hasData) {
      return {
        error: "Data not loaded. Page might require login or the profile is private.",
        pageText: document.body?.innerText?.substring(0, 500),
      };
    }

    const profile: Record<string, string> = {};
    const userBaseInfo = document.querySelector('[data-cname="UserBaseInfo"], [data-cname="user-base-info"]');
    if (userBaseInfo) {
      const nameEl = userBaseInfo.querySelector("[class*='font-bold'], [class*='text-\\[18px\\]'], [class*='text-\\[16px\\]']");
      if (nameEl) profile.nickname = getText(nameEl);
      const levelEl = userBaseInfo.querySelector("[class*='bg-\\[\\#3EAFFF\\]'], [class*='bg-\\[var(--brand']");
      if (levelEl) profile.level = getText(levelEl);
    }
    const bodyText = document.body?.innerText || "";
    const uidMatch = bodyText.match(/UID[:\s]*(\d+)/i);
    if (uidMatch) profile.gameUid = uidMatch[1];
    const serverMatch = bodyText.match(/(Japan|Korea|Global|Asia|NA|SEA|EU)/i);
    if (serverMatch) profile.server = serverMatch[1];

    const userInfo: Record<string, string> = {};
    const statGrid = document.querySelector(".flex.flex-wrap");
    if (statGrid) {
      const cells = statGrid.querySelectorAll(":scope > div");
      cells.forEach((cell) => {
        const divs = Array.from(cell.querySelectorAll("div"));
        if (divs.length < 2) return;
        const label = getText(divs[divs.length - 1]);
        if (!label || label.length > 20) return;
        const badgeEl = cell.querySelector("[class*='bg-\\[var(--brand']");
        const badge = badgeEl ? getText(badgeEl) : "";
        const valueEl = cell.querySelector("[class*='DINNextLTProBold']");
        const value = valueEl ? getText(valueEl) : "";
        if (badge && label) {
          userInfo[`${label}(${badge})`] = value;
        } else if (label && value) {
          userInfo[label] = value;
        }
      });
    }

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

    let storageCapacity = "";
    const allLabels = document.querySelectorAll("div, span, p");
    for (const el of allLabels) {
      const t = el.textContent?.trim() || "";
      if ((t.includes("보관함") || t === "Storage") && t.length < 30 && el.children.length <= 1) {
        let section = el.parentElement;
        for (let k = 0; k < 5 && section; k++) {
          const pctEl = section.querySelector("[class*='DINNextLTProBold']");
          if (pctEl) {
            storageCapacity = getText(pctEl);
            break;
          }
          section = section.parentElement;
        }
        break;
      }
    }

    const union: Record<string, string> = {};
    const unionContainer = document.querySelector("[data-cname='UserGameInfo'] [class*='bg-team'], [data-cname='UserGameInfo'] [class*='min-h-\\[89px\\]']");
    if (unionContainer) {
      const nameEl = unionContainer.querySelector("[class*='font-bold'][class*='truncate'], [class*='text-\\[14px\\]']");
      if (nameEl) {
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
    const flexStats = document.querySelectorAll("[class*='flex-\\[5\\]'], [class*='flex-\\[6\\]']");
    flexStats.forEach(stat => {
      const labelEl = stat.querySelector("[class*='text-\\[8px\\]'], [class*='text-\\[length\\:8px\\]']");
      const valueEl = stat.querySelector("[class*='DINNextLTProBold']");
      if (labelEl && valueEl) {
        union[getText(labelEl)] = getText(valueEl);
      }
    });

    const raidMeta: Record<string, string> = {};
    const guildSection = document.querySelector("[guild_info]");
    if (guildSection) {
      const seasonEl = guildSection.querySelector("[class*='text-\\[10px\\]'] span, [class*='cursor-pointer'] span");
      if (seasonEl) raidMeta.season = getText(seasonEl);
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

    const bosses: Array<{ name: string; progress: string; damage: string; hp: string; imageUrl: string; elementIcon: string }> = [];
    const bossRows = document.querySelectorAll("[guild_info] .shadow-md");
    bossRows.forEach((row) => {
      const nameEl = row.querySelector("[class*='text-\\[16px\\]']");
      const progressEl = row.querySelector("[class*='text-\\[\\#FC6A37\\]']");
      const numSpans = row.querySelectorAll("[class*='text-\\[8px\\]']");
      const bgImg = row.querySelector("img[loading='lazy']") as HTMLImageElement | null;
      const iconImg = row.querySelector("img[src*='icon-code']") as HTMLImageElement | null;
      bosses.push({
        name: getText(nameEl),
        progress: getText(progressEl),
        damage: numSpans[0] ? getText(numSpans[0]) : "",
        hp: numSpans[1] ? getText(numSpans[1]) : "",
        imageUrl: bgImg?.src ?? "",
        elementIcon: iconImg?.src ?? "",
      });
    });

    return {
      profile,
      userInfo,
      topNikkes: topNikkes.slice(0, 10),
      dailyMission: { storageCapacity, missions },
      union,
      unionRaid: { ...raidMeta, bosses },
      fetchedAt: new Date().toISOString(),
    };
  });
}

// ===== 메인 스크래핑 함수 (로그인 + 스크래핑) =====
export async function scrapeWithLogin(openId: string, email: string, password: string) {
  const cacheKey = `${email}:${openId}`;
  const sessionKey = email;

  let browser: Browser | undefined;
  try {
    browser = await getBrowser();
    let page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    );
    await setupRequestInterception(page);

    // 1단계: 캐싱된 세션으로 바로 시도
    const hasSession = await restoreSession(page, sessionKey);
    if (hasSession) {
      const data = await scrapeUserData(page, openId);
      if (data && !("error" in data)) {
        dataCache.set(cacheKey, { data, updatedAt: Date.now() });
        return data;
      }
      sessionCache.delete(sessionKey);
      await page.close();
      page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844 });
      await page.setUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      );
      await setupRequestInterception(page);
    }

    // 2단계: 로그인
    const loggedIn = await loginWithPuppeteer(page, email, password);
    if (!loggedIn) {
      throw new Error("Login failed. Check credentials.");
    }

    await saveSession(page, sessionKey);

    // 3단계: 스크래핑
    const data = await scrapeUserData(page, openId);
    if (data && !("error" in data)) {
      dataCache.set(cacheKey, { data, updatedAt: Date.now() });
    }
    return data;
  } finally {
    if (browser) await browser.close();
  }
}

// ===== 등록된 모든 사용자 자동 갱신 =====
export async function refreshAllUsers() {
  if (isRefreshing) {
    console.log("[cron] Already refreshing, skip");
    return { skipped: true };
  }

  // 등록된 사용자가 없으면 환경변수 기본 계정으로 시도
  if (registeredUsers.size === 0) {
    const email = process.env.BLABLA_EMAIL || "";
    const password = process.env.BLABLA_PASSWORD || "";
    const openId = process.env.DEFAULT_OPENID || "";
    if (email && password && openId) {
      registeredUsers.set(openId, { openId, email, password });
    }
  }

  if (registeredUsers.size === 0) {
    return { refreshed: 0, message: "No registered users" };
  }

  isRefreshing = true;
  const results: Array<{ openId: string; success: boolean; error?: string }> = [];

  try {
    for (const [, user] of registeredUsers) {
      try {
        await scrapeWithLogin(user.openId, user.email, user.password);
        results.push({ openId: user.openId, success: true });
        console.log(`[cron] Refreshed: ${user.openId}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        results.push({ openId: user.openId, success: false, error: msg });
        console.error(`[cron] Failed: ${user.openId}`, msg);
      }
    }
  } finally {
    isRefreshing = false;
  }

  return { refreshed: results.length, results };
}
