'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithoutRef, ComponentRef, ReactNode } from 'react';
import { createContext, forwardRef, useCallback, useContext, useMemo, useState } from 'react';
import { X } from 'lucide-react';

import { cn } from './lib/utils';

export const ToastProviderPrimitive = ToastPrimitive.Provider;

const toastVariants = cva(
  'pointer-events-auto relative flex w-full items-start gap-3 rounded-lg border p-4 shadow-lg',
  {
    variants: {
      variant: {
        default: 'border-border bg-surface text-foreground',
        success: 'border-success/40 bg-success/10 text-foreground',
        danger: 'border-danger/40 bg-danger/10 text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type ToastVariant = NonNullable<VariantProps<typeof toastVariants>['variant']>;

export const ToastViewport = forwardRef<
  ComponentRef<typeof ToastPrimitive.Viewport>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(function ToastViewport({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Viewport
      className={cn(
        'pointer-events-none fixed bottom-0 right-0 z-100 flex w-full max-w-sm flex-col gap-2 p-4',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});

export const ToastRoot = forwardRef<
  ComponentRef<typeof ToastPrimitive.Root>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & VariantProps<typeof toastVariants>
>(function ToastRoot({ className, variant, children, ...props }, ref) {
  return (
    <ToastPrimitive.Root className={cn(toastVariants({ variant }), className)} ref={ref} {...props}>
      {children}
      <ToastPrimitive.Close
        aria-label="Close"
        className="ml-auto rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <X className="size-4" aria-hidden="true" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
});

export const ToastTitle = forwardRef<
  ComponentRef<typeof ToastPrimitive.Title>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(function ToastTitle({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Title className={cn('text-sm font-semibold', className)} ref={ref} {...props} />
  );
});

export const ToastDescription = forwardRef<
  ComponentRef<typeof ToastPrimitive.Description>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(function ToastDescription({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      ref={ref}
      {...props}
    />
  );
});

export type ToastMessage = {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type ToastContextValue = { toast: (message: Omit<ToastMessage, 'id'>) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const toast = useCallback((message: Omit<ToastMessage, 'id'>) => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setMessages((current) => [...current, { ...message, id }]);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {messages.map((message) => (
          <ToastRoot
            key={message.id}
            {...(message.variant ? { variant: message.variant } : {})}
            onOpenChange={(open) => {
              if (!open) setMessages((current) => current.filter((item) => item.id !== message.id));
            }}
          >
            <div className="flex flex-col gap-1">
              <ToastTitle>{message.title}</ToastTitle>
              {message.description ? (
                <ToastDescription>{message.description}</ToastDescription>
              ) : null}
            </div>
          </ToastRoot>
        ))}
        <ToastViewport />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
