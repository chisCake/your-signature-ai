'use client';

import SignatureView from '@/components/signature/signature-view';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { Signature } from '@/lib/types';
import { BadgeFactory } from '@/lib/utils/badge-factory';
import {
  deleteSignature,
  downloadSignatureAsPNG,
} from '@/lib/utils/signature-utils';
import { ExternalLink, LoaderCircle, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface SignatureModalProps {
  signature: Signature | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SignatureModal({
  signature,
  isOpen,
  onClose,
}: SignatureModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  // Слушаем событие удаления подписи для автоматического закрытия модального окна
  useEffect(() => {
    if (!isOpen || !signature) return;

    const handleSignatureDeleted = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.id === signature.data.id) {
        onClose();
      }
    };

    window.addEventListener('signatureDeleted', handleSignatureDeleted);

    return () => {
      window.removeEventListener('signatureDeleted', handleSignatureDeleted);
    };
  }, [signature, onClose, isOpen]);

  if (!isOpen || !signature) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDownload = () => {
    downloadSignatureAsPNG(signature);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    deleteSignature(signature)
      .then(success => {
        if (success) {
          onClose();
        }
      })
      .catch(error => {
        console.error('Error deleting signature:', error);
        toast({ description: 'Ошибка при удалении подписи' });
      })
      .finally(() => {
        setIsDeleting(false);
      });
  };

  return (
    <div
      className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20 p-4'
      onClick={handleBackdropClick}
    >
      <div className='bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col'>
        {/* Header */}
        <div className='flex items-center justify-between p-6 border-b flex-shrink-0'>
          <div className='flex items-center gap-2'>
            <h2 className='text-2xl font-bold'>Детали подписи</h2>
            {BadgeFactory.authenticity(signature)}
          </div>
          <Button
            variant='ghost'
            size='icon'
            onClick={onClose}
            className='text-xl'
          >
            <X />
          </Button>
        </div>

        {/* Content */}
        <div className='flex-1 overflow-y-auto p-6'>
          <SignatureView signature={signature} compact={true} />
        </div>

        {/* Footer */}
        <div className='flex gap-3 justify-end p-6 border-t flex-shrink-0'>
          <Link href={`/signature/${signature.data.id}`}>
            <Button variant='outline'>
              <ExternalLink className='mr-2 h-4 w-4' />
              Открыть в новой странице
            </Button>
          </Link>
          <Button variant='outline' onClick={handleDownload}>
            Скачать PNG
          </Button>
          <Button
            variant='destructive'
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <LoaderCircle className='mr-2 h-4 w-4 animate-spin' />
                Удаление
              </>
            ) : (
              'Удалить'
            )}
          </Button>
          <Button onClick={onClose}>Закрыть</Button>
        </div>
      </div>
    </div>
  );
}
