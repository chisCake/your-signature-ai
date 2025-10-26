import { CopyLabel } from '@/components/ui/copy-label';
import { Signature, User, getUserId, getUserName } from '@/lib/types';
import {
  formatSignatureDateTime,
  getSignatureStats,
} from '@/lib/utils/signature-utils';

interface SignatureInfoProps {
  signature: Signature;
  owner: User | null;
  orientation?: 'horizontal' | 'vertical';
}

function InfoSection({
  signature,
  owner,
  title,
  orientation,
}: {
  signature: Signature;
  owner: User | null;
  title?: string;
  orientation: 'horizontal' | 'vertical';
}) {
  if (!signature || !signature.data) return null;

  const stats = getSignatureStats(signature);

  const basicInfo = (
    <div className='space-y-2'>
      <h3 className='font-semibold text-lg'>Основная информация</h3>
      <div className='space-y-1 text-sm'>
        <div>
          <span className='font-medium'>ID подписи:</span>{' '}
          <CopyLabel>{signature.data.id}</CopyLabel>
        </div>
        <div>
          <span className='font-medium'>Тип подписи:</span>{' '}
          {signature.type === 'genuine' ? 'Настоящая' : 'Поддельная'}
        </div>
        <div>
          <span className='font-medium'>ID владельца:</span>{' '}
          {owner ? <CopyLabel>{getUserId(owner)}</CopyLabel> : 'Неизвестно'}
        </div>
        <div>
          <span className='font-medium'>Тип владельца:</span>{' '}
          {owner
            ? owner.type === 'user'
              ? 'Пользователь'
              : 'Псевдопользователь'
            : 'Неизвестно'}
        </div>
        <div>
          <span className='font-medium'>Имя владельца:</span>{' '}
          {owner ? <CopyLabel>{getUserName(owner)}</CopyLabel> : 'Неизвестно'}
        </div>
        <div>
          <span className='font-medium'>Создана:</span>{' '}
          {formatSignatureDateTime(signature)}
        </div>
      </div>
    </div>
  );

  const technicalInfo = (
    <div className='space-y-2'>
      <h3 className='font-semibold text-lg'>Технические данные</h3>
      <div className='space-y-1 text-sm'>
        <div>
          <span className='font-medium'>Количество точек:</span>{' '}
          {stats.pointCount}
        </div>
        <div>
          <span className='font-medium'>Длительность:</span>{' '}
          {stats.duration.toFixed(2)}с
        </div>
        <div>
          <span className='font-medium'>Среднее давление:</span>{' '}
          {stats.averagePressure.toFixed(2)}
        </div>
        <div>
          <span className='font-medium'>Размер:</span>{' '}
          {stats.bounds.width.toFixed(0)} × {stats.bounds.height.toFixed(0)}px
        </div>
      </div>
    </div>
  );

  if (orientation === 'horizontal') {
    return (
      <div>
        {title && <h2 className='text-xl font-bold mb-4'>{title}</h2>}
        <div className='flex flex-row gap-4'>
          {basicInfo}
          {technicalInfo}
        </div>
      </div>
    );
  }

  // vertical orientation
  return (
    <div>
      {title && <h2 className='text-xl font-bold mb-4'>{title}</h2>}
      <div className='flex flex-col gap-4'>
        {basicInfo}
        {technicalInfo}
      </div>
    </div>
  );
}

export function SignatureInfo({
  signature,
  owner,
  orientation = 'horizontal',
}: SignatureInfoProps) {
  return (
    <InfoSection
      signature={signature}
      owner={owner}
      orientation={orientation}
    />
  );
}
