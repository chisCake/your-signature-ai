'use client';

import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
}

// expose promise-based confirm function
let confirmImpl: (opts: ConfirmOptions) => Promise<boolean> = async () => false;

export const confirm = (opts: ConfirmOptions): Promise<boolean> =>
  confirmImpl(opts);

export const ConfirmDialogProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [queue, setQueue] = React.useState<
    Array<ConfirmOptions & { resolve: (res: boolean) => void }>
  >([]);

  const enqueue = (opts: ConfirmOptions) =>
    new Promise<boolean>(resolve =>
      setQueue(q => [...q, { ...opts, resolve }])
    );

  React.useEffect(() => {
    confirmImpl = enqueue;
    return () => {
      confirmImpl = async () => false;
    };
  }, []);

  const current = queue[0];
  const close = (res: boolean) => {
    if (!current) return;
    current.resolve(res);
    setQueue(q => q.slice(1));
  };

  return (
    <>
      {children}
      {current && (
        <AlertDialogPrimitive.Root open onOpenChange={() => close(false)}>
          <AlertDialogPrimitive.Portal>
            <AlertDialogPrimitive.Overlay className='fixed inset-0 bg-black/40' />
            <AlertDialogPrimitive.Content className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background p-6 rounded-md max-w-lg w-full shadow-lg'>
              {current.title ? (
                <AlertDialogPrimitive.Title className='text-lg font-medium mb-2'>
                  {current.title}
                </AlertDialogPrimitive.Title>
              ) : (
                <AlertDialogPrimitive.Title>
                  <VisuallyHidden>Подтверждение</VisuallyHidden>
                </AlertDialogPrimitive.Title>
              )}
              {current.description && (
                <AlertDialogPrimitive.Description className='mb-4'>
                  {current.description}
                </AlertDialogPrimitive.Description>
              )}
              <div className='flex justify-end gap-2'>
                <AlertDialogPrimitive.Cancel asChild>
                  <button
                    className='px-4 py-2 border rounded-md'
                    onClick={() => close(false)}
                  >
                    {current.cancelText || 'Отмена'}
                  </button>
                </AlertDialogPrimitive.Cancel>
                <AlertDialogPrimitive.Action asChild>
                  <button
                    className='px-4 py-2 bg-primary text-primary-foreground rounded-md'
                    onClick={() => close(true)}
                  >
                    {current.confirmText || 'ОК'}
                  </button>
                </AlertDialogPrimitive.Action>
              </div>
            </AlertDialogPrimitive.Content>
          </AlertDialogPrimitive.Portal>
        </AlertDialogPrimitive.Root>
      )}
    </>
  );
};
