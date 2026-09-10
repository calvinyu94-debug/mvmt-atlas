// The <anatomy.json> the other scripts take is mvmt-program's ANATOMY array, lifted out of its
// index.html. There is no build step over there, so the array is read here: the literal between
// `const ANATOMY = [` and its closing bracket, evaluated as plain data (it references nothing).
//   node scripts/extract-anatomy.mjs <path to mvmt-program/index.html> <anatomy.json>
import fs from 'node:fs';
const [src,out]=process.argv.slice(2);
if(!src||!out)throw new Error('usage: extract-anatomy.mjs <mvmt-program/index.html> <anatomy.json>');
const html=fs.readFileSync(src,'utf8');
const start=html.indexOf('const ANATOMY = [');
if(start<0)throw new Error('no `const ANATOMY = [` in '+src);
const body=html.slice(start+'const ANATOMY = '.length);
// walk to the matching bracket, skipping string literals and comments
let depth=0,quote=null,end=-1;
for(let i=0;i<body.length;i++){
 const c=body[i];
 if(quote){if(c==='\\'){i++;continue;}if(c===quote)quote=null;continue;}
 if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
 if(c==='/'&&body[i+1]==='*'){i=body.indexOf('*/',i+2)+1;continue;}
 if(c==='/'&&body[i+1]==='/'){i=body.indexOf('\n',i);continue;}
 if(c==='[')depth++;
 else if(c===']'&&--depth===0){end=i+1;break;}
}
if(end<0)throw new Error('the ANATOMY array never closes');
const anatomy=new Function('return '+body.slice(0,end))();
if(!Array.isArray(anatomy)||!anatomy.every(s=>s.id&&s.name&&s.region&&s.system))throw new Error('ANATOMY did not evaluate to a list of structures');
fs.writeFileSync(out,JSON.stringify(anatomy,null,1));
const systems={};for(const s of anatomy)systems[s.system]=(systems[s.system]||0)+1;
console.log(JSON.stringify({structures:anatomy.length,systems}));
