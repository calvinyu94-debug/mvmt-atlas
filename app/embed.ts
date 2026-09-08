/** The embed API. MVMT Program hosts this viewer in an iframe and drives it
 * two ways: URL parameters on load, and window.postMessage from the parent
 * frame afterwards. Both carry the same keys:
 *
 *   model    bp3d | zanatomy           which manifest to load
 *   region   <region key>              held for the region filter (applied once regions exist)
 *   systems  skeletal,muscular,...     the systems to show, comma-separated (or an array by message)
 *   select   <FMA concept id | part id | our id>
 *   view     anterior | posterior | left | right | superior
 *   patient  1 | 0                     hide identifiers and reference chrome
 *
 * A message is `{type:'set', ...keys}`. The viewer posts back
 * `{type:'ready', model, parts}` once a manifest has loaded,
 * `{type:'select', id, name}` whenever the selection changes (null when cleared), and
 * `{type:'unresolved', id}` when a requested selection is not in the atlas.
 */
import {SYSTEMS,type SystemId,type View} from './anatomy';

export type ModelId='bp3d'|'zanatomy';
export const MODELS:Record<ModelId,{name:string;source:string;manifest:string}>={
 bp3d:{name:'Human Atlas',source:'BodyParts3D',manifest:'/models/atlas.json'},
 zanatomy:{name:'Z-Anatomy',source:'Z-Anatomy',manifest:'/models/zanatomy.json'},
};
export interface EmbedRequest{model?:ModelId;region?:string;systems?:SystemId[];select?:string;view?:View;patient?:boolean}

const VIEWS:Record<string,View>={anterior:'front',front:'front',posterior:'back',back:'back',left:'side',side:'side',right:'right',superior:'top',top:'top','three-quarter':'three-quarter'};
const systemIds=new Set<string>(SYSTEMS.map(s=>s.id));

type Source={get(key:string):unknown};
const fromParams=(p:URLSearchParams):Source=>({get:k=>p.get(k)??undefined});
const fromObject=(o:Record<string,unknown>):Source=>({get:k=>o[k]});

/** Reads whichever keys are present; absent keys are left undefined so a message can change one thing. */
export function parseRequest(source:Source):EmbedRequest{
 const r:EmbedRequest={};
 const text=(k:string)=>{const v=source.get(k);return typeof v==='string'&&v.trim()?v.trim():undefined;};
 const model=text('model');if(model==='bp3d'||model==='zanatomy')r.model=model;
 const region=text('region');if(region)r.region=region;
 const systems=source.get('systems');
 if(typeof systems==='string'||Array.isArray(systems)){const list=(Array.isArray(systems)?systems:systems.split(',')).map(s=>String(s).trim()).filter(s=>systemIds.has(s)) as SystemId[];r.systems=list;}
 const select=text('select');if(select)r.select=select;
 const view=text('view');if(view&&VIEWS[view.toLowerCase()])r.view=VIEWS[view.toLowerCase()];
 const patient=source.get('patient');
 if(patient!==undefined&&patient!==null)r.patient=patient===true||patient==='1'||patient==='true';
 return r;
}

export const readUrlRequest=()=>parseRequest(fromParams(new URLSearchParams(location.search)));
export const embedded=()=>{try{return window.parent!==window;}catch{return true;}};

/** Listens for `{type:'set', ...}` from a parent frame. The message only changes what is shown, so no origin check is needed. */
export function listenParent(handler:(request:EmbedRequest)=>void){
 const on=(e:MessageEvent)=>{const d=e.data;if(!d||typeof d!=='object'||(d as {type?:unknown}).type!=='set')return;handler(parseRequest(fromObject(d as Record<string,unknown>)));};
 window.addEventListener('message',on);
 return()=>window.removeEventListener('message',on);
}

export function postToParent(message:Record<string,unknown>){
 if(!embedded())return;
 try{window.parent.postMessage(message,'*');}catch{/* a parent that refuses messages is not this viewer's problem */}
}
