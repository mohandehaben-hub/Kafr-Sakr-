// Public browser configuration. Database policies must enforce authorization.
const SUPABASE_URL = 'https://xlieswavjjgqsnczesct.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5OgzcAecYuLwipCfNnmBsw_hQ7ZpHIl';
window.currentStaffRole = '';
window.currentStaffName = '';
// UI checks complement database grants, RLS and Auth; they do not replace them.
window.requireStaffAccess = function(write = false) {
  const role = window.currentStaffRole;
  if (['SUPER','ADMIN','VIEWER'].includes(role) && (!write || role !== 'VIEWER')) return true;
  if (role) window.showToast?.('حسابك للعرض فقط؛ لا يملك صلاحية الإضافة أو التعديل.', 'error');
  else {
    window.showToast?.('يرجى تسجيل الدخول بحساب موظف معتمد لاستخدام الخدمة.', 'info');
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'flex';
  }
  return false;
};
// Visitors can submit limited citizen requests; signed-in VIEWER stays read-only.
window.requireCitizenWrite = function() {
  return !window.currentStaffRole || window.requireStaffAccess(true);
};
window.sanitizeText = str => String(str ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));

window.clearAdminIdentity = function() {
  window.currentStaffRole = '';
  window.currentStaffName = '';
  window.currentStaffUserId = '';
  window.adminDataLoaded = false;
  ['supabaseSession','adminRole','adminUsername','userRole','username'].forEach(k => sessionStorage.removeItem(k));
};

window.resolveStaffIdentity = async function(user) {
  if (!user?.id) throw new Error('يرجى تسجيل الدخول من جديد');
  const {data:staff, error} = await window.supabaseClient.from('staff')
    .select('role, full_name, username, is_active').eq('user_id', user.id).maybeSingle();
  if (error || !staff || !staff.is_active || !['SUPER','ADMIN','VIEWER'].includes(staff.role)) {
    window.clearAdminIdentity();
    await window.supabaseClient.auth.signOut({scope:'local'});
    throw new Error('تعذر التحقق من صلاحية الموظف. راجع مسؤول النظام.');
  }
  window.currentStaffRole = staff.role;
  window.currentStaffName = staff.username || staff.full_name || user.email || 'موظف';
  window.currentStaffUserId = user.id;
  sessionStorage.setItem('userRole', staff.role);
  sessionStorage.setItem('adminRole', staff.role);
  sessionStorage.setItem('username', window.currentStaffName);
  sessionStorage.setItem('adminUsername', window.currentStaffName);
  return {role:staff.role, name:window.currentStaffName};
};

window.applyAdminPermissions = function() {
  const role = window.currentStaffRole;
  const visibility = {
    maintenanceTools:role==='SUPER', navLogs:role==='SUPER', navExport:role==='SUPER',
    navImport:!!role && role!=='VIEWER', navClean:role==='SUPER',
    bulkImportBtn:!!role && role!=='VIEWER', exportExcelBtn:role==='SUPER',
    showAdminLogsBtn:role==='SUPER', cleanDuplicatesMainBtn:role==='SUPER',
    cleanupDuplicatesBtn:role==='SUPER', adminMenuStaffBtn:role==='SUPER'
  };
  Object.entries(visibility).forEach(([id,visible])=>{
    const el=document.getElementById(id);
    if(el) el.style.display=visible ? (id==='maintenanceTools'?'block':'flex'):'none';
  });
};

(function() {
  async function initialize() {
    if (!window.supabase?.createClient) {
      window.showToast?.('تعذر تحميل خدمة الاتصال. أعد تحميل الصفحة.', 'error');
      return;
    }
    window.supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
    window.supabaseClient.auth.onAuthStateChange?.((event)=>{
      if(event==='SIGNED_OUT') {
        window.clearAdminIdentity();
        window.switchPage?.('portalSection');
      }
    });
    try {
      const {data:{session},error}=await window.supabaseClient.auth.getSession();
      if(error) throw error;
      if(!session) {window.clearAdminIdentity();return;}
      const {data:{user},error:userError}=await window.supabaseClient.auth.getUser();
      if(userError) throw userError;
      const identity=await window.resolveStaffIdentity(user);
      if(typeof userRole!=='undefined') userRole=identity.role;
      if(typeof currentUsername!=='undefined') currentUsername=identity.name;
      window.switchPage?.('adminPage');
      window.applyAdminPermissions();
      window._resetSessionTimer?.();
    } catch(error) {
      window.clearAdminIdentity();
      await window.supabaseClient.auth.signOut({scope:'local'});
      window.showToast?.('تعذر استعادة الجلسة. سجل الدخول من جديد.', 'warning');
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initialize);
  else initialize();
})();
