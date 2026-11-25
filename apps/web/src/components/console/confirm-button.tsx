'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A button that asks before it does something that cannot be undone. It opens a modal dialog (the
 * browser handles focus and Escape), names what will happen, and only then runs `onConfirm`.
 */
export function ConfirmButton({
  label,
  title,
  confirmLabel,
  onConfirm,
  disabled,
  children,
}: {
  /** The button's own text. */
  label: string;
  /** The question: what is about to happen. */
  title: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  /** What else the person should know before confirming. */
  children?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = dialog.current;
    return () => {
      if (el?.open) el.close();
    };
  }, []);

  return (
    <>
      <button
        type="button"
        data-btn
        data-danger
        disabled={disabled}
        onClick={() => dialog.current?.showModal()}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        data-confirm
        aria-label={title}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        <h2>{title}</h2>
        {children ? <div data-confirm-body>{children}</div> : null}
        <div data-confirm-actions>
          <button type="button" data-btn onClick={() => dialog.current?.close()}>
            Keep it
          </button>
          <button
            type="button"
            data-btn
            data-danger
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
                dialog.current?.close();
              }
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
