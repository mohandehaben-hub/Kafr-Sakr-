// Header scroll behavior in admin panel
let lastScrollTop = 0;
const header = document.querySelector('header');
const leadershipSection = document.getElementById('leadershipSection');
const adminPage = document.getElementById('adminPage');

window.addEventListener('scroll', function() {
  if (adminPage && adminPage.style.display !== 'none') {
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (scrollTop > lastScrollTop && scrollTop > 100) {
      header.style.transform = 'translateY(-100%)';
      header.style.transition = 'transform 0.3s ease';
      if (leadershipSection) {
        leadershipSection.style.transform = 'translateY(-100%)';
        leadershipSection.style.transition = 'transform 0.3s ease';
      }
    } else {
      header.style.transform = 'translateY(0)';
      header.style.transition = 'transform 0.3s ease';
      if (leadershipSection) {
        leadershipSection.style.transform = 'translateY(0)';
        leadershipSection.style.transition = 'transform 0.3s ease';
      }
    }
    lastScrollTop = scrollTop;
  }
});

// Page navigation
window.switchPage = function(targetPageId) {
  if(targetPageId==='adminPage' && !window.currentStaffRole) {
    const login=document.getElementById('loginModal');
    if(login) login.style.display='flex';
    return;
  }
  const allPages = [
    'portalSection',
    'citizenPage',
    'inquiryPage',
    'complaintsSelectionPage',
    'complaintsPage',
    'complaintInquiryPage',
    'adminPage'];

  // 1. Hide all pages cleanly
  allPages.forEach(function(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('active-page');
      el.style.removeProperty('display');
      el.style.setProperty('display', 'none', 'important');
    }
  });

  // 2. Show target page
  const target = document.getElementById(targetPageId);
  if (target) {
    target.classList.add('active-page');
    const disp = (targetPageId === 'portalSection') ? 'flex': 'block';
    target.style.removeProperty('display');
    target.style.setProperty('display', disp, 'important');
  }

  // 3. Leadership banner: only on portal
  const leader = document.getElementById('leadershipSection');
  if (leader) {
    leader.style.display = (targetPageId === 'portalSection') ? 'flex': 'none';
  }

  // 4. Update body classes & components for Admin vs Citizen
  const isTargetAdmin = (targetPageId === 'adminPage');
  const isLoggedIn = !!window.currentStaffRole;

  // Header Elements
  const headerMainTitle = document.getElementById('headerMainTitle');
  const headerSubTitle  = document.getElementById('headerSubTitle');
  const sidebarToggle   = document.getElementById('sidebarToggleBtn');
  const headerLogoutBtn = document.getElementById('headerLogoutBtn');
  const headerAdminBtn  = document.getElementById('headerAdminBtn');
  const loginBtn        = document.getElementById('loginBtn');
  const fabSidebar      = document.getElementById('fabSidebarBtn');
  const floatPag        = document.getElementById('floatPagination');

  // Bottom Navigation Bars
  const citizenBottomNav = document.getElementById('appBottomNav');
  const adminBottomNav   = document.getElementById('adminBottomNav');

  if (isTargetAdmin) {
    document.body.classList.add('admin-mode');
    document.body.classList.remove('in-service-page', 'portal-logged-in');
    window._navSource = 'admin';

    // Show Admin Bottom Nav on mobile, hide Citizen Bottom Nav
    if (citizenBottomNav) citizenBottomNav.style.setProperty('display', 'none', 'important');
    if (adminBottomNav && window.innerWidth <= 768) {
      adminBottomNav.style.setProperty('display', 'flex', 'important');
    }

    if (headerMainTitle) headerMainTitle.innerHTML = '<i class="ri-government-line"></i> رئاسة مركز ومدينة كفر صقر';
    if (headerSubTitle)  headerSubTitle.textContent  = 'د/ أحمد المقدم';
    if (sidebarToggle)   sidebarToggle.style.display = 'none';
    if (headerLogoutBtn) headerLogoutBtn.style.display = 'none';
    if (headerAdminBtn)  headerAdminBtn.style.display  = 'none';
    if (loginBtn)        loginBtn.style.display        = 'none';
    if (fabSidebar)      fabSidebar.style.setProperty('display', 'none', 'important');
    if (floatPag)        floatPag.style.setProperty('display', 'none', 'important');

    // Sync admin bottom nav active tab
    const curFilter = window.currentFilter || 'tuktuk';
    document.querySelectorAll('.admin-bnav-item').forEach(el => el.classList.remove('active'));
    const activeAdminTab = document.getElementById(curFilter === 'microbus' ? 'adminBnavMicrobus' : 'adminBnavTuktuk');
    if (activeAdminTab) activeAdminTab.classList.add('active');

    // Load admin data on first visit
    if (typeof loadAdminData === 'function' && !window.adminDataLoaded) {
      loadAdminData();
      if (typeof loadComplaints === 'function') loadComplaints();
      window.adminDataLoaded = true;
    }
  } else {
    document.body.classList.remove('admin-mode');
    if (targetPageId === 'portalSection') {
      document.body.classList.remove('in-service-page');
      window._navSource = 'portal';
    } else {
      document.body.classList.add('in-service-page');
    }

    // Hide Admin Bottom Nav, show Citizen Bottom Nav on mobile
    if (adminBottomNav) adminBottomNav.style.setProperty('display', 'none', 'important');
    if (citizenBottomNav && window.innerWidth <= 768) {
      citizenBottomNav.style.setProperty('display', 'flex', 'important');
    }

    // Header in citizen mode
    if (headerMainTitle) headerMainTitle.innerHTML = '<i class="ri-government-line"></i> رئاسة مركز ومدينة كفر صقر';
    if (headerSubTitle)  headerSubTitle.textContent  = 'د/ أحمد المقدم';
    if (sidebarToggle)   sidebarToggle.style.display = 'none';
    if (headerLogoutBtn) headerLogoutBtn.style.display = 'none';
    if (headerAdminBtn)  headerAdminBtn.style.display  = isLoggedIn ? 'inline-flex' : 'none';
    if (loginBtn)        loginBtn.style.display        = isLoggedIn ? 'none' : 'inline-flex';
    if (fabSidebar)      fabSidebar.style.setProperty('display', 'none', 'important');
    if (floatPag)        floatPag.style.setProperty('display', 'none', 'important');

    // Update bottom nav active tab for citizen pages
    const bnavMap = {
      'portalSection': 'bnav-home',
      'citizenPage': 'bnav-register',
      'inquiryPage': 'bnav-inquiry',
      'complaintsSelectionPage': 'bnav-complaint',
      'complaintsPage': 'bnav-complaint',
      'complaintInquiryPage': 'bnav-inquiry'
    };
    const activeBtnId = bnavMap[targetPageId];
    document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));
    if (activeBtnId) {
      const btn = document.getElementById(activeBtnId);
      if (btn) btn.classList.add('active');
    }

    // Update 5th button in citizen bottom nav (دخول or التحكم)
    const bnavLoginText = document.querySelector('#bnav-login span');
    const bnavLoginIcon = document.querySelector('#bnav-login i');
    if (bnavLoginText && bnavLoginIcon) {
      if (isLoggedIn) {
        bnavLoginText.textContent = 'التحكم';
        bnavLoginIcon.className = 'ri-dashboard-line';
      } else {
        bnavLoginText.textContent = 'دخول';
        bnavLoginIcon.className = 'ri-shield-keyhole-line';
      }
    }
  }

  // 7. Close mobile drawers / sheets if open
  if (typeof window.closeSidebar === 'function') window.closeSidebar();
  if (typeof window.closeWASheet === 'function') window.closeWASheet();
  if (typeof window.closeLoginModal === 'function') window.closeLoginModal();

  if (typeof updateBackButtons === 'function') updateBackButtons();
  if (typeof updateFABs === 'function') updateFABs();

  window.scrollTo(0, 0);
};

