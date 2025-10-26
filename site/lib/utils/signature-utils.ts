import { confirm } from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/toast';
import {
  InsertForgedSignatureData,
  InsertGenuineSignatureData,
} from '@/lib/supabase/queries';
import {
  InputType,
  Signature,
  SignatureForged,
  SignatureGenuine,
  SignaturePoint,
  UserType,
} from '@/lib/types';

export interface BaseSaveOptions {
  points: SignaturePoint[];
  inputType?: InputType;
  userForForgery?: boolean;
  endpoint?: string;
}

export interface SaveForAnotherSignatureOptions extends BaseSaveOptions {
  targetTable: 'profiles' | 'pseudousers';
  targetId: string;
}

export function generateSignaturePNG(
  signature: Signature,
  width: number = 800,
  height: number = 400,
  strokeWidth: number = 3
): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const points = csvToPoints(signature);
  if (!ctx || points.length === 0) return '';

  canvas.width = width;
  canvas.height = height;

  // Белый фон
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Находим границы подписи
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const signatureWidth = maxX - minX;
  const signatureHeight = maxY - minY;

  if (signatureWidth === 0 || signatureHeight === 0) return '';

  // Вычисляем масштаб с отступами
  const padding = 20;
  const scaleX = (canvas.width - padding * 2) / signatureWidth;
  const scaleY = (canvas.height - padding * 2) / signatureHeight;
  const scale = Math.min(scaleX, scaleY, 1);

  // Центрируем подпись
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const offsetX = centerX - (minX + signatureWidth / 2) * scale;
  const offsetY = centerY - (minY + signatureHeight / 2) * scale;

  // Рисуем подпись
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Рисуем штрихи, учитывая разрывы между ними
  let currentStroke: { x: number; y: number; timestamp: number }[] = [];

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const scaledPoint = {
      x: point.x * scale + offsetX,
      y: point.y * scale + offsetY,
      timestamp: point.timestamp,
    };

    currentStroke.push(scaledPoint);

    // Проверяем, нужно ли завершить текущий штрих
    const isLastPoint = i === points.length - 1;
    const nextPoint = points[i + 1];
    const shouldBreakStroke =
      isLastPoint || (nextPoint && nextPoint.timestamp - point.timestamp > 100);

    if (shouldBreakStroke && currentStroke.length > 1) {
      // Рисуем текущий штрих
      ctx.beginPath();
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);

      for (let j = 1; j < currentStroke.length; j++) {
        ctx.lineTo(currentStroke[j].x, currentStroke[j].y);
      }
      ctx.stroke();

      // Начинаем новый штрих
      currentStroke = [];
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * Генерирует превью PNG изображения подписи для отображения в списках
 */
export function generateSignaturePreview(signature: Signature): string {
  return generateSignaturePNG(signature, 200, 100, 2);
}

/**
 * Скачивает подпись как PNG файл
 */
export function downloadSignatureAsPNG(
  signature: Signature,
  filename?: string
): void {
  const pngData = generateSignaturePNG(signature);
  if (!pngData) return;

  const link = document.createElement('a');
  link.download = filename || `signature-${signature.data.id}.png`;
  link.href = pngData;
  link.click();
}

/**
 * Вычисляет статистику подписи
 */
export function getSignatureStats(signature: Signature) {
  const points = csvToPoints(signature);
  if (points.length === 0) {
    return {
      pointCount: 0,
      duration: 0,
      averagePressure: 0,
      bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 },
    };
  }
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const pressures = points.map(p => p.pressure);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const duration = points[points.length - 1].timestamp - points[0].timestamp;
  const averagePressure =
    pressures.reduce((sum, p) => sum + p, 0) / pressures.length;

  return {
    pointCount: points.length,
    duration: duration / 1000, // в секундах
    averagePressure,
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
  };
}

/**
 * Проверяет, является ли подпись валидной (имеет достаточно точек)
 */
export function isValidSignature(
  signature: Signature,
  minPoints: number = 10
): boolean {
  return csvToPoints(signature).length >= minPoints;
}

/**
 * Форматирует дату создания подписи
 */
export function formatSignatureDate(
  signature: Signature,
  locale: string = 'ru-RU'
): string {
  return new Date(signature.data.created_at).toLocaleDateString(locale);
}

/**
 * Форматирует дату и время создания подписи
 */
export function formatSignatureDateTime(
  signature: Signature,
  locale: string = 'ru-RU'
): string {
  return new Date(signature.data.created_at).toLocaleString(locale);
}

/**
 * Получает короткий ID подписи для отображения
 */
export function getShortSignatureId(
  signature: Signature,
  length: number = 8
): string {
  return signature.data.id.slice(0, length) + '...';
}

