import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Script,createContext} from 'node:vm';
import {DEFAULTS,simulateHop,simulateInvert,simulateTurnComparison} from '../src/physics.ts';

test('standalone artifact parses with isolated module scopes',()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root,stdio:'pipe'});
  const html=readFileSync(new URL('../dist/impulse.html',import.meta.url),'utf8');
  const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script,'offline script must be embedded');
  assert.doesNotThrow(()=>new Script(script));
  assert.ok(!/^import /m.test(script),'offline artifact must not import local files');
  const audioData=JSON.parse(script.match(/globalThis\.ROADSTERLAB_AUDIO_DATA=(\{[^\n]+\});/)?.[1]||'null');
  assert.equal(Object.keys(audioData||{}).length,17,'standalone must embed every recording');
  for(const [name,url] of Object.entries(audioData)){
    assert.ok(url.startsWith('data:audio/wav;base64,'));
    assert.deepEqual(Buffer.from(url.split(',')[1],'base64'),readFileSync(new URL(`../dist/assets/audio/${name}.wav`,import.meta.url)));
  }
  const workerSource=readFileSync(new URL('../dist/standalone-worker.js',import.meta.url),'utf8');
  let received;
  const context=createContext({self:{postMessage:data=>{received=data;}}});
  new Script(workerSource).runInContext(context);
  const config={...DEFAULTS,pulse:.2,landingBurn:1};
  context.self.onmessage({data:{id:23,kind:'hop',config}});
  assert.equal(received.id,23);assert.ok(!received.error);
  assert.deepEqual(JSON.parse(JSON.stringify(received.result.runs[2])),simulateHop(config));
  const manualConfig={...config,landingBurn:2,manualBurnAt:1.48};
  context.self.onmessage({data:{id:24,kind:'hop',config:manualConfig}});
  assert.ok(!received.error);assert.equal(received.id,24);
  assert.deepEqual(JSON.parse(JSON.stringify(received.result.runs[2])),simulateHop(manualConfig));
  assert.ok(received.result.runs[2].landing.burnStart!==null);
  const invertConfig={...DEFAULTS,angle:90,fan:40};
  context.self.onmessage({data:{id:25,kind:'invert',config:invertConfig}});
  assert.ok(!received.error);assert.equal(received.id,25);
  assert.deepEqual(JSON.parse(JSON.stringify(received.result.runs[2])),simulateInvert(invertConfig));
  context.self.onmessage({data:{id:26,kind:'turn',config:DEFAULTS}});
  assert.ok(!received.error);assert.equal(received.id,26);
  assert.deepEqual(JSON.parse(JSON.stringify(received.result)),simulateTurnComparison(DEFAULTS));


});