// Navigation Function
function openService(serviceId) {
  // تتبع المصدر
  const fromAdmin = document.getElementById('adminPage') && document.getElementById('adminPage').classList.contains('active-page');
  if (fromAdmin) {
    window._navSource = 'admin';
  } else if (!window._navSource) {
    window._navSource = 'portal';
  }

  if (serviceId === 'complaintsPage') {
    window.switchPage('complaintsSelectionPage');
  } else {
    window.switchPage(serviceId);
  }

  if (serviceId === 'citizenPage') {
    const vType = document.getElementById('vType');
    if (vType) vType.value = 'توكتوك';
  }
}

// فتح نموذج الشكوى حسب نوع المركبة
function openComplaintForm(vehicleType) {
  window.switchPage('complaintsPage');
  window.selectedComplaintVehicleType = vehicleType;

  const typeDisplay = document.getElementById('selectedVehicleType');
  const vehicleTypeDisplay = document.getElementById('vehicleTypeDisplay');
  const avatarEl = document.getElementById('complaintVehicleAvatar');
  if (typeDisplay && vehicleTypeDisplay) {
    typeDisplay.style.display = 'block';
    vehicleTypeDisplay.innerHTML = vehicleType === 'توكتوك'? '<i class="ri-motorbike-line"></i> توكتوك': '<i class="ri-bus-line"></i> ميكروباص';
  }
  if (avatarEl) {
    avatarEl.src = vehicleType === 'توكتوك'
      ? 'https://i.postimg.cc/QtgDfPKv/images-(1).jpg'
      : 'https://i.postimg.cc/44zFDbrR/images.jpg';
    avatarEl.alt = vehicleType;
  }

  // تحديث Label وPlaceholder حسب نوع المركبة
  const label = document.getElementById('vehicleIdLabel');
  const input = document.getElementById('compVehicleId');
  const hint = document.getElementById('vehicleIdHint');

  if (label && input && hint) {
    if (vehicleType === 'توكتوك') {
      label.textContent = 'رقم كود التقنين';
      input.placeholder = 'مثال: 1234';
      input.type = 'number';
      hint.textContent = 'أدخل رقم الكود المكون من أرقام فقط';
    } else {
      label.textContent = 'رقم لوحة الميكروباص';
      input.placeholder = 'مثال: ر ع و 1234';
      input.type = 'text';
      hint.textContent = 'أدخل رقم اللوحة (حروف عربية + أرقام)';
    }
  }
}

