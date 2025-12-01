import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Нейронная сеть | Your Sign AI',
  description: 'Информация о модели нейронной сети и исходный код',
};

export default function NeuralNetworkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
