import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "../../branding/BrandLogo";

type WorkspaceHeaderProps = {
  readonly title: string;
  readonly description?: string;
  readonly context?: string;
  readonly identity?: ReactNode;
  readonly className?: string;
  readonly onBack: () => void;
  readonly backDisabled?: boolean;
  readonly actions?: ReactNode;
};

/** Presentation only: navigation, dirty-state checks and work remain caller-owned. */
export function WorkspaceHeader({
  title,
  description,
  context,
  identity = <BrandLogo />,
  className = "",
  onBack,
  backDisabled = false,
  actions,
}: WorkspaceHeaderProps) {
  return (
    <header className={`td2-workspace-header ${className}`.trim()}>
      <div className="td2-heading">
        <div className="td2-heading-meta">
          <button type="button" className="td2-back" disabled={backDisabled} onClick={onBack}>
            <ArrowLeft size={16} aria-hidden="true" />
            보건 업무로
          </button>
          {context ? <span className="td2-context">{context}</span> : null}
        </div>
        <div className="td2-heading-identity">
          {identity ? <span className="td2-header-identity">{identity}</span> : null}
          <div className="td2-heading-copy">
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
          </div>
        </div>
      </div>
      {actions ? <div className="td2-header-actions">{actions}</div> : null}
    </header>
  );
}
