const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'), dist=path.join(root,'dist');
// Only deploy this explicit list. Audit snapshots, SQL and tests stay local.
if(path.dirname(dist)!==root || path.basename(dist)!=='dist') throw new Error('Invalid build output directory');
fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(dist,{recursive:true});
for(const item of ['index.html','_headers','_routes.json','CNAME','sharkiya_flag.png','css','vendor']) {
  fs.cpSync(path.join(root,item),path.join(dist,item),{recursive:true});
}
fs.mkdirSync(path.join(dist,'js'),{recursive:true});
for(const file of fs.readdirSync(path.join(root,'js'))) {
  if(file.endsWith('.js') && file!=='env.example.js' && file!=='env.js') fs.copyFileSync(path.join(root,'js',file),path.join(dist,'js',file));
}
console.log('Production assets prepared in dist/');
