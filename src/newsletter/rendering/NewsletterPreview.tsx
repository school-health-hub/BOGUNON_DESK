import { useId } from "react"
import { buildA4PageScene, buildCardScene, newsletterPageSceneHash, type NewsletterPageScene, type SceneLayer, type TextSceneLayer } from "./renderScene"
import type { RenderDocument, RenderPage } from "./renderDocument"
import { newsletterPlaceholderDataUrl } from "./placeholders"

function textPosition(layer: TextSceneLayer): { readonly x: number; readonly anchor: "start" | "middle" | "end" } {
  switch (layer.style.align) {
    case "left": return { x: layer.frame.x, anchor: "start" }
    case "center": return { x: layer.frame.x + layer.frame.width / 2, anchor: "middle" }
    case "right": return { x: layer.frame.x + layer.frame.width, anchor: "end" }
  }
  throw new Error("Unsupported newsletter text alignment")
}
function Layer({ layer, pageId, instanceId }: { readonly layer: SceneLayer; readonly pageId: string; readonly instanceId: string }) {
  switch (layer.kind) {
    case "shape":
      return <rect id={layer.layerId} x={layer.frame.x} y={layer.frame.y} width={layer.frame.width} height={layer.frame.height} rx={layer.radius ?? 0} fill={layer.fill} stroke={layer.stroke} />
    case "image": {
      const clipId = `preview-clip-${instanceId}-${pageId}-${layer.slotId}`
      return <g id={layer.layerId} data-placeholder-kind={layer.placeholderKind}><defs><clipPath id={clipId}><rect x={layer.frame.x} y={layer.frame.y} width={layer.frame.width} height={layer.frame.height} rx="12" /></clipPath></defs><image href={newsletterPlaceholderDataUrl(layer.placeholderKind)} x={layer.frame.x} y={layer.frame.y} width={layer.frame.width} height={layer.frame.height} preserveAspectRatio={layer.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"} clipPath={`url(#${clipId})`} /></g>
    }
    case "text": {
      const position = textPosition(layer)
      return <text id={layer.layerId} fill={layer.style.color} fontFamily={layer.style.fontFamily} fontSize={layer.style.fontSize} fontWeight={layer.style.fontWeight} textAnchor={position.anchor}>
        {layer.lines.map((line, index) => <tspan key={`${layer.layerId}-${index}`} x={position.x} y={layer.frame.y + layer.style.fontSize + index * layer.style.fontSize * layer.style.lineHeight}>{line}</tspan>)}
      </text>
    }
  }
}
function ScenePreview({ scene, label, className }: { readonly scene: NewsletterPageScene; readonly label: string; readonly className: string }) {
  const instanceId = useId().replace(/:/g, "")
  const layers = [...scene.layers].sort((left, right) => left.zOrder - right.zOrder || left.layerId.localeCompare(right.layerId))
  return <svg className={`newsletter-canvas ${className}`} viewBox={`0 0 ${scene.width} ${scene.height}`} role="img" aria-label={label} data-scene-template-version={scene.templateVersion} data-scene-hash={newsletterPageSceneHash(scene)}>
    {layers.map((layer) => <Layer key={layer.layerId} layer={layer} pageId={scene.pageId} instanceId={instanceId} />)}
  </svg>
}
export function CardPreview({ page }: { readonly page: RenderPage }) { return <ScenePreview scene={buildCardScene(page)} label={`${page.pageId} 미리보기`} className="newsletter-card-canvas" /> }
export function A4Preview({ document }: { readonly document: RenderDocument }) { return <ScenePreview scene={buildA4PageScene(document.a4)} label="A4 보건소식지 미리보기" className="newsletter-a4-canvas" /> }
