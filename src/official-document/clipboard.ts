type ClipboardWriter = (value: string) => Promise<void>;

export const copyOfficialDocumentText = async (
  writeText: ClipboardWriter,
  label: string,
  value: string,
): Promise<string> => {
  await writeText(value);
  return `${label}을(를) 복사했습니다.`;
};
