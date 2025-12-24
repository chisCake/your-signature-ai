import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Обзор пользователей | Your Sign AI',
  description: 'Просмотр и управление пользователями',
};

export default function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
