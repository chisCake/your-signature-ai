'use client';

import CreateSignatureSection from '@/components/signature/signature-creation-section';
import { Button } from '@/components/ui/button';
import { DashboardSection } from '@/components/dashboard/dashboard-section';
import { Profile, Signature } from '@/lib/types';
import { SignatureList, PreviewField } from '@/components/signature/signature-list';
import {
  formatSignatureDate,
  getShortSignatureId,
} from '@/lib/utils/signature-utils';
import {
  User as UserIcon,
  Mail,
  Calendar,
  Shield,
  LoaderCircle,
} from 'lucide-react';
import { getSignatures } from '@/lib/utils/user-utils';
import { getProfile } from '@/lib/utils/user-utils';
import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/toast';

const CANVAS_SIZE_MOBILE = 'w-[320px] h-[240px] sm:w-[320px] sm:h-[240px]';
const CANVAS_SIZE_DESKTOP =
  'md:w-[380px] md:h-[285px] lg:w-[640px] lg:h-[480px]';

export default function UserDashboard() {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [signaturesLoading, setSignaturesLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  // Загрузка подписей пользователя
  const fetchSignatures = useCallback(async () => {
    try {
      setSignaturesLoading(true);
      const data = await getSignatures();
      setSignatures(data || []);
    } catch (error) {
      console.error('Ошибка сети:', error);
    } finally {
      setSignaturesLoading(false);
    }
  }, []);

  // Загрузка данных пользователя
  const fetchUserData = useCallback(async () => {
    try {
      const userData = await getProfile();
      setCurrentUser(userData ?? null);
      setUserEmail(userData?.email ?? '');
    } catch (error) {
      console.error('Ошибка загрузки данных пользователя:', error);
    }
  }, []);

  const signatureDeletedHandler = useCallback(() => {
    fetchSignatures();
  }, [fetchSignatures]);

  useEffect(() => {
    // Загружаем подписи и данные пользователя при инициализации
    fetchSignatures();
    fetchUserData();

    // Подписываемся на событие удаления подписи
    window.addEventListener('signatureDeleted', signatureDeletedHandler);

    return () => {
      window.removeEventListener('signatureDeleted', signatureDeletedHandler);
    };
  }, [fetchSignatures, fetchUserData, signatureDeletedHandler]);

  const bulkUpdateForgery = async (allow: boolean) => {
    if (
      !window.confirm(
        allow
          ? 'Разрешить использование всех ваших подписей как примеров для подделки?'
          : 'Запретить использование всех ваших подписей как примеров для подделки?'
      )
    ) {
      return;
    }
    try {
      const res = await fetch('/api/signatures', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userForForgery: allow }),
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        toast({ description: msg.error || 'Ошибка обновления' });
        return;
      }
      // обновляем локальное состояние
      setSignatures(prev => prev.map(s => ({ ...s, user_for_forgery: allow })));
      // Даем подписи обновиться через пропсы; если всё равно нужен глобальный сигнал,
      // делаем его асинхронно, чтобы избежать setState во время рендера
      setTimeout(() => {
        signatures.forEach(sig => {
          window.dispatchEvent(
            new CustomEvent('signatureUpdated', {
              detail: { id: sig.id, user_for_forgery: allow },
            })
          );
        });
      }, 0);
      toast({ description: 'Настройки обновлены' });
    } catch (err) {
      console.error('Network error', err);
      toast({ description: 'Ошибка сети' });
    }
  };

  // Кастомные поля для отображения в превью
  const previewFields: PreviewField[] = [
    {
      key: 'id',
      label: 'ID',
      getValue: signature => getShortSignatureId(signature),
    },
    {
      key: 'created_at',
      label: 'Создана',
      getValue: signature => formatSignatureDate(signature),
    },
  ];

  return (
    <div className='w-full max-w-6xl mx-auto'>
      {/* Заголовок */}
      <div className='text-center mb-6 sm:mb-8'>
        <h1 className='text-xl sm:text-2xl lg:text-3xl font-bold mb-2 sm:mb-4'>
          Личный кабинет
        </h1>
        <p className='text-sm sm:text-base text-muted-foreground'>
          Управляйте своими подписями и настройками
        </p>
      </div>

      {/* Основной контент */}
      <div className='space-y-4 sm:space-y-6'>
        <DashboardSection title='Информация о профиле'>
          {currentUser ? (
            <div className='space-y-4'>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'>
                <div className='space-y-1'>
                  <label className='text-xs sm:text-sm font-medium text-muted-foreground'>
                    Имя
                  </label>
                  <div className='text-sm sm:text-lg font-semibold flex items-center gap-2'>
                    <UserIcon className='h-4 w-4 sm:h-5 sm:w-5' />
                    {currentUser.display_name || 'Не указано'}
                  </div>
                </div>
                <div className='space-y-1'>
                  <label className='text-xs sm:text-sm font-medium text-muted-foreground'>
                    Роль
                  </label>
                  <div className='text-xs sm:text-sm flex items-center gap-2'>
                    <Shield className='h-3 w-3 sm:h-4 sm:w-4' />
                    {currentUser.role || 'user'}
                  </div>
                </div>
                <div className='space-y-1 sm:col-span-2'>
                  <label className='text-xs sm:text-sm font-medium text-muted-foreground'>
                    ID
                  </label>
                  <div className='text-xs sm:text-sm font-mono break-all'>{currentUser.id}</div>
                </div>
                <div className='space-y-1 sm:col-span-2'>
                  <label className='text-xs sm:text-sm font-medium text-muted-foreground'>
                    Email
                  </label>
                  <div className='text-xs sm:text-sm flex items-center gap-1 break-all'>
                    <Mail className='h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0' />
                    {userEmail}
                  </div>
                </div>
                <div className='space-y-1 sm:col-span-2'>
                  <label className='text-xs sm:text-sm font-medium text-muted-foreground'>
                    Дата регистрации
                  </label>
                  <div className='text-xs sm:text-sm flex items-center gap-1'>
                    <Calendar className='h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0' />
                    {currentUser.created_at
                      ? new Date(currentUser.created_at).toLocaleDateString(
                          'ru-RU',
                          {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          }
                        )
                      : 'Неизвестно'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className='text-center py-6 sm:py-8 text-muted-foreground'>
              <UserIcon className='h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50' />
              <div className='text-xs sm:text-sm flex flex-row items-center justify-center gap-2'>
                <LoaderCircle className='animate-spin h-3 w-3 sm:h-4 sm:w-4' /> 
                Загрузка данных пользователя
              </div>
            </div>
          )}
        </DashboardSection>

      <DashboardSection title='Создать подпись'>
        <CreateSignatureSection onSignatureSaved={fetchSignatures} canvasClassName={`${CANVAS_SIZE_MOBILE} ${CANVAS_SIZE_DESKTOP}`}/>
      </DashboardSection>

        <DashboardSection title='Приватность'>
          <div className='flex flex-col gap-4'>
            <div className='flex flex-col gap-3'>
              <span className='text-sm sm:text-base font-medium'>
                Использование подписей как примеров для подделки
              </span>
              <div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-2'>
                <Button 
                  variant='confirm' 
                  onClick={() => bulkUpdateForgery(true)}
                  className='w-full sm:w-auto text-xs sm:text-sm'
                >
                  Разрешить все
                </Button>
                <Button
                  variant='destructive'
                  onClick={() => bulkUpdateForgery(false)}
                  className='w-full sm:w-auto text-xs sm:text-sm'
                >
                  Запретить все
                </Button>
              </div>
            </div>
          </div>
        </DashboardSection>

        <DashboardSection title='Мои подписи'>
          <SignatureList
            signatures={signatures}
            loading={signaturesLoading}
            previewFields={previewFields}
          />
        </DashboardSection>
      </div>
    </div>
  );
}