// Fill Years
function fillYears() {
const select = document.getElementById('vYear');
if (!select) return;
for (let year = 2000; year <= 2030; year++) {
let opt = document.createElement('option');
opt.value = year;
opt.innerText = year;
select.appendChild(opt);
}
}
fillYears();

// Fill Birth Days (1-31)
function fillBirthDays() {
const select = document.getElementById('birthDay');
if (!select) return;
for (let day = 1; day <= 31; day++) {
let opt = document.createElement('option');
opt.value = day < 10 ? '0'+ day : day.toString();
opt.innerText = day;
select.appendChild(opt);
}
}
fillBirthDays();

// Fill Birth Years (1950-2200)
function fillBirthYears() {
const select = document.getElementById('birthYear');
if (!select) return;
for (let year = 2200; year >= 1950; year--) {
let opt = document.createElement('option');
opt.value = year;
opt.innerText = year;
select.appendChild(opt);
}
}
fillBirthYears();

// Fill Years for Edit Modal
function fillEditYears() {
const select = document.getElementById('editVYear');
if (!select) return;
for (let year = 2000; year <= 2030; year++) {
let opt = document.createElement('option');
opt.value = year;
opt.innerText = year;
select.appendChild(opt);
}
}
fillEditYears();

// Validate National ID
function validateNationalId(input) {
const nid = input.value.replace(/[^0-9]/g, '');
input.value = nid;
const msgDiv = document.getElementById('nidValidation');

if (nid.length === 0) {
msgDiv.style.display = 'none';
input.style.borderColor = 'var(--glass-border)';
return false;
}

if (nid.length !== 14) {
msgDiv.style.display = 'block';
msgDiv.style.background = 'rgba(231, 76, 60, 0.1)';
msgDiv.style.color = 'var(--danger)';
msgDiv.innerText = 'الرقم القومي يجب أن يكون 14 رقم';
input.style.borderColor = 'var(--danger)';
return false;
}

const century = nid[0];
if (!['2', '3'].includes(century)) {
msgDiv.style.display = 'block';
msgDiv.style.background = 'rgba(231, 76, 60, 0.1)';
msgDiv.style.color = 'var(--danger)';
msgDiv.innerText = 'الرقم القومي غير صحيح (يجب أن يبدأ بـ 2 أو 3)';
input.style.borderColor = 'var(--danger)';
return false;
}

const year = parseInt((century === '2'? '19': '20') + nid.substring(1, 3));
const month = parseInt(nid.substring(3, 5));
const day = parseInt(nid.substring(5, 7));

const birth = new Date(year, month - 1, day);
if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day || birth > new Date()) {
msgDiv.style.display = 'block';
msgDiv.style.background = 'rgba(231, 76, 60, 0.1)';
msgDiv.style.color = 'var(--danger)';
msgDiv.innerText = 'تاريخ الميلاد في الرقم القومي غير صحيح';
input.style.borderColor = 'var(--danger)';
return false;
}

