// Counted reads: a short API page does not mean that an export is complete.
window.fetchAllRows = async function(table, columns='*') {
  if(!['orders','complaints','supervisor_logs'].includes(table)) throw new Error('جدول غير مسموح');
  const rows=[];
  const pageSize=100;
  let expected=null;
  for(;;) {
    const {data,error,count}=await window.supabaseClient.from(table).select(columns,{count:'exact'})
      .order('id',{ascending:true}).range(rows.length,rows.length+pageSize-1);
    if(error) throw error;
    if(!Number.isInteger(count)) throw new Error('تعذر التحقق من اكتمال البيانات');
    if(expected===null) expected=count;
    if(count!==expected) throw new Error('تغير عدد السجلات أثناء التصدير. أعد المحاولة.');
    if(!Array.isArray(data)) throw new Error('استجابة بيانات غير صالحة');
    rows.push(...data);
    if(rows.length===expected) return rows;
    if(!data.length || rows.length>expected) throw new Error('التصدير غير مكتمل');
  }
};
window.requireAdminRole = function(allowed=['SUPER','ADMIN']) {
  if(!allowed.includes(window.currentStaffRole)) throw new Error('ليست لديك صلاحية لتنفيذ الإجراء');
};
window.confirmRowUpdate = async function(query) {
  const {data,error}=await query.select('id');
  if(error) throw error;
  if(!data?.length) throw new Error('لم يتغير أي سجل. راجع الصلاحيات أو أعد تحميل البيانات.');
  return data;
};
window.isValidNationalId = function(nid) {
  if(!/^[23]\d{13}$/.test(nid)) return false;
  const year=Number((nid[0]==='2'?'19':'20')+nid.slice(1,3));
  const month=Number(nid.slice(3,5)), day=Number(nid.slice(5,7));
  const birth=new Date(year,month-1,day);
  return birth.getFullYear()===year && birth.getMonth()===month-1 && birth.getDate()===day && birth<=new Date();
};
