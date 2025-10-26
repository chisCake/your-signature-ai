'use client';

import { cn } from '@/lib/utils/client-utils';
import { cva } from 'class-variance-authority';
import { Check, Copy } from 'lucide-react';
import * as React from 'react';
import { toast } from './toast';

const copyLabelVariants = cva(
  'inline-flex items-center gap-2 text-sm font-medium leading-none cursor-pointer transition-all duration-200 hover:opacity-80 active:scale-95'
);

export interface CopyLabelProps extends React.HTMLAttributes<HTMLLabelElement> {
  textToCopy?: string;
  copySuccessMessage?: string;
  showIcon?: boolean;
}

const CopyLabel = React.forwardRef<HTMLLabelElement, CopyLabelProps>(
  (
    {
      className,
      textToCopy,
      copySuccessMessage = 'Скопировано в буфер обмена',
      showIcon = true,
      children,
      ...props
    },
    ref
  ) => {
    const [copied, setCopied] = React.useState(false);
    const internalRef = React.useRef<HTMLLabelElement>(null);

    // Объединяем внешний и внутренний ref
    const labelRef = React.useCallback(
      (node: HTMLLabelElement) => {
        internalRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLLabelElement | null>).current =
            node;
        }
      },
      [ref]
    );

    const handleCopy = async (e: React.MouseEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        let textToCopyValue = textToCopy;

        // Если textToCopy не указан, получаем текст из содержимого элемента
        if (!textToCopyValue && internalRef.current) {
          textToCopyValue = internalRef.current.textContent || '';
          // Удаляем текст иконки SVG из текста
          textToCopyValue = textToCopyValue
            .replace(/\bCopy\b|\bCheck\b/g, '')
            .trim();
        }

        await navigator.clipboard.writeText(textToCopyValue || '');
        setCopied(true);
        toast({
          description: copySuccessMessage,
          type: 'background',
        });

        // Сброс состояния через 2 секунды
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } catch (error) {
        console.error('Failed to copy text:', error);
        toast({
          description: 'Не удалось скопировать текст',
          type: 'background',
        });
      }
    };

    return (
      <label
        ref={labelRef}
        onClick={handleCopy}
        className={cn(copyLabelVariants(), className)}
        {...props}
      >
        {children}
        {showIcon && (
          <span className='flex items-center' aria-hidden='true'>
            {copied ? (
              <Check size={14} className='text-green-500' />
            ) : (
              <Copy size={14} className='text-gray-500' />
            )}
          </span>
        )}
      </label>
    );
  }
);

CopyLabel.displayName = 'CopyLabel';

export { CopyLabel };
