import { JSDOM } from "jsdom";
import { afterEach, expect, it, vi } from "vitest";
import { createCollectRequest } from "../src/lib/connections";

const profile = '<div class="name_block">Player</div><img src="/maimai-mobile/img/Plate/equipped.png">';
const card = (title: string) => `<div class="music_master_score_back pointer w_450 m_15 p_3 f_0"><div class="music_name_block">${title}</div><div class="music_lv_block">13</div><div class="music_score_block">100.0000%</div></div>`;
const b50 = '<div class="see_through_block"></div><div class="screw_block"></div>' + Array.from({length:15},(_,i)=>card(`New ${i}`)).join('') + '<div class="screw_block"></div>' + Array.from({length:35},(_,i)=>card(`Old ${i}`)).join('');
let dom: JSDOM;
afterEach(() => { dom?.window.close(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function setup(fetcher: ReturnType<typeof vi.fn>) {
  vi.resetModules();
  dom = new JSDOM('', {url:'https://maimaidx-eng.com/maimai-mobile/home/'});
  vi.stubGlobal('window',dom.window); vi.stubGlobal('DOMParser',dom.window.DOMParser);
  vi.stubGlobal('fetch',fetcher);
  let listener: (message: unknown, sender: unknown, reply: (r:any)=>void)=>void;
  const messages: any[] = [];
  vi.stubGlobal('chrome', { storage:{local:{get:async()=>({})}}, runtime:{
    onMessage:{addListener:(fn:typeof listener)=>{listener=fn;}},
    sendMessage:async(message:any)=>{ messages.push(message); return {ok:true,records:message.records?.map((r:any)=>({...r,chartRating:280,internalLevelValue:13}))}; }
  }});
  await import('../src/content');
  return { run:()=>new Promise<any>(resolve=>listener(createCollectRequest('dxnet-intl',true),{},resolve)), messages };
}

it('retries profile network failure, completes all difficulties despite decorative failures, and preserves flags', async()=>{
  let homes=0;
  const fetcher=vi.fn(async(url:string)=>{
    if(url.endsWith('/home/')) { if(++homes===1) throw new TypeError('Failed to fetch'); return new Response(profile); }
    if(url.includes('ratingTargetMusic')) return new Response(b50);
    if(url.includes('/collection/')) return new Response('',{status:404});
    const diff=new URL(url).searchParams.get('diff');
    if (diff === '0') return new Response('<div class="main_wrapper"><section><div class="w_450"><div class="music_name_block">Unplayed BASIC</div><div class="music_lv_block">3</div></div></section></div>');
    return new Response(`<div class="main_wrapper"><div class="w_450"><div class="music_name_block">${diff==='3'?'New 0':'Full '+diff}</div><div class="music_lv_block">13</div><div class="music_score_block">100%</div><img src="music_icon_app.png"><img src="music_icon_fdxp.png"></div></div>`);
  });
  const {run,messages}=await setup(fetcher); const result=await run();
  expect(result.ok).toBe(true);
  expect(homes).toBe(2);
  expect(result.data.player.plateUrl).toContain('/Plate/equipped.png');
  expect(result.data.records[0]).toMatchObject({comboFlag:'ap+',syncFlag:'fdx+'});
  expect(messages.filter(m=>m.stage==='fetch').map(m=>m.done)).toEqual([1,2,3,4,5,6,7,8,9]);
  expect(fetcher.mock.calls.filter(([url])=>String(url).includes('/record/'))).toHaveLength(5);
});

it('stops on a required HTTP error without pretending previous B50 data was refreshed', async()=>{
  const fetcher=vi.fn(async()=>new Response('',{status:403}));
  const {run}=await setup(fetcher);
  expect(await run()).toMatchObject({ok:false,error:expect.stringContaining('403')});
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('reports the DX NET expiry page at BASIC even when HTTP is successful', async()=>{
  const fetcher=vi.fn(async(url:string)=>{
    if(url.endsWith('/home/')) return new Response(profile);
    if(url.includes('ratingTargetMusic')) return new Response(b50);
    if(url.includes('/collection/')) return new Response('',{status:404});
    return new Response('<div>ERROR CODE : 200002</div><p>The connection time has been expired.</p>');
  });
  const {run,messages}=await setup(fetcher);
  const result=await run();
  expect(result).toMatchObject({ok:false,error:expect.stringContaining('200002')});
  expect(result.error).toContain('Sign in');
  expect(result.error).not.toContain('layout');
  expect(messages.some(m=>m.type==='MAI_SCORE_RESOLVE')).toBe(false);
  expect(fetcher.mock.calls.filter(([url])=>String(url).includes('/record/'))).toHaveLength(1);
});

it('preserves other DX NET application error codes instead of reporting parser failure', async()=>{
  const {run}=await setup(vi.fn(async()=>new Response('<p>ERROR CODE : 999999</p>')));
  expect(await run()).toMatchObject({ok:false,error:expect.stringContaining('999999')});
});
