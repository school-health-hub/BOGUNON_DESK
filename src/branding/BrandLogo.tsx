import type { CSSProperties } from "react";
import { PRODUCT_NAME } from "../branding";
import symbolUrl from "./assets/bogunon-desk-symbol.png";
import wordmarkUrl from "./assets/bogunon-desk-wordmark.png";
import "./brand-logo.css";

type BrandLogoProps = { readonly compact?: boolean; readonly className?: string };

export function BrandLogo({ compact = false, className = "" }: BrandLogoProps) {
  return (
    <span aria-label={PRODUCT_NAME} className={`brand-logo ${compact ? "brand-logo--compact" : ""} ${className}`.trim()} role="img">
      <img aria-hidden="true" className="brand-logo__wordmark" src={wordmarkUrl} />
      <img aria-hidden="true" className="brand-logo__symbol" src={symbolUrl} />
    </span>
  );
}

export function BrandSymbolIcon({ size = 28 }: { readonly size?: number; readonly strokeWidth?: number }) {
  return <img alt="" aria-hidden="true" className="brand-symbol-icon" src={symbolUrl} style={{ "--brand-symbol-size": `${size}px` } as CSSProperties} />;
}
