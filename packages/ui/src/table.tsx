import type { ComponentPropsWithoutRef } from 'react';

import { cn } from './lib/utils';

export function Table({ className, ...props }: ComponentPropsWithoutRef<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn('w-full caption-bottom border-collapse text-sm', className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentPropsWithoutRef<'thead'>) {
  return <thead className={cn('[&_tr]:border-b [&_tr]:border-border', className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentPropsWithoutRef<'tbody'>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableFooter({ className, ...props }: ComponentPropsWithoutRef<'tfoot'>) {
  return <tfoot className={cn('border-t border-border font-medium', className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentPropsWithoutRef<'tr'>) {
  return (
    <tr
      className={cn('border-b border-border transition-colors hover:bg-muted/30', className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ComponentPropsWithoutRef<'th'>) {
  return (
    <th
      className={cn(
        'h-10 px-3 text-left align-middle font-semibold text-muted-foreground',
        className,
      )}
      scope="col"
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentPropsWithoutRef<'td'>) {
  return <td className={cn('px-3 py-2 align-middle', className)} {...props} />;
}

export function TableCaption({ className, ...props }: ComponentPropsWithoutRef<'caption'>) {
  return <caption className={cn('mt-3 text-sm text-muted-foreground', className)} {...props} />;
}
