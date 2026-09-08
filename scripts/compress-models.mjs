import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
// Only the .gz chunks are committed and served (GitHub Pages hands them over as raw bytes and the
// viewer decompresses them itself), so the uncompressed .bin is removed once its .gz is written.
const base=new URL('../public/models/',import.meta.url);
for(const name of fs.readdirSync(base).filter(n=>n.endsWith('.json'))){
 const path=new URL(name,base),atlas=JSON.parse(fs.readFileSync(path));
 if(!Array.isArray(atlas.chunks))continue;
 let bytes=0;
 for(const c of atlas.chunks){const raw=new URL(c.url.split('/').pop(),base);if(!fs.existsSync(raw))continue;const compressed=gzipSync(fs.readFileSync(raw),{level:9});c.gzip=c.url+'.gz';c.gzipBytes=compressed.length;fs.writeFileSync(new URL(c.gzip.split('/').pop(),base),compressed);fs.unlinkSync(raw);bytes+=compressed.length;}
 fs.writeFileSync(path,JSON.stringify(atlas));console.log(`${name}: ${(bytes/1e6).toFixed(1)} MB compressed download`);
}