// Don't show the extracted birth date - just confirm the ID is valid
msgDiv.style.display = 'block';
msgDiv.style.background = 'rgba(39, 174, 96, 0.1)';
msgDiv.style.color = 'var(--secondary)';
msgDiv.innerText = 'الرقم القومي صحيح - الآن أدخل تاريخ ميلادك للتحقق';
input.style.borderColor = 'var(--secondary)';

// Don't auto-fill birth date - let user enter it manually
// This is intentional for verification purposes

return true;
}

// Verify Birth Date
function verifyBirthDate() {
const nid = document.getElementById('nationalId').value;
const day = document.getElementById('birthDay').value;
const month = document.getElementById('birthMonth').value;
const year = document.getElementById('birthYear').value;
const msgDiv = document.getElementById('birthValidation');

// Update hidden field
const birthDateHidden = document.getElementById('birthDate');
if (day && month && year) {
birthDateHidden.value = `${year}-${month}-${day}`;
} else {
birthDateHidden.value = '';
}

if (!nid || nid.length !== 14 || !day || !month || !year) {
msgDiv.style.display = 'none';
document.getElementById('birthDay').style.borderColor = 'var(--glass-border)';
document.getElementById('birthMonth').style.borderColor = 'var(--glass-border)';
document.getElementById('birthYear').style.borderColor = 'var(--glass-border)';
return;
}

const century = nid[0];
const nidYear = parseInt((century === '2'? '19': '20') + nid.substring(1, 3));
const nidMonth = parseInt(nid.substring(3, 5));
const nidDay = parseInt(nid.substring(5, 7));

const selectedYear = parseInt(year);
const selectedMonth = parseInt(month);
const selectedDay = parseInt(day);

if (selectedYear === nidYear && selectedMonth === nidMonth && selectedDay === nidDay) {
msgDiv.style.display = 'block';
msgDiv.style.background = 'rgba(39, 174, 96, 0.1)';
msgDiv.style.color = 'var(--secondary)';
msgDiv.innerText = 'تاريخ الميلاد مطابق للرقم القومي - البيانات صحيحة';
document.getElementById('birthDay').style.borderColor = 'var(--secondary)';
document.getElementById('birthMonth').style.borderColor = 'var(--secondary)';
document.getElementById('birthYear').style.borderColor = 'var(--secondary)';
return true;
} else {
msgDiv.style.display = 'block';
msgDiv.style.background = 'rgba(231, 76, 60, 0.1)';
msgDiv.style.color = 'var(--danger)';
msgDiv.innerText = 'تاريخ الميلاد غير مطابق للرقم القومي - تأكد من البيانات'; 
document.getElementById('birthDay').style.borderColor = 'var(--danger)';
document.getElementById('birthMonth').style.borderColor = 'var(--danger)';
document.getElementById('birthYear').style.borderColor = 'var(--danger)';
return false;
}
}

