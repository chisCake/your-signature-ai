import type { Metadata } from "next";
import React from "react";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ThemeSwitcher } from '@/components/theme-switcher';
import { AuthButton } from '@/components/auth-button';
import Link from "next/link";
import { DashboardList } from '@/components/dashboard-list';
import "./globals.css";
import { ActionPageList } from '@/components/action-page-list';
import { ToastProvider } from '@/components/ui/toast';
import { ConfirmDialogProvider } from '@/components/ui/alert-dialog';

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Your Sign AI",
  description: "AI-powered signature recognition and analysis",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ToastProvider>
          <ConfirmDialogProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <header>
                <div className="border-b border-b-foreground/10">
                  {/* Стопка */}
                  <nav className="w-full flex flex-col justify-center max-w-5xl mx-auto ">
                    {/* Контейнер слева/справа */}
                    <div className="w-full flex justify-between items-center p-3 px-5 text-sm h-16 border-b border-b-foreground/10">
                      <div className="flex gap-5 items-center font-semibold">
                        <Link href={"/"}>Your Sign AI</Link>
                        <DashboardList />
                      </div>
                      <div className="flex gap-2 items-center">
                        <ThemeSwitcher />
                        <AuthButton />
                      </div>
                    </div>

                    <ActionPageList />
                  </nav>
                </div>
              </header>

              <main className="flex flex-col items-center"
                style={{ minHeight: "calc(100vh - 4rem - 4rem)" }}>
                {children}
              </main>

              <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 h-16">
                {/* TODO: Сделать реальные страницы */}
                <Link href={"/"}>Пользовательское соглашение</Link>
                <Link href={"/"}>Политика конфиденциальности</Link>
              </footer>
            </ThemeProvider>
          </ConfirmDialogProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
