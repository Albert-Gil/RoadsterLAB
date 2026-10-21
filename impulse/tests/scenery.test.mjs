import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sceneryMeshes,coastalHeight} from '../src/scenery.js';
import {Scene} from '../src/scene.js';

test('campus geometry has finite unit normals facing the actual triangles',()=>{
 let vertices=0;
 for(const mesh of sceneryMeshes()){
  assert.equal(mesh.p.length,mesh.n.length);assert.equal(mesh.p.length%9,0);
  assert.ok(mesh.p.every(Number.isFinite));assert.ok(mesh.n.every(Number.isFinite));
  vertices+=mesh.p.length/3;
  for(let i=0;i<mesh.n.length;i+=3)assert.ok(Math.abs(Math.hypot(...mesh.n.slice(i,i+3))-1)<1e-10);
  for(let i=0;i<mesh.p.length;i+=9){
   const a=mesh.p.slice(i,i+3),b=mesh.p.slice(i+3,i+6),c=mesh.p.slice(i+6,i+9),u=b.map((v,j)=>v-a[j]),v=c.map((x,j)=>x-a[j]);
   const face=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
   if(Math.hypot(...face)<1e-8)continue; // Closed lathe poles have one zero-area triangle.
   const normal=[0,1,2].map(j=>mesh.n[i+j]+mesh.n[i+3+j]+mesh.n[i+6+j]);
   assert.ok(face.reduce((sum,x,j)=>sum+x*normal[j],0)>0,`${mesh.name} has inverted smooth normals`);
  }
 }
 assert.ok(vertices<100_000,'keep the static backdrop within a modest vertex budget');
});

test('sky follows the camera while scenery retains its Launch world position',()=>{
 const draws=[],models=[],eye=[12,4,18];
 const scene=Object.assign(Object.create(Scene.prototype),{
  frameX:250,dist:25,scenery:[{name:'site:test',color:[1,1,1]}],canvas:{dataset:{}},
  draw(...args){draws.push(args);},drawM(...args){models.push(args);}
 });
 scene.environment(eye);assert.deepEqual(draws[0][1],eye);
 assert.equal(models[0][1][12],-250);assert.equal(models[0][1][14],0);
 scene.frameX=800;scene.environment(eye);assert.equal(models[1][1][12],-800);
 assert.equal(scene.canvas.dataset.environment,'starbase-sunrise');
 scene.cam='hop-under';scene.scenery=[{name:'water',floor:5},{name:'tower'}];models.length=0;scene.environment(eye);
 assert.deepEqual(models.map(m=>m[0]),['tower'],'ground cannot occlude an underside inspection');
});

test('decorative dunes are finite and never enter roads or campus foundations',()=>{
 let high=0;
 for(let x=-1200;x<=1200;x+=20)for(let z=-1000;z<=100;z+=10){
  const y=coastalHeight(x,z);assert.ok(Number.isFinite(y)&&y>=0&&y<4);
  high=Math.max(high,y);if(z>=-180)assert.equal(y,0,'experiment ground stays level');
 }
 assert.ok(high>2,'the coastal mesh has actual relief');
 for(const [x,z] of [[-340,-545],[-70,-515],[140,-245]])assert.equal(coastalHeight(x,z),0,'foundations stay clear');
});