// Make functions global
window.validateNationalId = validateNationalId;
window.verifyBirthDate = verifyBirthDate;

// Format date/time helper
window.formatDateTime = function(timestamp) {
  if (!timestamp) return '—';
  try {
    const d = new Date(typeof timestamp === 'number'? timestamp : timestamp);
    return d.toLocaleDateString('ar-EG', { year:'numeric', month:'short', day:'numeric'});
  } catch(e) { return '—'; }
};

window.getStatusDisplay = function(status) {
const statusMap = {
pending: { text: 'قيد المراجعة', color: '#f59e0b', icon: 'ri-time-line'},
approved: { text: 'تم القبول', color: '#3b82f6', icon: 'ri-check-line'},
coded: { text: 'تم التكويد', color: '#10b981', icon: 'ri-checkbox-circle-line'},
sticker_applied: { text: 'تم لصق الملصق', color: '#10b981', icon: 'ri-shield-check-line'},
delivered: { text: 'تم التسليم', color: '#10b981', icon: 'ri-checkbox-circle-fill'}
};
return statusMap[status] || statusMap.pending;
};

// Update complaint images summary
function updateComplaintImagesSummary() {
const selfie = document.getElementById('compSelfie').files[0];
const idCard = document.getElementById('compIdCard').files[0];
const problemImages = document.getElementById('compProblemImage').files;
const vehicleImage = document.getElementById('compVehicleImage').files[0];

const summary = document.getElementById('compImagesSummary');
const list = document.getElementById('compImagesList');

let hasImages = selfie || idCard || problemImages.length > 0 || vehicleImage;

  if (hasImages) {
    summary.style.display = 'block';
    let html = '';
    const sanitize = window.sanitizeText || (x => String(x).replace(/</g,'&lt;').replace(/>/g,'&gt;'));
    if (selfie) html += `<div style="color: var(--secondary); font-weight: 600;">صورة سيلفي: ${sanitize(selfie.name)}</div>`;
    if (idCard) html += `<div style="color: var(--secondary); font-weight: 600;">صورة البطاقة: ${sanitize(idCard.name)}</div>`;
    if (problemImages.length > 0) html += `<div style="color: var(--secondary); font-weight: 600;">صور المشكلة: ${problemImages.length} صورة</div>`;
    if (vehicleImage) html += `<div style="color: var(--secondary); font-weight: 600;">صورة المركبة: ${sanitize(vehicleImage.name)}</div>`;
    list.innerHTML = html;
  } else {
    summary.style.display = 'none';
  }
}; 

// Safe binding for complaint image inputs
['compSelfie', 'compIdCard', 'compProblemImage', 'compVehicleImage'].forEach(function(id) {
  const el = document.getElementById(id);
  if (el) el.onchange = updateComplaintImagesSummary;
});

// WhatsApp Support Bottom Sheet Toggle
window.openWASheet = function() {
  const sheet = document.getElementById('waBottomSheet');
  if (sheet) {
    sheet.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
};

window.closeWASheet = function() {
  const sheet = document.getElementById('waBottomSheet');
  if (sheet) {
    sheet.style.display = 'none';
    document.body.style.overflow = '';
  }
};

// Government Login Modal Helpers
window.closeLoginModal = function() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.style.display = 'none';
  }
};

window.toggleLoginPassword = function() {
  const pwdInput = document.getElementById('loginPassword');
  const pwdIcon = document.getElementById('loginPwdIcon');
  if (!pwdInput) return;
  if (pwdInput.type === 'password') {
    pwdInput.type = 'text';
    if (pwdIcon) pwdIcon.className = 'ri-eye-off-line';
  } else {
    pwdInput.type = 'password';
    if (pwdIcon) pwdIcon.className = 'ri-eye-line';
  }
};

