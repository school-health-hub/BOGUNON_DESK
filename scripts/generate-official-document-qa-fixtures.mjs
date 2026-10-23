import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

import { officialDocumentQaPaths, prepareOfficialDocumentQaPaths } from "./official-document-qa-paths.mjs";

const paths = officialDocumentQaPaths();
prepareOfficialDocumentQaPaths(paths);
const directory = paths.fixtures;
const headers = [
  "No", "사용여부", "문서목적", "업무분야", "자료명", "설명", "참고문서URL", "문서ID", "파일형태",
  "템플릿본문", "붙임예시", "메신저예시", "체크리스트", "공개구분", "비식별여부", "자동본문추출",
  "상태", "우선순위", "열기", "메모", "자료형태구분", "비식별원문URL", "원문노출여부", "표복사용본문",
  "표복사안내", "AI정리상태", "AI정리일시", "AI검토필요", "AI정리메모",
];

const normalize = (value) => value.replace(/\r\n?/g, "\n").trim();
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const makeRow = (values) => headers.map((header) => values[header] ?? "");
const rowHash = (row) => sha256(JSON.stringify(row.map(normalize)));
const approvedRow = makeRow({
  No: "101",
  사용여부: "TRUE",
  문서목적: "계획 기안",
  업무분야: "합성 보건업무",
  자료명: "합성 보건업무 계획",
  설명: "실제 기관과 개인을 포함하지 않은 격리 QA 자료",
  파일형태: "PDF",
  템플릿본문: "1. 관련: [입력 필요]\n2. [업무명]을 다음과 같이 운영하고자 합니다.\n  가. 대상: [입력 필요]\n  나. 일시: [입력 필요]",
  붙임예시: "합성 운영계획\n합성 안내문",
  메신저예시: "[업무명] 안내입니다. 일정은 [입력 필요]입니다.",
  체크리스트: "개인정보 포함 여부 확인\n일정 및 대상 확인",
  공개구분: "합성자료",
  비식별여부: "TRUE",
  상태: "QA 전용",
  우선순위: "중간",
  자료형태구분: "표포함",
  표복사용본문: "구분\t인원\n완료\t[입력 필요]",
  표복사안내: "탭 구분 합성 텍스트",
});
const disabledRow = makeRow({
  No: "205",
  사용여부: "FALSE",
  문서목적: "결과 보고",
  업무분야: "합성 결과",
  자료명: "사용 중지 합성 자료",
  비식별여부: "TRUE",
});
const privacyRow = makeRow({
  No: "309",
  사용여부: "TRUE",
  문서목적: "안내문 발송",
  업무분야: "합성 안내",
  자료명: "비식별 확인 실패 자료",
  설명: "학생명: 홍길동",
  비식별여부: "FALSE",
});

const packageWith = (id, rows, approvedRows) => ({
  schemaVersion: 1,
  packageId: id,
  packageVersion: "1.0.0",
  publishedAt: "2026-10-22",
  source: "격리 QA 합성 자료",
  usageTerms: "로컬 격리 검증 전용",
  redistribution: "재배포 금지",
  review: { reviewer: "합성 검토", reviewedAt: "2026-10-22", approvedRows },
  headers,
  rows,
});

const validPackage = packageWith(
  "official-document-qa-valid",
  [approvedRow, disabledRow],
  [approvedRow, disabledRow].map((row) => ({ sourceNo: row[0], sha256: rowHash(row) })),
);
const hashMismatchPackage = packageWith(
  "official-document-qa-hash-mismatch",
  [approvedRow],
  [{ sourceNo: approvedRow[0], sha256: "0".repeat(64) }],
);
const privacyPackage = packageWith(
  "official-document-qa-privacy-excluded",
  [approvedRow, privacyRow],
  [approvedRow, privacyRow].map((row) => ({ sourceNo: row[0], sha256: rowHash(row) })),
);

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
const crc32 = (bytes) => {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
};
const zip = (entries) => {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(text);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    localParts.push(local, nameBytes, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
};

const makePdf = () => {
  const newline = "\r\n";
  const content = "BT /F1 14 Tf 72 720 Td (Synthetic official document QA) Tj ET";
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    `<</Length ${Buffer.byteLength(content)}>>stream${newline}${content}${newline}endstream`,
  ];
  const parts = [Buffer.from(`%PDF-1.4${newline}`)];
  const offsets = [];
  let length = parts[0].length;

  objects.forEach((body, index) => {
    offsets.push(length);
    const object = Buffer.from(`${index + 1} 0 obj${newline}${body}${newline}endobj${newline}`);
    parts.push(object);
    length += object.length;
  });

  const xrefOffset = length;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f",
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n`),
    "trailer",
    `<</Size ${objects.length + 1}/Root 1 0 R>>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
    "",
  ].join(newline);
  parts.push(Buffer.from(xref));
  return Buffer.concat(parts);
};

const pdf = makePdf();

await mkdir(directory, { recursive: true });
await Promise.all([
  writeFile(`${directory}/reference-valid.json`, `${JSON.stringify(validPackage, null, 2)}\n`),
  writeFile(`${directory}/reference-hash-mismatch.json`, `${JSON.stringify(hashMismatchPackage, null, 2)}\n`),
  writeFile(`${directory}/reference-privacy-excluded.json`, `${JSON.stringify(privacyPackage, null, 2)}\n`),
  writeFile(`${directory}/stored-package-corrupt.json`, '{"version":1,"sha256":"wrong","payload":{}}\n'),
  writeFile(`${directory}/synthetic-document.pdf`, pdf),
  writeFile(`${directory}/synthetic-document.hwpx`, zip([["Contents/section0.xml", "<hp:p xmlns:hp=\"urn:synthetic\"><hp:t>합성 공문 HWPX 본문입니다.</hp:t></hp:p>"]])),
  writeFile(`${directory}/synthetic-document.odt`, zip([["content.xml", "<office:document-content xmlns:office=\"urn:oasis:names:tc:opendocument:xmlns:office:1.0\" xmlns:text=\"urn:oasis:names:tc:opendocument:xmlns:text:1.0\"><office:body><office:text><text:p>합성 공문 ODT 본문입니다.</text:p></office:text></office:body></office:document-content>"]])),
  writeFile(`${directory}/unsupported-document.txt`, "합성 자료이지만 지원하지 않는 형식입니다.\n"),
]);
