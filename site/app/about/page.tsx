import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { FileText, Shield, Brain } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Информация | Your Sign AI',
  description: 'Информационные страницы Your Sign AI',
};

export default function AboutPage() {
  const pages = [
    {
      href: '/about/terms',
      title: 'Пользовательское соглашение',
      icon: FileText,
      description: 'Условия использования сервиса',
    },
    {
      href: '/about/privacy',
      title: 'Политика конфиденциальности',
      icon: Shield,
      description: 'Как мы обрабатываем ваши данные',
    },
    {
      href: '/about/neuralnetwork',
      title: 'Нейронная сеть',
      icon: Brain,
      description: 'Информация о модели и исходный код',
    },
  ];

  return (
    <div className='w-full max-w-2xl mx-auto'>
      <h1 className='text-3xl font-bold mb-8'>Информация</h1>
      <div className='flex flex-col gap-4'>
        {pages.map(page => {
          const Icon = page.icon;
          return (
            <Button
              key={page.href}
              asChild
              variant='outline'
              size='lg'
              className='w-full justify-start h-auto py-4 px-6'
            >
              <Link href={page.href} className='flex items-center gap-4'>
                <Icon size={24} className='shrink-0' />
                <div className='flex flex-col items-start text-left'>
                  <span className='font-semibold'>{page.title}</span>
                  <span className='text-sm text-muted-foreground font-normal'>
                    {page.description}
                  </span>
                </div>
              </Link>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
