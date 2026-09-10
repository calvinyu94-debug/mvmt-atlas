// The indexes the viewer reads beside the geometry, rebuilt from atlas.json alone (idempotent, no
// chunk files touched): muscle depth for every BP3D and MVMT muscle part, the twelve fascial
// lines resolved to concept ids on this body, and the id bridge (every part to the MVMT structures
// that claim it, every structure to its parts) with the bundled copy of the structures' blurbs and
// the coverage table. Run after merge-layers.mjs and rechunk-bp3d.mjs.
//   node scripts/build-index.mjs <anatomy.json from mvmt-program> <structure-meshes.json>
// (anatomy.json is scripts/extract-anatomy.mjs run over mvmt-program's index.html.)
import fs from 'node:fs';
import {CONCEPT_MATCHES} from './overrides.mjs';
const dir=new URL('../public/models/',import.meta.url);
const [anatomyPath,joinPath]=process.argv.slice(2);
if(!anatomyPath||!joinPath)throw new Error('usage: build-index.mjs <anatomy.json> <structure-meshes.json>');
const atlas=JSON.parse(fs.readFileSync(new URL('atlas.json',dir),'utf8'));
const anatomy=JSON.parse(fs.readFileSync(anatomyPath,'utf8')),join=JSON.parse(fs.readFileSync(joinPath,'utf8'));
const norm=s=>{s=s.toLowerCase().replace(/[()]/g,'').replace(/\bcolli\b/g,'cervicis');const drop=new Set(['muscle','of','part','the','bone','left','right','and']);return s.split(/[^a-z0-9-]+/).filter(w=>w&&!drop.has(w)).sort().join(' ');};
const tokens=s=>new Set(norm(s).split(' ').filter(Boolean));
const bp3dConcepts=atlas.concepts.filter(c=>!c.source);
// every concept under a normalised name, not the first one indexed: BP3D holds many muscles as a
// pair of sided concepts ("right rhomboid major", "left rhomboid major") beside or instead of an
// unsided one, and "right" and "left" are dropped by norm, so one name is several concepts
const byNorm=new Map();for(const c of bp3dConcepts){const k=norm(c.name);if(!byNorm.has(k))byNorm.set(k,[]);byNorm.get(k).push(c);}
const byId=new Map(atlas.concepts.map(c=>[c.id,c]));
// a concept whose elements all sit inside another chosen concept's adds nothing ("right rhomboid
// major" inside "rhomboid major"); dropping it keeps the record short and the counts honest
const prune=cs=>cs.filter(c=>!cs.some(o=>o!==c&&o.elements.length>c.elements.length&&c.elements.every(e=>o.elements.includes(e))));
// every concept matching the name exactly by token set; else every smallest BP3D concept whose
// tokens contain the structure's ("Biceps Brachii" is BP3D's "short head of biceps brachii" and
// "long head of biceps brachii", both, once "of" goes; "Masseter, Superficial Part" would be
// "superficial part of masseter"). A one-word name is not searched by containment: "deltoid" is
// in the name of an artery.
const conceptsFor=name=>{const exact=byNorm.get(norm(name));if(exact)return prune(exact);const t=tokens(name);if(t.size<2)return[];let best=[],size=Infinity;for(const c of bp3dConcepts){const ct=tokens(c.name);if(![...t].every(w=>ct.has(w)))continue;if(ct.size<size){size=ct.size;best=[c];}else if(ct.size===size)best.push(c);}return prune(best);};
// the hand-kept table, checked whole before anything is written: every key a structure of
// mvmt-program's, every name a concept of this atlas
const structureNames=new Set(anatomy.map(s=>s.name));
for(const [key,names] of Object.entries(CONCEPT_MATCHES)){
 if(!structureNames.has(key))throw new Error(`CONCEPT_MATCHES names a structure mvmt-program does not have: ${key}`);
 const missing=names.filter(n=>!byNorm.has(norm(n)));
 if(missing.length)throw new Error(`${key}: CONCEPT_MATCHES names a concept this atlas lacks: ${missing.join(', ')}`);
}
// the BP3D concepts that stand for a structure: the table's answer when it has one, else the match
const bp3dFor=s=>{const manual=CONCEPT_MATCHES[s.name];return manual?prune(manual.flatMap(n=>byNorm.get(norm(n)))):conceptsFor(s.name);};

