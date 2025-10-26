'use client';

import SignatureView from '@/components/signature/signature-view';
import { toast } from '@/components/ui/toast';
import { usePageTitle } from '@/lib/hooks/use-page-title';
import { createBrowserClient } from '@/lib/supabase/client';
import { searchSignature } from '@/lib/supabase/queries';
import { Signature } from '@/lib/types';
import { getShortSignatureId } from '@/lib/utils/signature-utils';
import { LoaderCircle } from 'lucide-react';
import { use, useCallback, useEffect, useState } from 'react';

interface SignaturePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function SignaturePage({ params }: SignaturePageProps) {
  const [signature, setSignature] = useState<Signature | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const client = createBrowserClient();

  // Разворачиваем params с помощью React.use()
  const { id } = use(params);

  const pageTitle = signature
    ? `Обзор подписи ${signature.type === 'genuine' ? 'G' : 'F'}:${getShortSignatureId(signature)}`
    : 'Загрузка подписи';
  usePageTitle({ title: pageTitle });

  const loadSignature = useCallback(
    async (signatureId: string) => {
      setIsLoading(true);
      setNotFound(false);

      try {
        const foundSignature = await searchSignature(signatureId, client);

        if (!foundSignature) {
          setNotFound(true);
          toast({
            description: 'Подпись с указанным ID не найдена',
            type: 'foreground',
          });
          return;
        }

        setSignature(foundSignature);
      } catch (error) {
        console.error('Error loading signature:', error);
        toast({
          description: 'Ошибка загрузки подписи',
          type: 'foreground',
        });
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  useEffect(() => {
    if (id) {
      loadSignature(id);
    }
  }, [id, loadSignature]);

  if (isLoading) {
    return (
      <div className='p-6 w-full'>
        <div className='flex items-center justify-center py-8'>
          <div className='text-gray-500 flex items-center gap-2'>
            <LoaderCircle className='animate-spin' /> Загрузка подписи
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className='p-6 w-full'>
        <div className='text-center py-8 text-gray-500'>
          <div className='text-lg mb-2'>
            Подпись с ID &quot;{id}&quot; не найдена
          </div>
          <div className='text-sm'>
            Возможно, подпись была удалена или ID указан неверно
          </div>
        </div>
      </div>
    );
  }

  if (!signature) {
    return null;
  }

  return <SignatureView signature={signature} />;
}
