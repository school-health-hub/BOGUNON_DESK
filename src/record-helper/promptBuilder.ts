export type RecordHelperPromptInput = {
  readonly activityMemo: string;
  readonly writingRequest: string;
};

export const buildRecordHelperPrompt = ({
  activityMemo,
  writingRequest,
}: RecordHelperPromptInput): string => {
  const sections = [
    "다음 비식별 활동·관찰 메모를 근거로 학교생활기록부에 참고할 수 있는 기록 문구 초안을 작성해 주세요.",
    "",
    "작성 원칙",
    "- 입력에 존재하는 사실만 사용하세요.",
    "- 새로운 사실, 성과, 태도, 역할을 추정하거나 만들어내지 마세요.",
    "- 학생 이름, 학번, 연락처 등 식별정보를 새로 생성하지 마세요.",
    "- 건강정보, 상담정보 등 민감정보를 새로 추가하지 마세요.",
    "- 과장 표현을 피하고 교사가 검토·수정할 초안으로 작성하세요.",
    "- 자연스러운 한국어 관찰 서술형을 사용하세요.",
    "- 불필요한 머리말이나 설명 없이 결과 문구 중심으로 작성하세요.",
    "",
    "비식별 활동·관찰 메모",
    activityMemo.trim(),
  ];
  const trimmedRequest = writingRequest.trim();
  if (trimmedRequest !== "") {
    sections.push("", "작성 요청 / 강조할 점", trimmedRequest);
  }
  return sections.join("\n");
};