// ===== Сохранение подписи =====
export async function saveOwnSignature({
  points,
  inputType = 'mouse',
  userForForgery: allowForForgery = false,
  endpoint = '/api/signatures',
}: BaseSaveOptions): Promise<string> {
  const csvData = pointsToCSV(points);
  const body = { csvData, inputType, userForForgery: allowForForgery };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || 'Ошибка сохранения');
  }
  const json = await res.json();
  return json.id as string;
}

export async function saveForAnotherSignature({
  points,
  inputType = 'mouse',
  userForForgery = false,
  endpoint = '/api/signatures',
  targetTable,
  targetId,
}: SaveForAnotherSignatureOptions): Promise<string> {
  try {
    const csvData = pointsToCSV(points);
    const body = {
      csvData,
      inputType,
      userForForgery,
      targetTable,
      targetId,
    };

    // console.log("body", body);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    return json.id as string;
  } catch (error) {
    console.error('Network error while saving signature', error);
    toast({ description: 'Ошибка сети при сохранении', type: 'background' });
    throw error;
  }
}

/**
 * Переключает видимость подписи для подделки со стороны пользователя
 * @param signature подпись для переключения
 * @returns новое состояние видимости подписи для подделки
 */
export async function toggleUserForForgery(
  signature: SignatureGenuine
): Promise<boolean> {
  try {
    const res = await fetch(`/api/signatures/${signature.id}?type=genuine`, {
      method: 'PATCH',
      body: JSON.stringify({ userForForgery: !signature.user_for_forgery }),
    });

    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      toast({
        description: msg.error || 'Ошибка изменения видимости подписи',
        type: 'background',
      });
      return signature.user_for_forgery;
    }

    // Сообщаем другим компонентам о том, что подпись была обновлена
    const { user_for_forgery } = await res.json();
    window.dispatchEvent(
      new CustomEvent('signatureUpdated', {
        detail: { id: signature.id, user_for_forgery },
      })
    );
  } catch (error) {
    console.error('Network error while toggling user_for_forgery', error);
    toast({ description: 'Ошибка сети при обновлении', type: 'background' });
    return signature.user_for_forgery;
  }
  return !signature.user_for_forgery;
}

/**
 * Переключает видимость подписи для подделки со стороны модератора
 * @param signature подпись для переключения
 * @returns новое состояние видимости подписи для подделки
 */
export async function toggleModForForgery(
  signature: SignatureGenuine
): Promise<boolean> {
  try {
    const res = await fetch(`/api/signatures/${signature.id}?type=genuine`, {
      method: 'PATCH',
      body: JSON.stringify({ modForForgery: !signature.mod_for_forgery }),
    });

    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      toast({
        description: msg.error || 'Ошибка изменения видимости подписи',
        type: 'background',
      });
      return signature.mod_for_forgery;
    }

    const { mod_for_forgery } = await res.json();
    window.dispatchEvent(
      new CustomEvent('signatureUpdated', {
        detail: { id: signature.id, mod_for_forgery },
      })
    );
  } catch (error) {
    console.error('Network error while toggling mod_for_forgery', error);
    toast({ description: 'Ошибка сети при обновлении', type: 'background' });
    return signature.mod_for_forgery;
  }
  return !signature.mod_for_forgery;
}

/**
 * Переключает видимость подписи для датасета
 * @param signature подпись для переключения
 * @returns новое состояние видимости подписи для датасета
 */
export async function toggleModForDataset(
  signature: Signature
): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/signatures/${signature.data.id}?type=${signature.type}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          modForDataset: !signature.data.mod_for_dataset,
        }),
      }
    );

    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      toast({
        description: msg.error || 'Ошибка изменения видимости подписи',
        type: 'background',
      });
      return signature.data.mod_for_dataset;
    }

    const { mod_for_dataset } = await res.json();
    window.dispatchEvent(
      new CustomEvent('signatureUpdated', {
        detail: { id: signature.data.id, mod_for_dataset },
      })
    );
  } catch (error) {
    console.error('Network error while toggling mod_for_dataset', error);
    toast({ description: 'Ошибка сети при обновлении', type: 'background' });
    return signature.data.mod_for_dataset;
  }
  return !signature.data.mod_for_dataset;
}

/**
 * Удаляет подпись.
 * **Определение типа подписи производится автоматически**
 * @param signature подпись для удаления
 * @returns true, если подпись успешно удалена, false в противном случае
 */
