import type { RenderDocument, RenderPage, RenderTextBlock } from "./renderDocument"

type SvgTextProps = { readonly block: RenderTextBlock }

function SvgText({ block }: SvgTextProps) {
  const anchor = block.style.align === "center" ? "middle" : block.style.align === "right" ? "end" : "start"
  const x = block.style.align === "center" ? block.frame.x + block.frame.width / 2 : block.style.align === "right" ? block.frame.x + block.frame.width : block.frame.x
  return <text x={x} y={block.frame.y + block.style.fontSize} fill={block.style.color} fontFamily="Pretendard" fontSize={block.style.fontSize} fontWeight={block.style.fontWeight} textAnchor={anchor}>
    {block.lines.map((line, index) => <tspan key={`${block.id}-${index}`} x={x} dy={index === 0 ? 0 : block.style.fontSize * block.style.lineHeight}>{line}</tspan>)}
  </text>
}

function ImageSlot({ page }: { readonly page: RenderPage }) {
  const { frame } = page.image
  return <g data-image-slot={page.image.slotId}>
    <rect x={frame.x} y={frame.y} width={frame.width} height={frame.height} rx="24" fill="#edf3ec" stroke="#8aa89a" strokeWidth="3" strokeDasharray="14 10" />
    <text x={frame.x + frame.width / 2} y={frame.y + frame.height / 2} fill="#59746a" fontFamily="Pretendard" fontSize="28" textAnchor="middle">승인된 이미지 슬롯</text>
  </g>
}

export function CardPreview({ page }: { readonly page: RenderPage }) {
  return <svg className="newsletter-canvas newsletter-card-canvas" viewBox="0 0 1200 1200" role="img" aria-label={`${page.pageId} 미리보기`}>
    <rect width="1200" height="1200" fill={page.background} />
    <rect x="28" y="28" width="1144" height="1144" rx="42" fill="none" stroke="#b7c8ae" strokeWidth="4" />
    <SvgText block={page.title} />
    <ImageSlot page={page} />
    <SvgText block={page.body} />
  </svg>
}

export function A4Preview({ document }: { readonly document: RenderDocument }) {
  const page = document.a4
  return <svg className="newsletter-canvas newsletter-a4-canvas" viewBox="0 0 1240 1754" role="img" aria-label="A4 보건소식지 미리보기">
    <rect width={page.width} height={page.height} fill={page.background} />
    <rect x={page.safeMargin} y={page.safeMargin} width={page.width - page.safeMargin * 2} height={page.height - page.safeMargin * 2} fill="none" stroke="#d3b98b" strokeWidth="2" strokeDasharray="10 8" />
    <SvgText block={page.title} />
    <SvgText block={page.publicationMeta} />
    {page.modules.map((module) => <g key={module.sectionId}>
      <rect x={module.title.frame.x - 14} y={module.title.frame.y - 18} width={module.title.frame.width + 28} height={module.title.frame.height + module.body.frame.height + 40} rx="22" fill="#ffffff" stroke="#dce6d9" strokeWidth="2" />
      <SvgText block={module.title} />
      <SvgText block={module.body} />
      <g data-image-slot={module.image.slotId}>
        <rect x={module.image.frame.x} y={module.image.frame.y} width={module.image.frame.width} height={module.image.frame.height} rx="14" fill="#edf3ec" stroke="#8aa89a" strokeWidth="2" strokeDasharray="8 7" />
        <text x={module.image.frame.x + module.image.frame.width / 2} y={module.image.frame.y + module.image.frame.height / 2} fill="#59746a" fontFamily="Pretendard" fontSize="16" textAnchor="middle">이미지</text>
      </g>
    </g>)}
    <SvgText block={page.footer} />
  </svg>
}
