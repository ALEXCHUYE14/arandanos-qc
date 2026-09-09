"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "./button";

/**
 * Modal de confirmación genérico para acciones destructivas (borrados
 * masivos, etc.) — más visible que un window.confirm() nativo: muestra
 * título + descripción (ej. cuántos registros se van a borrar) y requiere
 * un clic explícito en el botón de confirmar, no solo Enter/Escape.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-sm rounded-lg bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className={danger ? "h-5 w-5 shrink-0 text-danger" : "h-5 w-5 shrink-0 text-warning"} />
          <h2 id="confirm-dialog-title" className="text-sm font-bold text-ink">
            {title}
          </h2>
        </div>
        <div className="mb-4 text-sm text-muted">{description}</div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "default"} size="sm" onClick={onConfirm} disabled={busy}>
            {busy ? "Eliminando…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
