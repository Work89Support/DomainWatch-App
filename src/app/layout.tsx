import type { Metadata } from "next";
import { Kanit } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
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
          <div className="flex min-h-screen">
            <Sidebar role={user.role} />
            <div className="flex-1 min-w-0 flex flex-col">
              <Topbar user={user} />
              <main className="flex-1 min-w-0">{children}</main>
            </div>
          </div>
        ) : (
          <main>{children}</main>
        )}
      </body>
    </html>
  );
}
