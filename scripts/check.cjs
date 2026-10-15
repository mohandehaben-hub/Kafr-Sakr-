const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
for(const dir of ['js','scripts','tests']) {
  for(const file of fs.readdirSync(path.join(root,dir)).filter(f=>/\.(c?js)$/.test(f))) {
    const r=spawnSync(process.execPath,['--check',path.join(root,dir,file)],{stdio:'inherit'});
    if(r.status) process.exit(r.status);
  }
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
if(/\son[a-z]+\s*=/i.test(html)) throw new Error('Inline event handler found');
console.log('JavaScript syntax and inline script checks passed');
