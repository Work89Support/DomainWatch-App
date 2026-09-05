import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
async function main() {
  let count = 0;
  for (const source of ["SYSTEM", "MOBILE"] as const) {
    let cursor: string | undefined;
    for (;;) {
      const args = { take: 100, orderBy: { id: "asc" as const }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), include: { link: { include: { company: true } } } };
      const rows = source === "SYSTEM" ? await db.incident.findMany(args) : await db.networkIncident.findMany(args);
      if (!rows.length) break;
      for (const row of rows) {
        if (await db.caseActivity.findFirst({ where: { source, caseId: row.id }, select: { id: true } })) continue;
        await db.caseActivity.upsert({ where: { id: `legacy:${source}:${row.id}` }, update: {}, create: {
          id: `legacy:${source}:${row.id}`, source, caseId: row.id, companyId: row.link.companyId,
          companyName: row.link.company.name, linkName: row.link.name, url: row.link.url,
          action: "LEGACY_SNAPSHOT", actorName: "ระบบเก็บข้อมูลย้อนหลัง", note: "สำเนาข้อมูลเดิม ณ วันเปิดใช้ประวัติละเอียด ไม่ใช่การดำเนินการใหม่ และ URL เป็นค่าที่มีขณะเก็บสำเนา",
          details: JSON.parse(JSON.stringify({ status: row.status, detectedAt: row.detectedAt, adminAckAt: row.adminAckAt, adminUpdatedAt: row.adminUpdatedAt, resolvedAt: row.resolvedAt, adminUserId: row.adminUserId })),
        } });
        count++;
      }
      cursor = rows[rows.length - 1].id;
    }
  }
  console.log(`Case history snapshots checked: ${count}`);
}
main().finally(() => db.$disconnect());
