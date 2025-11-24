'use client';

import { SignatureModal } from '@/components/signature/signature-modal';
import { SignaturePreview } from '@/components/signature/signature-preview';
import { Signature } from '@/lib/types';
import { LoaderCircle } from 'lucide-react';
import { memo, useState } from 'react';

export interface PreviewField {
  key: string;
  label: string;
  getValue: (signature: Signature) => string;
}

interface SignatureListProps {
  signatures: Signature[];
  loading?: boolean;
  previewFields?: PreviewField[];
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  showHeader?: boolean;
  fullWidth?: boolean;
}

export const SignatureList = memo(function SignatureList({
  signatures,
  loading = false,
  previewFields,
  emptyStateTitle = 'Нет подписей для отображения',
  emptyStateDescription = '',
  showHeader = true,
  fullWidth = false,
}: SignatureListProps) {
  const [selectedSignature, setSelectedSignature] = useState<Signature | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = (signature: Signature) => {
    setSelectedSignature(signature);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSignature(null);
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center py-8'>
        <div className='text-gray-500 flex items-center gap-2'>
          <LoaderCircle className='animate-spin' /> Загрузка подписей
        </div>
      </div>
    );
  }

  if (signatures.length === 0) {
    return (
      <div className='text-center py-8 text-gray-500'>
        <div className='text-lg mb-2'>{emptyStateTitle}</div>
        <div className='text-sm'>{emptyStateDescription}</div>
      </div>
    );
  }

  return (
    <div className={fullWidth ? 'w-full' : 'xl:min-w-2xl'}>
      {/* Заголовок с количеством */}
      {showHeader && (
        <div className='flex items-center justify-between mb-2'>
          <h3 className='text-lg font-semibold'>
            Всего подписей: {signatures.length}
          </h3>
        </div>
      )}

      {/* Сетка подписей */}
      <div className='grid grid-cols-1 mt-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
        {signatures.map(signature => (
          <SignaturePreview
            key={signature.data.id}
            signature={signature}
            previewFields={previewFields}
            onOpenModal={handleOpenModal}
          />
        ))}
      </div>

      {/* Модальное окно */}
      <SignatureModal
        signature={selectedSignature}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
});
