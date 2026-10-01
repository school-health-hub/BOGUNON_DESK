import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type PanelProps = {
  readonly title: string;
  readonly icon: LucideIcon;
  readonly action?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
};

export function Panel({ title, icon: Icon, action, className = "", children }: PanelProps) {
  return (
    <section className={`panel ${className}`.trim()}>
      <header className="panel__header">
        <div className="panel__title-wrap">
          <span className="panel__icon" aria-hidden="true"><Icon size={17} strokeWidth={2} /></span>
          <h2 className="panel__title">{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
