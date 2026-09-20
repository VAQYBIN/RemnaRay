import type { ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from './lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-sm hover:opacity-90',
        secondary: 'border border-border bg-surface text-foreground hover:bg-muted/40',
        ghost: 'text-foreground hover:bg-muted/40',
        danger: 'bg-danger text-white shadow-sm hover:opacity-90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 rounded-md px-3',
        md: 'h-10 px-4 py-2',
        lg: 'h-12 rounded-lg px-6 text-base',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /**
   * Render the child element with the button styling instead of a `<button>`.
   * A link that looks like a button must stay a single interactive element:
   * nesting `<button>` inside `<a>` fails the WCAG target-size check (NFR-010).
   */
  asChild?: boolean;
}

export function Button({
  asChild = false,
  className,
  variant,
  size,
  type = 'button',
  ...props
}: ButtonProps) {
  if (asChild)
    return <Slot className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} type={type} {...props} />
  );
}
