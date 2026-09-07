/// <reference lib="webworker" />
import { hashPixels, HASH_VERSION } from '@/lib/duplicates/core';
self.onmessage=async({data}:MessageEvent<{id:string;blob:Blob}>)=>{
  let bitmap:ImageBitmap|undefined;
  try{
    bitmap=await createImageBitmap(data.blob);
    const canvas=new OffscreenCanvas(9,8),ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Image processing unavailable.');
    ctx.fillStyle='white';ctx.fillRect(0,0,9,8);ctx.drawImage(bitmap,0,0,9,8);
    self.postMessage({record:{id:data.id,hash:hashPixels(ctx.getImageData(0,0,9,8).data),width:bitmap.width,height:bitmap.height,version:HASH_VERSION}});
  }catch(e){self.postMessage({error:String(e)});}finally{bitmap?.close();}
};