// ---- muscle depth: 1 superficial, 2 deep, from ANATOMY's layer through the structures that claim
// a part, shallowest claim winning (the same rule as mvmt-program's v3MuscleLayerOf)
const depth={};const note=(id,layer)=>{if(layer!==1&&layer!==2)return;depth[id]=Math.min(depth[id]??9,layer);};
let matchedStructures=0,unmatched=[];
for(const s of anatomy){
 if(s.system!=='muscular'||!s.layer)continue;
 const own=byId.get(s.id);if(own)for(const e of own.elements)note(e,s.layer);          // our own exported meshes it claims
 const cs=bp3dFor(s);
 if(cs.length){matchedStructures++;for(const c of cs)for(const e of c.elements)note(e,s.layer);}else unmatched.push(s.name);
}
const muscles=atlas.parts.filter(p=>p.system==='muscular');
const classified=muscles.filter(p=>depth[p.id]).length;
// a structure BP3D has no concept for may still have its belly: the muscles mvmt-anatomy carries across from
// Z-Anatomy arrive as our own muscular parts under the structure's concept, and take its depth that way
const partSystem=new Map(atlas.parts.map(p=>[p.id,p.system]));
const carriedStructures=unmatched.filter(n=>{const s=anatomy.find(x=>x.name===n);const own=s&&byId.get(s.id);return !!own&&own.elements.some(e=>partSystem.get(e)==='muscular');});
atlas.layers=atlas.layers||{};
atlas.layers.muscleDepth={note:'1 superficial, 2 deep, from MVMT ANATOMY layer through name-matched BP3D concepts and our own carried muscles; a muscle without an entry is shown under every depth setting',parts:depth,
 summary:{muscularParts:muscles.length,bp3dMuscularParts:muscles.filter(p=>!p.source).length,carriedMuscularParts:muscles.filter(p=>p.source).length,classified,superficial:muscles.filter(p=>depth[p.id]===1).length,deep:muscles.filter(p=>depth[p.id]===2).length,structuresMatched:matchedStructures,structuresUnmatched:unmatched.length,structuresCarried:carriedStructures.length},
 unmatchedStructures:unmatched,carriedStructures};
// atlas.json is written once, after the bridge at the end

// ---- fascial lines: named-structure storage, each station resolved to concept ids on this atlas.
// A station's `status` says what those concepts hold, so the viewer can say it on the row rather
// than light nothing: `full` when at least one mesh is a belly, sheet, ligament or tendon; `attachments`
// when every mesh is an insertion patch (the muscle itself is not on this body); `none` when nothing
// resolves at all. `sides` counts the meshes by side, because a bilateral station must light both.
const anat=new Map(anatomy.map(s=>[s.id,s]));
const parts=new Map(atlas.parts.map(p=>[p.id,p]));
const sideOf=p=>p.side==='l'||p.side==='r'?p.side:/\bleft\b/i.test(p.name)?'l':/\bright\b/i.test(p.name)?'r':'unsided';
const lines=[],unresolved=[],attachmentsOnly=[];
for(const [k,line] of Object.entries(join.fascialLines)){
 const stations=line.structures.map(sid=>{
  const s=anat.get(sid);if(!s)throw new Error(`${k}: station ${sid} is not a structure of mvmt-program's`);
  const resolve=[];
  if(byId.has(sid))resolve.push({kind:'mvmt',id:sid});
  for(const c of bp3dFor(s))if(!resolve.some(r=>r.id===c.id))resolve.push({kind:'bp3d',id:c.id,name:c.name});
  const elements=[...new Set(resolve.flatMap(r=>byId.get(r.id).elements))].map(id=>parts.get(id)).filter(Boolean);
  const status=!elements.length?'none':elements.every(p=>p.system==='insertions')?'attachments':'full';
  const sides={l:0,r:0,unsided:0};for(const p of elements)sides[sideOf(p)]++;
  const row={line:k,structure:sid,name:s.name,latin:s.latin??null,system:s.system??null};
  if(status==='none')unresolved.push(row);else if(status==='attachments')attachmentsOnly.push(row);
  return {structure:sid,name:s.name,resolve,status,sides};
 });
 lines.push({id:k,name:line.name,stations});
}
fs.writeFileSync(new URL('fascial-lines.json',dir),JSON.stringify({note:'Twelve myofascial lines as ordered lists of MVMT structures; each station resolves at load to the concept ids listed (mvmt = our exported meshes, bp3d = BodyParts3D concepts), status says whether that is the structure itself (full), only its insertion patches (attachments) or nothing (none), and sides counts the resolved meshes by side. Stations with no resolution are listed under unresolved, stations with patches alone under attachmentsOnly.',lines,unresolved,attachmentsOnly},null,1));
for(const l of lines){
 console.log(`\n${l.id} ${l.name}`);
 for(const st of l.stations)console.log(`  ${st.status.padEnd(11)} l${st.sides.l} r${st.sides.r} u${st.sides.unsided}  ${st.name}  <- ${st.resolve.map(r=>r.kind==='mvmt'?r.id:r.name).join(', ')}`);
}
console.log(JSON.stringify({muscleDepth:atlas.layers.muscleDepth.summary,fascialLines:lines.length,stations:lines.reduce((n,l)=>n+l.stations.length,0),full:lines.reduce((n,l)=>n+l.stations.filter(s=>s.status==='full').length,0),attachmentsOnly:attachmentsOnly.map(u=>u.structure),unresolved:unresolved.map(u=>u.structure)}));

