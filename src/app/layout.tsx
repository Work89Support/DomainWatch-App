import type { Metadata } from "next";
import { Kanit } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import HelpGuide from "@/components/HelpGuide";
import { getCurrentUser } from "@/lib/auth";

const kanit = Kanit({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-kanit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DomainWatch — ระบบเฝ้าดูสถานะลิงก์",
  description: "ระบบบอทตรวจเช็คสถานะหน้าเว็บ/ลิงก์ พร้อม KPI และ Dashboard",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <html lang="th" className={kanit.variable}>
      <body className="font-sans">
        {user ? (
          <>
            <AppShell user={user}>{children}</AppShell>
            <HelpGuide />
          </>
        ) : (
          <main>{children}</main>
        )}
      </body>
    </html>
  );
}
