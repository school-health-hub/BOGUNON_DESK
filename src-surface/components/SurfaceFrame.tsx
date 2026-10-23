import { Grip, X } from "lucide-react";
import type { ReactNode } from "react";

type Props = Readonly<{
  title: string;
  icon: ReactNode;
  editing: boolean;
  children: ReactNode;
  tone?: "information" | "work" | "utility";
  onHide: () => void;
}>;

export function SurfaceFrame({ title, icon, editing, children, tone = "work", onHide }: Props) {
  return <article className={`surface-card surface-card--${tone}`} aria-label={title}>
    <header className="surface-card__header surface-drag-handle">
      <span className="surface-card__title">{icon}<strong>{title}</strong></span>
      {editing && <span className="surface-card__tools">
        <Grip size={15} aria-hidden="true" />
        <button type="button" className="surface-icon-button" aria-label={`${title} 숨기기`} onClick={onHide}><X size={15} /></button>
      </span>}
    </header>
    <div className="surface-card__body">{children}</div>
  </article>;
}
