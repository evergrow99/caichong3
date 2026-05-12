"use client";

import type { ReactNode } from "react";
import { useId } from "react";

type AppConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isConfirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

type AppToastProps = {
  message: string | null;
};

export function AppConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确定",
  cancelLabel = "取消",
  isConfirming = false,
  onCancel,
  onConfirm
}: AppConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  if (!open) {
    return null;
  }

  return (
    <AppModalLayer onDismiss={isConfirming ? undefined : onCancel}>
      <section className="app-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <div className="app-dialog-copy">
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>{description}</p>
        </div>
        <div className="app-dialog-actions">
          <button className="app-dialog-button secondary" type="button" onClick={onCancel} disabled={isConfirming}>
            {cancelLabel}
          </button>
          <button className="app-dialog-button primary" type="button" onClick={onConfirm} disabled={isConfirming}>
            {isConfirming ? "处理中" : confirmLabel}
          </button>
        </div>
      </section>
    </AppModalLayer>
  );
}

export function AppToast({ message }: AppToastProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="app-toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}

function AppModalLayer({ children, onDismiss }: { children: ReactNode; onDismiss?: () => void }) {
  return (
    <div className="modal-layer">
      <button className="modal-backdrop app-dialog-backdrop" aria-label="关闭弹窗" type="button" onClick={onDismiss} />
      {children}
    </div>
  );
}
