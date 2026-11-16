// @vitest-environment jsdom
import {fireEvent,render,screen,waitFor} from "@testing-library/react"
import {describe,expect,it,vi} from "vitest"
import {createNewsletterDesignState} from "./rendering/designSchema"
import {upgradeNewsletterDesignStateV2} from "./rendering/designState"
import {UserImageImportPanel} from "./UserImageImportPanel"
import type {ImportedUserImage} from "./userImageImport"

const NOW="2026-11-16T04:00:00.000Z",SHA="a".repeat(64)
const imported:ImportedUserImage={assetId:"chatgpt-import-aaaaaaaaaaaaaaaa",originalName:"handwashing.png",mediaType:"image/png",sha256:SHA,width:1024,height:1024,byteSize:4,bytes:Uint8Array.of(1,2,3,4)}

describe("ChatGPT image import panel",()=>{
  it("requires explicit review, then places one image in the matching A4 and card slots",async()=>{
    vi.stubGlobal("URL",{createObjectURL:vi.fn(()=>"blob:synthetic"),revokeObjectURL:vi.fn()})
    const design=upgradeNewsletterDesignStateV2(createNewsletterDesignState({projectId:"import-ui",canonicalProjectRevision:1,now:NOW}),NOW)
    const onApply=vi.fn(),inspect=vi.fn(async()=>imported)
    render(<UserImageImportPanel design={design} images={new Map()} topicTitles={["손 위생","추위","생활 리듬","마음","식사","경계"]} inspect={inspect} now={()=>NOW} onApply={onApply}/>)
    const file=new File([Uint8Array.of(1)],"handwashing.png",{type:"image/png"})
    fireEvent.change(screen.getByLabelText("ChatGPT 생성 이미지 선택"),{target:{files:[file]}})
    await screen.findByText(/1024×1024/)
    expect(await screen.findByRole("img",{name:"handwashing.png 가져온 이미지 검토"})).toBeTruthy()
    expect(screen.getByRole("button",{name:"검토 승인 후 A4·카드에 배치"})).toHaveProperty("disabled",true)
    fireEvent.click(screen.getByLabelText("이미지 내용과 출처를 검토했습니다"))
    fireEvent.click(screen.getByRole("button",{name:"검토 승인 후 A4·카드에 배치"}))
    await waitFor(()=>expect(onApply).toHaveBeenCalledOnce())
    const call=onApply.mock.calls[0]
    expect(call?.[0].a4Layout.modules[0].image.assetId).toBe(imported.assetId)
    expect(call?.[0].cardLayouts[1].image.assetId).toBe(imported.assetId)
    expect(call?.[0].assetManifest[0]).toMatchObject({exportApproval:"pending",registry:{imported:{source:"chatgpt-user-import"}}})
    expect(call?.[1].get(`asset:${SHA}`)).toEqual(imported.bytes)
  })
})
