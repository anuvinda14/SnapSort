// Run from the repository root. Preview by default; --apply backs up before removing.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd();
if(!fs.existsSync('src/main.tsx')||!fs.readFileSync('index.html','utf8').includes('/src/main.tsx'))throw new Error('Unexpected app entry point; no files changed.');
const pairs={ 'App.tsx':'src/App.tsx','main.tsx':'src/main.tsx','index.css':'src/index.css','types.ts':'src/types.ts','vite-env.d.ts':'src/vite-env.d.ts','db.ts':'src/lib/db.ts','image.ts':'src/lib/image.ts','ocr.ts':'src/lib/ocr.ts','semantic.worker.ts':'src/workers/semantic.worker.ts','useSemanticSearch.ts':'src/hooks/useSemanticSearch.ts' };
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const candidates=Object.entries(pairs).filter(([old,current])=>fs.existsSync(old)&&fs.existsSync(current)).map(([old])=>old);
const sources=[...walk('src'),...fs.readdirSync('.').filter(f=>/\.(?:html|json|[cm]?js|ts)$/.test(f)&&!candidates.includes(f))].filter(f=>!f.endsWith('package-lock.json'));
// Resolve literal relative/alias module paths and absolute app URLs to detect root references.
const safe=candidates.filter(candidate=>{
 for(const source of sources){const text=fs.readFileSync(source,'utf8');
  for(const match of text.matchAll(/['"`]([^'"`\n]+)['"`]/g)){
   const spec=match[1];let resolved;
   if(spec.startsWith('@/'))resolved=path.resolve('src',spec.slice(2));
   else if(spec.startsWith('./')||spec.startsWith('../'))resolved=path.resolve(path.dirname(source),spec);
   else if(spec.startsWith('/')&&!spec.startsWith('//'))resolved=path.resolve(root,'.'+spec);
   else continue;
   if([resolved,resolved+'.ts',resolved+'.tsx',resolved+'.css'].includes(path.resolve(candidate))){console.log(`KEEP ${candidate}: referenced in ${source}`);return false;}
  }
 }
 return true;
});
// Known obsolete artifacts. Unknown files, including preprocess_2.ts, are left for review.
for(const f of ['.keep','CLAUDE_PANEL_INTEGRATION.md','package-lock.json','.bolt','eng.traineddata'])if(fs.existsSync(f)){
 if((f==='eng.traineddata'||f==='package-lock.json')&&sources.some(s=>fs.readFileSync(s,'utf8').includes(f)))continue;
 safe.push(f);
}
console.log('Files to archive:',safe.length?safe.join(', '):'(none)');
if(!process.argv.includes('--apply')){console.log('Preview only. Apply with: node scripts/cleanup.mjs --apply');process.exit(0);}
const backup=path.resolve('..','SnapSort-cleanup-backup-'+new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(backup,{recursive:true});
for(const f of safe){fs.cpSync(f,path.join(backup,f),{recursive:true});fs.rmSync(f,{recursive:true});}
fs.writeFileSync(path.join(backup,'RESTORE.txt'),'Copy the backed-up files back into '+root+' to restore them.\n');
// Stop tracking generated directories without deleting their working copies.
try{const files=execFileSync('git',['ls-files','-z','--','dist','node_modules'],{encoding:'utf8'}).split('\0').filter(Boolean);for(let i=0;i<files.length;i+=100)execFileSync('git',['rm','--cached','--',...files.slice(i,i+100)],{stdio:'pipe'});}catch(e){console.log('Could not update generated-file tracking. Inspect git status:',e.message);}
console.log('Backup saved to:',backup);console.log('No commit or push performed. Run pnpm check, then inspect git status before committing.');
