import { createHash } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { dirname,resolve,sep } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
const manifest=JSON.parse(await readFile('release-manifest.json','utf8'));
const origin=new URL(manifest.origin);
if(origin.protocol!=='https:' || manifest.files.length!==247) throw new Error('Unexpected release manifest');
const root=resolve('_site');
let next=0,done=0;
async function restore() {
  for(let entry; (entry=manifest.files[next++]); ) {
    const output=resolve(root,entry.path);
    if(!output.startsWith(root+sep)) throw new Error('Invalid release path');
    const url=new URL(entry.path.split('/').map(encodeURIComponent).join('/'),origin);
    let last;
    for(let attempt=0;attempt<4;attempt++){
      try {
        const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(60000)});
        if(!response.ok) throw new Error('HTTP '+response.status);
        const bytes=Buffer.from(await response.arrayBuffer());
        if(bytes.length!==entry.bytes || createHash('sha256').update(bytes).digest('hex')!==entry.sha256) throw new Error('file hash mismatch');
        await mkdir(dirname(output),{recursive:true});
        await writeFile(output,bytes);
        if(++done%40===0 || done===manifest.files.length) console.log('Verified '+done+'/'+manifest.files.length+' files');
        last=undefined;
        break;
      } catch(error){last=error; if(attempt<3) await pause(1200*2**attempt);}
    }
    if(last) throw new Error(entry.path+': '+last.message);
  }
}
await mkdir(root,{recursive:true});
await Promise.all(Array.from({length:5},()=>restore()));
await writeFile(resolve(root,'.nojekyll'),'');
