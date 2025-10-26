'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleButton } from '@/components/ui/toggle-button';
import { Signature, User, createProfileUser } from '@/lib/types';
import { getUserProfile } from '@/lib/utils/auth-client-utils';
import {
  getForgedSignatureOwnerId,
  getGenuineSignatureOwnerId,
} from '@/lib/utils/signature-utils';
import {
  Ban,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldX,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

// ========================================
// Хук для получения владельца подписи
// ========================================

export function useSignatureOwner(signature: Signature | null) {
  const [owner, setOwner] = useState<User | null>(null);

  useEffect(() => {
    if (!signature) {
      setOwner(null);
      return;
    }

    const getOwner = async () => {
      const user = await getUserProfile();
      const isGenuine = signature.type === 'genuine';
      let ownerId: string | null = null;

      if (isGenuine) {
        ownerId = getGenuineSignatureOwnerId(signature.data)?.id ?? null;
      } else {
        ownerId = getForgedSignatureOwnerId(signature.data);
      }

      if (!ownerId || !user) {
        console.error('Owner or user not found');
        setOwner(null);
        return;
      }

      if (user?.id === ownerId) {
        setOwner(createProfileUser(user));
        return;
      }

      // Если текущий пользователь не владелец, просто используем его профиль
      // TODO: реализовать получение профиля владельца по ID
      setOwner(createProfileUser(user));
    };

    getOwner();
  }, [signature]);

  return owner;
}

// ========================================
// Хуки для бэйджей
// ========================================

// Хук для бэйджа подлинности
export function useAuthenticityBadge(isGenuine: boolean) {
  return useMemo(() => {
    return isGenuine ? (
      <Badge variant='default' tooltip='Подпись является настоящей'>
        Настоящая
      </Badge>
    ) : (
      <Badge variant='default' tooltip='Подпись является поддельной'>
        Поддельная
      </Badge>
    );
  }, [isGenuine]);
}

// Хук для бэйджа пользовательского разрешения на подделку
export function useUserForForgeryBadge(
  userForForgery: boolean,
  isGenuine: boolean
) {
  return useMemo(() => {
    if (!isGenuine) return null;

    return userForForgery ? (
      <Badge
        variant='green'
        tooltip='Разрешено использование как примера для подделки'
      >
        Публичная
      </Badge>
    ) : (
      <Badge
        variant='yellow'
        tooltip='Запрещено использование как примера для подделки'
      >
        Скрыта пользователем
      </Badge>
    );
  }, [userForForgery, isGenuine]);
}

// Хук для бэйджа модераторского разрешения на подделку
export function useModForForgeryBadge(
  modForForgery: boolean,
  isGenuine: boolean
) {
  return useMemo(() => {
    if (!isGenuine) return null;

    return modForForgery ? (
      <Badge
        variant='green'
        tooltip='Разрешено использование как примера для подделки'
      >
        Публичная
      </Badge>
    ) : (
      <Badge
        variant='red'
        tooltip='Запрещено использование как примера для подделки модератором'
      >
        Скрыта модератором
      </Badge>
    );
  }, [modForForgery, isGenuine]);
}

// Хук для бэйджа участия в датасете
export function useModForDatasetBadge(modForDataset: boolean) {
  return useMemo(() => {
    return modForDataset ? (
      <Badge variant='green' tooltip='Подпись участвует в датасете'>
        В датасете
      </Badge>
    ) : (
      <Badge variant='red' tooltip='Подпись не участвует в датасете'>
        Не в датасете
      </Badge>
    );
  }, [modForDataset]);
}

// Хук для общего бэйджа подделки (комбинирует user и mod разрешения)
export function useCommonForForgeryBadge(
  userForForgery: boolean,
  modForForgery: boolean,
  isGenuine: boolean
) {
  const userForForgeryBadge = useUserForForgeryBadge(userForForgery, isGenuine);
  const modForForgeryBadge = useModForForgeryBadge(modForForgery, isGenuine);

  return useMemo(() => {
    if (!isGenuine) return null;

    if (userForForgery && modForForgery) {
      return (
        <Badge
          variant='green'
          tooltip='Разрешено использование как примера для подделки'
        >
          Публичная
        </Badge>
      );
    }
    if (userForForgery && !modForForgery) {
      return userForForgeryBadge;
    }
    if (!userForForgery && modForForgery) {
      return modForForgeryBadge;
    }
    return null;
  }, [
    userForForgery,
    modForForgery,
    isGenuine,
    userForForgeryBadge,
    modForForgeryBadge,
  ]);
}

// ========================================
// Хуки для кнопок
// ========================================

export function useOpenSignatureButton(signature: Signature) {
  return useMemo(() => {
    return (
      <Link href={`/signature/${signature.data.id}`}>
        <Button size='icon' variant='outline' title='Открыть в новой странице'>
          <ExternalLink size={24} />
        </Button>
      </Link>
    );
  }, [signature.data.id]);
}

export function useDownloadSignatureButton(handleDownload: () => void) {
  return useMemo(() => {
    return (
      <Button
        size='icon'
        variant='outline'
        onClick={handleDownload}
        title='Скачать'
      >
        <Download size={24} />
      </Button>
    );
  }, [handleDownload]);
}

export function useUserForForgeryButton(
  userForForgery: boolean,
  handleUserForForgery: () => void,
  userForForgeryLoading: boolean
) {
  return useMemo(() => {
    return (
      <ToggleButton
        size='icon'
        variant='secondary'
        title={userForForgery ? 'Сделать скрытой' : 'Сделать публичной'}
        iconOn={Eye}
        iconOff={EyeOff}
        iconSize={24}
        isToggled={userForForgery}
        onToggledChange={() => handleUserForForgery()}
        disabled={userForForgeryLoading}
      />
    );
  }, [userForForgery, handleUserForForgery, userForForgeryLoading]);
}

export function useModForForgeryButton(
  modForForgery: boolean,
  handleModForForgery: () => void,
  modForForgeryLoading: boolean
) {
  return useMemo(() => {
    return (
      <ToggleButton
        size='icon'
        variant='secondary'
        title={modForForgery ? 'Сделать скрытой' : 'Сделать публичной'}
        iconOn={ShieldCheck}
        iconOff={ShieldX}
        iconSize={24}
        isToggled={modForForgery}
        onToggledChange={() => handleModForForgery()}
        disabled={modForForgeryLoading}
      />
    );
  }, [modForForgery, handleModForForgery, modForForgeryLoading]);
}

export function useModForDatasetButton(
  modForDataset: boolean,
  handleModForDataset: () => void,
  modForDatasetLoading: boolean
) {
  return useMemo(() => {
    return (
      <ToggleButton
        size='icon'
        variant='secondary'
        title={modForDataset ? 'Исключить из датасета' : 'Включить в датасет'}
        iconOn={Database}
        iconOff={Ban}
        iconSize={24}
        isToggled={modForDataset}
        onToggledChange={() => handleModForDataset()}
        disabled={modForDatasetLoading}
      />
    );
  }, [modForDataset, handleModForDataset, modForDatasetLoading]);
}

export function useDeleteSignatureButton(handleDelete: () => void) {
  return useMemo(() => {
    return (
      <Button
        size='icon'
        variant='destructive'
        onClick={handleDelete}
        title='Удалить'
      >
        <X size={24} />
      </Button>
    );
  }, [handleDelete]);
}
