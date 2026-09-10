export type SystemId = 'skeletal'|'muscular'|'arterial'|'venous'|'nervous'|'digestive'|'respiratory'|'urinary'|'reproductive'|'lymphatic'|'endocrine'|'integumentary'|'connective'|'sensory'|'cardiac'|'fascia'|'ligaments'|'insertions'|'peripheral-nerves'|'central-nerves'|'landmarks';
export const SYSTEMS: {id:SystemId;name:string;color:string;description:string}[] = [
 {id:'skeletal',name:'Skeleton',color:'#EEE5D3',description:'Bones form the supporting framework of the body, protect organs, and provide attachment points for muscles. Their internal tissue also stores minerals and produces blood cells.'},
 {id:'muscular',name:'Muscles',color:'#B8654F',description:'Skeletal muscles generate movement by pulling on their attachments. Together with tendons, they move joints, stabilize posture, and produce heat.'},
 {id:'cardiac',name:'Heart',color:'#b96760',description:'The heart is a muscular pump with four chambers. Its valves direct blood forward through the pulmonary and systemic circuits.'},
 {id:'sensory',name:'Sensory organs',color:'#b0c8ce',description:'These structures contribute to special senses, including sight, hearing, and balance. Their specialized tissues detect stimuli and work with the nervous system to convey information.'},
 {id:'arterial',name:'Arteries',color:'#c05245',description:'The heart drives blood through the circulation. Arteries carry blood away from the heart to supply tissues or, in the pulmonary circuit, to the lungs.'},
 {id:'venous',name:'Veins',color:'#527c9f',description:'Veins return blood toward the heart. Superficial and deep networks collect blood from the tissues; the pulmonary veins bring oxygenated blood back from the lungs.'},
 {id:'nervous',name:'Nervous system',color:'#E0A427',description:'The brain, spinal cord, and peripheral nerves carry and process signals. They support sensation, movement, coordination, and automatic regulation of body functions.'},
 {id:'respiratory',name:'Respiratory',color:'#b98991',description:'The airways conduct air to the lungs, where oxygen and carbon dioxide move between air and blood. Breathing depends on pressure changes produced by respiratory muscles.'},
 {id:'digestive',name:'Digestive',color:'#b8916b',description:'The digestive tract breaks down food, absorbs nutrients and water, and moves waste onward. Accessory organs contribute bile and digestive enzymes.'},
 {id:'urinary',name:'Urinary',color:'#b47961',description:'The kidneys filter blood and regulate fluid, electrolyte, and acid–base balance. Urine travels through the ureters to the bladder and exits through the urethra.'},
 {id:'lymphatic',name:'Lymphatic',color:'#879f7c',description:'Lymphatic vessels return excess tissue fluid to the circulation. Lymph nodes and other lymphoid organs support immune surveillance and responses.'},
 {id:'endocrine',name:'Endocrine',color:'#c5a09a',description:'Endocrine organs release hormones into the blood to coordinate processes such as metabolism, growth, stress responses, and reproduction.'},
 {id:'reproductive',name:'Reproductive',color:'#bda098',description:'The male reproductive structures represented here contribute to sperm production, maturation, transport, and the production of sex hormones.'},
 {id:'integumentary',name:'Body surface',color:'#ba9b7d',description:'The body surface provides an outer anatomical reference. The integumentary system forms a protective barrier and contributes to sensation and temperature regulation.'},
 // MVMT layers, fitted onto the BodyParts3D body from Z-Anatomy (mvmt-anatomy tools/bp3d_export.py). Colours are mvmt-program's --v3-* tokens.
 {id:'fascia',name:'Fascia',color:'#D9CFC2',description:'Fasciae, bursae and retinacula: the connective-tissue sheets and sacs that wrap and separate muscles and let tendons glide. From the Z-Anatomy atlas, fitted onto this body.'},
 {id:'ligaments',name:'Joints & ligaments',color:'#B6C2CB',description:'Ligaments, joint capsules, articular cartilage and discs. From the Z-Anatomy atlas, fitted onto this body.'},
 {id:'insertions',name:'Insertions',color:'#8E3B2F',description:'Muscle origin and insertion patches, projected onto the bone surface of this body.'},
 {id:'peripheral-nerves',name:'Peripheral nerves',color:'#E0A427',description:'Schematic peripheral nerves: indicative paths authored from a written specification, not imaging-derived anatomy.'},
 {id:'central-nerves',name:'Central nerves',color:'#E0A427',description:'Schematic spinal cord, cauda equina and nerve roots: indicative paths through the vertebral canal, not imaging-derived anatomy.'},
 {id:'landmarks',name:'Landmarks',color:'#2B5F9E',description:'Palpable bony landmarks, each resolved by its anatomical rule on the bones of this body.'},
 {id:'connective',name:'Connective tissue',color:'#B6C2CB',description:'Cartilage, ligaments, and other connective tissues support, connect, and separate structures. Their roles include stabilizing joints and distributing mechanical loads.'},
];
/** fitConfidence is judged by one rule per system (mvmt-anatomy tools/bp3d_export.py), named in fitRule: `surface` for
 * ligaments and fascia (fitFarFraction of sampled vertices further than 6 mm from any BP3D bone or muscle surface), `canal`
 * for the central nerves (fitInBoneFraction inside bone; fitWallClearance is the median distance to the canal wall, recorded
 * not judged), `envelope` for the peripheral nerves (fitOutsideFraction beyond BP3D's skin, fitInBoneFraction inside bone;
 * no surface-distance test). Landmarks carry the fit's own residual instead. Low means more than 20% by the system's rule. */
