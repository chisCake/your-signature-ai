'use client';

import { Fingerprint, Mouse, Pen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CanvasRef } from './canvas';

interface CanvasInfoData {
  pointCount: number;
  width: number;
  height: number;
  inputType: 'mouse' | 'touch' | 'pen' | null;
  duration: number;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
  averagePressure: number;
  firstPointTimestamp: number | null;
  lastPointTimestamp: number | null;
}

interface CanvasInfoProps {
  canvasRef: React.RefObject<CanvasRef>;
  updateInterval?: number;
}

const getInputTypeIcon = (inputType: 'mouse' | 'touch' | 'pen' | null) => {
  switch (inputType) {
    case 'mouse':
      return <Mouse className='inline-block w-4 h-4' />;
    case 'touch':
      return <Fingerprint className='inline-block w-4 h-4' />;
    case 'pen':
      return <Pen className='inline-block w-4 h-4' />;
    default:
      return null;
  }
};

const getInputTypeLabel = (inputType: 'mouse' | 'touch' | 'pen' | null) => {
  switch (inputType) {
    case 'mouse':
      return 'Мышь';
    case 'touch':
      return 'Касание';
    case 'pen':
      return 'Стилус';
    default:
      return 'Не определен';
  }
};

function InfoSection({
  data,
  title,
}: {
  data: CanvasInfoData;
  title?: string;
}) {
  const allFields = (
    <div className='space-y-1 text-sm'>
      <div>
        <span className='font-medium'>Размер холста:</span> {data.width} ×{' '}
        {data.height}px
      </div>
      <div>
        <span className='font-medium'>Тип ввода:</span>{' '}
        <span className='inline-flex items-center gap-1 align-middle'>
          {getInputTypeIcon(data.inputType)}
          {getInputTypeLabel(data.inputType)}
        </span>
      </div>
      <div>
        <span className='font-medium'>Количество точек:</span> {data.pointCount}
      </div>
      <div>
        <span className='font-medium'>Область рисования:</span>{' '}
        {data.bounds.width > 0 && data.bounds.height > 0
          ? `${data.bounds.width.toFixed(0)} × ${data.bounds.height.toFixed(0)}px`
          : 'Еще нет данных'}
      </div>
      <div>
        <span className='font-medium'>Длительность:</span>{' '}
        {data.duration > 0 ? `${data.duration.toFixed(2)}с` : '0.00с'}
      </div>
      <div>
        <span className='font-medium'>Среднее давление:</span>{' '}
        {data.averagePressure.toFixed(2)}
      </div>
      <div>
        <span className='font-medium'>Последняя точка:</span>{' '}
        {data.lastPointTimestamp !== null
          ? `${data.lastPointTimestamp.toFixed(0)} мс`
          : 'Нет данных'}
      </div>
    </div>
  );

  return (
    <div>
      {title && <h2 className='text-xl font-bold mb-4'>{title}</h2>}
      {allFields}
    </div>
  );
}

export function CanvasInfo({
  canvasRef,
  updateInterval = 100,
}: CanvasInfoProps) {
  const [data, setData] = useState<CanvasInfoData>({
    pointCount: 0,
    width: 0,
    height: 0,
    inputType: null,
    duration: 0,
    bounds: {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      width: 0,
      height: 0,
    },
    averagePressure: 0,
    firstPointTimestamp: null,
    lastPointTimestamp: null,
  });

  useEffect(() => {
    const updateCanvasInfo = () => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current.getCanvas();
      const signatureData = canvasRef.current.getSignatureData();
      const inputType = canvasRef.current.getInputType();

      // Получаем размер canvas
      let width = 0;
      let height = 0;
      if (canvas) {
        width = canvas.width;
        height = canvas.height;
      }

      // Рассчитываем статистику
      const pointCount = signatureData.length;

      let duration = 0;
      let averagePressure = 0;
      let bounds = {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        width: 0,
        height: 0,
      };
      let firstPointTimestamp = null;
      let lastPointTimestamp = null;

      if (signatureData.length > 0) {
        const lastPoint = signatureData[signatureData.length - 1];
        duration = lastPoint.timestamp / 1000; // переводим в секунды
        lastPointTimestamp = lastPoint.timestamp;

        const firstPoint = signatureData[0];
        firstPointTimestamp = firstPoint.timestamp;

        // Рассчитываем среднее давление
        const totalPressure = signatureData.reduce(
          (sum, point) => sum + point.pressure,
          0
        );
        averagePressure = totalPressure / pointCount;

        // Рассчитываем границы
        const minX = Math.min(...signatureData.map(p => p.x));
        const maxX = Math.max(...signatureData.map(p => p.x));
        const minY = Math.min(...signatureData.map(p => p.y));
        const maxY = Math.max(...signatureData.map(p => p.y));

        bounds = {
          minX,
          maxX,
          minY,
          maxY,
          width: maxX - minX,
          height: maxY - minY,
        };
      }

      setData({
        pointCount,
        width,
        height,
        inputType,
        duration,
        bounds,
        averagePressure,
        firstPointTimestamp,
        lastPointTimestamp,
      });
    };

    // Обновляем информацию сразу
    updateCanvasInfo();

    // Обновляем периодически
    const interval = setInterval(updateCanvasInfo, updateInterval);

    return () => {
      clearInterval(interval);
    };
  }, [canvasRef, updateInterval]);

  return <InfoSection data={data} />;
}
