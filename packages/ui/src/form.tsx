'use client';

import { Slot } from '@radix-ui/react-slot';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { createContext, useContext, useId } from 'react';
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from 'react-hook-form';

import { Label } from './label';
import { cn } from './lib/utils';

export { useForm, useFormContext, type SubmitHandler } from 'react-hook-form';
export { zodResolver } from '@hookform/resolvers/zod';

export function Form<TFieldValues extends FieldValues>({
  form,
  children,
}: {
  form: UseFormReturn<TFieldValues>;
  children: ReactNode;
}) {
  return <FormProvider {...form}>{children}</FormProvider>;
}

type FieldContextValue = { name: string };
const FormFieldContext = createContext<FieldContextValue | null>(null);

type ItemContextValue = { id: string };
const FormItemContext = createContext<ItemContextValue | null>(null);

export function FormField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

function useFormField() {
  const field = useContext(FormFieldContext);
  const item = useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState();
  if (!field || !item) throw new Error('Form fields must be used inside <FormField><FormItem>');
  const state = getFieldState(field.name, formState);
  return {
    id: item.id,
    name: field.name,
    formItemId: `${item.id}-control`,
    formDescriptionId: `${item.id}-description`,
    formMessageId: `${item.id}-message`,
    error: state.error,
  };
}

export function FormItem({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  const id = useId();
  return (
    <FormItemContext.Provider value={{ id }}>
      <div className={cn('flex flex-col gap-2', className)} {...props} />
    </FormItemContext.Provider>
  );
}

export function FormLabel({ className, ...props }: ComponentPropsWithoutRef<typeof Label>) {
  const { error, formItemId } = useFormField();
  return (
    <Label className={cn(error && 'text-danger', className)} htmlFor={formItemId} {...props} />
  );
}

export function FormControl(props: ComponentPropsWithoutRef<typeof Slot>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  return (
    <Slot
      aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
      aria-invalid={Boolean(error)}
      id={formItemId}
      {...props}
    />
  );
}

export function FormDescription({ className, ...props }: ComponentPropsWithoutRef<'p'>) {
  const { formDescriptionId } = useFormField();
  return (
    <p
      className={cn('text-xs text-muted-foreground', className)}
      id={formDescriptionId}
      {...props}
    />
  );
}

export function FormMessage({ className, children, ...props }: ComponentPropsWithoutRef<'p'>) {
  const { error, formMessageId } = useFormField();
  const body = error ? (error.message ?? '') : children;
  if (!body) return null;
  return (
    <p className={cn('text-xs font-medium text-danger', className)} id={formMessageId} {...props}>
      {body}
    </p>
  );
}