export interface Part {id:string;name:string;conceptId:string;system:SystemId;chunk:number;positions:number;normals:number;indices:number;vertexCount:number;indexCount:number;bounds:[number[],number[]];source?:'zanatomy'|'schematic';sourceName?:string;region?:string;spans?:string[];structures?:string[];authored?:boolean;fitConfidence?:'low'|'high';fitRule?:'surface'|'canal'|'envelope';fitFarFraction?:number;fitMedianDistance?:number;fitInBoneFraction?:number;fitOutsideFraction?:number;fitWallClearance?:number;fitResidual?:number;landmark?:string}
export interface Concept {id:string;name:string;elements:string[]}
export interface Chunk {url:string;bytes:number;gzip?:string;gzipBytes?:number;region?:string;bp3dRegion?:string;systems?:string[]|string;triangles?:number;parts?:number}
export interface Layout {chunk:number;positions:number;normals:number;indices:number;vertexCount:number;indexCount:number}
export interface RegionInfo {id:string;name:string;chunk:number;parts:number;triangles:number;bytes:number;bounds:[number[],number[]]|null;spanningParts:string[];bp3dChunks?:number[];bp3dParts?:number;bp3dSpanningParts?:string[];anchors?:number[][]}
export interface ChunkSets {regions:Record<string,{bp3d:number[];mvmt:number[];context?:number[]}>;vessels:number[];organs:number[]}
export interface Atlas {version:string;sex?:'male';source?:string;scope?:string;parts:Part[];concepts:Concept[];chunks:Chunk[];triangles:number;regions?:RegionInfo[];chunkSets?:ChunkSets;overview?:{chunks:Chunk[];parts:Record<string,Layout>;triangles:number;bytes:number};contexts?:Record<string,{chunk:number;parts:Record<string,Layout>;count:number}>;layers?:{muscleDepth?:{parts:Record<string,number>};mvmt?:MvmtBridge;[k:string]:unknown}}
/** The id bridge from build-index.mjs: every part id to the MVMT structure ids that claim it, in resolution order (the most
 * specific group first, then the rest by specificity), and every structure id to the part ids it claims. */
export interface MvmtBridge {parts:Record<string,string[]>;structures:Record<string,string[]>;names:Record<string,string>}
/** mvmt-program's SYSTEMS, as its Anatomy view labels them. A structure's system is an MVMT system, not a BP3D one. */
export const MVMT_SYSTEMS:Record<string,string>={muscular:'Muscular',skeletal:'Skeletal',articular:'Articular',nervous:'Nervous',fascial:'Fascial',landmark:'Landmark'};
export type View = 'three-quarter'|'front'|'back'|'side'|'right'|'top';
/** chunkKeys: the chunk sets the scene should hold ('main:<i>' or 'overview:<i>', see chunkKeysFor); contextKeys: the
 * region's context sets, fetched only once every chunkKey is in and drawn dimmed and unselectable ('context:<region>');
 * hiddenParts: part ids kept off whatever their system says (patient view hides low-confidence landmarks); depth:
 * 0 all muscles, 1 superficial, 2 deep; frame: a part to frame the camera on, bumped by n; line: a fascial line as the
 * set of part ids its stations resolve to - the scene lights those and ghosts every other loaded part. */
export interface SceneState {inspectorOpen?:boolean;explode:number;visible:SystemId[];selected:string[];isolate:boolean;view:View;rotate:boolean;reset:number;chunkKeys?:string[];contextKeys?:string[];hiddenParts?:string[];depth?:MuscleDepth;frame?:{id:string;n:number}|null;line?:{id:string;parts:string[]}|null;focus?:[number[],number[]]|null}
/** The box a region view frames: the region's own parts, BP3D's and ours. */
export function regionBounds(atlas:Atlas,region:string):[number[],number[]]|null{
 let lo:number[]|null=null,hi:number[]|null=null;
 for(const p of atlas.parts){if(p.region!==region)continue;const [a,b]=p.bounds;if(!lo||!hi){lo=[...a];hi=[...b];continue;}for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],a[i]);hi[i]=Math.max(hi[i],b[i]);}}
 return lo&&hi?[lo,hi]:null;
}
export const VESSEL_SYSTEMS:SystemId[]=['arterial','venous'];
export const ORGAN_SYSTEMS:SystemId[]=['cardiac','sensory','respiratory','digestive','urinary','lymphatic','endocrine','reproductive','integumentary'];
/** The chunk sets a view needs. A region takes its own BP3D and MVMT chunks (arteries, veins and
 * organs only when one of their systems is on); the whole body takes the decimated overview. An
 * atlas without chunk sets takes every chunk, as before. */
