'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithoutRef, ComponentRef } from 'react';
import { forwardRef } from 'react';
import { X } from 'lucide-react';

import { cn } from './lib/utils';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetPortal = DialogPrimitive.Portal;

const sheetVariants = cva(
  'fixed z-50 flex flex-col gap-4 border-border bg-surface p-6 text-foreground shadow-xl',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b',
        bottom: 'inset-x-0 bottom-0 border-t',
        left: 'inset-y-0 left-0 h-full w-80 max-w-[85vw] border-r',
        right: 'inset-y-0 right-0 h-full w-80 max-w-[85vw] border-l',
      },
    },
    defaultVariants: { side: 'right' },
  },
);

export const SheetOverlay = forwardRef<
  ComponentRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function SheetOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      className={cn('fixed inset-0 z-50 bg-black/60 backdrop-blur-sm', className)}
      ref={ref}
      {...props}
    />
  );
});

export const SheetContent = forwardRef<
  ComponentRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & VariantProps<typeof sheetVariants>
>(function SheetContent({ className, children, side, ...props }, ref) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        className={cn(sheetVariants({ side }), className)}
        ref={ref}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring">
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  );
});

export const SheetHeader = ({ className, ...props }: ComponentPropsWithoutRef<'div'>) => (
  <div className={cn('flex flex-col space-y-2', className)} {...props} />
);

export const SheetFooter = ({ className, ...props }: ComponentPropsWithoutRef<'div'>) => (
  <div
    className={cn('mt-auto flex flex-col gap-2 sm:flex-row sm:justify-end', className)}
    {...props}
  />
);

export const SheetTitle = forwardRef<
  ComponentRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function SheetTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      className={cn('text-lg font-semibold', className)}
      ref={ref}
      {...props}
    />
  );
});

export const SheetDescription = forwardRef<
  ComponentRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function SheetDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      ref={ref}
      {...props}
    />
  );
});
