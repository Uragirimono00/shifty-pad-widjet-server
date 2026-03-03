import { NextRequest, NextResponse } from "next/server";
import puppeteer, { Browser, Page } from "puppeteer-core";
import chromium from "@sparticuz/chromium-min";

export const maxDuration = 60;

// In-memory cookie cache (resets on cold start)
let cachedCookies: Array<{ name: string; value: string; domain: string; path: string }> = [];
let cookieExpiry = 0;

function encodeOpenId(openId: string): string {
  const raw = `29080-${openId}`;
  return Buffer.from(raw).toString("base64");
}

async function getBrowser(): Promise<Browser> {
  if (process.env.NODE_ENV === "development") {
    return puppeteer.launch({
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 390, height: 844 },
    executablePath: await chromium.executablePath(
      "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar"
    ),
    headless: true,
  });
}

async function dismissPopups(page: Page) {
  // Accept cookies
  await page.evaluate(() => {
    const buttons = document.querySelectorAll("button");
    for (const btn of buttons) {
      if (btn.textContent?.includes("Accept all optional")) {
        (btn as HTMLElement).click();
        return;
      }
    }
  });
  await new Promise((r) => setTimeout(r, 500));

  // Dismiss note popup
  await page.evaluate(() => {
    const els = document.querySelectorAll("a, button, div");
    for (const el of els) {
      if (el.textContent?.trim() === "Confirm" && el.closest("[class*='note'], [class*='popup'], [class*='modal']")) {
        (el as HTMLElement).click();
        return;
      }
    }
  });
  await new Promise((r) => setTimeout(r, 500));
}

async function loginWithPuppeteer(page: Page, email: string, password: string): Promise<boolean> {
  // Navigate to login page
  await page.goto("https://www.blablalink.com/login?to=/shiftyspad/home", {
    waitUntil: "networkidle2",
    timeout: 20000,
  });
  await new Promise((r) => setTimeout(r, 3000));

  // Dismiss any popups
  await dismissPopups(page);

  // Select region if needed (click the region selector)
  await page.evaluate(() => {
    const els = document.querySelectorAll("*");
    for (const el of els) {
      if (el.textContent?.trim() === "JP/KR/NA/SEA/Global" && el.children.length <= 2) {
        (el as HTMLElement).click();
        return;
      }
    }
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Switch to password login tab if needed
  await page.evaluate(() => {
    const els = document.querySelectorAll("*");
    for (const el of els) {
      const text = el.textContent?.trim();
      if (text === "Password login" && el.children.length === 0) {
        (el as HTMLElement).click();
        return;
      }
    }
  });
  await new Promise((r) => setTimeout(r, 500));

  // Fill email
  const emailInput = await page.$("#loginPwdForm_account");
  if (emailInput) {
    await emailInput.click({ clickCount: 3 }); // Select all
    await emailInput.type(email, { delay: 50 });
  }

  // Fill password
  const pwdInput = await page.$("#loginPwdForm_password");
  if (pwdInput) {
    await pwdInput.click({ clickCount: 3 });
    await pwdInput.type(password, { delay: 50 });
  }

  // Click login button
  await page.evaluate(() => {
    const buttons = document.querySelectorAll("button, div[class*='btn'], span");
    for (const btn of buttons) {
      const text = btn.textContent?.trim();
      if (text === "Log in" && btn.closest("form, [class*='login']")) {
        (btn as HTMLElement).click();
        return;
      }
    }
    // Fallback: find any "Log in" button
    for (const btn of buttons) {
      if (btn.textContent?.trim() === "Log in") {
        (btn as HTMLElement).click();
        return;
      }
    }
  });

  // Wait for login to complete (redirect)
  try {
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 });
  } catch {
    // Navigation might already have happened
  }

  await new Promise((r) => setTimeout(r, 3000));

  // Check if login succeeded
  const currentUrl = page.url();
  const isLoggedIn = !currentUrl.includes("/login");

  return isLoggedIn;
}

async function scrapeUserData(page: Page, openId: string) {
  const encodedId = encodeOpenId(openId);
  const targetUrl = `https://www.blablalink.com/shiftyspad/home?uid=${encodeURIComponent(encodedId)}&openid=${encodeURIComponent(encodedId)}`;

  // Set Korean language
  await page.setExtraHTTPHeaders({ "Accept-Language": "ko-KR,ko;q=0.9" });

  await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 5000));

  // Dismiss popups
  await dismissPopups(page);

  // Wait for content
  try {
    await page.waitForSelector('[data-cname="UserGameInfo"]', { timeout: 10000 });
  } catch {
    await new Promise((r) => setTimeout(r, 5000));
  }

  // Expand the user info section (click the expand arrow if collapsed)
  await page.evaluate(() => {
    const expandBtn = document.querySelector(".expand-btn");
    if (expandBtn) (expandBtn as HTMLElement).click();
  });
  await new Promise((r) => setTimeout(r, 1000));

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

  let browser: Browser | undefined;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    );

    // Set cached cookies if available
    if (cachedCookies.length > 0 && Date.now() < cookieExpiry) {
      await page.setCookie(...cachedCookies.map(c => ({
        ...c,
        secure: true,
        sameSite: "None" as const,
      })));

      // Try to load the page directly with cached cookies
      const data = await scrapeUserData(page, openId);
      if (data && !("error" in data)) {
        return NextResponse.json({ success: true, openId, data });
      }
    }

    // Login required
    const loggedIn = await loginWithPuppeteer(page, email, password);
    if (!loggedIn) {
      return NextResponse.json({
        success: false,
        error: "Login failed. Check credentials.",
        currentUrl: page.url(),
      }, { status: 401 });
    }

    // Cache cookies for 1 hour
    const cookies = await page.cookies();
    cachedCookies = cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
    }));
    cookieExpiry = Date.now() + 60 * 60 * 1000;

    // Now scrape the data
    const data = await scrapeUserData(page, openId);

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
