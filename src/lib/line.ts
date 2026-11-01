// เรียก LINE Messaging API ด้วย Channel Access Token ของแต่ละ OA
// ใช้ตรวจชื่อ/รูปโปรไฟล์ของ OA และดึงลิงก์จาก Rich Menu

const LINE_TIMEOUT_MS = 12000;

async function lineRequest(
  path: string,
  token: string,
  init: RequestInit = {},
  dataApi = false
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINE_TIMEOUT_MS);
  try {
    return await fetch(`${dataApi ? "https://api-data.line.me" : "https://api.line.me"}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function lineGet(path: string, token: string): Promise<Response> {
  return lineRequest(path, token);
}

export type BotInfo = {
  displayName: string;
  userId: string;
  basicId: string;
  premiumId: string | null;
  pictureUrl: string | null;
  chatMode: string | null;
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
    basicId?: string;
    premiumId?: string;
    pictureUrl?: string;
    chatMode?: string;
  };
  return {
    displayName: j.displayName || "",
    userId: j.userId || "",
    basicId: j.basicId || "",
    premiumId: j.premiumId || null,
    pictureUrl: j.pictureUrl || null,
    chatMode: j.chatMode || null,
  };
}

export type RichMenuLink = { label: string; url: string };

export type DefaultRichMenuInspection = {
  status: "READY" | "OA_MANAGER" | "NO_DEFAULT" | "NO_URI";
  richMenuId: string | null;
  links: RichMenuLink[];
  note: string;
};

type LineAction = { type?: string; label?: string; uri?: string };
type LineArea = { action?: LineAction };
type LineRichMenu = { richMenuId?: string; areas?: LineArea[] };

export type RichMenuDraftConfig = {
  size: { width: number; height: number };
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: Array<{
    bounds: { x: number; y: number; width: number; height: number };
    action: { type: "uri"; label: string; uri: string };
  }>;
};

async function lineError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({})) as { message?: string; details?: Array<{ message?: string }> };
  const detail = body.details?.map((d) => d.message).filter(Boolean).join(", ");
  return detail || body.message || `LINE_HTTP_${res.status}`;
}

export async function validateRichMenuDraft(token: string, config: RichMenuDraftConfig): Promise<void> {
  const res = await lineRequest("/v2/bot/richmenu/validate", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (res.status === 401 || res.status === 403) throw new Error("TOKEN_INVALID");
  if (!res.ok) throw new Error(await lineError(res));
}

// สร้าง Rich Menu + อัปโหลดรูป แต่ยังไม่ผูกเป็น default จึงยังไม่กระทบลูกค้า
export async function createRichMenuDraft(
  token: string,
  config: RichMenuDraftConfig,
  image: Uint8Array,
  contentType: "image/png" | "image/jpeg"
): Promise<string> {
  await validateRichMenuDraft(token, config);
  const createRes = await lineRequest("/v2/bot/richmenu", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (createRes.status === 401 || createRes.status === 403) throw new Error("TOKEN_INVALID");
  if (!createRes.ok) throw new Error(await lineError(createRes));
  const created = await createRes.json() as { richMenuId?: string };
  const richMenuId = (created.richMenuId || "").trim();
  if (!richMenuId) throw new Error("LINE ไม่ส่ง richMenuId กลับมา");

  const uploadRes = await lineRequest(`/v2/bot/richmenu/${richMenuId}/content`, token, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: Buffer.from(image),
  }, true);
  if (!uploadRes.ok) {
    // ลบ object ที่เพิ่งสร้างในคำสั่งนี้ เพื่อไม่ทิ้ง draft ที่ไม่มีรูปค้างใน LINE
    await lineRequest(`/v2/bot/richmenu/${richMenuId}`, token, { method: "DELETE" }).catch(() => undefined);
    throw new Error(await lineError(uploadRes));
  }
  return richMenuId;
}

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

// ตรวจเฉพาะ default rich menu ที่ Messaging API มองเห็น
// LINE ไม่เปิดรายละเอียดของ rich menu ที่สร้างด้วย OA Manager ผ่าน API
export async function inspectDefaultRichMenu(token: string): Promise<DefaultRichMenuInspection> {
  const defaultRes = await lineGet("/v2/bot/user/all/richmenu", token);
  if (defaultRes.status === 401) throw new Error("TOKEN_INVALID");
  if (defaultRes.status === 403) {
    return {
      status: "OA_MANAGER",
      richMenuId: null,
      links: [],
      note: "LINE ไม่เปิดรายละเอียดเมนูนี้ผ่าน Messaging API — เมนูอาจถูกตั้งจาก LINE OA Manager",
    };
  }
  if (defaultRes.status === 404) {
    return {
      status: "NO_DEFAULT",
      richMenuId: null,
      links: [],
      note: "ยังไม่มี Default Rich Menu ที่ตั้งด้วย Messaging API",
    };
  }
  if (!defaultRes.ok) throw new Error(`LINE_HTTP_${defaultRes.status}`);

  const defaultJson = (await defaultRes.json()) as { richMenuId?: string };
  const richMenuId = (defaultJson.richMenuId || "").trim();
  if (!richMenuId) throw new Error("RICH_MENU_ID_MISSING");

  const menuRes = await lineGet(`/v2/bot/richmenu/${richMenuId}`, token);
  if (menuRes.status === 401 || menuRes.status === 403) throw new Error("TOKEN_INVALID");
  if (!menuRes.ok) throw new Error(`LINE_HTTP_${menuRes.status}`);
  const menu = (await menuRes.json()) as LineRichMenu;
  const links = extractLinks(menu);
  return {
    status: links.length ? "READY" : "NO_URI",
    richMenuId,
    links,
    note: links.length
      ? `อ่าน Default Rich Menu จาก Messaging API ได้ ${links.length} ลิงก์`
      : "พบ Default Rich Menu แต่ไม่มีปุ่มชนิด URL ให้ตรวจเทียบ",
  };
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
  status: "OK" | "MISMATCH" | "NO_PICTURE" | "TOKEN_INVALID" | "IDENTITY_MISMATCH" | "ERROR";
  displayName: string | null;
  userId: string | null;
  basicId: string | null;
  premiumId: string | null;
  chatMode: string | null;
  hasPicture: boolean | null;
  error: string | null;
};

// Bot userId เป็นตัวตนคงที่ของ LINE OA และปลอดภัยกว่าการเทียบชื่อที่เปลี่ยนได้
// เมื่อมี baseline แล้ว ห้ามเขียนทับอัตโนมัติหาก token ชี้ไปคนละ OA
export function enforceOaIdentityBaseline(
  result: OaCheck,
  baselineUserId?: string | null
): OaCheck {
  const baseline = (baselineUserId || "").trim();
  const observed = (result.userId || "").trim();
  if (!baseline || !observed || baseline === observed) return result;
  return {
    ...result,
    status: "IDENTITY_MISMATCH",
    error: "Bot userId ไม่ตรงกับข้อมูลอ้างอิง — token อาจเป็นของคนละ LINE OA ระบบยังไม่เขียนทับตัวตนเดิม",
  };
}

// ตรวจ OA 1 ตัว: อ่าน bot info แล้วเทียบชื่อ/รูป
export async function checkOa(token: string, expectedName?: string | null): Promise<OaCheck> {
  try {
    const info = await getBotInfo(token);
    const hasPicture = !!info.pictureUrl;
    if (expectedName && expectedName.trim() && info.displayName.trim() !== expectedName.trim()) {
      return { status: "MISMATCH", displayName: info.displayName, userId: info.userId, basicId: info.basicId, premiumId: info.premiumId, chatMode: info.chatMode, hasPicture, error: null };
    }
    if (!hasPicture) {
      return { status: "NO_PICTURE", displayName: info.displayName, userId: info.userId, basicId: info.basicId, premiumId: info.premiumId, chatMode: info.chatMode, hasPicture, error: null };
    }
    return { status: "OK", displayName: info.displayName, userId: info.userId, basicId: info.basicId, premiumId: info.premiumId, chatMode: info.chatMode, hasPicture, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "TOKEN_INVALID") {
      return { status: "TOKEN_INVALID", displayName: null, userId: null, basicId: null, premiumId: null, chatMode: null, hasPicture: null, error: "token ใช้ไม่ได้ — ยังสรุปไม่ได้ว่า OA ถูกระงับ" };
    }
    return { status: "ERROR", displayName: null, userId: null, basicId: null, premiumId: null, chatMode: null, hasPicture: null, error: msg };
  }
}
