import type { OfficialDocumentDraft } from "./types";

/** Keep validation metadata aligned with the visible canonical manuscript. */
export function editOfficialDocumentBody(draft: OfficialDocumentDraft, body: string): OfficialDocumentDraft {
  const headings = [...body.matchAll(/^[ \t]*붙임(?:[ \t]+|(?=\r?$))/gmu)];
  const heading = headings.at(-1);
  const section = heading === undefined
    ? ""
    : body.slice(heading.index + heading[0].length).replace(/[ \t]*끝\.[ \t\r\n]*$/u, "").trim();
  return { ...draft, body, attachments: section === "" ? "" : `붙임\n${section}\n끝.` };
}
