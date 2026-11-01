import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const initialLinks = [
  ["3XBET", "https://urlio.co/3XBET"],
  ["MCC888", "https://urlio.co/mcc888"],
  ["McLaren9", "https://urlio.co/mclaren9"],
  ["Urus99", "https://urlio.co/urus99"],
  ["Porsche88", "https://urlio.co/porsche88"],
  ["Ferrari8", "https://urlio.co/ferrari8"],
  ["SKOL888", "https://urlio.co/skol888"],
  ["Aston4", "https://urlio.co/aston4"],
  ["UFABET7M", "https://urlio.co/ufabet7m"],
] as const;

async function main() {
  const result = await prisma.crmLink.createMany({
    data: initialLinks.map(([name, url]) => ({
      name,
      url,
      note: "ลิงก์ส่ง SMS",
    })),
    skipDuplicates: true,
  });
  console.log(`CRM links ready: added ${result.count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
