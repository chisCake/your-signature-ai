'use client';

import { Button } from '@/components/ui/button';
import SignatureDisplay from '@/components/signature/signature-display';
import { useState, useEffect, useRef } from 'react';
import { SignaturePoint } from '@/lib/types';
import Canvas, { CanvasRef } from '@/components/signature/canvas';
import { LoaderCircle, PenLine, RotateCcw } from 'lucide-react';
import { csvStringToPoints } from '@/lib/utils/signature-utils';
import { toast } from '@/components/ui/toast';
import { useInferenceServer, ForgeryAnalysisResponse } from '@/lib/inference-client';
import { ComparisonResultModal } from '@/components/signature/comparison-result-modal';

// Адаптивные размеры холста для мобильных устройств
const CANVAS_SIZE_MOBILE = 'w-[280px] h-[210px] sm:w-[320px] sm:h-[240px]';
const CANVAS_SIZE_DESKTOP =
  'md:w-[380px] md:h-[285px] lg:w-[640px] lg:h-[480px]';

export default function Home() {
  const [signatureData, setSignatureData] = useState<SignaturePoint[]>([]);
  const canvasRef = useRef<CanvasRef>(null);
  const [originalSignatureId, setOriginalSignatureId] = useState<string>('');
  const [loadingSignature, setLoadingSignature] = useState(true);
  const [loadingResult, setLoadingResult] = useState(false);
  const [mobileMode, setMobileMode] = useState(false);
  
  // Состояние для модального окна с результатом анализа подделки
  const [forgeryResult, setForgeryResult] = useState<ForgeryAnalysisResponse | null>(null);
  const [showForgeryModal, setShowForgeryModal] = useState(false);
  
  // Хук для работы с inference сервером
  const { analyzeForgeryById, isLoading: inferenceLoading, error: inferenceError } = useInferenceServer();

  const getNewSignature = () => {
    setLoadingSignature(true);
    fetch('/api/forgery')
      .then(res => res.json())
      .then(data => {
        const points = csvStringToPoints(data.features_table);
        setOriginalSignatureId(data.id);
        setSignatureData(points);
      })
      .catch(error => {
        console.error('Error fetching signature:', error);
      })
      .finally(() => {
        setLoadingSignature(false);
      });
  };

  useEffect(() => {
    getNewSignature();
    setMobileMode(window.innerWidth < 1024);
  }, []);

  const handleGetNewSignatureButtonClick = () => {
    getNewSignature();
  };

  const handleSaveButtonClick = async () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const signatureData = canvas.getSignatureData();
      if (!signatureData || signatureData.length === 0) {
        toast({ description: 'Нельзя сохранить пустую подпись' });
        return;
      }
      
      const inputType = canvas.getInputType();

      setLoadingResult(true);
      
      try {
        // Сохраняем подделку в БД
        const saveResponse = await fetch('/api/forgery', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            originalSignatureId: originalSignatureId,
            forgedSignatureData: signatureData,
            inputType: inputType,
          }),
        });

        if (!saveResponse.ok) {
          throw new Error('Ошибка сохранения подделки');
        }

        const saveResult = await saveResponse.json();
        // console.log('Save result:', saveResult);
        
        const forgedSignatureId = saveResult.id;
        // console.log('Forged signature ID:', forgedSignatureId);

        if (!forgedSignatureId) {
          throw new Error('Не удалось получить ID сохраненной подписи');
        }

        // console.log('Calling analyzeForgeryById with:', {
        //   originalSignatureId,
        //   forgedSignatureId
        // });

        // Анализируем подделку по ID сохраненной подписи
        const analysisResult = await analyzeForgeryById(
          originalSignatureId,
          forgedSignatureId
        );

        // Показываем результат в модальном окне
        setForgeryResult(analysisResult);
        setShowForgeryModal(true);

        // Очищаем холст и загружаем новую подпись
        canvas.clear();
        getNewSignature();

      } catch (error) {
        console.error('Error saving and analyzing signature:', error);
        toast({ 
          description: 'Ошибка при сохранении подписи или анализе'
        });
      } finally {
        setLoadingResult(false);
      }
    }
  };

  return (
    <div className='w-full max-w-6xl mx-auto'>
      {/* Заголовок */}
      <div className='text-center mb-8'>
        <h1 className='text-2xl sm:text-3xl lg:text-4xl font-bold mb-4'>
          Тест на подделку подписи
        </h1>
        <p className='text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto'>
          Попробуйте воспроизвести показанную подпись на холсте. ИИ оценит
          качество вашей подделки.
        </p>
      </div>

      {/* Основной контент */}
      <div className='space-y-8'>
        <div className='flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-4'>
          {/* Оригинальная подпись */}
          <div className='flex flex-col items-center space-y-4'>
            <h2 className='text-lg sm:text-xl font-semibold text-center'>
              Оригинальная подпись
            </h2>
            <div className='bg-card rounded-lg p-4 shadow-sm border'>
              <SignatureDisplay
                signatureData={signatureData}
                disablePlayButton={true}
                canvasClassName={`${CANVAS_SIZE_MOBILE} ${CANVAS_SIZE_DESKTOP}`}
              />
            </div>
            {/* Кнопка поиска другой подписи */}
            <div className='flex justify-center'>
              <Button
                onClick={handleGetNewSignatureButtonClick}
                size='lg'
                className='w-full sm:w-auto min-w-[200px] lg:min-w-[300px] lg:min-h-[60px] lg:text-lg'
                disabled={loadingSignature}
                icon={RotateCcw}
                iconSize={mobileMode ? 16 : 24}
              >
                {loadingSignature ? (
                  <>
                    Поиск подписи
                    <LoaderCircle size={mobileMode ? 16 : 24} className='ml-2 animate-spin' />
                  </>
                ) : (
                  'Попробовать другую'
                )}
              </Button>
            </div>
          </div>

          {/* Холст для воспроизведения */}
          <div className='flex flex-col items-center space-y-4'>
            <h2 className='text-lg sm:text-xl font-semibold text-center'>
              Воспроизведите подпись
            </h2>
            <div className='bg-card rounded-lg p-4 shadow-sm border'>
              <Canvas
                ref={canvasRef}
                canvasClassName={`${CANVAS_SIZE_MOBILE} ${CANVAS_SIZE_DESKTOP}`}
              />
            </div>
            {/* Кнопка сохранения */}
            <div className='flex justify-center'>
              <Button
                onClick={handleSaveButtonClick}
                size='lg'
                className='w-full sm:w-auto min-w-[200px] lg:min-w-[300px] lg:min-h-[60px] lg:text-lg'
                disabled={loadingResult}
                icon={loadingResult ? LoaderCircle : PenLine}
                iconSize={mobileMode ? 16 : 24}
              >
                {loadingResult ? (
                  <>
                    Сохранение
                    <LoaderCircle size={mobileMode ? 16 : 24} className='ml-2 animate-spin' />
                  </>
                ) : (
                  'Анализировать подпись'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Инструкции */}
      <div className='mt-12 bg-muted/50 rounded-lg p-6'>
        <h3 className='text-lg font-semibold mb-3'>Как это работает:</h3>
        <ul className='space-y-2 text-sm text-muted-foreground'>
          <li>• Изучите оригинальную подпись выше</li>
          <li>• Воспроизведите её на холсте ниже</li>
          <li>• Нажмите &quot;Анализировать подпись&quot; для анализа</li>
          <li>• ИИ оценит качество вашей подделки</li>
        </ul>
      </div>

      {/* Загрузочный экран */}
      {loadingResult && (
        <div className='fixed inset-0 z-50 bg-black/50 flex items-center justify-center'>
          <div className='bg-background rounded-lg p-6 flex items-center space-x-3'>
            <LoaderCircle className='w-6 h-6 animate-spin' />
            <span className='text-sm'>Анализ подписи...</span>
          </div>
        </div>
      )}

      {/* Модальное окно с результатом анализа подделки */}
      <ComparisonResultModal
        isOpen={showForgeryModal}
        onClose={() => setShowForgeryModal(false)}
        result={forgeryResult}
        isLoading={inferenceLoading}
        error={inferenceError}
      />
    </div>
  );
}
