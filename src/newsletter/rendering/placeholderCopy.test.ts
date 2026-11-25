import {expect,it} from 'vitest';
import {newsletterPlaceholderDataUrl} from './placeholders';
import {renderNewsletterSceneSvg} from '../output/svgRenderer';

it('uses a user-facing missing-image prompt in preview and output scenes',()=>{
 const placeholder=decodeURIComponent(newsletterPlaceholderDataUrl('cover'));
 expect(placeholder).toContain('이미지를 넣어 주세요');
 expect(placeholder).not.toContain('QA PLACEHOLDER');
 const frame={x:0,y:0,width:320,height:260};
 const scene=renderNewsletterSceneSvg({pageId:'cover',width:320,height:260,templateVersion:1,layers:[{kind:'image',layerId:'cover',slotId:'cover-image',frame,clipBounds:frame,zOrder:1,fit:'contain',edgePolicy:'none',placeholderKind:'cover'}]},new Map());
 expect(decodeURIComponent(scene)).toContain('이미지를 넣어 주세요');
 expect(scene).not.toContain('QA PLACEHOLDER');
});
