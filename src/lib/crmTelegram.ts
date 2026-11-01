import { prisma } from "@/lib/prisma";
import { crmTelegramMode, sendCrmTelegram, sendTelegramTo, type TgMessage } from "@/lib/telegram";

export async function getCrmTelegramStatus() {
  const setting = await prisma.crmSetting.findUnique({
    where: { id: "default" },
    select: { tgBotToken: true, tgChatId: true },
  });
  const dedicated = !!(setting?.tgBotToken?.trim() && setting?.tgChatId?.trim());
  return {
    mode: dedicated ? "crm" as const : crmTelegramMode(),
    hasDedicated: dedicated,
    chatId: setting?.tgChatId || "",
  };
}

export async function sendConfiguredCrmTelegram(msg: string | TgMessage) {
  const setting = await prisma.crmSetting.findUnique({ where: { id: "default" } });
  if (setting?.tgBotToken?.trim() && setting?.tgChatId?.trim()) {
    return sendTelegramTo(setting.tgBotToken, setting.tgChatId, msg);
  }
  return sendCrmTelegram(msg);
}
