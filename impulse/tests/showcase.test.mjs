import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SHOWCASE_STEPS,SHOWCASE_DURATION,showcaseFrame,showcaseStart} from '../src/showcase.js';

test('showcase maps all chapter boundaries without skipping a solver endpoint',()=>{
 assert.equal(SHOWCASE_DURATION,36);
 assert.deepEqual(SHOWCASE_STEPS.map(s=>s.kind),['launch','hop','invert','turn']);
 for(let i=0;i<SHOWCASE_STEPS.length;i++){
  const start=showcaseStart(i),end=start+SHOWCASE_STEPS[i].seconds;
  assert.equal(showcaseFrame(start).index,i);
  assert.equal(showcaseFrame(start).fraction,0);
  assert.equal(showcaseFrame(end-.01).fraction,1);
  assert.equal(showcaseFrame(end-.01).done,false);
 }
 assert.equal(showcaseFrame(100).done,true);
 assert.equal(showcaseFrame(100).clock,36);
 assert.equal(showcaseFrame(-1).fraction,0);
});

test('showcase scrubbing deterministically restores the camera and presentation time',()=>{
 const first=showcaseFrame(5.2);showcaseFrame(35);showcaseFrame(11);
 assert.deepEqual(showcaseFrame(5.2),first);
 assert.equal(first.camera,'focus');
 assert.equal(showcaseFrame(0).camera,'field');
 assert.equal(showcaseFrame(showcaseStart(1)).camera,'hop-track');
 assert.equal(showcaseFrame(showcaseStart(2)+5).camera,'invert-track');
 assert.equal(showcaseFrame(showcaseStart(2)).camera,'invert-field');
 assert.equal(showcaseFrame(showcaseStart(3)).camera,'turn-field');
 assert.equal(showcaseFrame(showcaseStart(3)+5).camera,'turn-focus');
});
