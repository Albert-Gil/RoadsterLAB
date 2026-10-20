// Stage reviewable release folders. This script never commits, uploads or publishes.
import {mkdir,readdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,relative,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const app=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(app,'..');
execFileSync(process.execPath,['scripts/build.mjs'],{cwd:app,stdio:'inherit'});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const output=join(app,'dist','release',`roadsterlab-${stamp}`);
const site=join(output,'web'),source=join(output,'source');
await mkdir(site,{recursive:true});await mkdir(source,{recursive:true});
async function copy(from,to){await mkdir(dirname(to),{recursive:true});await copyFile(from,to);}
async function tree(from,to){
 for(const item of await readdir(from,{withFileTypes:true})){
  if(item.isSymbolicLink())continue;
  const src=join(from,item.name),dst=join(to,item.name);
  if(item.isDirectory())await tree(src,dst);else if(item.isFile())await copy(src,dst);
 }
}
// Only top-level built assets; do not recursively include old releases/test output.
for(const item of await readdir(join(app,'dist'),{withFileTypes:true})){
 if(item.isFile()&&/\.(html|js|css)$/.test(item.name))await copy(join(app,'dist',item.name),join(site,item.name));
}
for(const folder of ['src','scripts','tests','docs'])await tree(join(app,folder),join(source,'impulse',folder));
for(const name of ['README.md','AGENTS.md','MILESTONES.md'])await copy(join(repo,name),join(source,name));
for(const name of ['README.md','index.html','package.json'])await copy(join(app,name),join(source,'impulse',name));
await copy(join(repo,'README.md'),join(site,'README.md'));
await tree(join(app,'docs'),join(site,'impulse','docs'));
await writeFile(join(output,'START-HERE.txt'),`RoadsterLAB local release candidate\n\nOffline: open web/roadsterlab.html.\nWeb hosting: upload the contents of web/.\nSource: see source/README.md for build commands and physics equations.\nRelease procedure: source/impulse/docs/RELEASE.md.\nDraft release notes: source/impulse/docs/RELEASE-NOTES.md.\n\nIndependent model; illustrative inputs, not Tesla performance data.\nThis folder has not been published.\n`);
const hashes=[];
async function hashTree(folder){
 for(const item of (await readdir(folder,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  const path=join(folder,item.name);
  if(item.isDirectory())await hashTree(path);
  else if(item.isFile())hashes.push(`${createHash('sha256').update(await readFile(path)).digest('hex')}  ${relative(output,path).replaceAll('\\','/')}`);
 }
}
await hashTree(output);
await writeFile(join(output,'SHA256SUMS.txt'),hashes.join('\n')+'\n');
console.log(`Release candidate staged: ${output}\n${hashes.length} files hashed. No publication performed.`);
