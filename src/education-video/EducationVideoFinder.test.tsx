// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EducationVideoFinder } from './EducationVideoFinder';
import { searchMockVideos } from './model';
import {toEntry,type LibraryEntry} from './libraryV2';
const savedVideo=searchMockVideos({topic:'손씻기',target:'학생',minutes:10})[0];
const saved=toEntry({...savedVideo,educationTitle:'교육A',target:'학생',schedule:'이번주',instructions:'확인',message:'교사 수정문',notes:'보호할 메모'});
const save=vi.fn(async(item:LibraryEntry)=>({library:{version:2,entries:[...([saved].filter(existing=>existing.videoId!==item.videoId)),item]},recovered:false}));
vi.mock('./library',()=>({nativeLibrary:false,LIBRARY_RECOVERY_NOTICE:'저장된 교육영상 목록에 문제가 발견되어 백업에서 복구했습니다. 현재 목록을 확인해 주세요.',libraryRepository:{load:async()=>({library:{version:2,entries:[]},recovered:false}),save:(item:LibraryEntry)=>save(item),export:async()=>'',import:async()=>({library:{version:2,entries:[]},recovered:false}),recover:async()=>({library:{version:2,entries:[]},recovered:true})}}));
afterEach(()=>{cleanup();save.mockClear();});
const search=(topic:string)=>{fireEvent.change(screen.getByLabelText('교육 주제'),{target:{value:topic}});fireEvent.change(screen.getByLabelText('검색 대상'),{target:{value:'학생'}});fireEvent.click(screen.getByRole('button',{name:'Mock 영상 검색'}));};
describe('Finder workflow',()=>{
 it('shows the recovery notice after an explicit successful backup recovery',async()=>{
  render(<EducationVideoFinder onClose={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'백업 복구'}));
  await waitFor(()=>expect(screen.getByRole('status').textContent).toBe('저장된 교육영상 목록에 문제가 발견되어 백업에서 복구했습니다. 현재 목록을 확인해 주세요.'));
 });
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
  expect(save.mock.calls[1][0].teacher.notes).toBe('보호할 메모');expect(save.mock.calls[1][0].teacher.message).toBe('교사 수정문');
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
 expect(save.mock.calls[1][0].provider?.title).toContain('흡연예방');
 });
});
