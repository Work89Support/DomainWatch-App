// เรียก LINE Messaging API ด้วย Channel Access Token ของแต่ละ OA
// ใช้ตรวจชื่อ/รูปโปรไฟล์ของ OA และดึงลิงก์จาก Rich Menu

const LINE_TIMEOUT_MS = 12000;

async function lineGet(path: string, token: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINE_TIMEOUT_MS);
  try {
    return await fetch(`https://api.line.me${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export type BotInfo = {
  displayName: string;
  userId: string;
  pictureUrl: string | null;
};

// ข้อมูลบอท (ชื่อ/รูป) — ถ้า token ใช้ไม่ได้จะโยน error
export async function getBotInfo(token: string): Promise<BotInfo> {
  const res = await lineGet("/v2/bot/info", token);
  if (res.status === 401 || res.status === 403) {
    throw new Error("TOKEN_INVALID");
  }
  if (!res.ok) {
    throw new Error(`LINE_HTTP_${res.status}`);
  }
  const j = (await res.json()) as {
    displayName?: string;
    userId?: string;
    pictureUrl?: string;
  };
  return {
    displayName: j.displayName || "",
    userId: j.userId || "",
    pictureUrl: j.pictureUrl || null,
  };
}

export type RichMenuLink = { label: string; url: string };

type LineAction = { type?: string; label?: string; uri?: string };
type LineArea = { action?: LineAction };
type LineRichMenu = { richMenuId?: string; areas?: LineArea[] };

function extractLinks(rm: LineRichMenu): RichMenuLink[] {
  const out: RichMenuLink[] = [];
  const seen = new Set<string>();
  for (const area of rm.areas || []) {
    const a = area.action;
    if (!a || (a.type || "").toLowerCase() !== "uri" || !a.uri) continue;
    const url = a.uri.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ label: (a.label || "").trim() || "ลิงก์", url });
  }
  return out;
}

// ดึงลิงก์จาก Rich Menu ของ OA — เลือก default ก่อน ถ้าไม่มีใช้เมนูแรกที่มีลิงก์
export async function getRichMenuLinks(token: string): Promise<RichMenuLink[]> {
  // 1) หา default rich menu id
  let defaultId: string | null = null;
  try {
    const res = await lineGet("/v2/bot/user/all/richmenu", token);
    if (res.ok) {
      const j = (await res.json()) as { richMenuId?: string };
      defaultId = j.richMenuId || null;
    }
  } catch {
    /* ไม่มี default ก็ไม่เป็นไร */
  }

  if (defaultId) {
    const res = await lineGet(`/v2/bot/richmenu/${defaultId}`, token);
    if (res.ok) {
      const rm = (await res.json()) as LineRichMenu;
      const links = extractLinks(rm);
      if (links.length) return links;
    }
  }

  // 2) เมนูแรกที่มีลิงก์
  const listRes = await lineGet("/v2/bot/richmenu/list", token);
  if (!listRes.ok) {
    if (listRes.status === 401 || listRes.status === 403) throw new Error("TOKEN_INVALID");
    throw new Error(`LINE_HTTP_${listRes.status}`);
  }
  const root = (await listRes.json()) as { richmenus?: LineRichMenu[] };
  for (const rm of root.richmenus || []) {
    const links = extractLinks(rm);
    if (links.length) return links;
  }
  return [];
}

export type OaCheck = {
  status: "OK" | "MISMATCH" | "NO_PICTURE" | "TOKEN_INVALID" | "ERROR";
  displayName: string | null;
  hasPicture: boolean | null;
  error: string | null;
};

// ตรวจ OA 1 ตัว: อ่าน bot info แล้วเทียบชื่อ/รูป
export async function checkOa(token: string, expectedName?: string | null): Promise<OaCheck> {
  try {
    const info = await getBotInfo(token);
    const hasPicture = !!info.pictureUrl;
    if (expectedName && expectedName.trim() && info.displayName.trim() !== expectedName.trim()) {
      return { status: "MISMATCH", displayName: info.displayName, hasPicture, error: null };
    }
    if (!hasPicture) {
      return { status: "NO_PICTURE", displayName: info.displayName, hasPicture, error: null };
    }
    return { status: "OK", displayName: info.displayName, hasPicture, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "TOKEN_INVALID") {
      return { status: "TOKEN_INVALID", displayName: null, hasPicture: null, error: "token ใช้ไม่ได้ (OA อาจถูกปิด/แบน)" };
    }
    return { status: "ERROR", displayName: null, hasPicture: null, error: msg };
  }
}
