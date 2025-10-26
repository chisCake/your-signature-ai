'use client';

import { PreviewField } from '@/components/signature/signature-list';
import { Badge } from '@/components/ui/badge';
import {
  useAuthenticityBadge,
  useDeleteSignatureButton,
  useDownloadSignatureButton,
  useModForDatasetBadge,
  useModForDatasetButton,
  useModForForgeryBadge,
  useModForForgeryButton,
  useOpenSignatureButton,
  useUserForForgeryBadge,
  useUserForForgeryButton,
} from '@/lib/hooks/use-signature';
import { Signature, SignatureGenuine } from '@/lib/types';
import { getUser, isMod } from '@/lib/utils/auth-client-utils';
import {
  deleteSignature,
  downloadSignatureAsPNG,
  generateSignaturePNG,
  getGenuineSignatureOwnerId,
  getSignatureOwnerId,
  toggleModForDataset,
  toggleModForForgery,
  toggleUserForForgery,
} from '@/lib/utils/signature-utils';
import Image from 'next/image';
import React, { useCallback, useEffect, useState } from 'react';

interface SignaturePreviewProps {
  signature: Signature;
  previewFields?: PreviewField[];
  onOpenModal: (signature: Signature) => void;
}

export function SignaturePreview({
  signature,
  previewFields,
  onOpenModal,
}: SignaturePreviewProps) {
  // Состояния разрешений
  const [userForForgery, setUserForForgery] = useState<boolean>(
    'user_for_forgery' in signature.data
      ? signature.data.user_for_forgery === true
      : false
  );
  const [modForForgery, setModForForgery] = useState<boolean>(
    'mod_for_forgery' in signature.data
      ? signature.data.mod_for_forgery === true
      : false
  );
  const [modForDataset, setModForDataset] = useState<boolean>(
    'mod_for_dataset' in signature.data
      ? signature.data.mod_for_dataset === true
      : false
  );

  const [userForForgeryLoading, setUserForForgeryLoading] =
    useState<boolean>(false);
  const [modForForgeryLoading, setModForForgeryLoading] =
    useState<boolean>(false);
  const [modForDatasetLoading, setModForDatasetLoading] =
    useState<boolean>(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isCurrentUserMod, setIsCurrentUserMod] = useState<boolean>(false);
  const [deleted, setDeleted] = useState<boolean>(false);
  const [isProfileLoading, setIsProfileLoading] = useState<boolean>(true);
  const isGenuine = signature.type === 'genuine';

  // Бэйджи-хуки
  const authenticityBadge = useAuthenticityBadge(isGenuine);
  const userForForgeryBadge = useUserForForgeryBadge(userForForgery, isGenuine);
  const modForForgeryBadge = useModForForgeryBadge(modForForgery, isGenuine);
  const modForDatasetBadge = useModForDatasetBadge(modForDataset);

  useEffect(() => {
    const getCurentUserData = async () => {
      const user = await getUser();
      setIsCurrentUserMod(await isMod(user));
      setCurrentUserId(user?.id || null);
      setIsProfileLoading(false);
    };
    getCurentUserData();
  }, []);

  // Sync local state when parent passes new signature object
  useEffect(() => {
    if ('user_for_forgery' in signature) {
      setUserForForgery(
        (signature.data as SignatureGenuine).user_for_forgery ?? false
      );
    }
  }, [signature]);

  useEffect(() => {
    if ('mod_for_forgery' in signature) {
      setModForForgery(
        (signature.data as SignatureGenuine).mod_for_forgery ?? false
      );
    }
  }, [signature]);

  useEffect(() => {
    if ('mod_for_dataset' in signature) {
      setModForDataset(signature.data.mod_for_dataset ?? false);
    }
  }, [signature]);

  // Listen to global updates from SignatureUtils
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        id: string;
        user_for_forgery?: boolean;
        mod_for_forgery?: boolean;
        mod_for_dataset?: boolean;
      };
      if (detail.id !== signature.data.id) return;
      if (detail.user_for_forgery !== undefined) {
        setUserForForgery(detail.user_for_forgery);
      }
      if (detail.mod_for_forgery !== undefined) {
        setModForForgery(detail.mod_for_forgery);
      }
      if (detail.mod_for_dataset !== undefined) {
        setModForDataset(detail.mod_for_dataset);
      }
    };
    window.addEventListener('signatureUpdated', handler);
    return () => window.removeEventListener('signatureUpdated', handler);
  }, [signature.data.id]);

  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    const updatePreview = () => {
      const ratio =
        typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const cssWidth = 400;
      const cssHeight = 200;

      // Генерируем изображение в физических пикселях
      const dataUrl = generateSignaturePNG(
        signature,
        Math.round(cssWidth * ratio),
        Math.round(cssHeight * ratio),
        Math.max(2, Math.floor(2 * ratio)) // масштабируем толщину линии
      );
      setPreviewUrl(dataUrl);
    };

    updatePreview();

    // Обновляем при изменении DPR (например, если окно переносится между экранами)
    const mediaQuery = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`
    );
    const handler = () => updatePreview();
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [signature]);

  const handleDownload = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      downloadSignatureAsPNG(signature);
    },
    [signature]
  );

  const handleUserForForgery = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      const genuineSignature = signature.data as SignatureGenuine;
      setUserForForgeryLoading(true);
      toggleUserForForgery(genuineSignature)
        .then(newState => {
          genuineSignature.user_for_forgery = newState;
          setUserForForgery(newState);
        })
        .finally(() => {
          setUserForForgeryLoading(false);
        });
    },
    [signature]
  );

  const handleModForForgery = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      const genuineSignature = signature.data as SignatureGenuine;
      setModForForgeryLoading(true);
      toggleModForForgery(genuineSignature)
        .then(newState => {
          genuineSignature.mod_for_forgery = newState;
          setModForForgery(newState);
        })
        .finally(() => {
          setModForForgeryLoading(false);
        });
    },
    [signature]
  );

  const handleModForDataset = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setModForDatasetLoading(true);
      toggleModForDataset(signature)
        .then(newState => {
          signature.data.mod_for_dataset = newState;
          setModForDataset(newState);
        })
        .finally(() => {
          setModForDatasetLoading(false);
        });
    },
    [signature]
  );

  const handleDelete = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      deleteSignature(signature).then(success => {
        if (success) {
          setDeleted(true);
        }
      });
    },
    [signature]
  );

  // Кнопки-хуки
  const openSignatureButton = useOpenSignatureButton(signature);
  const downloadSignatureButton = useDownloadSignatureButton(handleDownload);
  const userForForgeryButton = useUserForForgeryButton(
    userForForgery,
    handleUserForForgery,
    userForForgeryLoading
  );
  const modForForgeryButton = useModForForgeryButton(
    modForForgery,
    handleModForForgery,
    modForForgeryLoading
  );
  const modForDatasetButton = useModForDatasetButton(
    modForDataset,
    handleModForDataset,
    modForDatasetLoading
  );
  const deleteSignatureButton = useDeleteSignatureButton(handleDelete);

  const renderBadges = () => {
    if (isProfileLoading) {
      return (
        <Badge variant='default' tooltip='Загрузка...'>
          Загрузка...
        </Badge>
      );
    }

    const isGenuine = signature.type === 'genuine';
    if (isCurrentUserMod) {
      const owner = getGenuineSignatureOwnerId(
        signature.data as SignatureGenuine
      );
      const userId = owner?.id ?? null;
      if (userId === currentUserId) {
        // Мод видит свою подпись
        return (
          <>
            {authenticityBadge}
            {isGenuine && userForForgeryBadge}
            {isGenuine &&
              !(userForForgery && modForForgery) &&
              modForForgeryBadge}
            {!modForDataset && modForDatasetBadge}
          </>
        );
      }
      // Мод видит чужую подпись
      return (
        <>
          {authenticityBadge}
          {isGenuine && !modForForgery && modForForgeryBadge}
          {!modForDataset && modForDatasetBadge}
        </>
      );
    }
    // Пользователь видит свою подпись
    return (
      <>
        {authenticityBadge}
        {isGenuine && userForForgeryBadge}
      </>
    );
  };

  const renderButtons = () => {
    if (isProfileLoading) {
      return (
        <Badge variant='default' tooltip='Загрузка...'>
          Загрузка...
        </Badge>
      );
    }

    const isGenuine = signature.type === 'genuine';
    if (isCurrentUserMod) {
      const userId = getSignatureOwnerId(signature);
      if (userId === currentUserId) {
        // Мод видит свою подпись
        return (
          <>
            {openSignatureButton}
            {downloadSignatureButton}
            {isGenuine && userForForgeryButton}
            {isGenuine && modForForgeryButton}
            {modForDatasetButton}
            {deleteSignatureButton}
          </>
        );
      }
      // Мод видит чужую подпись
      return (
        <>
          {openSignatureButton}
          {downloadSignatureButton}
          {isGenuine && modForForgeryButton}
          {modForDatasetButton}
          {deleteSignatureButton}
        </>
      );
    }
    // Пользователь видит свою подпись
    return (
      <>
        {openSignatureButton}
        {downloadSignatureButton}
        {isGenuine && userForForgeryButton}
        {deleteSignatureButton}
      </>
    );
  };

  return deleted ? null : (
    <div className='relative border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer group w-full'>
      {/* Кликабельная область для открытия модального окна */}
      <div
        className='absolute inset-0 z-10'
        onClick={() => onOpenModal(signature)}
        title='Нажмите для просмотра деталей'
      />

      {/* Превью подписи */}
      {previewUrl && (
        <div className='flex items-center justify-center mb-3'>
          <Image
            src={previewUrl}
            alt='Превью подписи'
            width={400}
            height={200}
            className='max-w-full object-contain'
          />
        </div>
      )}

      {/* Информация о подписи */}
      <div className='text-sm text-gray-600 mb-2'>
        {previewFields && previewFields.length > 0 ? (
          previewFields.map(field => (
            <div key={field.key}>
              {field.label}: {field.getValue(signature)}
            </div>
          ))
        ) : (
          <>
            <div>ID: {signature.data.id.slice(0, 8)}...</div>
            <div>
              Создана:{' '}
              {new Date(signature.data.created_at).toLocaleDateString()}
            </div>
          </>
        )}
      </div>

      <div className='flex items-center gap-2 flex-wrap'>{renderBadges()}</div>

      {/* Кнопки действий (справа-сверху) */}
      <div className='absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
        {renderButtons()}
      </div>
    </div>
  );
}
