'use client';

import { useState, type ReactNode } from 'react';

import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Input } from './input';
import { Label } from './label';

export type ConfirmDialogLabels = {
  confirm: string;
  cancel: string;
  reasonLabel: string;
  reasonPlaceholder?: string;
  reasonRequired?: string;
};

/**
 * Destructive or money-moving admin action confirmation.
 * `requireReason` enforces the ⚑ `reason` field required by section 14.3.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  labels,
  requireReason = false,
  destructive = false,
  pending = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  labels: ConfirmDialogLabels;
  requireReason?: boolean;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: (reason: string) => void;
  children?: ReactNode;
}) {
  const [reason, setReason] = useState('');
  const reasonMissing = requireReason && reason.trim().length < 3;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason('');
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
        {requireReason ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-reason">{labels.reasonLabel}</Label>
            <Input
              aria-invalid={reasonMissing}
              id="confirm-reason"
              placeholder={labels.reasonPlaceholder ?? ''}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
              }}
            />
            {reasonMissing && labels.reasonRequired ? (
              <p className="text-xs text-danger">{labels.reasonRequired}</p>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {labels.cancel}
          </Button>
          <Button
            disabled={pending || reasonMissing}
            variant={destructive ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm(reason.trim());
            }}
          >
            {labels.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