// ---- the id bridge: what a click on any part resolves to. Every part (BP3D's and ours) to the
// MVMT structures that claim it, and every structure to the parts it claims. A structure claims
// its own exported meshes (the concept under its id) and the BP3D concepts bp3dFor gives it, so
// the bridge is the same answer muscle depth and the fascial lines already read, applied to the
// whole map rather than to muscles and stations.
//
// A part claimed by several structures lists them in resolution order, and the viewer takes the
// first: the most specific *group* (a structure with no `inherits`), then the rest by
// specificity. That is mvmt-program's own default (Show named parts off): a click on the deep part
// of masseter answers Masseter, and Masseter, Deep Part is a link under "Breaks down into".
// Specificity is the number of parts claimed, fewest first; a tie between a named structure and a
// container from the join (Talocrural Joint holding exactly the lateral ligaments) goes to the
// named structure, as v3Rank does in mvmt-program.
const containers=new Set(join.structures.filter(x=>x.container).map(x=>x.id));
const partsOf={},claimsOf=new Map();
for(const s of anatomy){
 const own=byId.get(s.id)?.elements??[];
 const bp=bp3dFor(s).flatMap(c=>c.elements);
 const els=[...new Set([...own,...bp])].filter(e=>parts.has(e));
 partsOf[s.id]=els;
 for(const e of els){if(!claimsOf.has(e))claimsOf.set(e,new Set());claimsOf.get(e).add(s.id);}
}
const rank=(a,b)=>{const na=partsOf[a].length,nb=partsOf[b].length;if(na!==nb)return na-nb;const ca=containers.has(a),cb=containers.has(b);if(ca!==cb)return ca?1:-1;return a<b?-1:a>b?1:0;};
const order=ids=>{const sorted=[...ids].sort(rank);const group=sorted.find(id=>!anat.get(id).inherits);return group?[group,...sorted.filter(id=>id!==group)]:sorted;};
const bridgeParts={};for(const [e,set] of claimsOf)bridgeParts[e]=order(set);
// coverage: BP3D's own parts, by system, with and without a structure. Muscles, bones, joints &
// ligaments and fascia are the four systems the bridge is for; the rest is reported, not worked.
const BRIDGE_SYSTEMS=['muscular','skeletal','connective','fascia'];
const bp3dParts=atlas.parts.filter(p=>!p.source);
const cov={};for(const p of bp3dParts){const c=cov[p.system]=cov[p.system]||{parts:0,withStructure:0,without:0};c.parts++;if(bridgeParts[p.id])c.withStructure++;else c.without++;}
const covered=bp3dParts.filter(p=>BRIDGE_SYSTEMS.includes(p.system));
const noGeometry=anatomy.filter(s=>!partsOf[s.id].length).map(s=>s.id);
atlas.layers.mvmt={note:'The id bridge. parts: every part id (BP3D and MVMT layers) to the MVMT structure ids that claim it, in resolution order (the most specific group first, then the rest by specificity); structures: every MVMT structure id to the part ids it claims, its own exported meshes and the BP3D concepts name-matched or hand-matched to it (scripts/overrides.mjs CONCEPT_MATCHES). The blurbs live in mvmt-structures.json.',
 parts:bridgeParts,structures:partsOf,names:Object.fromEntries(anatomy.map(s=>[s.id,s.name])),
 summary:{structures:anatomy.length,structuresWithParts:anatomy.length-noGeometry.length,structuresWithoutParts:noGeometry.length,bp3dParts:bp3dParts.length,bp3dPartsInScope:covered.length,bp3dPartsWithStructure:covered.filter(p=>bridgeParts[p.id]).length,bp3dPartsWithout:covered.filter(p=>!bridgeParts[p.id]).length,bySystem:cov}};
