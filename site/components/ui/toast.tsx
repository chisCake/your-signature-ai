'use client';

import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X } from 'lucide-react';

export interface ToastOptions {
  title?: string;
  description: string;
  duration?: number;
  type?: 'foreground' | 'background';
}

const ToastContext = React.createContext<(opts: ToastOptions) => void>(() => {
  /* default noop */
});

// Imperative global function that non-React modules can call
let globalPublish: (opts: ToastOptions) => void = () => {
  console.warn('Toast provider is not mounted yet.');
};

// Тип для toast с методами
export interface ToastFunction {
  (opts: ToastOptions): void;
  error: (message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

export const toast = ((opts: ToastOptions) =>
  globalPublish(opts)) as ToastFunction;

// Вспомогательные методы для удобства использования
toast.error = (message: string, title?: string) => {
  globalPublish({
    title: title || 'Ошибка',
    description: message,
    type: 'foreground',
  });
};

toast.success = (message: string, title?: string) => {
  globalPublish({
    title: title || 'Успешно',
    description: message,
    type: 'foreground',
  });
};

toast.info = (message: string, title?: string) => {
  globalPublish({
    title: title || 'Информация',
    description: message,
    type: 'foreground',
  });
};

toast.warning = (message: string, title?: string) => {
  globalPublish({
    title: title || 'Предупреждение',
    description: message,
    type: 'foreground',
  });
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = React.useState<
    Array<ToastOptions & { id: number }>
  >([]);

  const publish = React.useCallback((opts: ToastOptions) => {
    setToasts(prev => [...prev, { ...opts, id: Date.now() + Math.random() }]);
  }, []);

  React.useEffect(() => {
    globalPublish = publish;
    return () => {
      globalPublish = () => console.warn('Toast provider unmounted');
    };
  }, [publish]);

  const remove = (id: number) =>
    setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={publish}>
      <ToastPrimitive.Provider swipeDirection='right' duration={5000}>
        {children}
        {toasts.map(toastData => (
          <ToastPrimitive.Root
            key={toastData.id}
            open
            onOpenChange={open => {
              if (!open) remove(toastData.id);
            }}
            duration={toastData.duration}
            type={toastData.type || 'foreground'}
            className='bg-background border border-border rounded-md shadow-md p-4'
          >
            {toastData.title && (
              <ToastPrimitive.Title className='font-semibold mb-1'>
                {toastData.title}
              </ToastPrimitive.Title>
            )}
            <ToastPrimitive.Description>
              {toastData.description}
            </ToastPrimitive.Description>
            <ToastPrimitive.Close
              aria-label='Close'
              className='absolute top-2 right-2'
            >
              <X />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className='fixed bottom-4 right-4 flex flex-col gap-2 w-96 z-50' />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
};

export const useToast = () => React.useContext(ToastContext);
