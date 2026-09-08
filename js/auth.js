// ═══════════════════════════════════════════════════════════════
// auth.js - تسجيل الدخول والخروج والتنقل
// ═══════════════════════════════════════════════════════════════

// ── متغير يتتبع من أين جاء المستخدم ──
// 'portal'= جاء من البوابة | 'admin'= جاء من لوحة التحكم
window._navSource = 'portal';

// ── قائمة كل صفحات الخدمة ──
const SERVICE_PAGES = [
  'citizenPage','inquiryPage','complaintsPage',
  'complaintsSelectionPage','complaintInquiryPage'];

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
    ? '<i class="ri-arrow-right-line"></i> لوحة التحكم': '<i class="ri-home-line"></i> البوابة';
  const backBtns = document.querySelectorAll(
    '#citizenBackBtn,#inquiryBackBtn,#compSelBackBtn,#compBackBtn,#compInqBackBtn');
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

// ── تسجيل الخروج الاحترافي (Modal بدلاً من Confirm المتصفح) ──
window.logoutAdmin = function() {
  const modal = document.getElementById('logoutConfirmModal');
  if (modal) {
    modal.style.display = 'flex';
  } else {
    window.confirmLogoutAdmin();
  }
};

window.closeLogoutModal = function() {
  const modal = document.getElementById('logoutConfirmModal');
  if (modal) modal.style.display = 'none';
};

window.confirmLogoutAdmin = async function() {
  window.closeLogoutModal();

  try {
    if (window.supabaseClient && window.supabaseClient.auth) {
      await window.supabaseClient.auth.signOut();
    }
  } catch(e) {
    console.warn('SignOut error:', e);
  }

  ['supabaseSession','adminRole','adminUsername','userRole','username']
    .forEach(k => sessionStorage.removeItem(k));
  window.adminDataLoaded = false;

  hideAllPages();
  const portalSec = document.getElementById('portalSection');
  if (portalSec) portalSec.style.display = 'flex';
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) loginBtn.style.display = 'inline-flex';

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

  if (typeof window.showToast === 'function') {
    window.showToast('تم تسجيل الخروج بنجاح', 'info');
  }

  setTimeout(() => {
    location.reload();
  }, 350);
};

// ── إظهار/إخفاء زر لوحة التحكم في الهيدر ──
function updateHeaderAdminBtn() {
  const btn = document.getElementById('headerAdminBtn');
  if (!btn) return;
  const isAdmin   = !!sessionStorage.getItem('adminRole');
  const inPortal  = document.getElementById('portalSection')?.style.display !== 'none';
  const adminMode = document.body.classList.contains('admin-mode');
  // يظهر فقط في البوابة لما المستخدم مسجل دخول وليس في لوحة التحكم
  btn.style.display = (isAdmin && inPortal && !adminMode) ? 'inline-flex': 'none';
}

// ── الانتقال للبوابة من لوحة التحكم (مع إمكانية الرجوع) ──
window.goToPortalFromAdmin = function() {
  if (typeof window.switchPage === 'function') {
    window.switchPage('portalSection');
  } else {
    hideAllPages();
    document.getElementById('portalSection').style.display = 'block';
  }
  window._navSource = 'admin';
  updateHeaderAdminBtn();
};

// ── الانتقال للبوابة (بدون خروج) ──
window.goToPortal = function() {
  if (typeof window.switchPage === 'function') {
    window.switchPage('portalSection');
  } else {
    hideAllPages();
    document.getElementById('portalSection').style.display = 'block';
  }
  window._navSource = 'portal';
  updateHeaderAdminBtn();
};

// ── الانتقال للوحة التحكم ──
window.goToAdmin = function() {
  if (typeof window.switchPage === 'function') {
    window.switchPage('adminPage');
  } else {
    hideAllPages();
    document.getElementById('adminPage').style.display = 'block';
    document.body.classList.add('admin-mode');
    document.body.classList.remove('portal-logged-in','in-service-page');
  }

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
  if (sidebarToggle) sidebarToggle.style.display = window.innerWidth <= 768 ? 'inline-flex': 'none';

  const fabBtn = document.getElementById('fabLoginBtn');
  if (fabBtn) {
    fabBtn.innerHTML = '';
    fabBtn.onclick = () => window.logoutAdmin();
  }

  window._navSource = 'admin';
  if (typeof updateFABs === 'function') updateFABs();
  updateHeaderAdminBtn();
};

// ── الرجوع للبوابة من صفحة خدمة ──
window.backToPortal = function() {
  if (typeof window.switchPage === 'function') {
    window.switchPage('portalSection');
  } else {
    SERVICE_PAGES.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.setProperty('display', 'none', 'important');
    });
    document.getElementById('adminPage').style.setProperty('display', 'none', 'important');
    document.getElementById('portalSection').style.setProperty('display', 'flex', 'important');
  }

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

  window._navSource = 'portal';
  if (typeof updateFABs === 'function') updateFABs();
  updateHeaderAdminBtn();
  window.scrollTo(0, 0);
};

// ── الرجوع للوحة التحكم من صفحة خدمة ──
window.backToAdmin = function() {
  if (typeof window.switchPage === 'function') {
    window.switchPage('adminPage');
  } else {
    SERVICE_PAGES.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.setProperty('display', 'none', 'important');
    });
    document.getElementById('portalSection').style.setProperty('display', 'none', 'important');
    document.getElementById('adminPage').style.setProperty('display', 'block', 'important');
  }

  document.body.classList.add('admin-mode');
  document.body.classList.remove('in-service-page','portal-logged-in','sidebar-open');

  window._navSource = 'admin';
  if (typeof updateFABs === 'function') updateFABs();
  updateHeaderAdminBtn();
  window.scrollTo(0, 0);
};

// ── تحديث الـ FABs حسب الحالة ──
function updateFABs() {
  const isAdmin    = !!sessionStorage.getItem('adminRole');
  const fromAdmin  = window._navSource === 'admin';
  const inService  = document.body.classList.contains('in-service-page');
  const adminMode  = document.body.classList.contains('admin-mode');

  // fabLoginBtn: يظهر فقط في البوابة وغير مسجل دخول
  const fabLogin = document.getElementById('fabLoginBtn');
  if (fabLogin) fabLogin.style.display = (!isAdmin && !inService && !adminMode) ? 'flex': 'none';

  // fabSidebarBtn: يظهر فقط في admin mode (موبايل — CSS يتحكم)
  // CSS يتحكم فيه بـ body.admin-mode

  // fabBackAdminBtn: يظهر في صفحات الخدمة لو جاي من لوحة التحكم
  const fabBack = document.getElementById('fabBackAdminBtn');
  if (fabBack) {
    fabBack.style.display = (inService && fromAdmin) ? 'flex': 'none';
    fabBack.title = fromAdmin ? 'العودة للوحة التحكم': 'العودة للبوابة';
  }
}
window.updateFABs = updateFABs;
document.addEventListener('DOMContentLoaded', () => {
  const cardModal = document.getElementById('citizenCardModal');
  if (!cardModal) return;
  const observer = new MutationObserver(() => {
    if (cardModal.style.display === 'flex'|| cardModal.style.display === 'block') {
      document.body.classList.add('print-card');
    } else {
      document.body.classList.remove('print-card');
    }
  });
  observer.observe(cardModal, { attributes: true, attributeFilter: ['style'] });
});
