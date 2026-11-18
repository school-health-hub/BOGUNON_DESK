import type { P0Info } from '../protocol';
import { SyntheticIpcSample } from './SyntheticIpcSample';

type ProductAboutProps = Readonly<{
  info: P0Info;
  onOpenNewsletter: () => void;
}>;

export function ProductAbout({ info, onOpenNewsletter }: ProductAboutProps) {
  return <div className="product-about">
    <h2>BOGUNON DESK 2.0</h2>
    <p>내부 베타 · 버전 {info.version}</p>
    <p>보건교사의 업무를 한곳에서 정리하는 Windows 데스크톱 작업 공간입니다.</p>
    <button type="button" onClick={onOpenNewsletter}>보건소식지 제작소</button>
    <SyntheticIpcSample />
    <details>
      <summary>고급 진단 정보</summary>
      <dl>
        <dt>제품 식별자</dt><dd>{info.appId}</dd>
        <dt>로컬 저장 위치</dt><dd>{info.userData}</dd>
        <dt>소스 버전</dt><dd>{info.sourceSha}</dd>
        <dt>Electron</dt><dd>{info.electron}</dd>
      </dl>
    </details>
    <p>자동 업데이트는 제공하지 않습니다. 계정과 AI 연결은 설정에서 별도로 관리합니다.</p>
  </div>;
}
