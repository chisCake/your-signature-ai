import { Signature, SignaturePoint, SignatureGenuine } from '@/lib/types';
import { toast } from '@/components/ui/toast';
import { confirm } from '@/components/ui/alert-dialog';

export interface BaseSaveOptions {
  points: SignaturePoint[];
  inputType?: 'mouse' | 'touch' | 'pen';
  userForForgery?: boolean;
  endpoint?: string;
}

// export interface SaveOwnSignatureOptions extends BaseSaveOptions {
//   // Extends BaseSaveOptions with no additional properties
// }

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
  link.download = filename || `signature-${signature.id}.png`;
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
  return new Date(signature.created_at).toLocaleDateString(locale);
}

/**
 * Форматирует дату и время создания подписи
 */
export function formatSignatureDateTime(
  signature: Signature,
  locale: string = 'ru-RU'
): string {
  return new Date(signature.created_at).toLocaleString(locale);
}

/**
 * Получает короткий ID подписи для отображения
 */
export function getShortSignatureId(
  signature: Signature,
  length: number = 8
): string {
  return signature.id.slice(0, length) + '...';
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

export async function toggleUserForForgery(
  signature: SignatureGenuine
): Promise<void> {
  try {
    const res = await fetch(`/api/signatures/${signature.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ userForForgery: !signature.user_for_forgery }),
    });

    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      toast({
        description: msg.error || 'Ошибка изменения видимости подписи',
        type: 'background',
      });
      return;
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
  }
}

export async function toggleModForForgery(
  signature: SignatureGenuine
): Promise<void> {
  try {
    const res = await fetch(`/api/signatures/${signature.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ modForForgery: !signature.mod_for_forgery }),
    });

    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      toast({
        description: msg.error || 'Ошибка изменения видимости подписи',
        type: 'background',
      });
      return;
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
  }
}

export async function toggleModForDataset(signature: Signature): Promise<void> {
  // TODO: Разбить на Genuine и Forged
  try {
    const res = await fetch(`/api/signatures/${signature.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ modForDataset: !signature.mod_for_dataset }),
    });

    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      toast({
        description: msg.error || 'Ошибка изменения видимости подписи',
        type: 'background',
      });
      return;
    }

    const { mod_for_dataset } = await res.json();
    window.dispatchEvent(
      new CustomEvent('signatureUpdated', {
        detail: { id: signature.id, mod_for_dataset },
      })
    );
  } catch (error) {
    console.error('Network error while toggling mod_for_dataset', error);
    toast({ description: 'Ошибка сети при обновлении', type: 'background' });
  }
}

export async function deleteSignature(signature: Signature): Promise<boolean> {
  // TODO: Разбить на Genuine и Forged
  const ok = await confirm({
    description: 'Вы уверены, что хотите удалить эту подпись?',
    confirmText: 'Удалить',
    cancelText: 'Отмена',
  });
  if (!ok) return false;

  try {
    const res = await fetch(`/api/signatures/${signature.id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      // console.log(msg);
      toast({
        description: msg.error || 'Ошибка удаления подписи',
        type: 'background',
      });
      return false;
    }

    // Сообщаем другим компонентам о том, что подпись была удалена
    window.dispatchEvent(
      new CustomEvent('signatureDeleted', { detail: { id: signature.id } })
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
  // Проверяем, есть ли features_table (новый формат)
  if ('features_table' in signature && signature.features_table) {
    return csvStringToPoints(signature.features_table);
  }

  // Старый формат с csv_header и csv_rows
  const sig = signature as { csv_header?: string; csv_rows?: string };
  // const header = (sig.csv_header || "").trim();
  const rows = (sig.csv_rows || '').trim();
  // const expected = "t,x,y,p";
  // допускаем другие заголовки, но пытаемся распарсить по порядку t,x,y,p
  const lines = rows.length ? rows.split('\n') : [];
  return lines.map((line: string) => {
    const [t, x, y, p] = line.split(',').map(Number);
    return { timestamp: t, x, y, pressure: p } as SignaturePoint;
  });
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
