import { confirm } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useAuthenticityBadge } from '@/lib/hooks/use-signature';
import { useUser } from '@/lib/hooks/use-user';
import {
  ForgeryAnalysisResponse,
  useInferenceServer,
} from '@/lib/inference-client';
import {
  createGenuineSignature,
  createProfileUser,
  Signature,
  SignatureGenuine,
  SignaturePoint,
  User,
} from '@/lib/types';
import { getUser, getUserProfile } from '@/lib/utils/auth-client-utils';
import { getSignatureOwner, saveForgery } from '@/lib/utils/mod-client-utils';
import {
  csvToPoints,
  deleteSignature,
  downloadSignatureAsPNG,
  getSignatureOwnerId,
  pointsToCSV,
} from '@/lib/utils/signature-utils';
import {
  CloudUpload,
  CornerDownLeft,
  CornerRightUp,
  Download,
  ExternalLinkIcon,
  LoaderCircle,
  Sparkles,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Canvas, { CanvasRef } from './canvas';
import { CanvasInfo } from './canvas-info';
import { ComparisonResultModal } from './comparison-result-modal';
import SignatureDisplay from './signature-display';
import { SignatureInfo } from './signature-info';

const CANVAS_SIZE_MOBILE = 'w-[280px] h-[210px] sm:w-[320px] sm:h-[240px]';
const CANVAS_SIZE_DESKTOP =
  'md:w-[380px] md:h-[285px] lg:w-[640px] lg:h-[480px]';

interface Props {
  signature: Signature;
  compact?: boolean; // Режим компактного отображения (для модального окна)
}

export default function SignatureView({
  signature,
  compact: modal = false,
}: Props) {
  const [signatureOwner, setSignatureOwner] = useState<User | null>(null);
  const [originalSignaturePoints, setOriginalSignaturePoints] = useState<
    SignaturePoint[]
  >([]);
  const [originalSignatureGenuine, setOriginalSignatureGenuine] =
    useState<SignatureGenuine | null>(null);
  const [originalOwner, setOriginalOwner] = useState<User | null>(null);
  const canvasRef = useRef<CanvasRef>(null);
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical');
  const [isAnalyzingForgery, setIsAnalyzingForgery] = useState<boolean>(false);
  const [isSavingForgery, setIsSavingForgery] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [forgeryAnalysisResult, setForgeryAnalysisResult] =
    useState<ForgeryAnalysisResponse | null>(null);
  const [showForgeryModal, setShowForgeryModal] = useState(false);

  const { isMod } = useUser();
  const { analyzeForgeryByData, isLoading: inferenceLoading } =
    useInferenceServer();
  const isGenuineSignature = signature.type === 'genuine';
  const signatureBadge = useAuthenticityBadge(isGenuineSignature);
  const originalBadge = useAuthenticityBadge(!isGenuineSignature);

  // Получение владельца подписи
  useEffect(() => {
    const getOwner = async () => {
      const user = await getUser();
      if (!user) return;

      // Пользователь сможет посмотреть получить свой профиль
      if (user.id === getSignatureOwnerId(signature)) {
        const profile = await getUserProfile();
        if (!profile) {
          toast({ description: 'Не удалось получить информацию профиля' });
          return;
        }
        setSignatureOwner(createProfileUser(profile));
      }
      // Но если подпись принадлежит другому пользователю, RLS не пропустит
      else {
        const owner = await getSignatureOwner(signature);
        // Принадлежит псевдопользователю
        if (!owner) return;

        setSignatureOwner(owner);
      }
    };

    if (!signature) return;
    getOwner();
  }, [signature]);

  // Попытка получения оригинального образца, если подпись поддельная
  useEffect(() => {
    const getOriginalSignature = async () => {
      const user = await getUser();

      if (!user) {
        toast({ description: 'Unauthorized' });
        return;
      }

      const originalSignatureRes = await fetch(
        `/api/forgery/${signature.data.id}`
      );

      if (!originalSignatureRes.ok) {
        toast({ description: 'Error fetching original signature' });
        return;
      }

      const originalSignatureData = await originalSignatureRes.json();
      if (originalSignatureData.type === 'points') {
        setOriginalSignaturePoints(originalSignatureData.data);
      } else {
        const originalSignature =
          originalSignatureData.data as SignatureGenuine;
        setOriginalSignatureGenuine(originalSignature as SignatureGenuine);

        const owner = await getSignatureOwner(
          createGenuineSignature(originalSignature)
        );
        setOriginalOwner(owner);
        setOriginalSignaturePoints(csvToPoints(originalSignatureData));
      }
    };

    if (signature.type === 'forged') {
      getOriginalSignature();
    }
  }, [signature.data.id, signature.type]);

  const switchLayout = useCallback(() => {
    setLayout(prevLayout =>
      prevLayout === 'vertical' ? 'horizontal' : 'vertical'
    );
  }, []);

  const handleDownload = useCallback(() => {
    downloadSignatureAsPNG(signature);
  }, [signature]);

  const handleDownloadOriginal = useCallback(() => {
    if (!originalSignatureGenuine) return;
    downloadSignatureAsPNG(createGenuineSignature(originalSignatureGenuine));
  }, [originalSignatureGenuine]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    deleteSignature(signature)
      .then(success => {
        if (success) {
          toast({ description: 'Подпись успешно удалена' });
        }
      })
      .catch(error => {
        console.error('Error deleting signature:', error);
        toast({ description: 'Ошибка при удалении подписи' });
      })
      .finally(() => {
        setIsDeleting(false);
      });
  }, [signature]);

  const handleAnalyzeForgery = useCallback(() => {
    const analyzeForgeryCallback = async () => {
      // Получаем данные с холста
      const canvasData = canvasRef.current?.getSignatureData();
      if (!canvasData || canvasData.length === 0) {
        throw new Error('Нельзя анализировать пустую подпись');
      }

      // Получаем ID оригинальной подписи
      const originalId = signature.data.id;

      // Конвертируем точки в CSV формат
      const forgeryData = pointsToCSV(canvasData);

      // Вызываем анализ
      const analysisResult = await analyzeForgeryByData(
        originalId,
        forgeryData
      );

      return analysisResult;
    };

    setIsAnalyzingForgery(true);
    analyzeForgeryCallback()
      .then(result => {
        setForgeryAnalysisResult(result);
        setShowForgeryModal(true);
        toast({
          title: 'Успешно',
          description: 'Анализ подделки завершен',
        });
      })
      .catch(error => {
        toast({
          description: `Ошибка при анализе поддельной подписи\n${(error as Error).message}`,
        });
      })
      .finally(() => {
        setIsAnalyzingForgery(false);
      });
  }, [signature.data.id, analyzeForgeryByData]);

  const handleSaveForgery = useCallback(async () => {
    const saveForgeryCallback = async () => {
      if (!isMod) {
        throw new Error('Вы не модератор');
      }

      const saveOk = await confirm({
        description:
          'Не сохраняйте вашу поддельную подпись, если оригинальная подпись тоже ваша!',
        confirmText: 'Сохранить',
        cancelText: 'Отмена',
        // Так надо, обратная психология
        confirmVariant: 'outline',
        cancelVariant: 'confirm',
      });

      if (!saveOk) return false;

      const forDatasetOk = await confirm({
        description: 'Использовать в датасете для обучения?',
        confirmText: 'Да',
        cancelText: 'Нет',
        confirmVariant: 'confirm',
        cancelVariant: 'outline',
      });

      const canvasData = canvasRef.current?.getSignatureData();
      if (!canvasData) {
        throw new Error('Не удалось считать данные подписи с холста');
      }
      const inputType = canvasRef.current?.getInputType() || 'mouse';
      const savedForgery = await saveForgery(
        signature.data as SignatureGenuine,
        canvasData,
        inputType,
        forDatasetOk
      );
      if (!savedForgery) {
        throw new Error('Не удалось сохранить поддельную подпись');
      }
      return true;
    };

    setIsSavingForgery(true);
    saveForgeryCallback()
      .then(ok => {
        if (ok) toast({ description: 'Поддельная подпись успешно сохранена' });
      })
      .catch(error => {
        toast({
          description: `Не удалось сохранить поддельную подпись\n${(error as Error).message}`,
        });
      })
      .finally(() => {
        setIsSavingForgery(false);
      });
  }, [isMod, signature.data]);

  const initialSignature = useMemo(() => {
    return (
      <div className='space-y-4'>
        <div className='flex align-middle gap-2 items-center'>
          {signatureBadge}
          <h2>Искомая подпись</h2>
        </div>
        <div
          className={`flex align-middle gap-2 items-start justify-between ${layout === 'vertical' ? 'flex-row' : 'flex-col'}`}
        >
          <div className='canvas-container'>
            <SignatureDisplay
              signatureData={signature}
              canvasClassName={`${CANVAS_SIZE_MOBILE} ${CANVAS_SIZE_DESKTOP}`}
            />
          </div>
          <div className='flex flex-col gap-2 w-full h-full items-start justify-start'>
            <div className='flex gap-2'>
              <Button variant='outline' onClick={handleDownload}>
                <Download size={16} />
                Скачать
              </Button>
              <Button
                variant='destructive'
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <LoaderCircle className='animate-spin' size={16} />
                ) : (
                  <Trash2 size={16} />
                )}
                Удалить
              </Button>
            </div>
            <SignatureInfo
              signature={signature}
              owner={signatureOwner}
              orientation={layout}
            />
          </div>
        </div>
      </div>
    );
  }, [
    signature,
    signatureBadge,
    signatureOwner,
    layout,
    handleDownload,
    handleDelete,
    isDeleting,
  ]);

  const originalSignature = useMemo(() => {
    return (
      <div className='space-y-4'>
        <div className='flex align-middle gap-2 items-center'>
          {originalBadge}
          <h2>Оригинальная подпись</h2>
        </div>
        <div
          className={`flex ${layout === 'vertical' ? 'flex-row' : 'flex-col'} gap-4`}
        >
          <div className='canvas-container'>
            <SignatureDisplay
              signatureData={originalSignaturePoints}
              canvasClassName={`${CANVAS_SIZE_MOBILE} ${CANVAS_SIZE_DESKTOP}`}
            />
          </div>
          <div className='flex flex-col gap-2 w-full h-full items-start justify-start'>
            <div className='flex gap-2'>
              <Button variant='outline' onClick={switchLayout}>
                {layout === 'vertical' ? (
                  <CornerRightUp size={16} />
                ) : (
                  <CornerDownLeft size={16} />
                )}
                Переместить
              </Button>
              <Link href={`/signature/${originalSignatureGenuine?.id}`}>
                <Button variant='outline'>
                  <ExternalLinkIcon size={16} />
                  Открыть
                </Button>
              </Link>
              <Button
                variant='outline'
                onClick={handleDownloadOriginal}
                disabled={!originalSignatureGenuine}
              >
                <Download size={16} />
                Скачать
              </Button>
            </div>
            <SignatureInfo
              signature={createGenuineSignature(
                originalSignatureGenuine as SignatureGenuine
              )}
              owner={originalOwner}
              orientation={layout}
            />
          </div>
        </div>
      </div>
    );
  }, [
    originalSignaturePoints,
    originalBadge,
    originalOwner,
    originalSignatureGenuine,
    layout,
    handleDownloadOriginal,
    switchLayout,
  ]);

  const forgeryCanvas = useMemo(() => {
    return (
      <div className='space-y-4 '>
        <div className='flex align-middle gap-2 items-center justify-between'>
          <h2>Попытайтесь подделать</h2>
        </div>
        <div
          className={`flex align-middle gap-2 items-start justify-between ${layout === 'vertical' ? 'flex-row' : 'flex-col'}`}
        >
          <div className='canvas-container'>
            <Canvas
              ref={canvasRef}
              canvasClassName={`${CANVAS_SIZE_MOBILE} ${CANVAS_SIZE_DESKTOP}`}
            />
          </div>
          <div className='flex flex-col gap-2 w-full h-full items-start justify-start'>
            <div className='flex gap-2'>
              <Button variant='outline' onClick={switchLayout}>
                {layout === 'vertical' ? (
                  <CornerRightUp size={16} />
                ) : (
                  <CornerDownLeft size={16} />
                )}
                Переместить
              </Button>
              <Button variant='outline' onClick={handleAnalyzeForgery}>
                {isAnalyzingForgery ? (
                  <LoaderCircle className='animate-spin' size={16} />
                ) : (
                  <Sparkles size={16} />
                )}
                Анализировать
              </Button>
              {isMod && (
                <Button
                  variant='outline'
                  onClick={handleSaveForgery}
                  disabled={isSavingForgery}
                >
                  {isSavingForgery ? (
                    <LoaderCircle className='animate-spin' size={16} />
                  ) : (
                    <CloudUpload size={16} />
                  )}
                  Сохранить
                </Button>
              )}
            </div>
            <CanvasInfo canvasRef={canvasRef as RefObject<CanvasRef>} />
          </div>
        </div>
      </div>
    );
  }, [
    canvasRef,
    layout,
    switchLayout,
    isMod,
    isAnalyzingForgery,
    isSavingForgery,
    handleSaveForgery,
    handleAnalyzeForgery,
  ]);

  if (modal) {
    return (
      <div className='space-y-4'>
        {/* Искомая подпись */}
        <div className='flex justify-center'>
          <div className='canvas-container'>
            <SignatureDisplay
              signatureData={signature}
              canvasClassName='w-[600px] h-[300px] border border-gray-300 rounded'
              className='border border-gray-300 rounded'
            />
          </div>
        </div>

        <div className='flex gap-4 justify-center'>
          <SignatureInfo
            signature={signature}
            owner={signatureOwner}
            orientation={isGenuineSignature ? 'horizontal' : 'vertical'}
          />
          {!isGenuineSignature && (
            <div>
              <h3>Оригинальная подпись</h3>
              <SignatureDisplay
                signatureData={originalSignaturePoints}
                canvasClassName='w-[400px] h-[200px] border border-gray-300 rounded'
                className='border border-gray-300 rounded'
              />
              <Link href={`/signature/${originalSignatureGenuine?.id}`}>
                <Button variant='outline'>
                  <ExternalLinkIcon size={16} />
                  Открыть
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Обычный режим для полноценной страницы
  return (
    <>
      <div
        className={`flex justify-center ${layout === 'vertical' ? 'flex-col max-w-screen-lg mx-auto space-y-4' : 'flex-row gap-4'}`}
      >
        {initialSignature}

        {isGenuineSignature ? forgeryCanvas : originalSignature}
      </div>

      {/* Модальное окно с результатом анализа подделки */}
      {isGenuineSignature && (
        <ComparisonResultModal
          isOpen={showForgeryModal}
          onClose={() => setShowForgeryModal(false)}
          result={forgeryAnalysisResult}
          isLoading={inferenceLoading}
          error={null}
        />
      )}
    </>
  );
}