/* ══════════════════════════════════════════════════════
   BOTTOM NAVIGATION & PORTAL SEARCH HELPERS
══════════════════════════════════════════════════════ */
window.bnavGo = function(sectionId, btnId) {
  if (typeof window.switchPage === 'function') {
    if (sectionId === 'complaintsPage') {
      window.switchPage('complaintsSelectionPage');
    } else {
      window.switchPage(sectionId);
    }
  } else if (sectionId === 'portalSection') {
    if (typeof window.backToPortal === 'function') window.backToPortal();
  } else if (typeof openService === 'function') {
    openService(sectionId);
  }
  if (sectionId === 'citizenPage') {
    const vType = document.getElementById('vType');
    if (vType) vType.value = 'توكتوك';
  }
};

window.syncBottomNavForService = function(serviceId) {
  const idMap = {
    'citizenPage': 'bnav-register',
    'inquiryPage': 'bnav-inquiry',
    'complaintsPage': 'bnav-complaint',
    'complaintsSelectionPage': 'bnav-complaint',
    'complaintInquiryPage': 'bnav-inquiry'};
  const btnId = idMap[serviceId];
  if (btnId) {
    document.querySelectorAll('.bnav-item:not(.bnav-login)').forEach(function(b) {
      b.classList.remove('active');
    });
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.add('active');
  }
};

window.bnavLogin = function() {
  const isLoggedIn = !!window.currentStaffRole;
  if (isLoggedIn) {
    if (typeof window.switchPage === 'function') {
      window.switchPage('adminPage');
    }
  } else {
    const modal = document.getElementById('loginModal');
    if (modal) {
      modal.style.display = 'flex';
      const u = document.getElementById('loginUsername');
      if (u) u.focus();
    } else {
      const loginBtn = document.getElementById('loginBtn');
      if (loginBtn) loginBtn.click();
    }
  }
};

window.quickInquirySearch = function() {
  const input = document.getElementById('homeQuickSearch');
  if (!input) return;
  const val = input.value.trim();
  if (!val) {
    input.focus();
    return;
  }
  window.bnavGo('inquiryPage', 'bnav-inquiry');
  setTimeout(function() {
    const inqNid = document.getElementById('inqNationalId');
    if (inqNid) {
      inqNid.value = val;
      const inqBtn = document.getElementById('inquiryBtn');
      if (inqBtn) inqBtn.click();
    }
  }, 100);
};

/* ══════════════════════════════════════════════════════
   ADMIN SIDEBAR & CONTROLS
══════════════════════════════════════════════════════ */
window.closeSidebar = function() {
  const sb = document.getElementById('adminSidebar');
  const ov = document.getElementById('sidebarOverlay');
  if (sb) sb.classList.remove('open');
  if (ov) ov.classList.remove('show');
  document.body.classList.remove('sidebar-open');
};

window.toggleAdminSidebar = function() {
  const sb = document.getElementById('adminSidebar');
  const ov = document.getElementById('sidebarOverlay');
  if (!sb) return;
  const isOpen = sb.classList.contains('open');
  if (isOpen) {
    sb.classList.remove('open');
    if (ov) ov.classList.remove('show');
    document.body.classList.remove('sidebar-open');
  } else {
    sb.classList.add('open');
    if (ov) ov.classList.add('show');
    document.body.classList.add('sidebar-open');
  }
};

