// ═══════════════════════════════════════════════════════════════
// auth.js - تسجيل الدخول والخروج والتنقل
// ═══════════════════════════════════════════════════════════════

// ── متغير يتتبع من أين جاء المستخدم ──
// 'portal' = جاء من البوابة | 'admin' = جاء من لوحة التحكم
window._navSource = 'portal';

// ── قائمة كل صفحات الخدمة ──
const SERVICE_PAGES = [
  'citizenPage','inquiryPage','complaintsPage',
  'complaintsSelectionPage','complaintInquiryPage'
];

// ── إخفاء كل الصفحات ──
function hideAllPages() {
  [...SERVICE_PAGES, 'adminPage', 'portalSection'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

// ── تحديث نص زر الرجوع في كل صفحة خدمة ──
function updateBackButtons() {
  const isAdmin = !!sessionStorage.getItem('adminRole');
  const fromAdmin = window._navSource === 'admin';
  const label = fromAdmin
    ? '<i class="ri-arrow-right-line"></i> لوحة التحكم'
    : '<i class="ri-home-line"></i> البوابة';
  const backBtns = document.querySelectorAll(
    '#citizenBackBtn,#inquiryBackBtn,#compSelBackBtn,#compBackBtn,#compInqBackBtn'
  );
  backBtns.forEach(btn => { if (btn) btn.innerHTML = label; });
}

// ── الرجوع الذكي: يرجع للمصدر الصحيح ──
window.smartBack = function() {
  if (window._navSource === 'admin') {
    window.backToAdmin();
  } else {
    window.backToPortal();
  }
};

// ── تسجيل الخروج ──
window.logoutAdmin = async function() {
  if (!confirm('هل تريد تسجيل الخروج من لوحة التحكم؟')) return;

  await window.supabaseClient.auth.signOut();
  ['supabaseSession','adminRole','adminUsername','userRole','username']
    .forEach(k => sessionStorage.removeItem(k));
  window.adminDataLoaded = false;

  hideAllPages();
  document.getElementById('portalSection').style.display = 'block';
  document.getElementById('loginBtn').style.display = 'inline-flex';

  // إخفاء أزرار الـ sidebar
  ['goPortalBtn','goAdminBtn','logoutBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const sidebarToggle = document.getElementById('sidebarToggleBtn');
  if (sidebarToggle) sidebarToggle.style.display = 'none';

  document.body.classList.remove('admin-mode','portal-logged-in','in-service-page','sidebar-open');

  const leadershipSection = document.getElementById('leadershipSection');
  if (leadershipSection) leadershipSection.style.display = 'flex';

  const badge = document.getElementById('roleBadge');
  if (badge) badge.remove();

  location.reload();
};

// ── إظهار/إخفاء زر لوحة التحكم في الهيدر ──
function updateHeaderAdminBtn() {
  const btn = document.getElementById('headerAdminBtn');
  if (!btn) return;
  const isAdmin   = !!sessionStorage.getItem('adminRole');
  const inPortal  = document.getElementById('portalSection')?.style.display !== 'none';
  const adminMode = document.body.classList.contains('admin-mode');
  // يظهر فقط في البوابة لما المستخدم مسجل دخول وليس في لوحة التحكم
  btn.style.display = (isAdmin && inPortal && !adminMode) ? 'inline-flex' : 'none';
}

// ── الانتقال للبوابة من لوحة التحكم (مع إمكانية الرجوع) ──
window.goToPortalFromAdmin = function() {
  hideAllPages();
  document.getElementById('portalSection').style.display = 'block';

  document.body.classList.remove('admin-mode','in-service-page','sidebar-open');
  document.body.classList.add('portal-logged-in');

  const sidebar = document.getElementById('adminSidebar');
  if (sidebar) sidebar.classList.remove('open');
  const overlay = document.getElementById('sidebarOverlay');
  if (overlay) overlay.classList.remove('show');

  const leadershipSection = document.getElementById('leadershipSection');
  if (leadershipSection) leadershipSection.style.display = 'flex';

  // نحتفظ بـ _navSource = 'admin' حتى زر الرجوع في صفحات الخدمة يرجع للوحة التحكم
  window._navSource = 'admin';
  if (typeof updateFABs === 'function') updateFABs();
  updateHeaderAdminBtn();
};

// ── الانتقال للبوابة (بدون خروج) ──
window.goToPortal = function() {
  hideAllPages();
  document.getElementById('portalSection').style.display = 'block';

  document.body.classList.remove('admin-mode','in-service-page','sidebar-open');
  document.body.classList.add('portal-logged-in');

  // أزرار الـ sidebar
  const goPortalBtn = document.getElementById('goPortalBtn');
  const goAdminBtn  = document.getElementById('goAdminBtn');
  const logoutBtn   = document.getElementById('logoutBtn');
  if (goPortalBtn) goPortalBtn.style.display = 'none';
  if (goAdminBtn)  goAdminBtn.style.display  = 'flex';
  if (logoutBtn)   logoutBtn.style.display   = 'flex';

  // إغلاق الـ sidebar
  const sidebar = document.getElementById('adminSidebar');
  if (sidebar) sidebar.classList.remove('open');
  const overlay = document.getElementById('sidebarOverlay');
  if (overlay) overlay.classList.remove('show');

  const sidebarToggle = document.getElementById('sidebarToggleBtn');
  if (sidebarToggle) sidebarToggle.style.display = 'none';

  const leadershipSection = document.getElementById('leadershipSection');
  if (leadershipSection) leadershipSection.style.display = 'flex';

  const fabBtn = document.getElementById('fabLoginBtn');
  if (fabBtn) {
    fabBtn.innerHTML = '🔐';
    fabBtn.onclick = () => document.getElementById('loginBtn').click();
  }

  window._navSource = 'portal';
  if (typeof updateFABs === 'function') updateFABs();
  updateHeaderAdminBtn();
};

// ── الانتقال للوحة التحكم ──
window.goToAdmin = function() {
  hideAllPages();
  document.getElementById('adminPage').style.display = 'block';

  document.body.classList.add('admin-mode');
  document.body.classList.remove('portal-logged-in','in-service-page');

  // أزرار الـ sidebar
  const goPortalBtn = document.getElementById('goPortalBtn');
  const goAdminBtn  = document.getElementById('goAdminBtn');
  const logoutBtn   = document.getElementById('logoutBtn');
  if (goPortalBtn) goPortalBtn.style.display = 'flex';
  if (goAdminBtn)  goAdminBtn.style.display  = 'none';
  if (logoutBtn)   logoutBtn.style.display   = 'flex';

  const leadershipSection = document.getElementById('leadershipSection');
  if (leadershipSection) leadershipSection.style.display = 'none';

  // زر الـ hamburger — موبايل فقط
  const sidebarToggle = document.getElementById('sidebarToggleBtn');
  if (sidebarToggle) sidebarToggle.style.display = window.innerWidth <= 768 ? 'inline-flex' : 'none';

  const fabBtn = document.getElementById('fabLoginBtn');
  if (fabBtn) {
    fabBtn.innerHTML = '🚪';
    fabBtn.onclick = () => window.logoutAdmin();
  }

  window._navSource = 'admin';
  if (typeof updateFABs === 'function') updateFABs();
  updateHeaderAdminBtn();
};

// ── الرجوع للبوابة من صفحة خدمة ──
window.backToPortal = function() {
  SERVICE_PAGES.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.getElementById('adminPage').style.display = 'none';
  document.getElementById('portalSection').style.display = 'block';

  document.body.classList.remove('in-service-page','admin-mode','sidebar-open');

  const sidebar = document.getElementById('adminSidebar');
  if (sidebar) sidebar.classList.remove('open');
  const overlay = document.getElementById('sidebarOverlay');
  if (overlay) overlay.classList.remove('show');

  // أزرار الـ sidebar
  const goPortalBtn = document.getElementById('goPortalBtn');
  const goAdminBtn  = document.getElementById('goAdminBtn');
  const logoutBtn   = document.getElementById('logoutBtn');
  if (goPortalBtn) goPortalBtn.style.display = 'none';
  if (goAdminBtn && sessionStorage.getItem('adminRole')) goAdminBtn.style.display = 'flex';
  if (logoutBtn  && sessionStorage.getItem('adminRole')) logoutBtn.style.display  = 'flex';

  const leadershipSection = document.getElementById('leadershipSection');
  if (leadershipSection) leadershipSection.style.display = 'flex';

  window._navSource = 'portal';
  if (typeof updateFABs === 'function') updateFABs();
  updateHeaderAdminBtn();
};

// ── الرجوع للوحة التحكم من صفحة خدمة ──
window.backToAdmin = function() {
  SERVICE_PAGES.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.getElementById('portalSection').style.display = 'none';
  document.getElementById('adminPage').style.display = 'block';

  document.body.classList.add('admin-mode');
  document.body.classList.remove('in-service-page','portal-logged-in','sidebar-open');

  const leadershipSection = document.getElementById('leadershipSection');
  if (leadershipSection) leadershipSection.style.display = 'none';

  window._navSource = 'admin';
  if (typeof updateFABs === 'function') updateFABs();
  updateHeaderAdminBtn();
};

// ── تحديث الـ FABs حسب الحالة ──
function updateFABs() {
  const isAdmin    = !!sessionStorage.getItem('adminRole');
  const fromAdmin  = window._navSource === 'admin';
  const inService  = document.body.classList.contains('in-service-page');
  const adminMode  = document.body.classList.contains('admin-mode');

  // fabLoginBtn: يظهر فقط في البوابة وغير مسجل دخول
  const fabLogin = document.getElementById('fabLoginBtn');
  if (fabLogin) fabLogin.style.display = (!isAdmin && !inService && !adminMode) ? 'flex' : 'none';

  // fabSidebarBtn: يظهر فقط في admin mode (موبايل — CSS يتحكم)
  // CSS يتحكم فيه بـ body.admin-mode

  // fabBackAdminBtn: يظهر في صفحات الخدمة لو جاي من لوحة التحكم
  const fabBack = document.getElementById('fabBackAdminBtn');
  if (fabBack) {
    fabBack.style.display = (inService && fromAdmin) ? 'flex' : 'none';
    fabBack.title = fromAdmin ? 'العودة للوحة التحكم' : 'العودة للبوابة';
  }
}
window.updateFABs = updateFABs;
document.addEventListener('DOMContentLoaded', () => {
  const cardModal = document.getElementById('citizenCardModal');
  if (!cardModal) return;
  const observer = new MutationObserver(() => {
    if (cardModal.style.display === 'flex' || cardModal.style.display === 'block') {
      document.body.classList.add('print-card');
    } else {
      document.body.classList.remove('print-card');
    }
  });
  observer.observe(cardModal, { attributes: true, attributeFilter: ['style'] });
});
