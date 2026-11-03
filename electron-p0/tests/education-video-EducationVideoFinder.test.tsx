// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EducationVideoFinder } from '../../src/education-video/EducationVideoFinder';
import { searchMockVideos, type LibraryItem } from '../../src/education-video/model';
const savedVideo=searchMockVideos({topic:'손씻기',target:'학생',minutes:10})[0];
const saved:LibraryItem={...savedVideo,educationTitle:'교육A',target:'학생',schedule:'이번주',instructions:'확인',message:'교사 수정문',notes:'보호할 메모'};
const exportFile=vi.fn<()=>Promise<{status:'saved';fileName:string}|{status:'canceled'}>>();
const save=vi.fn(async(item:LibraryItem)=>({library:{version:1,items:[...([saved].filter(existing=>existing.videoId!==item.videoId)),item]},recovered:false}));
vi.mock('../../src/education-video/library',()=>({nativeLibrary:false,libraryRepository:{load:async()=>({library:{version:1,items:[]},recovered:false}),save:(item:LibraryItem)=>save(item),export:async()=>'',exportFile:()=>exportFile(),import:async()=>({library:{version:1,items:[]},recovered:false}),recover:async()=>({library:{version:1,items:[]},recovered:true})}}));
afterEach(()=>{cleanup();save.mockClear();exportFile.mockReset();});
const search=(topic:string)=>{fireEvent.change(screen.getByLabelText('교육 주제'),{target:{value:topic}});fireEvent.change(screen.getByLabelText('검색 대상'),{target:{value:'학생'}});fireEvent.click(screen.getByRole('button',{name:'Mock 영상 검색'}));};
describe('Finder workflow',()=>{
 it('preserves notes and teacher message when selecting saved video again',async()=>{
  render(<EducationVideoFinder onClose={()=>{}}/>);search('손씻기');
  fireEvent.click(screen.getAllByRole('button',{name:/선택$/})[0]);
  fireEvent.change(screen.getByLabelText('교육 일시 또는 시청 기간'),{target:{value:'이번주'}});
  fireEvent.change(screen.getByLabelText('안내사항'),{target:{value:'확인'}});
  fireEvent.click(screen.getByRole('button',{name:'안내문 생성'}));
  fireEvent.change(screen.getByLabelText('안내문 직접 수정'),{target:{value:'교사 수정문'}});
  fireEvent.change(screen.getByLabelText('사용자 메모'),{target:{value:'보호할 메모'}});
  fireEvent.click(screen.getByRole('button',{name:'라이브러리 저장'}));await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));
  search('손씻기');fireEvent.click(screen.getAllByRole('button',{name:/선택$/})[0]);
  expect((screen.getByLabelText('사용자 메모')).getAttribute('maxlength')).toBe('3000');
  fireEvent.click(screen.getByRole('button',{name:'라이브러리 저장'}));await waitFor(()=>expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1][0].notes).toBe('보호할 메모');expect(save.mock.calls[1][0].message).toBe('교사 수정문');
 });
 it('requires complete information and teacher confirmation before copy',async()=>{
 render(<EducationVideoFinder onClose={()=>{}}/>);search('손씻기');
 fireEvent.click(screen.getAllByRole('button',{name:/선택$/})[0]);
 fireEvent.click(screen.getByRole('button',{name:'안내문 생성'}));
 expect(screen.getByRole('status').textContent).toContain('교육 일시');
 expect(screen.getByRole('button',{name:'안내문 복사'}).hasAttribute('disabled')).toBe(true);
 });
 it('saves selected new video without hidden old metadata',async()=>{
 render(<EducationVideoFinder onClose={()=>{}}/>);await waitFor(()=>expect(screen.getByRole('status')).toBeTruthy());
 search('손씻기');fireEvent.click(screen.getAllByRole('button',{name:/선택$/})[0]);
 fireEvent.change(screen.getByLabelText('교육 일시 또는 시청 기간'),{target:{value:'이번주'}});
 fireEvent.change(screen.getByLabelText('안내사항'),{target:{value:'확인'}});
 fireEvent.click(screen.getByRole('button',{name:'안내문 생성'}));
 fireEvent.change(screen.getByLabelText('사용자 메모'),{target:{value:'보호할 메모'}});
 fireEvent.click(screen.getByRole('button',{name:'라이브러리 저장'}));await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));
 fireEvent.click(screen.getAllByRole('button',{name:'불러오기'})[0]);
 search('흡연예방');fireEvent.click(screen.getAllByRole('button',{name:/선택$/})[0]);
 fireEvent.click(screen.getByRole('button',{name:'안내문 생성'}));fireEvent.click(screen.getByRole('button',{name:'라이브러리 저장'}));
 await waitFor(()=>expect(save).toHaveBeenCalledTimes(2));
 expect(save.mock.calls[1][0].videoId).not.toBe(saved.videoId);
 expect(save.mock.calls[1][0].title).toContain('흡연예방');
 });
});

it('reports success only after native save completion and distinguishes cancel/error without a Blob download',async()=>{
 let complete!:(value:{status:'saved';fileName:string})=>void;
 exportFile.mockImplementationOnce(()=>new Promise(r=>{complete=r;})).mockResolvedValueOnce({status:'canceled'}).mockRejectedValueOnce(new Error('synthetic failure'));
 render(<EducationVideoFinder onClose={()=>{}}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'내보내기'})).toBeTruthy());
 fireEvent.click(screen.getByRole('button',{name:'내보내기'}));await waitFor(()=>expect(exportFile).toHaveBeenCalledTimes(1));
 expect(screen.getByRole('status').textContent).not.toContain('저장했습니다');expect((screen.getByRole('button',{name:'내보내기'}) as HTMLButtonElement).disabled).toBe(true);
 complete({status:'saved',fileName:'synthetic.json'});await screen.findByText('라이브러리 JSON을 저장했습니다: synthetic.json');
 fireEvent.click(screen.getByRole('button',{name:'내보내기'}));await screen.findByText('라이브러리 JSON 저장을 취소했습니다.');
 fireEvent.click(screen.getByRole('button',{name:'내보내기'}));await screen.findByText('라이브러리 JSON을 저장하지 못했습니다. 기존 라이브러리는 유지됩니다.');expect(exportFile).toHaveBeenCalledTimes(3);expect(save).not.toHaveBeenCalled();
});
