'use client';

import { DashboardSection } from '@/components/dashboard/dashboard-section';
import { SignatureList } from '@/components/signature/signature-list';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { usePageTitle } from '@/lib/hooks/use-page-title';
import { createBrowserClient } from '@/lib/supabase/client';
import {
  getForgedSignatures,
  getForgedSignaturesAmount,
  getGenuineSignatures,
  getGenuineSignaturesAmount,
  getInputTypeStats,
  getPseudousers,
  getUsers,
} from '@/lib/supabase/queries';
import { mapToSignature, Signature } from '@/lib/types';
import {
  formatSignatureDate,
  getShortSignatureId,
} from '@/lib/utils/signature-utils';
import {
  ArrowRight,
  FileSignature,
  Hand,
  LoaderCircle,
  MousePointer,
  PenTool,
  Signature as SignatureIcon,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface StatsData {
  totalGenuine: number;
  totalForged: number;
  genuineToday: number;
  forgedToday: number;
  genuineThisWeek: number;
  forgedThisWeek: number;
  totalUsers: number;
  totalPseudousers: number;
  usersToday: number;
  usersThisWeek: number;
  inputTypeStats: {
    mouse: number;
    touch: number;
    pen: number;
  };
}

export default function ModDashboard() {
  usePageTitle({ title: 'Панель модератора' });

  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentSignatures, setRecentSignatures] = useState<Signature[]>([]);
  const [recentSignaturesLoading, setRecentSignaturesLoading] = useState(true);

  const client = createBrowserClient();

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);

      // Получаем общие количества
      const [
        totalGenuine,
        totalForged,
        genuineToday,
        forgedToday,
        genuineThisWeek,
        forgedThisWeek,
        allUsers,
        allPseudousers,
      ] = await Promise.all([
        getGenuineSignaturesAmount(client),
        getForgedSignaturesAmount(client),
        getGenuineSignaturesAmount(client, todayStart, now),
        getForgedSignaturesAmount(client, todayStart, now),
        getGenuineSignaturesAmount(client, weekStart, now),
        getForgedSignaturesAmount(client, weekStart, now),
        getUsers(client),
        getPseudousers(client),
      ]);

      // Подсчитываем пользователей за период
      const usersToday = allUsers.filter(
        u => new Date(u.created_at) >= todayStart
      ).length;
      const usersThisWeek = allUsers.filter(
        u => new Date(u.created_at) >= weekStart
      ).length;

      // Получаем статистику по типам ввода через оптимизированную RPC функцию
      const inputTypeStats = await getInputTypeStats(client);

      setStats({
        totalGenuine,
        totalForged,
        genuineToday,
        forgedToday,
        genuineThisWeek,
        forgedThisWeek,
        totalUsers: allUsers.length,
        totalPseudousers: allPseudousers.length,
        usersToday,
        usersThisWeek,
        inputTypeStats,
      });
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [client]);

  const loadRecentSignatures = useCallback(async () => {
    try {
      setRecentSignaturesLoading(true);
      const [genuine, forged] = await Promise.all([
        getGenuineSignatures(client, 4, 0),
        getForgedSignatures(client, 4, 0),
      ]);

      const allSignatures: Signature[] = [
        ...genuine.map(mapToSignature),
        ...forged.map(mapToSignature),
      ]
        .sort(
          (a, b) =>
            new Date(b.data.created_at).getTime() -
            new Date(a.data.created_at).getTime()
        )
        .slice(0, 8);

      setRecentSignatures(allSignatures);
    } catch (error) {
      console.error('Ошибка загрузки последних подписей:', error);
    } finally {
      setRecentSignaturesLoading(false);
    }
  }, [client]);

  useEffect(() => {
    loadStats();
    loadRecentSignatures();
  }, [loadStats, loadRecentSignatures]);

  const previewFields = [
    {
      key: 'id',
      label: 'ID',
      getValue: (signature: Signature) => getShortSignatureId(signature),
    },
    {
      key: 'created_at',
      label: 'Создана',
      getValue: (signature: Signature) => formatSignatureDate(signature),
    },
  ];

  return (
    <div className='w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6'>
      {/* Заголовок */}
      <div className='text-center mb-6'>
        <h1 className='text-2xl sm:text-3xl font-bold mb-2'>
          Панель модератора
        </h1>
        <p className='text-sm sm:text-base text-muted-foreground'>
          Обзор системы и управление подписями
        </p>
      </div>

      {/* Быстрые ссылки */}
      <DashboardSection title='Быстрые ссылки'>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <Card className='hover:shadow-md transition-shadow flex flex-col justify-between'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <FileSignature className='h-5 w-5' />
                Подписи
              </CardTitle>
              <CardDescription>
                Просмотр и управление всеми подписями
              </CardDescription>
            </CardHeader>
            <CardContent className='flex'>
              <Button asChild className='w-full' variant='outline'>
                <Link href='/signatures' className='flex items-center gap-2'>
                  Перейти
                  <ArrowRight className='h-4 w-4' />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className='hover:shadow-md transition-shadow flex flex-col justify-between'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Users className='h-5 w-5' />
                Пользователи
              </CardTitle>
              <CardDescription>
                Управление пользователями и псевдопользователями
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className='w-full' variant='outline'>
                <Link href='/users' className='flex items-center gap-2'>
                  Перейти
                  <ArrowRight className='h-4 w-4' />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className='hover:shadow-md transition-shadow flex flex-col justify-between'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <SignatureIcon className='h-5 w-5' />
                Контроллируемое добавление
              </CardTitle>
              <CardDescription>
                Добавление подписей от имени пользователей
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className='w-full' variant='outline'>
                <Link
                  href='/controlled-signature-addition'
                  className='flex items-center gap-2'
                >
                  Перейти
                  <ArrowRight className='h-4 w-4' />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardSection>

      {/* Статистика по подписям */}
      <DashboardSection title='Статистика по подписям'>
        {statsLoading ? (
          <div className='flex items-center justify-center py-8'>
            <LoaderCircle className='h-6 w-6 animate-spin text-muted-foreground' />
          </div>
        ) : stats ? (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm font-medium text-muted-foreground'>
                  Всего настоящих
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{stats.totalGenuine}</div>
                <div className='text-xs text-muted-foreground mt-1'>
                  За сегодня: {stats.genuineToday} | За неделю:{' '}
                  {stats.genuineThisWeek}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm font-medium text-muted-foreground'>
                  Всего поддельных
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{stats.totalForged}</div>
                <div className='text-xs text-muted-foreground mt-1'>
                  За сегодня: {stats.forgedToday} | За неделю:{' '}
                  {stats.forgedThisWeek}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm font-medium text-muted-foreground flex items-center gap-2'>
                  <MousePointer className='h-4 w-4' />
                  Мышь
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>
                  {stats.inputTypeStats.mouse}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm font-medium text-muted-foreground flex items-center gap-2'>
                  <Hand className='h-4 w-4' />
                  Сенсор
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>
                  {stats.inputTypeStats.touch}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm font-medium text-muted-foreground flex items-center gap-2'>
                  <PenTool className='h-4 w-4' />
                  Перо
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>
                  {stats.inputTypeStats.pen}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className='text-center py-8 text-muted-foreground'>
            Ошибка загрузки статистики
          </div>
        )}
      </DashboardSection>

      {/* Статистика по пользователям */}
      <DashboardSection title='Статистика по пользователям'>
        {statsLoading ? (
          <div className='flex items-center justify-center py-8'>
            <LoaderCircle className='h-6 w-6 animate-spin text-muted-foreground' />
          </div>
        ) : stats ? (
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm font-medium text-muted-foreground'>
                  Всего пользователей
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{stats.totalUsers}</div>
                <div className='text-xs text-muted-foreground mt-1'>
                  За сегодня: {stats.usersToday} | За неделю:{' '}
                  {stats.usersThisWeek}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm font-medium text-muted-foreground'>
                  Псевдопользователей
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>
                  {stats.totalPseudousers}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm font-medium text-muted-foreground'>
                  Всего пользователей
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>
                  {stats.totalUsers + stats.totalPseudousers}
                </div>
                <div className='text-xs text-muted-foreground mt-1'>
                  Пользователи + Псевдопользователи
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className='text-center py-8 text-muted-foreground'>
            Ошибка загрузки статистики
          </div>
        )}
      </DashboardSection>

      {/* Последние подписи */}
      <div className='w-full'>
        <div className='mb-4'>
          <h2 className='text-xl sm:text-2xl font-bold mb-2'>
            Последние подписи
          </h2>
          <p className='text-sm text-muted-foreground'>
            Последние 8 подписей в системе
          </p>
        </div>
        <SignatureList
          signatures={recentSignatures}
          loading={recentSignaturesLoading}
          previewFields={previewFields}
          showHeader={false}
          fullWidth={true}
          emptyStateTitle='Нет подписей'
          emptyStateDescription='В системе пока нет подписей'
        />
      </div>
    </div>
  );
}
