import {ArrowUpRight,Newspaper} from 'lucide-react';
import {Panel} from '../components/Panel';
import {useDesktopPanels} from '../components/desktop/DesktopPanelContext';

export function NewsletterShortcutWidget(){
  const {runDesktopAction}=useDesktopPanels();
  return <Panel title="보건소식지 제작소" icon={Newspaper} className="newsletter-shortcut">
    <p>이번 달 보건소식지를 이어서 편집하거나 새로 시작하세요.</p>
    <button type="button" className="newsletter-shortcut__open" onClick={()=>void runDesktopAction('newsletter')}>
      제작소 열기 <ArrowUpRight size={16} aria-hidden="true"/>
    </button>
  </Panel>;
}
