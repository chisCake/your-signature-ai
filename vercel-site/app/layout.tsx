import type { Metadata, Viewport } from 'next';
import React from 'react';
import { Geist } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { AuthButton } from '@/components/auth-button';
import Link from 'next/link';
import { DashboardList } from '@/components/dashboard-list';
import './globals.css';
import { ActionPageList } from '@/components/action-page-list';
import { ToastProvider } from '@/components/ui/toast';
import { ConfirmDialogProvider } from '@/components/ui/alert-dialog';
import { MobileNavigation } from '@/components/mobile-navigation';
import { Github } from 'lucide-react';

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: 'Your Sign AI',
  description: 'AI-powered signature recognition and analysis',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const geistSans = Geist({
  variable: '--font-geist-sans',
  display: 'swap',
  subsets: ['latin'],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ToastProvider>
          <ConfirmDialogProvider>
            <ThemeProvider
              attribute='class'
              defaultTheme='system'
              enableSystem
              disableTransitionOnChange
            >
              <div className='min-h-screen flex flex-col'>
                {/* Мобильно-оптимизированный хедер */}
                <header className='sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-b-foreground/10'>
                  <div className='container mx-auto px-4 py-2 sm:px-6 lg:px-8'>
                    {/* Основная навигация */}
                    <nav className='flex items-center justify-between h-12'>
                      {/* Логотип */}
                      <div className='flex items-center h-full'>
                        <Link
                          href='/'
                          className='text-lg font-bold text-foreground hover:text-primary transition-colors flex items-center h-full'
                        >
                          Your Sign AI
                        </Link>
                      </div>

                      {/* Десктопная навигация */}
                      <div className='hidden lg:flex items-center space-x-6'>
                        <DashboardList />
                        <div className='flex items-center space-x-2'>
                          <ThemeSwitcher />
                          <AuthButton />
                        </div>
                      </div>

                      {/* Мобильная навигация */}
                      <div className='lg:hidden'>
                        <MobileNavigation />
                      </div>
                    </nav>

                    {/* Дополнительная навигация для модераторов (десктоп) */}
                    <div className='hidden lg:block'>
                      <ActionPageList />
                    </div>
                  </div>
                </header>

                {/* Основной контент */}
                <main className='flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-6'>
                  {children}
                </main>

                {/* Мобильно-оптимизированный футер */}
                <footer className='border-t border-t-foreground/10 bg-muted/30'>
                  <div className='container mx-auto px-4 sm:px-6 lg:px-8 py-6'>
                    <div className='flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground'>
                      {/* Лево */}
                      <div className='flex flex-col sm:flex-row items-center gap-2'>
                        <Link
                          href='/'
                          className='flex items-center h-full hover:text-foreground transition-colors'
                        >
                          Пользовательское соглашение
                        </Link>
                        <Link
                          href='/'
                          className='flex items-center h-full hover:text-foreground transition-colors'
                        >
                          Политика конфиденциальности
                        </Link>
                      </div>
                      {/* Право */}
                      <div>
                        <Link
                          href='https://github.com/chisCake/your-signature-ai'
                          className='flex items-center gap-2 hover:text-foreground transition-colors'
                        >
                          <Github /> chisCake
                        </Link>
                      </div>
                    </div>
                  </div>
                </footer>
              </div>
            </ThemeProvider>
          </ConfirmDialogProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
