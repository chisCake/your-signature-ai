'use client';

import Canvas, { CanvasRef, DEFAULT_CANVAS_SIZE } from '@/components/signature/canvas';
import { Button } from '@/components/ui/button';
import { CheckboxWithLabel } from '@/components/ui/checkbox-with-label';
import { useState, useEffect, useRef } from 'react';
import { BaseSaveOptions, saveOwnSignature } from '@/lib/utils/signature-utils';
import { toast } from '@/components/ui/toast';

interface CreateSignatureSectionProps {
  onSignatureSaved?: () => void;
  /**
   * Кастомная функция сохранения подписи. Если не указано – будет использован SignatureUtils.saveSignature
   */
  saveSignature?: (
    options: Omit<BaseSaveOptions, 'endpoint'>
  ) => Promise<string>;
  canvasClassName?: string;
}

export default function CreateSignatureSection({
  onSignatureSaved,
  saveSignature: saveSignatureProp,
  canvasClassName,
}: CreateSignatureSectionProps) {
  const [allowForForgery, setAllowForForgery] = useState(true);
  const canvasRef = useRef<CanvasRef>(null);
  const [saving, setSaving] = useState(false);

  // Восстанавливаем сохранённый флаг из localStorage при монтировании
  useEffect(() => {
    const savedState = localStorage.getItem('allowForForgery');
    if (savedState !== null) {
      setAllowForForgery(JSON.parse(savedState));
    }
  }, []);

  // Обработчик изменения чекбокса
  const handleCheckboxChange = (checked: boolean) => {
    setAllowForForgery(checked);
    localStorage.setItem('allowForForgery', JSON.stringify(checked));
  };

  // Сохранение подписи
  const handleSaveSignature = async () => {
    if (saving) return;
    setSaving(true);

    if (!canvasRef.current) {
      console.error('Canvas не найден');
      setSaving(false);
      return;
    }

    const signatureData = canvasRef.current.getSignatureData();
    const inputType = canvasRef.current.getInputType();

    try {
      const saveFn =
        saveSignatureProp ??
        (async (opts: Omit<BaseSaveOptions, 'endpoint'>) =>
          saveOwnSignature(opts));
      await saveFn({
        points: signatureData,
        inputType: inputType ?? 'mouse',
        userForForgery: allowForForgery,
      });

      toast({ description: 'Подпись сохранена' });
      canvasRef.current.clear();
      onSignatureSaved?.();
    } catch (err) {
      console.error('Network error', err);
      toast({ description: 'Ошибка сети', type: 'background' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className='flex justify-center'>
        <Canvas
          ref={canvasRef}
          canvasClassName={canvasClassName || DEFAULT_CANVAS_SIZE}
        />
      </div>
      <CheckboxWithLabel
        id='allowForForgery'
        checked={allowForForgery}
        onCheckedChange={handleCheckboxChange}
        label='Разрешить использование как пример для подделки'
      />
      <Button onClick={handleSaveSignature} disabled={saving}>
        {saving ? 'Сохранение...' : 'Сохранить'}
      </Button>
    </>
  );
}
