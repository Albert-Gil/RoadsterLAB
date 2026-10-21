import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { Script } from 'node:vm';
await mkdir('dist', { recursive: true });
await copyFile('index.html', 'dist/index.html');
for (const file of ['recorder.js','engineering.js','showcase.js','tuning.js','ui.js','app.js','scene.js','scenery.js','audio.js','audio-assets.js','audio-mapping.js','air-table.js','plots.js','hop.js','invert.js','turn.js','vessel.js','simulation-client.js','simulation-worker.js','style.css']) await copyFile(`src/${file}`, `dist/${file}`);
const physicsSrc = stripTypeScriptTypes(await readFile('src/physics.ts','utf8'));
await writeFile('dist/physics.js', physicsSrc);
const html = await readFile('index.html','utf8'), css = await readFile('src/style.css','utf8');
const scene = await readFile('src/scene.js','utf8'), app = await readFile('src/app.js','utf8');
const audio = await readFile('src/audio.js','utf8'), air = await readFile('src/air-table.js','utf8');
const audioCatalog=JSON.parse(await readFile('assets/audio/catalog.json','utf8'));
const audioData={};await mkdir('dist/assets/audio',{recursive:true});
for(const [name,asset] of Object.entries(audioCatalog)){
 await copyFile(`assets/audio/web/${asset.file}`,`dist/assets/audio/${asset.file}`);
 audioData[name]='data:audio/wav;base64,'+(await readFile(`assets/audio/web/${asset.file}`)).toString('base64');
}
await copyFile('assets/audio/RIGHTS.json','dist/assets/audio/RIGHTS.json');
const audioAssets=await readFile('src/audio-assets.js','utf8'),audioMapping=await readFile('src/audio-mapping.js','utf8');
// Keep module scopes isolated in the offline artifact, including private table arrays.
// Collect the actual named imports instead of maintaining a second public API list.
function bundle(modules){
 const ids=new Map([...modules.keys()].map((name,i)=>[name,`__module${i}`]));
 const requested=new Map([...modules.keys()].map(name=>[name,new Set()]));
 const importPattern=/^import\s*\{([^}]+)\}\s*from\s*['"]\.\/([^'"]+)['"];?\r?\n/gm;
 for(const source of modules.values())for(const match of source.matchAll(importPattern))
  for(const name of match[1].split(',').map(x=>x.trim()))requested.get(match[2]).add(name);
 return [...modules].map(([name,source])=>{
  const body=source.replace(importPattern,(_,names,path)=>`const {${names}}=${ids.get(path)};\n`)
   .replace(/^export\s*\{[^}]+\};?\r?\n/gm,'').replace(/^export /gm,'').replaceAll('import.meta.url','document.baseURI');
  return `const ${ids.get(name)}=(()=>{\n${body}\nreturn {${[...requested.get(name)].join(',')}};\n})();`;
 }).join('\n');
}
const worker=await readFile('src/simulation-worker.js','utf8');
const workerBundle=bundle(new Map([['air-table.js',air],['physics.js',physicsSrc],['simulation-worker.js',worker]]));
new Script(workerBundle,{filename:'standalone-worker.js'});
const recorder=await readFile('src/recorder.js','utf8'),engineering=await readFile('src/engineering.js','utf8');
const showcase=await readFile('src/showcase.js','utf8');
const tuning=await readFile('src/tuning.js','utf8');
const ui=await readFile('src/ui.js','utf8');
const plots=await readFile('src/plots.js','utf8'),client=await readFile('src/simulation-client.js','utf8');
const hop=await readFile('src/hop.js','utf8');
const invert=await readFile('src/invert.js','utf8');
const turn=await readFile('src/turn.js','utf8');
const vessel=await readFile('src/vessel.js','utf8');
const scenery=await readFile('src/scenery.js','utf8');
const bundled='globalThis.ROADSTERLAB_AUDIO_DATA='+JSON.stringify(audioData)+';\n'+'globalThis.IMPULSE_WORKER_SOURCE='+JSON.stringify(workerBundle)+';\n'+bundle(new Map([
 ['air-table.js',air],['physics.js',physicsSrc],['audio-assets.js',audioAssets],['audio-mapping.js',audioMapping],['audio.js',audio],['hop.js',hop],['invert.js',invert],['turn.js',turn],['scenery.js',scenery],['scene.js',scene],
 ['showcase.js',showcase],['recorder.js',recorder],['engineering.js',engineering],['tuning.js',tuning],['ui.js',ui],['simulation-client.js',client],['plots.js',plots],['vessel.js',vessel],['app.js',app]
]));
await writeFile('dist/standalone-worker.js',workerBundle);
// Check the artifact itself, not just its component files.
new Script(bundled, {filename:'roadsterlab.html'});
await writeFile('dist/impulse.html', html.replace('<link rel="stylesheet" href="style.css"/>', `<style>${css}</style>`).replace('<script type="module" src="app.js"></script>', `<script type="module">${bundled.replace(/<\/script/gi,'<\\/script')}</script>`));
await copyFile('dist/impulse.html','dist/roadsterlab.html');
console.log('Built dependency-free application in dist/');