// ── التبديل بين قسم التوكتوك وقسم الميكروباص ────────────────
window.switchToVehicleSection = function(type) {
  type = (type === 'microbus') ? 'microbus': 'tuktuk';
  window.currentFilter = type;
  window._newRequestsMode = false;
  window._stickerMode = false;

  // إظهار بطاقة الجداول الرئيسية وإخفاء الأقسام الأخرى
  const tableWrap = document.querySelector('.table-wrap');
  if (tableWrap) tableWrap.style.display = 'block';

  ['newRequestsTableContainer', 'complaintsTableContainer', 'adminLogsTableContainer', 'availableCodesContainer'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // تحديث القائمة الجانبية
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  const navId = (type === 'microbus') ? 'navMicrobus': 'navTuktuk';
  const navEl = document.getElementById(navId);
  if (navEl) navEl.classList.add('active');

  // تحديث أزرار الأقسام (Chips)
  const chipTuk = document.getElementById('chipTuktuk');
  const chipMic = document.getElementById('chipMicrobus');
  if (chipTuk) chipTuk.classList.toggle('active', type === 'tuktuk');
  if (chipMic) chipMic.classList.toggle('active', type === 'microbus');

  // تحديث شريط تنقل الإدارة السفلي للموبايل
  document.querySelectorAll('.admin-bnav-item').forEach(el => el.classList.remove('active'));
  const bnavId = (type === 'microbus') ? 'adminBnavMicrobus' : 'adminBnavTuktuk';
  const bnavEl = document.getElementById(bnavId);
  if (bnavEl) bnavEl.classList.add('active');

  // إظهار شريط التنقل السفلي
  const botPag = document.getElementById('bottomPaginationBar');
  if (botPag) botPag.style.display = 'flex';

  // استدعاء فلترة نوع المركبة
  if (typeof window.filterByVehicleType === 'function') {
    window.filterByVehicleType(type);
  }

  if (window.innerWidth <= 768 && typeof window.closeSidebar === 'function') {
    window.closeSidebar();
  }
};

window.sidebarNav = function(section) {
  // توجيه الأقسام الخاصة بالمركبات مباشرة
  if (section === 'tuktuk'|| section === 'orders') {
    window.switchToVehicleSection('tuktuk');
    return;
  }
  if (section === 'microbus') {
    window.switchToVehicleSection('microbus');
    return;
  }

  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav'+ section.charAt(0).toUpperCase() + section.slice(1));
  if (navEl) navEl.classList.add('active');

  // تحديث شريط تنقل الإدارة السفلي للموبايل
  document.querySelectorAll('.admin-bnav-item').forEach(el => el.classList.remove('active'));
  if (section === 'newRequests') {
    const b = document.getElementById('adminBnavRequests');
    if (b) b.classList.add('active');
  } else if (section === 'complaints') {
    const b = document.getElementById('adminBnavComplaints');
    if (b) b.classList.add('active');
  }

  const titleMap = {
    tuktuk:      { text: 'قسم التوكتوك'},
    microbus:    { text: 'قسم الميكروباص'},
    orders:      { text: 'قسم التوكتوك'},
    newRequests: { text: 'الطلبات الجديدة'},
    complaints:  { text: 'الشكاوى الواردة'},
    codes:       { text: 'الأكواد المتاحة'},
    import:      { text: 'استيراد Excel'},
    export:      { text: 'تصدير Excel'},
    logs:        { text: 'سجل المشرفين'},
    clean:       { text: 'حذف المكرر'},
  };
  const barTitle = document.getElementById('adminPageBarTitle');
  if (barTitle && titleMap[section]) {
    barTitle.textContent = titleMap[section].text;
  }

  const searchType  = document.getElementById('searchType');
  const searchInput = document.getElementById('searchInput');
  if (searchType) {
    if (searchInput) { searchInput.value = ''; window.currentSearch = ''; }
    window.currentSearchType = 'all';
    window.currentSection    = section;

    const optionSets = {
      tuktuk: [
        { value: 'code',       label: 'الكود'},
        { value: 'name',       label: 'اسم المالك'},
        { value: 'nationalId', label: 'الرقم القومي'},
        { value: 'phone',      label: 'رقم الهاتف'},
        { value: 'chassis',    label: 'رقم الشاسيه'},
        { value: 'motor',      label: 'رقم الموتور'},
        { value: 'all',        label: 'بحث شامل'},
      ],
      microbus: [
        { value: 'plate',      label: 'رقم اللوحة'},
        { value: 'name',       label: 'اسم المالك / السائق'},
        { value: 'nationalId', label: 'الرقم القومي'},
        { value: 'phone',      label: 'رقم الهاتف'},
        { value: 'all',        label: 'بحث شامل'},
      ],
      complaints: [
        { value: 'all',      label: 'بحث شامل'},
        { value: 'name',     label: 'اسم المشتكي'},
        { value: 'phone',    label: 'رقم الهاتف'},
        { value: 'compType', label: 'نوع الشكوى'},
      ],
      default: [
        { value: 'code',       label: 'الكود'},
        { value: 'name',       label: 'الاسم'},
        { value: 'nationalId', label: 'الرقم القومي'},
        { value: 'phone',      label: 'الهاتف'},
        { value: 'all',        label: 'بحث شامل'},
      ],
    };

    const sectionOptMap = {
      complaints:  'complaints',
      orders:      'tuktuk',
      tuktuk:      'tuktuk',
      microbus:    'microbus',
      newRequests: 'tuktuk',
    };
    const key  = sectionOptMap[section] || 'default';
    const opts = optionSets[key] || optionSets.default;
    const defaultVal = (key === 'microbus') ? 'plate': (key === 'tuktuk'? 'code': 'all');
    searchType.innerHTML = opts.map(o =>
      `<option value="${o.value}"${o.value === defaultVal ? 'selected': ''}>${o.label}</option>`).join('');
    searchType.value = defaultVal;
    window.currentSearchType = defaultVal;

    if (searchInput) {
      searchInput.placeholder = (key === 'microbus')
        ? 'اكتب رقم اللوحة (مثال: ر ع و 1234)...': (key === 'tuktuk'? 'ابحث برقم الكود...': 'ابحث في السجلات...');
    }
  }

  const btnMap = {
    orders:      'showOrdersBtn',
    newRequests: 'showNewRequestsBtn',
    complaints:  'showComplaintsBtn',
    codes:       'showAvailableCodesBtn',
    import:      'bulkImportBtn',
    export:      'exportExcelBtn',
    logs:        'showAdminLogsBtn',
    clean:       'cleanDuplicatesMainBtn',
  };
  const btn = document.getElementById(btnMap[section]);
  if (btn) btn.click();

  if (window.innerWidth <= 768 && typeof window.closeSidebar === 'function') {
    window.closeSidebar();
  }
  window._navSource = 'admin';
};

window.setChip = function(el) {
  document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
};

window.updateBackButtons = function() {
  const fromAdmin = window._navSource === 'admin';
  const label = fromAdmin
    ? '<i class="ri-arrow-right-line"></i> لوحة التحكم': '<i class="ri-home-line"></i> البوابة';
  ['citizenBackBtn','inquiryBackBtn','compSelBackBtn','compBackBtn','compInqBackBtn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.innerHTML = label;
  });
};

