import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Обзор подписей | Your Sign AI',
  description: 'Просмотр и управление подписями',
};

export default function SignaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
