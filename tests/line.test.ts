import assert from "node:assert/strict";
import test from "node:test";
import { checkOa, getBotInfo, getRichMenuLinks } from "../src/lib/line";

const originalFetch = global.fetch;

test.afterEach(() => {
  global.fetch = originalFetch;
});

test("getBotInfo returns Basic ID and treats omitted Premium ID as none", async () => {
  global.fetch = async () =>
    new Response(
      JSON.stringify({
        displayName: "MR9 SUPPORT",
        userId: "U123",
        basicId: "@123basic",
        pictureUrl: "https://example.com/picture.jpg",
        chatMode: "bot",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  const info = await getBotInfo("test-token");
  assert.deepEqual(info, {
    displayName: "MR9 SUPPORT",
    userId: "U123",
    basicId: "@123basic",
    premiumId: null,
    pictureUrl: "https://example.com/picture.jpg",
    chatMode: "bot",
  });
});

test("checkOa exposes identity fields during a dry-run-compatible check", async () => {
  global.fetch = async () =>
    new Response(
      JSON.stringify({
        displayName: "MR9 SUPPORT",
        userId: "U123",
        basicId: "@123basic",
        premiumId: "@mr9support",
        pictureUrl: "https://example.com/picture.jpg",
        chatMode: "chat",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  const result = await checkOa("test-token", "MR9 SUPPORT");
  assert.equal(result.status, "OK");
  assert.equal(result.userId, "U123");
  assert.equal(result.basicId, "@123basic");
  assert.equal(result.premiumId, "@mr9support");
  assert.equal(result.chatMode, "chat");
});

test("invalid token is not reported as proof that the OA is banned", async () => {
  global.fetch = async () => new Response(null, { status: 401 });

  const result = await checkOa("invalid-token", "MR9 SUPPORT");
  assert.equal(result.status, "TOKEN_INVALID");
  assert.match(result.error || "", /ยังสรุปไม่ได้ว่า OA ถูกระงับ/);
});

test("getRichMenuLinks reads URI actions from the default API rich menu", async () => {
  global.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/v2/bot/user/all/richmenu")) {
      return new Response(JSON.stringify({ richMenuId: "richmenu-1" }), { status: 200 });
    }
    if (url.endsWith("/v2/bot/richmenu/richmenu-1")) {
      return new Response(
        JSON.stringify({
          richMenuId: "richmenu-1",
          areas: [
            { action: { type: "uri", label: "ทางเข้า", uri: "https://example.com/login" } },
            { action: { type: "message", label: "ข้อความ" } },
          ],
        }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ richmenus: [] }), { status: 200 });
  };

  const links = await getRichMenuLinks("test-token");
  assert.deepEqual(links, [{ label: "ทางเข้า", url: "https://example.com/login" }]);
});
