'use client';

import { useState, memo } from 'react';
import { SignatureGenuine, SignatureForged } from '@/lib/types';
import { SignaturePreview } from '@/components/signature/signature-preview';
import { SignatureModal } from '@/components/signature/signature-modal';
import { LoaderCircle } from 'lucide-react';

export interface PreviewField {
  key: string;
  label: string;
  getValue: (signature: SignatureGenuine | SignatureForged) => string;
}

interface SignatureListProps {
  signatures: (SignatureGenuine | SignatureForged)[];
  loading?: boolean;
  previewFields?: PreviewField[];
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  showHeader?: boolean;
}

export const SignatureList = memo(function SignatureList({
  signatures,
  loading = false,
  previewFields,
  emptyStateTitle = 'Нет подписей для отображения',
  emptyStateDescription = '',
  showHeader = true,
}: SignatureListProps) {
  const [selectedSignature, setSelectedSignature] = useState<
    SignatureGenuine | SignatureForged | null
  >(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = (signature: SignatureGenuine | SignatureForged) => {
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
    <div className='space-y-4 last:space-y-0 xl:min-w-2xl'>
      {/* Заголовок с количеством */}
      {showHeader && (
        <div className='flex items-center justify-between mb-2'>
          <h3 className='text-lg font-semibold'>
            Всего подписей: {signatures.length}
          </h3>
        </div>
      )}

      {/* Сетка подписей */}
      <div className='grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
        {signatures.map(signature => (
          <SignaturePreview
            key={signature.id}
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
