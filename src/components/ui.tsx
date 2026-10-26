import { useEffect, useId, useRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { X, Smile, Meh, Moon, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { Mood, Unit } from '../../shared/types.ts';
import { formatWeight } from '../../shared/domain.ts';

export function IconButton({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" className="icon-button" aria-label={label} title={label} {...props}>{children}</button>;
}

export function Modal({ title, eyebrow, children, onClose, className = '' }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    node?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => { node?.close(); };
  }, []);
  return <dialog ref={dialog} className={`modal ${className}`} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal-inner">
      <div className="modal-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id={titleId}>{title}</h2></div><IconButton label="关闭对话框" onClick={onClose}><X size={19} /></IconButton></div>
      {children}
    </div>
  </dialog>;
}

export const moodLabels: Record<Mood, string> = { good: '状态很好', neutral: '平常的一天', tired: '有点疲惫' };
export const moodIcons = { good: Smile, neutral: Meh, tired: Moon };
export function MoodIcon({ mood, size = 16 }: { mood: Mood; size?: number }) {
  const Icon = moodIcons[mood];
  return <span className={`mood-icon ${mood}`} title={moodLabels[mood]}><Icon size={size} /></span>;
}

export function Change({ value, unit, label = '', color = false }: { value: number | null; unit: Unit; label?: string; color?: boolean }) {
  const Icon = value == null || Math.abs(value) < 0.05 ? Minus : value < 0 ? ArrowDownRight : ArrowUpRight;
  return <span className={`change ${color ? 'tinted' : ''}`}><Icon size={14} />{value == null ? '暂无对比' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatWeight(Math.abs(value), unit)} ${unit}`}{label && <span>{label}</span>}</span>;
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function formatDay(date: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('zh-CN', options ?? { month: 'long', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
}
