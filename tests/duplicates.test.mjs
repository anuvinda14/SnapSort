import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPixels,distance,clusterHashes,isDismissed,HASH_VERSION } from '../src/lib/duplicates/core.ts';
const r=(id,hash,extra={})=>({id,hash:BigInt(hash).toString(16).padStart(16,'0'),width:900,height:1600,version:HASH_VERSION,...extra});
test('dHash preserves edges and tolerates uniform brightness shifts',()=>{
 const a=new Uint8ClampedArray(288),b=new Uint8ClampedArray(288);
 for(let y=0;y<8;y++)for(let x=0;x<9;x++){const i=(y*9+x)*4,v=x%2?100:150;a.set([v,v,v,255],i);b.set([v+10,v+10,v+10,255],i);}
 assert.equal(hashPixels(a),'aaaaaaaaaaaaaaaa');assert.equal(hashPixels(a),hashPixels(b));assert.throws(()=>hashPixels(new Uint8ClampedArray(4)));
});
test('Hamming distance and 4-bit boundary',()=>{
 assert.equal(distance('0000000000000000','ffffffffffffffff'),64);
 assert.deepEqual(clusterHashes([r('a',0),r('b',15)]),[['a','b']]);assert.deepEqual(clusterHashes([r('a',0),r('b',31)]),[]);
});
test('proportions filter without excluding resized copies',()=>{
 assert.deepEqual(clusterHashes([r('a',0),r('b',0,{width:450,height:800})]),[['a','b']]);
 assert.deepEqual(clusterHashes([r('a',0),r('b',0,{width:1600,height:900})]),[]);
});
test('transitive groups are connected components',()=>assert.deepEqual(clusterHashes([r('a',0),r('b',15),r('c',255)]),[['a','b','c']]));
test('dismissal hides remaining members but not new additions',()=>{assert.equal(isDismissed(['a','b'],[['a','b','c']]),true);assert.equal(isDismissed(['a','b','d'],[['a','b','c']]),false);});
test('band index finds four-bit matches across random bit positions',()=>{
 let state=123456789n;const rnd=()=>{state=(state*6364136223846793005n+1442695040888963407n)&((1n<<64n)-1n);return state;};
 for(let n=0;n<150;n++){const base=rnd();let near=base;for(let j=0;j<4;j++)near^=1n<<(rnd()%64n);assert.equal(clusterHashes([r('a',base),r('b',near)]).length,1);}
});
