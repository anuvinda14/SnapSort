export const HASH_VERSION = 'dhash64-v1';
export const MAX_DISTANCE = 4;
export interface ImageHash { id:string; hash:string; width:number; height:number; version:string }
export function hashPixels(pixels: Uint8ClampedArray): string {
  if(pixels.length!==9*8*4) throw new Error('Expected 9 × 8 RGBA pixels.');
  let result=0n;
  const gray=(i:number)=>0.299*pixels[i]+0.587*pixels[i+1]+0.114*pixels[i+2];
  for(let y=0;y<8;y++)for(let x=0;x<8;x++)result=(result<<1n)|BigInt(gray((y*9+x)*4)>gray((y*9+x+1)*4)?1:0);
  return result.toString(16).padStart(16,'0');
}
export function distance(a:string,b:string):number {
  let xor=BigInt('0x'+a)^BigInt('0x'+b),count=0;
  while(xor){xor&=xor-1n;count++;}return count;
}
function bands(hash:string):string[]{
  const bits=BigInt('0x'+hash).toString(2).padStart(64,'0');
  return [bits.slice(0,13),bits.slice(13,26),bits.slice(26,39),bits.slice(39,52),bits.slice(52)];
}
/** Five disjoint bands guarantee at least one identical band when <=4 bits differ.
 * Build/query incrementally once per hash collection change, never on OCR progress/search. */
export function clusterHashes(records:ImageHash[]):string[][] {
  const buckets=new Map<string,number[]>(), parent=records.map((_,i)=>i);
  const find=(i:number):number=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  for(let i=0;i<records.length;i++){
    const r=records[i], parts=bands(r.hash), candidates=new Set<number>();
    parts.forEach((b,k)=>buckets.get(`${k}:${b}`)?.forEach(j=>candidates.add(j)));
    for(const j of candidates){const other=records[j];const ratio=(r.width/r.height)/(other.width/other.height);
      if(ratio>=0.98&&ratio<=1.02&&distance(r.hash,other.hash)<=MAX_DISTANCE)parent[find(i)]=find(j);
    }
    parts.forEach((b,k)=>{const key=`${k}:${b}`;const list=buckets.get(key)??[];list.push(i);buckets.set(key,list);});
  }
  const groups=new Map<number,string[]>();records.forEach((r,i)=>{const root=find(i);const g=groups.get(root)??[];g.push(r.id);groups.set(root,g);});
  return [...groups.values()].filter(g=>g.length>1).map(g=>g.sort()).sort((a,b)=>a[0].localeCompare(b[0]));
}
export function isDismissed(group:string[],dismissals:string[][]){return dismissals.some(d=>group.every(id=>d.includes(id)));}
