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

export type RecordHelperReportPromptInput = {
  readonly reportText: string;
  readonly teacherMemo: string;
};

export const buildRecordHelperReportPrompt = ({ reportText, teacherMemo }: RecordHelperReportPromptInput): string => {
  const sections = [
    "다음 자료를 바탕으로 학교생활기록부에 참고할 기록 문구 초안을 작성해 주세요.",
    "",
    "작성 원칙",
    "- 제공된 사실만 사용하세요.",
    "- 새로운 사실, 성과, 역할, 태도를 창작하지 마세요.",
    "- 학생 보고서의 자기서술과 교사의 실제 관찰을 구분하세요.",
    "- 학생 보고서에만 있는 내용을 교사가 직접 관찰한 사실처럼 바꾸지 마세요.",
    "- 교사 메모로 확인된 내용만 관찰 근거로 활용하세요.",
    "- 이름, 학번, 연락처 등 식별정보를 생성하지 마세요.",
    "- 건강, 상담 등 민감정보를 생성하지 마세요.",
    "- 과장 표현을 피하고 교사가 최종 검토할 초안으로 작성하세요.",
    "- 불필요한 설명 없이 결과 문구 중심으로 작성하세요.",
    "",
    "[학생 활동보고서]",
    reportText.trim(),
  ];
  const memo = teacherMemo.trim();
  if (memo !== "") sections.push("", "[교사 메모/관찰]", memo);
  return sections.join("\n");
};
