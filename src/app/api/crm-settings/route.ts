import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canEditCrmLinks } from "@/lib/permissions";
import { crmTelegramMode } from "@/lib/telegram";

export async function PATCH(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canEditCrmLinks(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const existing = await prisma.crmSetting.findUnique({ where: { id: "default" } });
  const clear = body.clear === true;
  const token = clear ? null : (String(body.tgBotToken || "").trim() || existing?.tgBotToken || null);
  const chatId = clear ? null : (String(body.tgChatId || "").trim() || null);
  if (!clear && (!token || !chatId)) {
    return NextResponse.json({ error: "กรุณากรอก Bot Token และ Chat ID" }, { status: 400 });
  }
  await prisma.crmSetting.upsert({
    where: { id: "default" },
    create: { id: "default", tgBotToken: token, tgChatId: chatId },
    update: { tgBotToken: token, tgChatId: chatId },
  });
  return NextResponse.json({
    ok: true,
    configured: !!(token && chatId),
    chatId: chatId || "",
    mode: token && chatId ? "crm" : crmTelegramMode(),
  });
}