fs.writeFileSync(new URL('atlas.json',dir),JSON.stringify(atlas));

// the bundled copy of the structures' text, for a viewer with no parent frame to ask: what the
// structure does and why it matters, never the drills (those come from the parent's library, which
// the practitioner may have extended). clinical is practitioner-only there and here alike.
const STRUCTURE_FIELDS=['id','name','latin','region','alsoRegion','system','layer','inherits','action','clinical','noExercises','modelNote'];
const structures=anatomy.map(s=>Object.fromEntries(STRUCTURE_FIELDS.filter(k=>s[k]!==undefined).map(k=>[k,s[k]])));
fs.writeFileSync(new URL('mvmt-structures.json',dir),JSON.stringify({note:"mvmt-program's ANATOMY without the drill lists: name, Latin, region, system, what it does (action) and why it matters clinically (clinical, practitioner-only). Read by the viewer when it has no parent frame to ask; embedded in mvmt-program the parent answers from its live library instead.",generatedFrom:'mvmt-program index.html ANATOMY via scripts/extract-anatomy.mjs',structures}));

// the coverage table, for review: which BP3D parts resolve to a structure and which do not, and
// which structures have no geometry in this atlas at all
const base=n=>n.replace(/\b(right|left)\s+/i,'').replace(/\s+of (right|left) /i,' of ').replace(/\s+\((right|left)\)/i,'');
const md=[];
md.push('# Id bridge coverage','',`Generated by \`scripts/build-index.mjs\` on ${new Date().toISOString().slice(0,10)}. Which BodyParts3D parts resolve to an MVMT structure through \`atlas.layers.mvmt\`, and which do not. The four systems the bridge is for are muscles, bones, joints & ligaments (BP3D's \`connective\`) and fascia; the others are counted, not worked. Every MVMT layer part (\`source: zanatomy\` or \`schematic\`) carries its structures from the export and is not listed here.`,'','## BodyParts3D parts by system','','| System | Parts | With a structure | Without |','|---|---|---|---|');
for(const sy of Object.keys(cov).sort((a,b)=>(BRIDGE_SYSTEMS.includes(b)?1:0)-(BRIDGE_SYSTEMS.includes(a)?1:0)||a.localeCompare(b))){const c=cov[sy];md.push(`| ${sy}${BRIDGE_SYSTEMS.includes(sy)?'':' (out of scope)'} | ${c.parts} | ${c.withStructure} | ${c.without} |`);}
md.push('',`In scope: **${atlas.layers.mvmt.summary.bp3dPartsWithStructure} of ${covered.length}** parts resolve to a structure; ${atlas.layers.mvmt.summary.bp3dPartsWithout} do not.`);
for(const sy of BRIDGE_SYSTEMS){
 const without=covered.filter(p=>p.system===sy&&!bridgeParts[p.id]);
 md.push('',`## ${sy}: parts without a structure (${without.length})`,'');
 if(!without.length){md.push('None.');continue;}
 const groups={};for(const p of without){const b=base(p.name);(groups[b]=groups[b]||{n:0,regions:new Set()}).n++;groups[b].regions.add(p.region??'?');}
 md.push('| BP3D part | Sides | Region |','|---|---|---|');
 for(const b of Object.keys(groups).sort((a,c)=>a.localeCompare(c)))md.push(`| ${b} | ${groups[b].n} | ${[...groups[b].regions].join(', ')} |`);
}
md.push('','## structures resolving to BP3D parts (in scope)','','| Structure | System | BP3D parts | BP3D concepts |','|---|---|---|---|');
for(const s of anatomy){const bp=partsOf[s.id].filter(e=>parts.get(e)&&!parts.get(e).source);if(!bp.length)continue;md.push(`| ${s.name} (\`${s.id}\`) | ${s.system} | ${bp.length} | ${bp3dFor(s).map(c=>c.name).join(', ')} |`);}
md.push('','## structures with no geometry in this atlas','','No BP3D concept and no carried mesh, so a click can never reach them and the panel only ever shows them by search or by link.','','| Structure | System | Region |','|---|---|---|');
for(const id of noGeometry){const s=anat.get(id);md.push(`| ${s.name} (\`${s.id}\`) | ${s.system} | ${s.region} |`);}
fs.mkdirSync(new URL('../verification/bridge/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../verification/bridge/coverage.md',import.meta.url),md.join('\n')+'\n');
console.log(JSON.stringify({bridge:atlas.layers.mvmt.summary}));
