'use client';

import React, { useEffect, useState, useRef } from 'react';
import { SignatureGenuine, SignatureForged } from '@/lib/types';
import SignatureDisplay from '@/components/signature/signature-display';
import Canvas, { CanvasRef } from '@/components/signature/canvas';
import { Button } from '@/components/ui/button';
import {
  csvToPoints,
  formatSignatureDateTime,
  getSignatureStats,
  downloadSignatureAsPNG,
  deleteSignature,
} from '@/lib/utils/signature-utils';
import { X, PenLine, LoaderCircle } from 'lucide-react';
import { useInferenceServer, ForgeryAnalysisResponse } from '@/lib/inference-client';
import { ComparisonResultModal } from '@/components/signature/comparison-result-modal';
import { toast } from '@/components/ui/toast';

interface SignatureModalProps {
  signature: SignatureGenuine | SignatureForged | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SignatureModal({
  signature,
  isOpen,
  onClose,
}: SignatureModalProps) {
  // Состояние для режима подделки
  const [isForgeryMode, setIsForgeryMode] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ForgeryAnalysisResponse | null>(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  
  // Реф для холста
  const canvasRef = useRef<CanvasRef>(null);
  
  // Хук для работы с inference сервером
  const { analyzeForgeryByData, isLoading: inferenceLoading, error: inferenceError } = useInferenceServer();

  // Слушаем событие удаления подписи для автоматического закрытия модального окна
  useEffect(() => {
    if (!isOpen || !signature) return;

    const handleSignatureDeleted = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.id === signature.id) {
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
      handleClose();
    }
  };

  const handleDownload = () => {
    downloadSignatureAsPNG(signature);
  };

  const handleForgeryModeToggle = () => {
    setIsForgeryMode(!isForgeryMode);
    if (canvasRef.current) {
      canvasRef.current.clear();
    }
  };

  const handleAnalyzeForgery = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !signature) return;

    const signatureData = canvas.getSignatureData();
    if (!signatureData || signatureData.length === 0) {
      toast({ description: 'Нельзя анализировать пустую подпись' });
      return;
    }

    setIsAnalyzing(true);

    try {
      // Преобразуем данные подписи в формат для анализа (t, x, y, p)
      const forgeryData = signatureData.map(point => [
        point.timestamp,
        point.x,
        point.y,
        point.pressure
      ]);

      // Отправляем запрос на анализ подделки по данным
      const result = await analyzeForgeryByData(
        signature.id,
        forgeryData
      );

      // Показываем результат в модальном окне
      setComparisonResult(result);
      setShowComparisonModal(true);

      // Очищаем холст
      canvas.clear();

    } catch (error) {
      console.error('Error analyzing forgery:', error);
      toast({ 
        description: 'Ошибка при анализе подделки'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClose = () => {
    setIsForgeryMode(false);
    setIsAnalyzing(false);
    setComparisonResult(null);
    setShowComparisonModal(false);
    if (canvasRef.current) {
      canvasRef.current.clear();
    }
    onClose();
  };

  return (
    <div
      className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'
      onClick={handleBackdropClick}
    >
      <div className='bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col'>
        {/* Заголовок - фиксированный */}
        <div className='flex items-center justify-between p-6 border-b flex-shrink-0'>
          <h2 className='text-2xl font-bold'>Детали подписи</h2>
          <Button
            variant='ghost'
            size='icon'
            onClick={onClose}
            className='text-xl'
          >
            <X />
          </Button>
        </div>

        {/* Прокручиваемое содержимое */}
        <div className='flex-1 overflow-y-auto p-6 space-y-6'>
          {!isForgeryMode ? (
            /* Режим просмотра подписи */
            <>
              {/* Отображение подписи */}
              <div className='flex justify-center'>
                <div className='border border-gray-200 rounded-lg p-4 bg-gray-50'>
                  <SignatureDisplay
                    signatureData={csvToPoints(signature)}
                    canvasClassName='w-[600px] h-[300px] border border-gray-300 rounded'
                    className='border border-gray-300 rounded'
                  />
                </div>
              </div>
            </>
          ) : (
            /* Режим подделки */
            <>
              {/* Оригинальная подпись */}
              <div className='space-y-4'>
                <h3 className='text-lg font-semibold text-center'>Оригинальная подпись</h3>
                <div className='flex justify-center'>
                  <div className='border border-gray-200 rounded-lg p-4 bg-gray-50'>
                    <SignatureDisplay
                      signatureData={csvToPoints(signature)}
                      canvasClassName='w-[600px] h-[300px] border border-gray-300 rounded'
                      className='border border-gray-300 rounded'
                    />
                  </div>
                </div>
              </div>

              {/* Холст для подделки */}
              <div className='space-y-4'>
                <h3 className='text-lg font-semibold text-center'>Попробуйте подделать</h3>
                <div className='flex justify-center'>
                  <div className='border border-gray-200 rounded-lg p-4 bg-gray-50'>
                    <Canvas
                      ref={canvasRef}
                      canvasClassName='w-[600px] h-[300px] border border-gray-300 rounded'
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Информация о подписи */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <h3 className='font-semibold text-lg'>Основная информация</h3>
              <div className='space-y-1 text-sm'>
                <div>
                  <span className='font-medium'>ID:</span> {signature.id}
                </div>
                <div>
                  <span className='font-medium'>Создана:</span>{' '}
                  {formatSignatureDateTime(signature)}
                </div>
              </div>
            </div>

            <div className='space-y-2'>
              <h3 className='font-semibold text-lg'>Технические данные</h3>
              <div className='space-y-1 text-sm'>
                {(() => {
                  const stats = getSignatureStats(signature);
                  return (
                    <>
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
                        {stats.bounds.width.toFixed(0)} ×{' '}
                        {stats.bounds.height.toFixed(0)}px
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Кнопки действий - фиксированные */}
        <div className='flex gap-3 justify-end p-6 border-t flex-shrink-0'>
          {!isForgeryMode ? (
            /* Кнопки для режима просмотра */
            <>
              <Button variant='outline' onClick={handleDownload}>
                Скачать PNG
              </Button>
              <Button
                variant='secondary'
                onClick={handleForgeryModeToggle}
                icon={PenLine}
              >
                Попытаться подделать
              </Button>
              <Button
                variant='destructive'
                onClick={() => deleteSignature(signature)}
              >
                Удалить
              </Button>
              <Button onClick={handleClose}>Закрыть</Button>
            </>
          ) : (
            /* Кнопки для режима подделки */
            <>
              <Button
                variant='outline'
                onClick={handleForgeryModeToggle}
              >
                Назад к просмотру
              </Button>
              <Button
                onClick={handleAnalyzeForgery}
                disabled={isAnalyzing}
                icon={isAnalyzing ? LoaderCircle : PenLine}
              >
                {isAnalyzing ? (
                  <>
                    Анализ...
                    <LoaderCircle className='ml-2 h-4 w-4 animate-spin' />
                  </>
                ) : (
                  'Анализировать подделку'
                )}
              </Button>
              <Button onClick={handleClose}>Закрыть</Button>
            </>
          )}
        </div>
      </div>

      {/* Модальное окно с результатом сравнения */}
      <ComparisonResultModal
        isOpen={showComparisonModal}
        onClose={() => setShowComparisonModal(false)}
        result={comparisonResult}
        isLoading={inferenceLoading}
        error={inferenceError}
      />
    </div>
  );
}