export function chunkKeysFor(atlas:Atlas,region:string|null,visible:SystemId[]):string[]{
 const sets=atlas.chunkSets;
 if(!sets||!atlas.overview)return atlas.chunks.map((_,i)=>`main:${i}`);
 const r=region&&sets.regions[region];
 if(!r)return atlas.overview.chunks.map((_,i)=>`overview:${i}`);
 const keys=[...r.bp3d,...r.mvmt];
 if(visible.some(s=>VESSEL_SYSTEMS.includes(s)))keys.push(...sets.vessels);
 if(visible.some(s=>ORGAN_SYSTEMS.includes(s)))keys.push(...sets.organs);
 return [...new Set(keys)].map(i=>`main:${i}`);
}
/** First load: skeleton, muscles and joints & ligaments. Fascia, nerves, insertions and landmarks are off; arteries,
 * veins and organs sit in the "More systems" fold, off. */
export const DEFAULT_VISIBLE:SystemId[] = ['skeletal','muscular','ligaments'];
/** The systems panel, top to bottom. The nervous system is one toggle that carries three sub-toggles: our schematic
 * central and peripheral nerves, and BodyParts3D's own nervous parts (brain and cranial nerves). */
export const PRIMARY_SYSTEMS:SystemId[]=['skeletal','muscular','ligaments','fascia'];
export const NERVOUS_GROUP:SystemId[]=['central-nerves','peripheral-nerves','nervous'];
export const TRAILING_SYSTEMS:SystemId[]=['insertions','landmarks'];
export const MORE_SYSTEMS:SystemId[]=['arterial','venous','cardiac','sensory','respiratory','digestive','urinary','lymphatic','endocrine','reproductive','integumentary','connective'];
export const MVMT_REGIONS:{id:string;name:string}[]=[{id:'head-jaw',name:'Head & jaw'},{id:'cervical',name:'Cervical'},{id:'shoulder',name:'Shoulder'},{id:'elbow-wrist',name:'Elbow & wrist'},{id:'thoracic',name:'Thoracic'},{id:'lumbar',name:'Lumbar'},{id:'hip',name:'Hip'},{id:'knee',name:'Knee'},{id:'ankle-foot',name:'Ankle & foot'}];
export type MuscleDepth=0|1|2;
/** A line from fascial-lines.json: stations in anatomical order, each resolved to concept ids on this body. `status` is what
 * those concepts hold - the structure itself (`full`), only its insertion patches (`attachments`), nothing (`none`) - and
 * `sides` counts the resolved meshes by side, so a bilateral station can be checked to light both. */
export interface FascialLine {id:string;name:string;stations:{structure:string;name:string;resolve:{kind:'mvmt'|'bp3d';id:string;name?:string}[];status:'full'|'attachments'|'none';sides:{l:number;r:number;unsided:number}}[]}
/** The context chunk keys a region view draws dimmed once its own chunks are in: the neighbours' parts that reach into it. */
export function contextKeysFor(atlas:Atlas,region:string|null):string[]{
 const r=region&&atlas.chunkSets?.regions[region];
 return r&&r.context?.length&&atlas.contexts?.[region]?[`context:${region}`]:[];
}
export const EXPLANATIONS:Record<string,string> = {
 'heart':'A muscular pump in the chest. Its right side sends blood to the lungs; its left side sends blood through the systemic circulation.',
 'liver':'A large organ beneath the right side of the diaphragm. It processes absorbed nutrients, produces bile, and synthesizes many proteins carried in the blood.',
 'brain':'The central organ of the nervous system. Its interconnected regions support perception, movement, memory, language, and the regulation of bodily functions.',
 'stomach':'A muscular chamber between the esophagus and small intestine. It stores and mixes food with acid and enzymes before releasing it into the duodenum.',
 'spleen':'A lymphoid organ in the upper left abdomen. It filters blood, removes aging blood cells, and participates in immune responses.',
 'pancreas':'An abdominal organ with digestive and endocrine roles. It supplies enzymes to the small intestine and releases hormones including insulin and glucagon.',
 'urinary bladder':'A muscular reservoir in the pelvis that stores urine arriving from the kidneys through the ureters.',
 'trachea':'The main airway connecting the larynx to the bronchi. Its cartilage supports keep the airway open during breathing.',
 'diaphragm':'A broad muscle separating the chest and abdomen. When it contracts, it increases chest volume and helps draw air into the lungs.',
};
export function explanation(name:string,system:SystemId){return EXPLANATIONS[name.toLowerCase()] ?? SYSTEMS.find(s=>s.id===system)?.description ?? '';}
