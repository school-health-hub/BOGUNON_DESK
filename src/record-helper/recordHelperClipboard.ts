type ClipboardWriter = (value: string) => Promise<void>;

export type RecordHelperClipboardResult =
  | { readonly status: "success"; readonly message: string }
  | { readonly status: "error"; readonly message: string };

export const copyRecordHelperDraft = async (
  writeText: ClipboardWriter,
  draft: string,
): Promise<RecordHelperClipboardResult> => {
  try {
    await writeText(draft);
    return { status: "success", message: "AI 초안을 복사했습니다." };
  } catch {
    return { status: "error", message: "AI 초안을 복사하지 못했습니다." };
  }
};
