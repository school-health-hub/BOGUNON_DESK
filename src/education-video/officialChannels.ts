export const verifiedChannels = new Map([
 ['UCexUyFaq9YH7XJfCQzVR_jg', {name:'교육부',evidence:'https://moe.go.kr/main.do',checkedAt:'2026-10-22',reviewStatus:'verified',channelUrl:'https://www.youtube.com/channel/UCexUyFaq9YH7XJfCQzVR_jg'}],
 ['UCa7-3Zvxg-5Rfxgu3RQY_gw', {name:'질병관리청',evidence:'https://www.kdca.go.kr/sites/kdca/index.do',checkedAt:'2026-10-22',reviewStatus:'verified',channelUrl:'https://www.youtube.com/channel/UCa7-3Zvxg-5Rfxgu3RQY_gw'}],
]);
export const verifiedChannelEvidence = (channelId:string):string|null => {
 const entry=verifiedChannels.get(channelId);
 return entry?.evidence ?? null;
};
