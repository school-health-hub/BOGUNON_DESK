import { useEffect, useState } from "react"
import type { NewsletterDesignState } from "./designSchema"
import { resolveDesignAssets } from "./assetResolution"

type AssetState =
  | { readonly design: NewsletterDesignState; readonly status: "ready"; readonly assets: ReadonlyMap<string, string> }
  | { readonly design: NewsletterDesignState; readonly status: "loading" }
  | { readonly design: NewsletterDesignState; readonly status: "error"; readonly message: string }

export function useNewsletterAssets(design: NewsletterDesignState): AssetState {
  const [state, setState] = useState<AssetState>({ design, status: "loading" })
  useEffect(() => {
    let active = true
    resolveDesignAssets(design, design.designRevision).then((assets) => {
      if (active) setState({ design, status: "ready", assets })
    }, (error: unknown) => {
      if (active) setState({ design, status: "error", message: error instanceof Error ? error.message : "이미지 검증에 실패했습니다." })
    })
    return () => { active = false }
  }, [design])
  return state.design === design ? state : { design, status: "loading" }
}
