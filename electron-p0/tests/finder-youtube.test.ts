import {it,expect,vi} from 'vitest';
import {allowedYoutubeUrl,validateFinderConditions,youtubeUrl,searchYoutube,parseYoutubeSearch,parseYoutubeDetails,FINDER_ERRORS} from '../main/finder-youtube';
const key='SYNTHETIC_YOUTUBE_KEY_1234567890',conditions={topic:'손씻기',target:'초등',minutes:10},id='QaVideo0001',channel='UC'+'x'.repeat(22);
const json=(value:unknown,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json',...headers}});
const detail=(videoId=id)=>({id:videoId,snippet:{title:'합성 &amp; 안전 <텍스트>',channelId:channel,channelTitle:'합성 채널'},contentDetails:{duration:'PT10M'}});
it('uses fixed public YouTube API endpoints with strict parameters, never renderer URLs or redirects',async()=>{
 const first=youtubeUrl('search',key,conditions);expect(allowedYoutubeUrl(first)).toBe(true);const url=new URL(first);expect(url.searchParams.get('q')).toBe('손씻기 초등');expect(url.searchParams.get('type')).toBe('video');expect(url.searchParams.get('safeSearch')).toBe('strict');expect(url.searchParams.get('key')).toBe(key);
 for(const value of [first.replace('www.googleapis.com','evil.test'),first.replace('https:','http:'),first+'&url=https://evil.test',first+'&q=other',first+'#fragment',first.replace('/search','/channels'),first.replace('maxResults=10','maxResults=50'),first.replace('www.googleapis.com','user:pass@www.googleapis.com')])expect(allowedYoutubeUrl(value)).toBe(false);
 const fetcher=vi.fn(async(url:string,_init:RequestInit)=>url.includes('/search?')?json({items:[{id:{videoId:id}},{id:{videoId:id}}],nextPageToken:'NEXT_TOKEN'}):json({items:[detail()]}));
 const result=await searchYoutube(fetcher,key,conditions,new AbortController().signal);expect(result.videos).toEqual([{videoId:id,title:'합성 & 안전 <텍스트>',channelId:channel,channelTitle:'합성 채널',durationSeconds:600,url:`https://www.youtube.com/watch?v=${id}`,source:'youtube'}]);expect(result.nextToken).toBe('NEXT_TOKEN');expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls[0][1]).toMatchObject({method:'GET',redirect:'error',credentials:'omit',cache:'no-store'});
 expect(new URL(fetcher.mock.calls[1][0]).searchParams.get('id')).toBe(id);expect(JSON.stringify(result)).not.toContain(key);
});
it('rejects unsafe input and known personal/credential data before any request',()=>{
 for(const patch of [{topic:''},{minutes:0},{topic:'학생명: 홍길동'},{target:'010-1234-5678'},{topic:'teacher@example.test'},{topic:'api_key=synthetic'},{topic:'합성\n주제'},{url:'https://evil.test'}])expect(()=>validateFinderConditions({...conditions,...patch})).toThrow();
 expect(()=>youtubeUrl('videos',key,conditions,['bad'])).toThrow();expect(()=>youtubeUrl('search','bad',conditions)).toThrow();
});
it('rejects forged IDs/details, unknown next tokens, oversized arrays, missing fields, and unknown IDs',()=>{
 for(const value of [{items:[{id:{videoId:'../bad'}}]},{items:Array(11).fill({id:{videoId:id}})},{items:[],nextPageToken:'https://evil.test'},{error:{},items:[]}])expect(()=>parseYoutubeSearch(value)).toThrow();
 for(const value of [{items:[detail('QaVideo0002')]},{items:[detail(),detail()]},{items:[{...detail(),snippet:{...detail().snippet,channelId:'fake-channel'}}]},{items:[{id}]},{items:Array(11).fill(detail())}])expect(()=>parseYoutubeDetails(value,[id])).toThrow();
 expect(parseYoutubeDetails({items:[{...detail(),contentDetails:{duration:'P0D'}}]},[id])).toEqual([]);expect(parseYoutubeDetails({items:[]},[id])).toEqual([]);
});
it.each([[400,'keyInvalid',FINDER_ERRORS.auth],[401,'authError',FINDER_ERRORS.auth],[403,'accessNotConfigured',FINDER_ERRORS.auth],[403,'quotaExceeded',FINDER_ERRORS.quota],[429,'rateLimitExceeded',FINDER_ERRORS.quota],[503,'backendError',FINDER_ERRORS.network]] as const)('normalizes HTTP %s / %s without provider text or keys',async(status,reason,message)=>{
 const fetcher=vi.fn(async()=>json({error:{message:'PRIVATE '+key,errors:[{reason}]}},status));await expect(searchYoutube(fetcher,key,conditions,new AbortController().signal)).rejects.toThrow(message);expect(fetcher).toHaveBeenCalledOnce();
});
it('handles empty results with no details request and bounds malformed/streaming responses',async()=>{
 const empty=vi.fn(async()=>json({items:[]}));expect(await searchYoutube(empty,key,conditions,new AbortController().signal)).toEqual({videos:[],nextToken:undefined,omitted:0});expect(empty).toHaveBeenCalledOnce();
 const redirected=json({items:[]});Object.defineProperty(redirected,'redirected',{value:true});
 for(const make of [()=>redirected,()=>new Response('{}',{headers:{'content-type':'text/html'}}),()=>new Response('broken',{headers:{'content-type':'application/json'}}),()=>json({items:[]},200,{'content-length':'524289'}),()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(524289));c.close();}}),{headers:{'content-type':'application/json'}})])await expect(searchYoutube(async()=>make(),key,conditions,new AbortController().signal)).rejects.toThrow();
});
it('passes only opaque provider page token into the bounded next API request',async()=>{
 const fetcher=vi.fn(async(_url:string)=>json({items:[]}));await searchYoutube(fetcher,key,conditions,new AbortController().signal,'NEXT_TOKEN');expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('pageToken')).toBe('NEXT_TOKEN');
});
