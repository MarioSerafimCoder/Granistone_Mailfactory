'use client';
import {
  useEffect,
  useRef,
  useId,
  type ReactNode,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { X } from 'lucide-react';
export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <label className="field">
      <span id={id}>{label}</span>
      <input aria-labelledby={id} aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </label>
  );
}
export function TextArea({
  label,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const id = useId();
  return (
    <label className="field">
      <span id={id}>{label}</span>
      <textarea aria-labelledby={id} rows={3} {...props} />
    </label>
  );
}
export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <label className="field">
      <span id={id}>{label}</span>
      <select aria-labelledby={id} {...props}>
        {children}
      </select>
    </label>
  );
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