export async function deleteSignature(signature: Signature): Promise<boolean> {
  const ok = await confirm({
    description: 'Вы уверены, что хотите удалить эту подпись?',
    confirmText: 'Удалить',
    cancelText: 'Отмена',
    confirmVariant: 'destructive',
  });
  if (!ok) return false;

  try {
    const res = await fetch(
      `/api/signatures/${signature.data.id}?type=${signature.type}`,
      {
        method: 'DELETE',
      }
    );

    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      toast({
        description: msg.error || 'Ошибка удаления подписи',
        type: 'background',
      });
      return false;
    }

    // Сообщаем другим компонентам о том, что подпись была удалена
    window.dispatchEvent(
      new CustomEvent('signatureDeleted', {
        detail: { id: signature.data.id, type: signature.type },
      })
    );
    return true;
  } catch (error) {
    console.error('Network error while deleting signature', error);
    toast({ description: 'Ошибка сети при удалении', type: 'background' });
    return false;
  }
}

// ===== CSV helpers =====
export function pointsToCSV(points: SignaturePoint[]): string {
  const csvRows = points.map(p => `${p.timestamp},${p.x},${p.y},${p.pressure}`);
  return 't,x,y,p\n' + csvRows.join('\n');
}

export function csvToPoints(signature: Signature): SignaturePoint[] {
  return csvStringToPoints(signature.data.features_table);
}

/**
 * Конвертирует CSV строку (полный CSV с заголовком) в массив точек
 */
export function csvStringToPoints(csvString: string): SignaturePoint[] {
  const lines = csvString.trim().split('\n');
  const dataLines = lines.slice(1);

  const result = dataLines.map((line: string) => {
    const [t, x, y, p] = line.split(',').map(Number);
    return {
      timestamp: t,
      x,
      y,
      pressure: p,
    };
  });

  return result;
}

/**
 * Получает id владельца подписи
 * @param signature подпись из которой следует получить владельца
 * @returns { string | null } id владельца подписи, если подпись из внешнего датасета/источника, то null
 */
export function getSignatureOwnerId(signature: Signature): string | null {
  if (signature.type === 'genuine') {
    if (!signature.data.user_id && !signature.data.pseudouser_id) {
      return null;
    }
    return (
      (signature.data.user_id as string) ||
      (signature.data.pseudouser_id as string)
    );
  } else {
    if (!signature.data.forger_id) {
      return null;
    }
    return signature.data.forger_id;
  }
}

/**
 * Получает id и тип владельца подлинной подписи
 * @param signature подпись из которой следует получить владельца
 * @returns { id: string, type: UserType } | null
 */
export function getGenuineSignatureOwnerId(
  signature: SignatureGenuine
): { id: string; type: UserType } | null {
  if (signature.user_id) {
    return { id: signature.user_id, type: 'user' };
  } else if (signature.pseudouser_id) {
    return { id: signature.pseudouser_id, type: 'pseudouser' };
  } else {
    return null;
  }
}

/**
 * Получает id владельца поддельной подписи
 * @param signature подпись из которой следует получить владельца
 * @returns { string | null } id владельца поддельной подписи
 */
export function getForgedSignatureOwnerId(
  signature: SignatureForged
): string | null {
  return signature.forger_id ?? null;
}

// Подпись принадлежит настоящему пользователю или псевдопользователю
export function isSignatureBelongsToProfile(signature: Signature): boolean {
  return signature.type === 'genuine'
    ? signature.data.user_id !== null
    : signature.data.original_user_id !== null;
}

export function prepareGenuineSignatureDataForInsert(
  genuineSignatureData: SignaturePoint[],
  inputType: InputType,
  userId: string | null = null,
  pseudouserId: string | null = null,
  userForForgery: boolean = false,
  modForForgery: boolean = true,
  modForDataset: boolean = true
): InsertGenuineSignatureData {
  if (!userId && !pseudouserId) {
    throw new Error('User or pseudouser id is required');
  }
  if (userId && pseudouserId) {
    throw new Error('Only one of user or pseudouser id is allowed');
  }

  return {
    user_id: userId || undefined,
    pseudouser_id: pseudouserId || undefined,
    features_table: pointsToCSV(genuineSignatureData),
    input_type: inputType,
    user_for_forgery: userForForgery,
    mod_for_forgery: modForForgery,
    mod_for_dataset: modForDataset,
  };
}

export function prepareForgedSignatureDataForInsert(
  genuineSignature: SignatureGenuine,
  originalUserId: string | null = null,
  originalPseudouserId: string | null = null,
  forgedSignatureData: SignaturePoint[],
  inputType: InputType,
  modForDataset: boolean
): InsertForgedSignatureData {
  if (!originalUserId && !originalPseudouserId) {
    throw new Error('Original user or pseudouser id is required');
  }
  if (originalUserId && originalPseudouserId) {
    throw new Error('Only one of original user or pseudouser id is allowed');
  }

  return {
    original_signature_id: genuineSignature.id,
    original_user_id: originalUserId,
    original_pseudouser_id: originalPseudouserId,
    features_table: pointsToCSV(forgedSignatureData),
    input_type: inputType,
    mod_for_dataset: modForDataset,
  } as InsertForgedSignatureData;
}
