// Administrative mutations. Authorization must also be enforced by RLS/RPC.
(function() {
  const value=id=>document.getElementById(id).value.trim();
  const busy=async(button,action)=>{
    if(button.disabled) return;
    button.disabled=true;
    try {await action();}
    catch(error) {window.showToast(error.message || 'تعذر تنفيذ الإجراء','error');}
    finally {button.disabled=false;}
  };
  document.getElementById('randomCodeBtn').onclick=function() {
    return busy(this,async()=>{
      window.requireAdminRole();
      document.getElementById('manualCodeInput').value=await window.getRandomAvailableCode();
    });
  };
  document.getElementById('confirmCodeBtn').onclick=function() {
    return busy(this,async()=>{
      window.requireAdminRole();
      if(!currentCodeItem?.id) throw new Error('أعد فتح ملف المركبة');
      const code=window.toAsciiDigits(value('manualCodeInput'));
      if(!/^[1-9]\d{0,8}$/.test(code)) throw new Error('أدخل كودًا صحيحًا من 1 إلى 999999999');
      const {data,error}=await window.supabaseClient.rpc('assign_vehicle_code',{p_order_id:String(currentCodeItem.id),p_code:code});
      if(error) {
        if(error.code==='PGRST202') throw new Error('خدمة التكويد تحتاج تفعيلًا من مسؤول النظام');
        throw error;
      }
      if(!data?.length) throw new Error('لم يتم حفظ الكود. أعد تحميل السجل.');
      document.getElementById('codeModal').style.display='none';
      window.showToast('تم حفظ الكود بنجاح','success');
      await logAdminAction(getUsername(),'تكويد مركبة',`السجل ${currentCodeItem.id} — الكود ${code}`);
      if(document.getElementById('sendWhatsAppCode').checked) {
        await window.sendWhatsAppNotification(currentCodeItem.item.phone,`تم تكويد مركبتك برقم ${code}`);
      }
      currentCodeItem=null;
      await loadPage(window.currentPage);
    });
  };
  document.getElementById('confirmEditBtn').onclick=function() {
    return busy(this,async()=>{
      window.requireAdminRole();
      if(!currentEditId) throw new Error('أعد فتح ملف المركبة');
      const owner=value('editOwnerName'), phone=window.toAsciiDigits(value('editPhone'));
      const type=value('editVType');
      if(owner.length<3 || !/^\d{11}$/.test(phone)) throw new Error('راجع الاسم ورقم الهاتف');
      if(!['توكتوك','ميكروباص'].includes(type)) throw new Error('نوع مركبة غير صحيح');
      const plate=type==='ميكروباص'?formatLicensePlateString(value('editLicensePlate')):'';
      if(type==='ميكروباص' && (!/[\u0621-\u064A]/.test(plate)||!/\d/.test(plate))) throw new Error('أدخل لوحة الميكروباص');
      await window.confirmRowUpdate(window.supabaseClient.from('orders').update({
        owner_name:owner,phone,vehicle_type:type,vehicle_year:value('editVYear'),
        address:value('editAddress'),license_plate:plate || null
      }).eq('id',currentEditId));
      await logAdminAction(getUsername(),'تعديل مركبة',`السجل ${currentEditId}`);
      document.getElementById('editModal').style.display='none';
      currentEditId='';
      window.showToast('تم حفظ التعديلات','success');
      await loadPage(window.currentPage);
    });
  };

  window.cleanupDuplicates=async()=>{
    try {
      window.requireAdminRole(['SUPER']);
      const rows=await window.fetchAllRows('orders');
      rows.sort((a,b)=>Number(new Date(b.submitted_at))-Number(new Date(a.submitted_at)));
      const seen=new Set(),duplicates=[];
      for(const row of rows) {
        if(!row.national_id) continue;
        // Same owner alone is not a duplicate: preserve distinct vehicles, codes and documents.
        const fingerprint=JSON.stringify(Object.keys(row).sort().filter(k=>!['id','ref_number','submitted_at','created_at','updated_at'].includes(k)).map(k=>[k,row[k]]));
        if(seen.has(fingerprint)) duplicates.push(row.id); else seen.add(fingerprint);
      }
      if(!duplicates.length) {window.showToast('لا توجد سجلات متطابقة للتنظيف','info');return;}
      if(!await window.showConfirmModal({title:'تنظيف السجلات المتطابقة',message:`سيتم حذف ${duplicates.length} سجل متطابق مع الاحتفاظ بالأحدث. احتفظ بتصدير كامل قبل المتابعة.`,confirmText:'حذف المتطابق',type:'danger'})) return;
      let deleted=0;
      for(let i=0;i<duplicates.length;i+=50) {
        const batch=duplicates.slice(i,i+50);
        const {data,error}=await window.supabaseClient.from('orders').delete().in('id',batch).select('id');
        if(error) throw new Error(`حُذف ${deleted} سجل. تعذر استكمال التنظيف: ${error.message}`);
        if(data?.length!==batch.length) throw new Error(`حُذف ${deleted} سجل. لم تسمح قاعدة البيانات بحذف باقي السجلات.`);
        deleted+=data.length;
      }
      await logAdminAction(getUsername(),'تنظيف متطابق',`حُذف ${deleted} سجل`);
      window.showToast(`تم حذف ${deleted} سجل متطابق بنجاح`,'success');
      await loadPage(1);
    } catch(error) {window.showToast(error.message,'error');}
  };
  ['cleanDuplicatesMainBtn','cleanDuplicatesBtn','cleanupDuplicatesBtn'].forEach(id=>{
    const button=document.getElementById(id);
    if(button) button.onclick=()=>busy(button,window.cleanupDuplicates);
  });

  let imported=[];
  const fileInput=document.getElementById('bulkImportFile');
  const importButton=document.getElementById('confirmImportBtn');
  document.getElementById('downloadTemplateBtn').onclick=()=>{
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
      ['الاسم','الرقم القومي','الهاتف','نوع المركبة','السنة','العنوان','رقم اللوحة','الكود'],
      ['اسم المالك','29501011234567','01012345678','توكتوك','2020','كفر صقر','','']
    ]),'البيانات');
    XLSX.writeFile(wb,'نموذج_المركبات.xlsx');
  };
  fileInput.onchange=async()=>{
    imported=[];
    const preview=document.getElementById('importPreview');
    preview.replaceChildren();
    importButton.disabled=true;
    const file=fileInput.files[0];
    if(!file) return;
    try {
      window.requireAdminRole();
      if(!/\.xlsx?$/i.test(file.name)||file.size>5*1024*1024) throw new Error('اختر ملف Excel بحجم 5 ميجابايت أو أقل');
      const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
      const rows=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{defval:'',raw:false});
      if(!rows.length || rows.length>5000) throw new Error('الملف يجب أن يحتوي على 1 إلى 5000 سجل');
      const get=(row,...keys)=>String(keys.map(k=>row[k]).find(v=>v!==undefined && v!=='') ?? '').trim();
      for(const [i,row] of rows.entries()) {
        const nid=window.toAsciiDigits(get(row,'الرقم القومي','رقم قومي','national_id'));
        const owner=get(row,'الاسم','اسم المالك','الاسم الرباعي','owner_name');
        const phone=window.toAsciiDigits(get(row,'الهاتف','رقم الهاتف','phone'));
        const type=get(row,'نوع المركبة','vehicle_type')||'توكتوك';
        const plate=formatLicensePlateString(get(row,'رقم اللوحة','license_plate'));
        const code=window.toAsciiDigits(get(row,'الكود','كود المركبة','code'));
        if(owner.length<3 || !window.isValidNationalId(nid) || (phone && !/^\d{11}$/.test(phone)) || !['توكتوك','ميكروباص'].includes(type) || (type==='ميكروباص' && (!/[\u0621-\u064A]/.test(plate) || !/\d/.test(plate) || code)) || (code && !/^[1-9]\d{0,8}$/.test(code))) {
          throw new Error(`راجع بيانات الصف ${i+2}: الاسم والرقم القومي والهاتف والنوع واللوحة والكود`);
        }
        imported.push({owner_name:owner,national_id:nid,phone,vehicle_type:type,license_plate:type==='ميكروباص'?plate:null,
          code:code||null,vehicle_year:get(row,'السنة','موديل السنة','vehicle_year'),address:get(row,'العنوان','address'),
          chassis_number:get(row,'الشاسيه','chassis_number'),motor_number:get(row,'الموتور','motor_number')});
      }
      const summary=document.createElement('p');summary.textContent=`${imported.length} سجل جاهز للاستيراد`;
      preview.append(summary);
      imported.slice(0,50).forEach(row=>{const line=document.createElement('p');line.textContent=`${row.owner_name} — ${row.national_id} — ${row.vehicle_type}`;preview.append(line);});
      preview.style.display='block';importButton.disabled=false;
    } catch(error) {imported=[];window.showToast(error.message,'error');}
  };
  importButton.onclick=function() {
    return busy(this,async()=>{
      window.requireAdminRole();
      if(!imported.length) throw new Error('اختر ملف بيانات صالحًا أولًا');
      if(!await window.showConfirmModal({title:'تأكيد الاستيراد',message:`استيراد ${imported.length} سجل؟ لن تتغير السجلات الموجودة.`,confirmText:'استيراد'})) return;
      const existing=await window.fetchAllRows('orders','id, national_id, license_plate');
      const ids=new Set(existing.map(row=>row.national_id));
      const plates=new Set(existing.map(row=>formatLicensePlateString(row.license_plate)));
      let saved=0,skipped=0,failed=0;
      const progress=document.getElementById('importProgress');progress.style.display='block';
      for(const [index,row] of imported.entries()) {
        if(ids.has(row.national_id)||(row.license_plate && plates.has(row.license_plate))) {skipped++;continue;}
        const {code,...fields}=row;
        // Any supplied code uses the same atomic server operation as manual coding.
        const ref=`KS-IMP-${crypto.randomUUID()}`;
        const {data,error}=await window.supabaseClient.from('orders').insert({...fields,ref_number:ref,code:null,status:'pending',submitted_at:Date.now(),images:[]}).select('id');
        if(error || !data?.[0]?.id) {failed++;continue;}
        saved++;ids.add(row.national_id);if(row.license_plate) plates.add(row.license_plate);
        if(code) {
          const {error:codeError}=await window.supabaseClient.rpc('assign_vehicle_code',{p_order_id:String(data[0].id),p_code:code});
          if(codeError) window.showToast(`حُفظ ${row.owner_name} دون كود: ${codeError.message}`,'warning');
        }
        const percent=Math.round((index+1)/imported.length*100);
        document.getElementById('progressBar').style.width=percent+'%';
        document.getElementById('progressText').textContent=percent+'%';
      }
      document.getElementById('progressStatus').textContent=`حُفظ: ${saved} — مكرر: ${skipped} — فشل: ${failed}`;
      window.showToast(`حُفظ ${saved} سجل، وتُخطي ${skipped} مكرر، وفشل ${failed}`,failed?'warning':'success');
      imported=[];fileInput.value='';document.getElementById('importPreview').replaceChildren();
      await loadPage(1);
    });
  };
})();
