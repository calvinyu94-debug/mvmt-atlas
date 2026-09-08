/** The site is served under Vite's `base` (`/mvmt-atlas/` on GitHub Pages), but
 * atlas.json stores chunk URLs root-absolute (`/models/body-0.bin.gz`) and is
 * not rewritten. Resolve every root-absolute asset path through this at fetch
 * time so the same manifest works at any base.
 */
export function assetUrl(path:string):string{
 const base=import.meta.env.BASE_URL||'/';
 return base.replace(/\/$/,'')+'/'+path.replace(/^\//,'');
}
