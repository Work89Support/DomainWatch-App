import test from "node:test";
import assert from "node:assert/strict";
import { downAlertMessage, networkDownMessage, networkRecoveredMessage, recoveredMessage } from "../src/lib/telegram";

const incidentId = "cmtest00000000abcdefgh";

test("down alert identifies the exact incident, company, room and reason", () => {
  const message = downAlertMessage({
    incidentId,
    company: "Example Co",
    room: "Main room",
    name: "Login",
    url: "https://example.com/login",
    category: "ทางเข้า",
    httpCode: 503,
    error: "HTTP 503",
    detectedAt: new Date("2026-08-15T00:00:00Z"),
    appBaseUrl: "https://watch.example.com",
  });

  assert.match(message.text, /#ABCDEFGH/);
  assert.match(message.text, /Example Co/);
  assert.match(message.text, /Main room/);
  assert.match(message.text, /HTTP 503/);
  assert.ok(
    message.buttons
      ?.flat()
      .some((button) => /incidents\?incident=cmtest00000000abcdefgh/.test(button.url))
  );
});

test("recovery alert keeps the same incident reference", () => {
  const message = recoveredMessage({
    incidentId,
    company: "Example Co",
    room: "Main room",
    name: "Login",
    url: "https://example.com/login",
    downMinutes: 3,
    responseMs: 1200,
    appBaseUrl: "https://watch.example.com",
  });

  assert.match(message.text, /#ABCDEFGH/);
  assert.match(message.text, /Main room/);
  assert.match(message.text, /ลิงก์กลับมาใช้งานได้แล้ว/);
  assert.doesNotMatch(message.text, /ยังโหลดช้า/);
  assert.ok(
    message.buttons
      ?.flat()
      .some((button) => /incidents\?incident=cmtest00000000abcdefgh/.test(button.url))
  );
});

test("slow recovery says the link is back but still slow", () => {
  const message = recoveredMessage({
    incidentId,
    company: "Example Co",
    room: "Main room",
    name: "Login",
    url: "https://example.com/login",
    downMinutes: 12,
    slow: true,
    responseMs: 6789,
    detail: "ตอบสำเร็จ แต่เกินเกณฑ์",
    appBaseUrl: "https://watch.example.com",
  });

  assert.match(message.text, /กลับมาใช้งานได้แล้ว — แต่ยังโหลดช้า/);
  assert.match(message.text, /6\.8 วินาที/);
  assert.match(message.text, /ระบบจะตรวจติดตามต่ออัตโนมัติ/);
});

test("mobile carrier outage message identifies TRUE and the exact room", () => {
  const message = networkDownMessage({
    incidentId,
    carrier: "TRUE",
    agentName: "TRUE Phone 1",
    company: "Example Co",
    room: "Room A",
    name: "Login",
    url: "https://example.com/login",
    error: "HTTP 503 จากเครือข่ายมือถือ",
    detectedAt: new Date("2026-08-26T00:00:00Z"),
    appBaseUrl: "https://watch.example.com",
  });
  assert.match(message.text, /TRUE เปิดลิงก์ไม่ได้/);
  assert.match(message.text, /Room A/);
  assert.match(message.text, /ยืนยันจากซิม 2 รอบ/);
});

test("mobile slow recovery is clearly reported", () => {
  const message = networkRecoveredMessage({
    incidentId,
    carrier: "TRUE",
    agentName: "TRUE Phone 1",
    company: "Example Co",
    room: "Room A",
    name: "Login",
    url: "https://example.com/login",
    downMinutes: 10,
    slow: true,
    responseMs: 7200,
    appBaseUrl: "https://watch.example.com",
  });
  assert.match(message.text, /กลับมาเปิดได้แล้ว — แต่ยังโหลดช้า/);
  assert.match(message.text, /7\.2 วินาที/);
});