window.updateSidebarBadges = function(newReqs, complaints) {
  const nb = document.getElementById('newRequestsBadge');
  const cb = document.getElementById('compBadge');
  if (nb) { nb.textContent = newReqs; nb.style.display = newReqs > 0 ? 'inline-flex': 'none'; }
  if (cb) { cb.textContent = complaints; cb.style.display = complaints > 0 ? 'inline-flex': 'none'; }
};

// Auto-sync DOM listeners on boot
document.addEventListener('DOMContentLoaded', function() {
  const homeBtn = document.getElementById('bnav-home');
  const portalEl = document.getElementById('portalSection');
  if (portalEl && homeBtn) {
    const obs = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.attributeName === 'style'|| m.attributeName === 'class') {
          const visible = portalEl.style.display !== 'none' && (!portalEl.classList.contains('app-page') || portalEl.classList.contains('active-page'));
          if (visible) {
            document.querySelectorAll('.bnav-item:not(.bnav-login)').forEach(function(b) {
              b.classList.remove('active');
            });
            homeBtn.classList.add('active');
          }
        }
      });
    });
    obs.observe(portalEl, { attributes: true, attributeFilter: ['style', 'class'] });
  }
});

// Admin Quick Menu Controls
window.openAdminQuickMenu = function() {
  const m = document.getElementById('adminQuickMenuModal');
  if (m) {
    m.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
};

window.closeAdminQuickMenu = function() {
  const m = document.getElementById('adminQuickMenuModal');
  if (m) {
    m.style.display = 'none';
    document.body.style.overflow = '';
  }
};