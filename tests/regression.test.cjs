const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
let browser;
before(async () => {browser = await chromium.launch({headless:true, ...(process.platform==='win32'?{channel:'msedge'}:{})});});
after(async () => {await browser?.close();});
async function fixture({role='SUPER', restored=false, csp=true}={}) {
  const page = await browser.newPage();
  await page.addInitScript(({role,restored}) => {
    window.mock={role,restored,calls:[],rows:[],messages:[],signed:[],deleteError:null,mutationError:null,session:restored?{user:{id:'u'}}:null};
    if(restored) {sessionStorage.setItem('adminRole','SUPER');sessionStorage.setItem('userRole','SUPER');}
    function query(table) {
      const state={table,ops:[]};
      const q=new Proxy({}, {get(_,prop){
        if(prop==='then')return resolve=>{
          mock.calls.push(state);
          const mutation=state.ops.some(o=>['update','insert','delete'].includes(o[0]));
          const range=state.ops.find(o=>o[0]==='range');
          const error=state.ops.some(o=>o[0]==='delete')?mock.deleteError:(mutation?mock.mutationError:null);
          let data=range?mock.rows.slice(range[1],range[2]+1):mock.rows;
          if(mutation && !error)data=[{id:'row-1'}];
          resolve({data,error,count:mock.countUnavailable?null:mock.rows.length});
        };
        if(prop==='maybeSingle')return async()=>({data:mock.role?{role:mock.role,username:'Tester',is_active:true}:null,error:mock.role?null:{message:'staff denied'}});
        return (...args)=>{state.ops.push([prop,...args]);return q;};
      }});return q;
    }
    window.supabase={createClient:()=>({from:query, rpc:async(name,args)=>{mock.calls.push({rpc:name,args});return {data:[{id:'row-1',code:args?.p_code}],error:mock.mutationError};},auth:{
      getSession:async()=>({data:{session:mock.session},error:null}),
      getUser:async()=>({data:{user:mock.session?.user||null},error:null}),
      signInWithPassword:async()=>{mock.session={user:{id:'u'}};return {data:{user:{id:'u'},session:mock.session},error:null};},
      signOut:async()=>{mock.signedOut=true;mock.session=null;return {error:null};},
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
    },storage:{from:()=>({createSignedUrl:async p=>{mock.signed.push(p);return {data:{signedUrl:'https://signed.invalid/'+p},error:null};},remove:async paths=>{mock.removed=paths;return {error:null};}})}})};
    window.open=()=>null;
    window.__messages=[];
  },{role,restored});
  await page.route('**/*', async route=>{
    const u=new URL(route.request().url());
    if(u.hostname!=='test.local')return route.fulfill({status:200,body:''});
    const file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
    // Keep the authentication fixture in control; test the real Excel library separately.
    if(file.endsWith('supabase.js'))return route.fulfill({contentType:'text/javascript',body:''});
    const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png'};
    const policy=fs.readFileSync(path.join(root,'_headers'),'utf8').match(/Content-Security-Policy: (.*)/)?.[1];
    return route.fulfill({headers:csp&&policy?{'content-security-policy':policy}:{},contentType:types[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  await page.goto('https://test.local/');
  await page.waitForFunction(()=>window.supabaseClient && typeof window.openVehicleDossier==='function');
  if(restored)await page.waitForFunction(()=>window.currentStaffRole || !mock.role);
  await page.evaluate(()=>{window.alert=m=>mock.messages.push(m);window.showToast=m=>mock.messages.push(m);window.showConfirmModal=async()=>true;});
  return page;
}
async function login(page) {
  await page.evaluate(async()=>{document.getElementById('loginUsername').value='tester';document.getElementById('loginPassword').value='test-password';await document.getElementById('confirmLoginBtn').onclick();});
}
test('unknown staff cannot become SUPER and session is ended',async()=>{
  const p=await fixture({role:null});try{await login(p);const r=await p.evaluate(()=>({role:sessionStorage.getItem('userRole'),signedOut:mock.signedOut}));assert.notEqual(r.role,'SUPER');assert.equal(r.signedOut,true);}finally{await p.close();}
});
test('dossier image payload cannot execute script',async()=>{
  const p=await fixture({csp:false});try{const r=await p.evaluate(async()=>{window.__xss=0;openVehicleDossier({id:'x',owner:'Test',images:['bad" onerror="window.__xss=1']},'tuktuk');await new Promise(r=>setTimeout(r,40));return window.__xss;});assert.equal(r,0);}finally{await p.close();}
});
test('every private complaint image is signed',async()=>{
  const p=await fixture();try{const r=await p.evaluate(async()=>{await showCategorizedImages({selfie:'images/a.jpg',problemImages:['images/b.jpg']});return mock.signed;});assert.deepEqual(r,['images/a.jpg','images/b.jpg']);}finally{await p.close();}
});
test('corrupt JPEG rejects instead of leaving upload pending',async()=>{
  const p=await fixture();try{const r=await p.evaluate(async()=>Promise.race([uploadToSupabaseStorage(new File(['bad'],'bad.jpg',{type:'image/jpeg'})).then(()=> 'resolved',()=> 'rejected'),new Promise(r=>setTimeout(()=>r('pending'),150))]));assert.equal(r,'rejected');}finally{await p.close();}
});
test('plate formatting preserves searchable separators',async()=>{
  const p=await fixture();try{assert.equal(await p.evaluate(()=>formatLicensePlateString('ر ع و ١٢٣٤')),'ر ع و 1234');}finally{await p.close();}
});
test('latest pagination request wins',async()=>{
  const p=await fixture();try{const r=await p.evaluate(async()=>{const pending=[];const rendered=[];fetchPage=()=>new Promise(resolve=>pending.push(resolve));renderTable=rows=>rendered.push(rows[0]);updateStats=()=>{};window.currentFilter='tuktuk';const first=loadPage(1);window.currentFilter='microbus';const second=loadPage(1);if(pending.length===2)pending[1]({data:['new'],count:1});pending[0]({data:['old'],count:1});await Promise.all([first,second]);return rendered;});assert.deepEqual(r,['new']);}finally{await p.close();}
});
test('pagination query has a stable database order before range',async()=>{
  const p=await fixture();try{const ops=await p.evaluate(async()=>{mock.calls=[];await fetchPage(2,'','all','tuktuk');return mock.calls[0].ops.map(o=>o[0]);});assert(ops.indexOf('order')>=0 && ops.indexOf('order')<ops.indexOf('range'));}finally{await p.close();}
});
test('deletion denial never produces success',async()=>{
  const p=await fixture();try{await login(p);const msgs=await p.evaluate(async()=>{mock.messages=[];mock.rows=[{id:'1',national_id:'same'},{id:'2',national_id:'same'}];mock.deleteError={message:'denied'};await cleanupDuplicates();return mock.messages;});assert(!msgs.some(m=>m.includes('بنجاح')));assert(msgs.some(m=>m.includes('denied')));}finally{await p.close();}
});
test('coding and edit actions have handlers and retain target ID',async()=>{
  const p=await fixture();try{await login(p);const r=await p.evaluate(()=>{openVehicleDossier({id:'row-1',owner:'Test',images:[]},'tuktuk');document.getElementById('dossierBtnEdit').click();return {id:currentEditId,handlers:['randomCodeBtn','confirmCodeBtn','confirmEditBtn'].every(id=>typeof document.getElementById(id).onclick==='function')};});assert.equal(r.id,'row-1');assert.equal(r.handlers,true);}finally{await p.close();}
});
test('import UI exists and can open',async()=>{
  const p=await fixture();try{await login(p);const r=await p.evaluate(()=>{document.getElementById('bulkImportBtn').click();return !!document.getElementById('bulkImportFile') && document.getElementById('bulkImportModal')?.style.display!=='none';});assert.equal(r,true);}finally{await p.close();}
});
test('full export continues past the first API page',async()=>{
  const p=await fixture();try{const n=await p.evaluate(async()=>{mock.rows=Array.from({length:205},(_,i)=>({id:String(i)}));return (await window.fetchAllRows('orders')).length;});assert.equal(n,205);}finally{await p.close();}
});
test('impossible national ID date is rejected',async()=>{
  const p=await fixture();try{assert.equal(await p.evaluate(()=>{const e=document.getElementById('nationalId');e.value='29502311234567';return validateNationalId(e);}),false);}finally{await p.close();}
});
test('forged saved role cannot open the administrative page',async()=>{
  const p=await fixture();try{const allowed=await p.evaluate(()=>{sessionStorage.setItem('userRole','SUPER');sessionStorage.setItem('adminRole','SUPER');switchPage('adminPage');return document.body.classList.contains('admin-mode');});assert.equal(allowed,false);}finally{await p.close();}
});
test('restored VIEWER is verified again instead of using saved SUPER',async()=>{
  const p=await fixture({role:'VIEWER',restored:true});try{assert.equal(await p.evaluate(()=>window.currentStaffRole),'VIEWER');assert.equal(await p.evaluate(()=>document.getElementById('adminMenuStaffBtn').style.display),'none');}finally{await p.close();}
});
test('coding uses atomic RPC and surfaces a duplicate refusal',async()=>{
  const p=await fixture();try{await login(p);const r=await p.evaluate(async()=>{currentCodeItem={id:'row-1',item:{phone:''}};document.getElementById('manualCodeInput').value='123';mock.mutationError={code:'23505',message:'Code already used'};mock.messages=[];await document.getElementById('confirmCodeBtn').onclick();return {messages:mock.messages,call:mock.calls.find(c=>c.rpc==='assign_vehicle_code')};});assert.equal(r.call.args.p_order_id,'row-1');assert.equal(r.call.args.p_code,'123');assert(r.messages.some(m=>m.includes('already used')));assert(!r.messages.some(m=>m.includes('بنجاح')));}finally{await p.close();}
});
test('VIEWER cannot submit a code even by calling the handler directly',async()=>{
  const p=await fixture({role:'VIEWER'});try{await login(p);const calls=await p.evaluate(async()=>{mock.calls=[];await document.getElementById('confirmCodeBtn').onclick();return mock.calls;});assert.equal(calls.length,0);}finally{await p.close();}
});
test('successful edit writes to the selected record',async()=>{
  const p=await fixture();try{await login(p);const call=await p.evaluate(async()=>{openVehicleDossier({id:'row-1',owner:'Owner',phone:'01012345678',vType:'توكتوك',vYear:'2020',images:[]},'tuktuk');document.getElementById('dossierBtnEdit').click();document.getElementById('editOwnerName').value='Changed Owner';mock.calls=[];await document.getElementById('confirmEditBtn').onclick();return mock.calls.find(c=>c.ops?.some(o=>o[0]==='update'));});assert(call.ops.some(o=>o[0]==='eq' && o[1]==='id' && o[2]==='row-1'));assert.equal(call.ops.find(o=>o[0]==='update')[1].owner_name,'Changed Owner');}finally{await p.close();}
});
test('countless export fails instead of claiming completion',async()=>{
  const p=await fixture();try{const result=await p.evaluate(async()=>{mock.countUnavailable=true;try{await fetchAllRows('orders');return 'complete';}catch(_){return 'rejected';}});assert.equal(result,'rejected');}finally{await p.close();}
});
test('spreadsheet preview renders names as text',async()=>{
  const p=await fixture();try{await login(p);const XLSX=require('xlsx'), wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{'الاسم':'<img src=x onerror="window.__previewXss=1">','الرقم القومي':'29501011234567','الهاتف':'01012345678'}]),'Data');await p.locator('#bulkImportFile').setInputFiles({name:'test.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(wb,{type:'buffer',bookType:'xlsx'})});await p.waitForFunction(()=>document.getElementById('importPreview').textContent.includes('جاهز'));assert.equal(await p.evaluate(()=>!!window.__previewXss),false);assert((await p.locator('#importPreview').textContent()).includes('<img'));}finally{await p.close();}
});
test('exported Excel retains microbus plate and phone as text',async()=>{
  const p=await fixture();try{await login(p);await p.evaluate(()=>{mock.rows=[{id:'1',owner_name:'Owner',national_id:'29501011234567',phone:'01012345678',vehicle_type:'ميكروباص',license_plate:'ر ع و 1234',submitted_at:Date.now()}];});const promise=p.waitForEvent('download');await p.evaluate(async()=>document.getElementById('exportExcelBtn').onclick());const download=await promise;const XLSX=require('xlsx'), workbook=XLSX.read(fs.readFileSync(await download.path()));const row=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])[0];assert.equal(row['رقم اللوحة'],'ر ع و 1234');assert.equal(row['رقم الهاتف'],'01012345678');}finally{await p.close();}
});
test('citizen navigation still works with strict CSP',async()=>{
  const p=await fixture();try{await p.locator('#bnav-register').evaluate(el=>el.click());assert.equal(await p.locator('#citizenPage').evaluate(el=>el.classList.contains('active-page')),true);}finally{await p.close();}
});
test('failed edit leaves the form open and never reports success',async()=>{
  const p=await fixture();try{await login(p);const r=await p.evaluate(async()=>{openVehicleDossier({id:'row-1',owner:'Owner',phone:'01012345678',vType:'توكتوك',vYear:'2020',images:[]},'tuktuk');document.getElementById('dossierBtnEdit').click();mock.messages=[];mock.mutationError={message:'update denied'};await document.getElementById('confirmEditBtn').onclick();return {messages:mock.messages,visible:document.getElementById('editModal').style.display};});assert.equal(r.visible,'block');assert(r.messages.some(m=>m.includes('update denied')));assert(!r.messages.some(m=>m.includes('تم حفظ')));}finally{await p.close();}
});
test('cleanup preserves distinct vehicles owned by the same citizen',async()=>{
  const p=await fixture();try{await login(p);const calls=await p.evaluate(async()=>{mock.rows=[{id:'1',national_id:'same',code:'1'},{id:'2',national_id:'same',code:'2'}];mock.calls=[];await cleanupDuplicates();return mock.calls;});assert(!calls.some(c=>c.ops?.some(o=>o[0]==='delete')));}finally{await p.close();}
});
test('large codes do not allocate a billion-entry list for suggestions',async()=>{
  const p=await fixture();try{const n=await p.evaluate(async()=>{mock.rows=[{id:'1',code:'999999999'}];return getRandomAvailableCode();});assert(n>0 && n<999999999);}finally{await p.close();}
});
test('date filters use the production bigint millisecond format',async()=>{
  const p=await fixture();try{const ops=await p.evaluate(async()=>{window._dateFrom='2026-10-01';window._dateTo='2026-10-15';mock.calls=[];await fetchPage(1,'','all','tuktuk');return mock.calls[0].ops;});assert.equal(typeof ops.find(o=>o[0]==='gte')[2],'number');assert.equal(typeof ops.find(o=>o[0]==='lt')[2],'number');}finally{await p.close();}
});
