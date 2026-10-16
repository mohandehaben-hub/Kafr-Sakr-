// ═══════════════════════════════════════════════════════════════
// admin.js - لوحة التحكم الإدارية
// ═══════════════════════════════════════════════════════════════

// Admin Panel - Supabase Only
let currentEditId = "";

function getRole() { return window.currentStaffRole || 'VIEWER'; }
function getUsername() { return window.currentStaffName || 'مجهول'; }
Object.defineProperty(window, 'userRole', {get:getRole});
Object.defineProperty(window, 'currentUsername', {get:getUsername});
let userRole = 'VIEWER';
let currentUsername = '';
let currentCodeItem = null;

// Log Admin Action to Supabase
async function logAdminAction(username, action, details) {
// Redirect to new supervisor log system
await window.logSupervisorAction(action, details);
}

window.logAdminAction = logAdminAction;

// Send WhatsApp Notification Function
async function sendWhatsAppNotification(phone, message, confirmMessage = "هل تريد إرسال إشعار واتساب للمواطن؟") {
if (!phone || phone.length !== 11) {
return false;
}

const whatsappUrl = `https://wa.me/2${phone}?text=${encodeURIComponent(message)}`;

const confirmed = await window.showConfirmModal({
  title: 'إرسال إشعار واتساب',
  message: confirmMessage,
  confirmText: 'إرسال',
  cancelText: 'إلغاء',
  type: 'info'
});
if (confirmed) {
window.open(whatsappUrl, '_blank');
return true;
}
return false;
}

window.sendWhatsAppNotification = sendWhatsAppNotification;

// Code suggestions are advisory; only assign_vehicle_code reserves a code.
async function readUsedCodes() {
  const rows = await window.fetchAllRows('orders', 'id, code');
  return [...new Set(rows.map(row=>Number(row.code)).filter(n=>Number.isSafeInteger(n) && n>0 && n<=999999999))].sort((a,b)=>a-b);
}
async function getSmartNextCode() {
  const used=await readUsedCodes();
  const last=used.at(-1) || 100;
  if(last>=999999999) throw new Error('لا يوجد كود تالٍ ضمن النطاق المسموح');
  return {last,next:last+1};
}
window.getSmartNextCode=getSmartNextCode;
async function getRandomAvailableCode() {
  const used=await readUsedCodes(), end=Math.max(100,used.at(-1)||0);
  const available=end-used.length;
  if(available===0) return (await getSmartNextCode()).next;
  let rank=Math.floor(Math.random()*available), previous=0;
  for(const code of [...used,end+1]) {
    const gap=code-previous-1;
    if(rank<gap) return previous+rank+1;
    rank-=gap;previous=code;
  }
  throw new Error('تعذر اقتراح كود شاغر');
}
window.getRandomAvailableCode=getRandomAvailableCode;

// Login (SECURE VERSION)
let countdownInterval = null;

function checkActiveLockout() {
  const lockoutTime = parseInt(localStorage.getItem('loginLockoutTime') || '0');
  const timerDiv = document.getElementById('loginLockoutTimer');
  const countdownSpan = document.getElementById('countdownSeconds');
  const btn = document.getElementById('confirmLoginBtn');
  const emailInput = document.getElementById('loginUsername');
  const passInput = document.getElementById('loginPassword');
  
  if (Date.now() < lockoutTime) {
    if (timerDiv) timerDiv.style.display = 'block';
    if (btn) btn.disabled = true;
    if (emailInput) emailInput.disabled = true;
    if (passInput) passInput.disabled = true;
    
    if (countdownInterval) clearInterval(countdownInterval);
    
    function updateCountdown() {
      const remaining = lockoutTime - Date.now();
      if (remaining <= 0) {
        clearInterval(countdownInterval);
        if (timerDiv) timerDiv.style.display = 'none';
        if (btn) { btn.disabled = false; btn.innerText = 'دخول '; }
        if (emailInput) emailInput.disabled = false;
        if (passInput) passInput.disabled = false;
        localStorage.removeItem('loginLockoutTime');
        localStorage.setItem('loginAttempts', '0');

      } else {
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        if (countdownSpan) {
          countdownSpan.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
      }
    }
    
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
  } else {
    if (timerDiv) timerDiv.style.display = 'none';
    if (btn) btn.disabled = false;
    if (emailInput) emailInput.disabled = false;
    if (passInput) passInput.disabled = false;

  }
}

document.getElementById('loginBtn').onclick = () => {
document.getElementById('loginModal').style.display = 'block';
document.getElementById('loginUsername').value = '';
document.getElementById('loginPassword').value = '';
document.getElementById('loginUsername').focus();
checkActiveLockout();
}; 
document.getElementById('confirmLoginBtn').onclick = async () => {
let userInput = document.getElementById('loginUsername').value.trim();
const password = document.getElementById('loginPassword').value;

if (!userInput || !password) {
alert("يرجى إدخال اسم المستخدم وكلمة المرور");
return;
}

// إضافة @gmail.com تلقائياً إذا كتب المستخدم اسمه فقط (مثلاً Eltohamy)
let email = userInput;
if (!email.includes('@')) {
  email = email.toLowerCase() + '@gmail.com';
}

// Check Lockout
const lockoutTime = parseInt(localStorage.getItem('loginLockoutTime') || '0');
if (Date.now() < lockoutTime) {
  alert(`تم حظر محاولات الدخول مؤقتاً بسبب محاولات خاطئة متكررة.`);
  return;
}

// Auth validates this challenge on the server, including direct API calls.
let captchaToken;
try { captchaToken = window.getLoginCaptchaToken(); }
catch(error) { alert(error.message); return; }

// Show loading
const btn = document.getElementById('confirmLoginBtn');
const originalText = btn.innerText;
btn.innerText = 'جاري التحقق...';
btn.disabled = true;

try {
// Sign in with secure authentication
const { data, error } = await window.supabaseClient.auth.signInWithPassword({
email: email,
password: password,
options: {captchaToken}
}).finally(() => window.resetLoginCaptcha());

if (error) {
console.error('خطأ في تسجيل الدخول:', error);

let attempts = parseInt(localStorage.getItem('loginAttempts') || '0');
attempts += 1;
localStorage.setItem('loginAttempts', attempts);

if (attempts >= 5) {
  const lockoutUntil = Date.now() + (15 * 60 * 1000); // 15 mins
  localStorage.setItem('loginLockoutTime', lockoutUntil.toString());
  localStorage.setItem('loginAttempts', '0');
  checkActiveLockout();
  alert("تم حظر محاولات الدخول لمدة 15 دقيقة بسبب محاولات خاطئة متكررة.");
} else {
  // رسالة توضيحية حسب نوع الخطأ
  if (error.message.includes('Invalid login credentials')) {
      alert(`اسم المستخدم أو كلمة المرور غير صحيحة\n\nمحاولات متبقية قبل الحظر: ${5 - attempts}`);
  } else if (error.message.includes('Email not confirmed')) {
      alert("البريد الإلكتروني غير مفعل\n\nيرجى تفعيل البريد الإلكتروني أولاً");
  } else {
      alert("خطأ في تسجيل الدخول:\n\n"+ error.message);
  }
  

}

btn.innerText = originalText;
btn.disabled = false;
return;
}

// Clear Lockout on success
localStorage.removeItem('loginAttempts');
localStorage.removeItem('loginLockoutTime');


// Successful login
const user = data.user;

const identity = await window.resolveStaffIdentity(user);
userRole = identity.role;
currentUsername = identity.name;
window.applyAdminPermissions();
window._resetSessionTimer?.();

// Hide login modal
document.getElementById('loginModal').style.display = 'none';

// Log admin login
await logAdminAction(currentUsername, 'تسجيل دخول', `دخول آمن إلى النظام`);

if (typeof window.switchPage === 'function') {
  window.switchPage('adminPage');
} else {
  document.getElementById('portalSection').style.display = 'none';
  document.getElementById('adminPage').style.display = 'block';
}

// Hide leadership section in admin panel
const leadershipSection = document.getElementById('leadershipSection');
if (leadershipSection) leadershipSection.style.display = 'none';

// Add admin mode class to body
document.body.classList.add('admin-mode');
window._navSource = 'admin';

// Update FAB button
const fabBtn = document.getElementById('fabLoginBtn');
if (fabBtn) {
fabBtn.innerHTML = '';
fabBtn.onclick = () => logoutAdmin();
}

// أزرار الـ sidebar — تُظهر في الـ footer
const _goPortalBtn = document.getElementById('goPortalBtn');
const _goAdminBtn  = document.getElementById('goAdminBtn');
const _logoutBtn   = document.getElementById('logoutBtn');
const _loginBtn    = document.getElementById('loginBtn');
if (_goPortalBtn) _goPortalBtn.style.display = 'flex';
if (_goAdminBtn)  _goAdminBtn.style.display  = 'none';
if (_logoutBtn)   _logoutBtn.style.display   = 'flex';
if (_loginBtn)    _loginBtn.style.display    = 'none';

// زر الـ hamburger — موبايل فقط
const sidebarToggle = document.getElementById('sidebarToggleBtn');
if (sidebarToggle) sidebarToggle.style.display = window.innerWidth <= 768 ? 'inline-flex': 'none';

// إخفاء زر لوحة التحكم من الهيدر (نحن في لوحة التحكم)
const _headerAdminBtn = document.getElementById('headerAdminBtn');
if (_headerAdminBtn) _headerAdminBtn.style.display = 'none';

// Load data only if not already loaded from session restore
if (!window.adminDataLoaded) {
    loadAdminData();
    loadComplaints();
    window.adminDataLoaded = true; // Mark as loaded after first load
}

// Hide buttons based on role
{
  const _bulkImportBtn = document.getElementById('bulkImportBtn');
  if (userRole === 'VIEWER'&& _bulkImportBtn) {
    _bulkImportBtn.style.display = 'none';
  }

  // Hide cleanup/logs/export for non-SUPER users
  const _cleanupBtn     = document.getElementById('cleanupDuplicatesBtn');
  const _cleanupMainBtn = document.getElementById('cleanDuplicatesMainBtn');
  const _logsBtn        = document.getElementById('showAdminLogsBtn');
  const _exportBtn      = document.getElementById('exportExcelBtn');
  if (userRole !== 'SUPER') {
    if (_cleanupBtn)     _cleanupBtn.style.display     = 'none';
    if (_cleanupMainBtn) _cleanupMainBtn.style.display = 'none';
    if (_logsBtn)        _logsBtn.style.display        = 'none';
    if (_exportBtn)      _exportBtn.style.display      = 'none';
  } else {
    if (_logsBtn)   _logsBtn.style.display   = 'inline-block';
    if (_exportBtn) _exportBtn.style.display = 'inline-block';
    const maintenanceTools = document.getElementById('maintenanceTools');
    if (maintenanceTools) maintenanceTools.style.display = 'block';
  }
}
} catch (error) {
console.error('خطأ في تسجيل الدخول:', error);
alert(error.message || "حدث خطأ في تسجيل الدخول");
btn.innerText = originalText;
btn.disabled = false;
}
};

// Get Signed URL for Private Images
async function getSignedUrl(filePath) {
if (!filePath) return '';

// If it's already a full URL, return it
if (typeof filePath !== 'string') return '';
if (/^https:\/\//i.test(filePath)) {
  try {
    const url = new URL(filePath);
    return url.origin === SUPABASE_URL && url.pathname.startsWith('/storage/v1/object/') ? url.href : '';
  } catch (_) { return ''; }
}
if (/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(filePath) && filePath.length<8000000) return filePath;
if (!/^images\/[a-zA-Z0-9_-]+\.(jpe?g|png|webp)$/i.test(filePath)) return '';

try {
const { data, error } = await window.supabaseClient.storage
.from('vehicle-images')
.createSignedUrl(filePath, 3600); // Valid for 1 hour

if (error) {
console.error('Error getting signed URL:', error);
return '';
}

return data.signedUrl;
} catch (err) {
console.error('Error:', err);
return '';
}
}

// View Images
async function viewImages(images) {
if(!Array.isArray(images) || !images.length) return;
const modal = document.getElementById("imgModal");
const mainImg = document.getElementById("mainViewImg");
const thumbContainer = document.getElementById("modalThumbnails");

thumbContainer.innerHTML = '';

// Get signed URLs for all images
const signedUrls = await Promise.all(images.map(img => getSignedUrl(img)));
mainImg.src = signedUrls[0];

signedUrls.forEach(src => {
const img = document.createElement('img');
img.src = src;
img.style.width = "80px";
img.style.height = "80px";
img.style.cursor = "pointer";
img.style.objectFit = "cover";
img.style.borderRadius = "15px";
img.style.border = "3px solid white";
img.onclick = () => mainImg.src = src;
thumbContainer.appendChild(img);
});

modal.style.display = "block";
}

// View Categorized Images (for complaints)
async function showCategorizedImages(images) {
const modal = document.getElementById("imgModal");
const mainImg = document.getElementById("mainViewImg");
const thumbContainer = document.getElementById("modalThumbnails");

thumbContainer.innerHTML = '';

// Collect all images with labels
const allImages = [];

if (images.selfie) {
const url = await getSignedUrl(images.selfie);
allImages.push({ url, label: 'صورة سيلفي'});
}
if (images.idCard) {
const url = await getSignedUrl(images.idCard);
allImages.push({ url, label: 'صورة البطاقة'});
}
if (images.vehicleImage) {
const url = await getSignedUrl(images.vehicleImage);
allImages.push({ url, label: 'صورة المركبة/الكود'});
}
if (images.problemImages && images.problemImages.length > 0) {
for (const [index, path] of images.problemImages.entries()) {
  const url = await getSignedUrl(path);
  allImages.push({url, label: `صورة المشكلة ${index + 1}`});
}
}

if (allImages.length === 0) {
alert("لا توجد صور متاحة للعرض");
return;
}

// Set first image
mainImg.src = allImages[0].url;

// Create thumbnails with labels
allImages.forEach(imgData => {
const container = document.createElement('div');
container.style.textAlign = 'center';

const img = document.createElement('img');
img.src = imgData.url;
img.style.width = "80px";
img.style.height = "80px";
img.style.cursor = "pointer";
img.style.objectFit = "cover";
img.style.borderRadius = "15px";
img.style.border = "3px solid white";
img.onclick = () => mainImg.src = imgData.url;

const label = document.createElement('div');
label.innerText = imgData.label;
label.style.color = 'white';
label.style.fontSize = '0.75rem';
label.style.marginTop = '5px';
label.style.fontWeight = 'bold';

container.appendChild(img);
container.appendChild(label);
thumbContainer.appendChild(container);
});

modal.style.display = "block";
}

// Logout function
// Function to create table row based on vehicle type
// Function to create table row based on vehicle type (4 أعمدة فقط بدون سكرول أفقي)
function createTableRow(item, vehicleType) {
  const tr = document.createElement('tr');
  const id = item.id;
  const s = window.sanitizeText || (x => x || '');

  // Row type class
  tr.classList.add(vehicleType === 'microbus'? 'row-microbus': 'row-tuktuk');
  if (item.status === 'sticker_applied') tr.classList.add('sticker-applied');

  // Single Dossier & Actions button with official SVG icon
  const actionsBtn = `<button class="btn-dossier"title="ملف المركبة والإجراءات"><i class="ri-more-2-fill"></i></button>`;

  if (vehicleType === 'microbus') {
    tr.innerHTML = `<td class="td-plate"><span class="badge-gov-plate">${s(item.licensePlate) || '—'}</span></td>
      <td class="td-bold td-truncate"title="${s(item.owner)}">${s(item.owner) || '—'}</td>
      <td class="td-addr td-truncate"title="${s(item.line || item.address || '')}">${s(item.line || item.address) || '—'}</td>
      <td class="td-actions">${actionsBtn}</td>`;
  } else {
    const hasCode = item.vCode && item.vCode !== '';
    tr.innerHTML = `<td class="td-code"><span class="${hasCode ? 'badge-gov-code': 'badge-gov-nocode'}">${s(item.vCode) || 'غير مكود'}</span></td>
      <td class="td-bold td-truncate"title="${s(item.owner)}">${s(item.owner) || '—'}</td>
      <td class="td-addr td-truncate"title="${s(item.address || '')}">${s(item.address) || '—'}</td>
      <td class="td-actions">${actionsBtn}</td>`;
  }

  // الربط بفتح كرت البيانات الكاملة والإجراءات
  const btn = tr.querySelector('.btn-dossier');
  if (btn) {
    btn.onclick = (e) => {
      e.stopPropagation();
      openVehicleDossier(item, vehicleType);
    };
  }

  return tr;
}

// ── كرت ملف المركبة الشامل والإجراءات الحكومية ────────────────────────
function openVehicleDossier(item, vehicleType) {
  const modal = document.getElementById('vehicleDossierModal');
  if (!modal) return;
  if(!Array.isArray(item.images)) item={...item,images:[]};
  const userRole = getRole();
  const id = item.id;
  const s = window.sanitizeText || (x => x || '');

  // 1. الترويسة
  const titleEl = document.getElementById('dossierTitle');
  if (titleEl) titleEl.textContent = 'ملف المركبة — '+ (item.owner || '—');

  // 2. الكود أو اللوحة
  const idLabel = document.getElementById('dossierIdentifierLabel');
  const idVal   = document.getElementById('dossierIdentifierVal');
  if (idLabel && idVal) {
    if (vehicleType === 'microbus') {
      idLabel.textContent = 'رقم اللوحة';
      idVal.textContent = item.licensePlate || '—';
    } else {
      idLabel.textContent = 'كود المركبة';
      idVal.textContent = item.vCode || 'غير مكود';
    }
  }

  // 3. شارة نوع المركبة
  const typeBadge = document.getElementById('dossierTypeBadge');
  if (typeBadge) {
    if (vehicleType === 'microbus') {
      typeBadge.textContent = 'ميكروباص';
      typeBadge.style.background = 'rgba(52,152,219,0.15)';
      typeBadge.style.color = '#60A5FA';
      typeBadge.style.borderColor = 'rgba(96,165,250,0.3)';
    } else {
      typeBadge.textContent = 'توكتوك';
      typeBadge.style.background = 'rgba(245,158,11,0.15)';
      typeBadge.style.color = '#FBBF24';
      typeBadge.style.borderColor = 'rgba(245,158,11,0.3)';
    }
  }

  // صورة المركبة الدائرية
  const avatarEl = document.getElementById('dossierVehicleAvatar');
  if (avatarEl) {
    avatarEl.src = (vehicleType === 'microbus')
      ? 'https://i.postimg.cc/44zFDbrR/images.jpg'
      : 'https://i.postimg.cc/QtgDfPKv/images-(1).jpg';
    avatarEl.alt = (vehicleType === 'microbus') ? 'ميكروباص' : 'توكتوك';
  }

  // 4. شارة الحالة
  const statusBadge = document.getElementById('dossierStatusBadge');
  if (statusBadge) {
    const st = window.getStatusDisplay ? window.getStatusDisplay(item.status) : { text: item.status || 'قيد المراجعة', color: '#f59e0b', icon: 'ri-time-line'};
    statusBadge.innerHTML = `<i class="${st.icon || 'ri-time-line'}"></i> ${st.text}`;
    statusBadge.style.background = (st.color || '#10b981') + '22';
    statusBadge.style.color = st.color || '#10b981';
    statusBadge.style.borderColor = (st.color || '#10b981') + '44';
  }

  // 5. شبكة البيانات
  const setEl = (elemId, val) => {
    const el = document.getElementById(elemId);
    if (el) el.textContent = val || '—';
  };
  setEl('dossierOwner', item.owner);
  setEl('dossierNationalId', item.nationalId);

  const phoneEl = document.getElementById('dossierPhone');
  if (phoneEl) {
    if (item.phone) {
      phoneEl.innerHTML = `<a href="tel:${s(item.phone)}"style="color:#38BDF8;text-decoration:none;display:inline-flex;align-items:center;gap:4px"><i class="ri-phone-line"></i> ${s(item.phone)}</a>`;
    } else {
      phoneEl.textContent = '—';
    }
  }

  const addrLabel = document.getElementById('dossierAddressLabel');
  if (addrLabel) addrLabel.textContent = vehicleType === 'microbus'? 'خط السير / العنوان': 'العنوان';
  setEl('dossierAddress', item.line || item.address);

  setEl('dossierChassis', item.chassisNumber);
  setEl('dossierMotor', item.motorNumber);
  setEl('dossierYear', item.vYear);
  setEl('dossierRef', item.refNumber);

  const dateVal = window.formatDateTime ? window.formatDateTime(item.timestamp) : (item.timestamp || '—');
  setEl('dossierDate', dateVal);

  const capField = document.getElementById('dossierCapacityField');
  if (capField) {
    if (vehicleType === 'microbus'&& item.passengerCapacity) {
      capField.style.display = 'flex';
      setEl('dossierCapacity', item.passengerCapacity + 'ركاب');
    } else {
      capField.style.display = 'none';
    }
  }

  // 6. قسم الصور والوثائق
  const imgSec = document.getElementById('dossierImagesSection');
  const imgGal = document.getElementById('dossierImagesGallery');
  const imgCnt = document.getElementById('dossierImagesCount');
  if (imgSec && imgGal) {
    if (item.images && item.images.length > 0) {
      imgSec.style.display = 'block';
      if (imgCnt) imgCnt.textContent = `${item.images.length} ملف / صورة`;
      imgGal.replaceChildren();
      item.images.forEach((path, idx) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-label', `عرض صورة ${idx + 1}`);
        button.style.cssText = 'width:56px;height:56px;border:0;border-radius:8px;overflow:hidden;padding:0;cursor:pointer';
        const image = document.createElement('img');
        image.alt = `صورة ${idx + 1}`;
        image.style.cssText = 'width:100%;height:100%;object-fit:cover';
        button.append(image);
        button.addEventListener('click', () => window.viewImages(item.images));
        imgGal.append(button);
        getSignedUrl(path).then(url => {if(url && image.isConnected) image.src = url;});
      });
    } else {
      imgSec.style.display = 'none';
      imgGal.innerHTML = '';
      if (imgCnt) imgCnt.textContent = '';
    }
  }

  // 7. قسم الإجراءات الحكومية الرسمية (أزرار SVG موحدة)
  const actGrid = document.getElementById('dossierActionsGrid');
  if (actGrid) {
    const btns = [];

    // بطاقة المركبة
    btns.push(`<button class="btn-gov-action btn-gov-primary"id="dossierBtnCard">
        <i class="ri-id-card-line"></i> <span>بطاقة المركبة</span>
      </button>
    `);

    // تعديل البيانات
    if (userRole !== 'VIEWER') {
      btns.push(`<button class="btn-gov-action"id="dossierBtnEdit">
          <i class="ri-edit-line"></i> <span>تعديل البيانات</span>
        </button>
      `);
    }

    // تغيير الحالة
    if (userRole !== 'VIEWER') {
      btns.push(`<button class="btn-gov-action"id="dossierBtnStatus">
          <i class="ri-refresh-line"></i> <span>تغيير الحالة</span>
        </button>
      `);
    }

    // تكويد المركبة (للتوكتوك فقط)
    if (vehicleType === 'tuktuk'&& userRole !== 'VIEWER') {
      btns.push(`<button class="btn-gov-action btn-gov-gold"id="dossierBtnCode">
          <i class="ri-hashtag"></i> <span>تكويد المركبة</span>
        </button>
      `);
    }

    // عرض المستندات
    if (item.images && item.images.length > 0) {
      btns.push(`<button class="btn-gov-action"id="dossierBtnPhotos">
          <i class="ri-image-line"></i> <span>الوثائق (${item.images.length})</span>
        </button>
      `);
    }

    // حذف السجل (للمشرف العام)
    if (userRole === 'SUPER') {
      btns.push('<button class="btn-gov-action" id="dossierBtnEmail"><i class="ri-mail-line"></i><span>ربط بريد الاستعلام</span></button>');
      btns.push(`<button class="btn-gov-action btn-gov-danger"id="dossierBtnDelete">
          <i class="ri-delete-bin-line"></i> <span>حذف السجل نهائياً</span>
        </button>
      `);
    }

    actGrid.innerHTML = btns.join('');
    actGrid.querySelector('#dossierBtnEmail')?.addEventListener('click', async () => {
      const entered = window.prompt('بعد التحقق من هوية صاحب الطلب في مجلس المدينة، أدخل بريده الإلكتروني لربط الاستعلام بهذا الطلب:');
      if (!entered) return;
      const email = entered.trim().toLowerCase();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { window.showToast('أدخل بريدًا صحيحًا.', 'error'); return; }
      if (!await window.showConfirmModal({title:'ربط بريد المواطن',message:'هل تحققت من هوية صاحب الطلب وملكيته لهذا البريد؟'})) return;
      const {error} = await window.supabaseClient.rpc('link_citizen_email', {p_table:'orders',p_id:id,p_email:email});
      window.showToast(error ? 'تعذر ربط البريد. راجع صلاحياتك والبيانات.' : 'تم ربط بريد المواطن بهذا الطلب وتسجيل الإجراء.', error ? 'error' : 'success');
    });

    const closeDossier = () => { modal.style.display = 'none'; };

    // ربط بطاقة المواطن
    actGrid.querySelector('#dossierBtnCard')?.addEventListener('click', () => {
      closeDossier();
      window.openCitizenCardModal(item, vehicleType);
    });

    // ربط تعديل البيانات
    actGrid.querySelector('#dossierBtnEdit')?.addEventListener('click', () => {
      currentEditId = id;
      closeDossier();
      document.getElementById('editLicensePlate').value = item.licensePlate || '';
      document.getElementById('editOwnerName').value = item.owner || '';
      document.getElementById('editPhone').value     = item.phone || '';
      document.getElementById('editVType').value     = item.vType || (vehicleType === 'microbus'? 'ميكروباص': 'توكتوك');
      document.getElementById('editVYear').value     = item.vYear || '';
      document.getElementById('editAddress').value   = item.address || item.line || '';
      document.getElementById('editModal').style.display = 'block';
    });

    // ربط تغيير الحالة
    actGrid.querySelector('#dossierBtnStatus')?.addEventListener('click', () => {
      closeDossier();
      document.getElementById('statusChangeModal').style.display = 'block';
      document.getElementById('statusNote').value = '';
      window.currentStatusChangeItem = { item, id };
    });

    // ربط تكويد المركبة
    actGrid.querySelector('#dossierBtnCode')?.addEventListener('click', async () => {
      closeDossier();
      if (item.vCode) {
        alert('المركبة مكودة بالفعل برقم: '+ item.vCode);
        return;
      }
      currentCodeItem = {item, id};
      let info;
      try { info = await window.getSmartNextCode(); } catch(error) { alert(error.message); return; }
      document.getElementById('codeHint').innerText = `آخر كود: (${info.last}) | المقترح: (${info.next})`;
      document.getElementById('manualCodeInput').value = info.next;
      document.getElementById('codeModal').style.display = 'block';
    });

    // ربط استعراض الصور
    actGrid.querySelector('#dossierBtnPhotos')?.addEventListener('click', () => {
      closeDossier();
      if (item.images && item.images.length > 0) window.viewImages(item.images);
    });

    // ربط حذف السجل
    actGrid.querySelector('#dossierBtnDelete')?.addEventListener('click', async () => {
      if(getRole()!=='SUPER') return;
      closeDossier();
      const confirmed = await window.showConfirmModal({
        title: 'حذف سجل المركبة',
        message: `هل تريد حذف سجل المركبة للمواطن (${item.owner}) بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.`,
        confirmText: 'حذف نهائي',
        cancelText: 'إلغاء',
        type: 'danger'
      });
      if (!confirmed) return;
      const { data: changedRows, error } = await window.supabaseClient.from('orders').delete().eq('id', id).select('id');
if(!error && !changedRows?.length) throw new Error('لم يتغير أي سجل. راجع الصلاحيات وأعد المحاولة.');
      if (error) {
        window.showToast('فشل الحذف من قاعدة البيانات', 'error');
        return;
      }
      window.showToast('تم حذف السجل بنجاح', 'success');
      window.initializePagination([]);
    });
  }

  modal.style.display = 'flex';
}

// ── بطاقة المواطن الحكومية ──────────────────────────────────────────
window.openCitizenCardModal = function(item, vehicleType) {
  const modal = document.getElementById('citizenCardModal');
  if (!modal) return;

  modal.querySelector('#cardOwner').textContent      = 'جاري التحميل...';
  modal.querySelector('#cardCode').textContent       = '—';
  modal.querySelector('#cardCodeLabel').textContent  = 'الكود';
  modal.querySelector('#cardNationalId').textContent = '—';
  modal.querySelector('#cardAddress').textContent    = '—';
  modal.querySelector('#cardPhone').textContent      = '—';

  const typeBadgeEl = modal.querySelector('#cardVehicleTypeBadge');
  if (typeBadgeEl) {
    if (vehicleType === 'microbus') {
      typeBadgeEl.textContent = 'ميكروباص';
      typeBadgeEl.style.background = 'rgba(52,152,219,0.12)';
      typeBadgeEl.style.color      = 'var(--blue)';
      typeBadgeEl.style.borderColor = 'rgba(52,152,219,0.3)';
    } else {
      typeBadgeEl.textContent = 'توكتوك';
      typeBadgeEl.style.background  = 'var(--gold-bg)';
      typeBadgeEl.style.color       = 'var(--gold)';
      typeBadgeEl.style.borderColor = 'var(--gold-border)';
    }
  }

  const cardAvatarEl = modal.querySelector('#citizenCardVehicleAvatar');
  if (cardAvatarEl) {
    cardAvatarEl.src = (vehicleType === 'microbus')
      ? 'https://i.postimg.cc/44zFDbrR/images.jpg'
      : 'https://i.postimg.cc/QtgDfPKv/images-(1).jpg';
    cardAvatarEl.alt = (vehicleType === 'microbus') ? 'ميكروباص' : 'توكتوك';
  }

  const code      = vehicleType === 'microbus'? (item.licensePlate || '—') : (item.vCode || '—');
  const codeLabel = vehicleType === 'microbus'? 'رقم اللوحة': 'الكود';

  modal.querySelector('#cardOwner').textContent      = item.owner       || '—';
  modal.querySelector('#cardCode').textContent       = code;
  modal.querySelector('#cardCodeLabel').textContent  = codeLabel;
  modal.querySelector('#cardNationalId').textContent = item.nationalId  || '—';
  modal.querySelector('#cardAddress').textContent    = item.address || item.line || '—';
  modal.querySelector('#cardPhone').textContent      = item.phone        || '—';
  modal.style.display = 'flex';
};

window.openVehicleDossier = openVehicleDossier;
window.createTableRow = createTableRow;

async function loadAdminData() {
  // تفعيل قسم التوكتوك افتراضياً وضبط خيارات البحث واللوحة تلقائياً
  if (typeof window.switchToVehicleSection === 'function') {
    window.switchToVehicleSection(window.currentFilter || 'tuktuk');
  } else if (typeof loadPage === 'function') {
    await loadPage(1);
  }
  // تحديث الأرقام في الشريط الجانبي بعد تحميل البيانات
  await updateSidebarBadges();
};

// تحديث أرقام الشارات في الشريط الجانبي
async function updateSidebarBadges() {
  try {
    // تحديث شارة الطلبات الجديدة فقط — الإحصائيات الكاملة في openStatsModal
    const { count: newReqs } = await window.supabaseClient
      .from('orders').select('*', { count:'exact', head:true })
      .or('license_plate.is.null,license_plate.eq.')
      .or('code.is.null,code.eq.');
    const badge = document.getElementById('newRequestsBadge');
    if (badge) {
      badge.textContent = newReqs || 0;
      badge.style.display = (newReqs > 0) ? 'inline-flex': 'none';
    }
    const bnavBadge = document.getElementById('adminBnavReqBadge');
    if (bnavBadge) {
      bnavBadge.textContent = newReqs || 0;
      bnavBadge.style.display = (newReqs > 0) ? 'inline-block': 'none';
    }
  } catch (err) {
    console.warn('تعذّر تحديث الشارات:', err);
  }
}
window.updateSidebarBadges = updateSidebarBadges;

// Load Complaints
async function loadComplaints() {

try {
const complaints = await window.fetchAllRows('complaints');
complaints.sort((a,b)=>new Date(b.submitted_at)-new Date(a.submitted_at));

const tableBody = document.getElementById('compTableBody');
tableBody.innerHTML = '';

// Update complaints badge
const compBadge = document.getElementById('compBadge');
const bnavCompBadge = document.getElementById('adminBnavCompBadge');
if (compBadge || bnavCompBadge) {
  const pending = complaints ? complaints.filter(c => c.status !== 'replied').length : 0;
  if (compBadge) {
    compBadge.textContent = pending;
    compBadge.style.display = pending > 0 ? 'inline-flex': 'none';
  }
  if (bnavCompBadge) {
    bnavCompBadge.textContent = pending;
    bnavCompBadge.style.display = pending > 0 ? 'inline-block': 'none';
  }
}

if (!complaints || complaints.length === 0) {
tableBody.innerHTML = '<tr><td colspan="8"style="text-align: center; padding: 40px; color: #999;">لا توجد شكاوى</td></tr>';
return;
}

const role = getRole();

complaints.forEach((complaint) => {
const statusColor = complaint.status === 'replied'? 'var(--emerald)': 'rgba(245, 158, 11, 0.2)';
const statusText = complaint.status === 'replied'? 'تم الرد': 'قيد المراجعة';

const tr = document.createElement('tr');

const s = window.sanitizeText;
tr.innerHTML = `<td style="padding: 14px 18px; font-weight: 600;">${s(complaint.owner_name) || 'غير محدد'}</td>
<td style="padding: 14px 18px; font-family: monospace;">${s(complaint.phone) || '-'}</td>
<td style="padding: 14px 18px;"><span style="background: rgba(148, 163, 184, 0.1); color: var(--text2); padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 0.8rem;">${s(complaint.complaint_type) || 'غير محدد'}</span></td>
<td style="padding: 14px 18px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${s(complaint.details) || '-'}">${s(complaint.details) || '-'}</td>
<td style="padding: 14px 18px; text-align: center;">
<button class="btn btn-ghost btn-view-complaint-images" style="padding: 6px 12px; font-size: 0.8rem;"><i class="ri-image-line"></i> عرض الصور</button>
</td>
<td style="padding: 14px 18px;"><span style="background: ${statusColor}; color: white; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 0.78rem;">${statusText}</span></td>
<td style="padding: 14px 18px; display: flex; gap: 8px; flex-wrap: wrap;">
<button class="btn btn-primary btn-reply-complaint" style="padding: 6px 12px; font-size: 0.8rem; display: ${role === 'VIEWER'? 'none': 'inline-flex'};"><i class="ri-reply-line"></i> رد</button>
<button class="btn btn-danger btn-delete-complaint" style="padding: 6px 12px; font-size: 0.8rem; display: ${role === 'SUPER'? 'inline-flex': 'none'};"><i class="ri-delete-bin-line"></i> حذف</button>
</td>
${complaint.status === 'replied' && complaint.reply ? `<td style="padding:14px 18px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--green);font-size:0.78rem;" title="${window.sanitizeText ? window.sanitizeText(complaint.reply) : complaint.reply}">${window.sanitizeText ? window.sanitizeText(complaint.reply).substring(0,60) : complaint.reply.substring(0,60)}...</td>` : `<td style="padding:14px 18px;color:var(--text3);font-size:0.78rem;">لم يُرد بعد</td>`}
`;

// View images button
tr.querySelector('.btn-view-complaint-images').onclick = () => {
if (complaint.images) {
if (typeof complaint.images === 'object'&& !Array.isArray(complaint.images)) {
showCategorizedImages(complaint.images);
} else if (Array.isArray(complaint.images)) {
viewImages(complaint.images);
}
} else {
alert("لا توجد صور متاحة للعرض");
}
};

// Reply button
tr.querySelector('.btn-reply-complaint').onclick = () => {
document.getElementById('complaintReplyModal').style.display = 'block';
document.getElementById('complaintReplyText').value = complaint.reply || '';
document.getElementById('sendWhatsAppReply').checked = true;
window.currentComplaintReply = { 
item: {
ownerName: complaint.owner_name,
phone: complaint.phone,
type: complaint.complaint_type
}, 
id: complaint.id 
};
};

// Delete button (SUPER only)
const deleteBtn = tr.querySelector('.btn-delete-complaint');
if (deleteBtn) {
deleteBtn.onclick = async () => {
if(getRole()!=='SUPER') return;
const delComplaintConfirmed = await window.showConfirmModal({
  title: 'حذف الشكوى',
  message: `المقدم من: ${complaint.owner_name} — النوع: ${complaint.complaint_type}. هذا الإجراء لا يمكن التراجع عنه.`,
  confirmText: 'حذف نهائي',
  cancelText: 'إلغاء',
  type: 'danger'
});
if (!delComplaintConfirmed) {
return;
}

document.getElementById('loadingSpinner').style.display = 'block';

try {
const { data: deletedRows, error } = await window.supabaseClient
.from('complaints')
.delete()
.eq('id', complaint.id).select('id');
if(!error && !deletedRows?.length) throw new Error('لم يُحذف السجل. راجع الصلاحيات وأعد المحاولة.');

if (error) {
console.error('خطأ في حذف الشكوى:', error);
throw error;
}

// Log delete action
await logAdminAction(currentUsername, 'حذف شكوى', `تم حذف شكوى من نوع: ${complaint.complaint_type} للمواطن: ${complaint.owner_name}`);

document.getElementById('loadingSpinner').style.display = 'none';
alert("تم حذف الشكوى بنجاح!");

// Reload complaints
await loadComplaints();

} catch (error) {
document.getElementById('loadingSpinner').style.display = 'none';
console.error('خطأ في حذف الشكوى:', error);
alert(`حدث خطأ أثناء حذف الشكوى:\n\n${error.message || error.toString()}\n\nيرجى المحاولة مرة أخرى`);
}
};
}

tableBody.appendChild(tr);
});

} catch (error) {
console.error('خطأ في تحميل الشكاوى:', error);
document.getElementById('compTableBody').innerHTML = '<tr><td colspan="8"style="text-align: center; padding: 40px; color: var(--danger);">حدث خطأ في تحميل الشكاوى</td></tr>';
}
}

// ── عزل تام للأقسام: يُخفي كل شيء ويُظهر القسم المطلوب فقط ──
function isolateSection(show) {
  const all = [
    'ordersTableContainer',
    'microbusTableContainer',
    'newRequestsTableContainer',
    'complaintsTableContainer',
    'adminLogsTableContainer',
    'availableCodesContainer',
  ];
  all.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  if (show) {
    const target = document.getElementById(show);
    if (target) target.style.display = 'block';
  }

  // إخفاء/إظهار شريط البحث والـ chips حسب القسم
  const tableWrap = document.querySelector('.table-wrap');
  const searchSections = ['ordersTableContainer','microbusTableContainer','newRequestsTableContainer'];
  const isTableSection = searchSections.includes(show);
  if (tableWrap) {
    const toolbar = tableWrap.querySelector('.table-toolbar');
    const chips   = tableWrap.querySelector('.filter-chips')?.parentElement;
    const topPag  = tableWrap.querySelector('.pagination-bar');
    if (toolbar) toolbar.style.display = isTableSection ? 'flex': 'none';
    if (chips)   chips.style.display   = isTableSection ? 'block': 'none';
    if (topPag)  topPag.style.display  = isTableSection ? 'flex': 'none';
  }
}
window.isolateSection = isolateSection;

// Show Orders/Complaints
const showOrdersBtn = document.getElementById('showOrdersBtn');
if (showOrdersBtn) {
showOrdersBtn.onclick = () => {
  isolateSection('ordersTableContainer');
  const filterStatus = document.getElementById('filterStatus');
  if (filterStatus) filterStatus.style.display = 'none';
  showAllOrdersInTable();
};
}

// Show New Requests Button
{
  const showNewRequestsBtn = document.getElementById('showNewRequestsBtn');
  if (showNewRequestsBtn) {
    showNewRequestsBtn.onclick = () => { showNewRequests(); };
  }
}

// Status Change Modal Handler - YES Button (Apply Sticker)
const confirmStickerYesBtn = document.getElementById('confirmStickerYesBtn');
if (confirmStickerYesBtn) {
confirmStickerYesBtn.onclick = async () => {
if(!['SUPER','ADMIN'].includes(getRole())) return;
if (!window.currentStatusChangeItem) return;

const { item, id } = window.currentStatusChangeItem;
const note = document.getElementById('statusNote').value.trim();
const sendWhatsApp = document.getElementById('sendWhatsAppStatus').checked;
const userRole = getRole();
const currentUsername = getUsername();

const newStatus = 'sticker_applied';

if (!id) {
alert("خطأ: معرف الطلب غير موجود");
return;
}

document.getElementById('loadingSpinner').style.display = 'block';

try {
// Update only status (status_history column doesn't exist in database)
const { data: changedRows, error: statusError } = await window.supabaseClient
.from('orders')
.update({
status: newStatus
})
.eq('id', id).select('id');
if(!statusError && !changedRows?.length) throw new Error('لم يتغير أي سجل. راجع الصلاحيات وأعد المحاولة.');

if (statusError) {
console.error('خطأ في تغيير الحالة:', statusError);
console.error('تفاصيل الخطأ:', JSON.stringify(statusError, null, 2));
console.error('ID:', id);
console.error('newStatus:', newStatus);
alert(`خطأ في تغيير الحالة:\n${statusError.message || statusError.hint || JSON.stringify(statusError)}`);
throw statusError;
}

await logAdminAction(currentUsername, 'لصق ملصق', `تم لصق الملصق على مركبة ${item.vType} للمالك: ${item.owner} (الرقم المرجعي: ${item.refNumber})`);

if (sendWhatsApp && item.phone && item.phone.length === 11) {
const message = `*تم لصق الملصق!*\n\n`+
`السيد/ة: ${item.owner}\n`+
`نوع المركبة: ${item.vType}\n`+
`كود المركبة: ${item.vCode || 'غير مكود'}\n`+
`الرقم المرجعي: ${item.refNumber}\n\n`+
`تم لصق الملصق الجديد على مركبتك\n\n`+
`_رئاسة مركز ومدينة كفر صقر_`;
const whatsappUrl = `https://wa.me/2${item.phone}?text=${encodeURIComponent(message)}`;
window.open(whatsappUrl, '_blank');
}

document.getElementById('loadingSpinner').style.display = 'none';
document.getElementById('statusChangeModal').style.display = 'none';
alert("تم لصق الملصق بنجاح!"+ (sendWhatsApp && item.phone && item.phone.length === 11 ? "\n تم فتح واتساب لإرسال الإشعار": ""));
await loadAdminData();
} catch (error) {
document.getElementById('loadingSpinner').style.display = 'none';
console.error('خطأ:', error);
alert(`حدث خطأ: ${error.message}`);
}
};
}

// Status Change Modal Handler - NO Button (Remove Sticker)
const confirmStickerNoBtn = document.getElementById('confirmStickerNoBtn');
if (confirmStickerNoBtn) {
confirmStickerNoBtn.onclick = async () => {
if(!['SUPER','ADMIN'].includes(getRole())) return;
if (!window.currentStatusChangeItem) return;

const { item, id } = window.currentStatusChangeItem;
const note = document.getElementById('statusNote').value.trim();
const userRole = getRole();
const currentUsername = getUsername();

// إرجاع الحالة إلى "تم التكويد"أو "pending"حسب وجود كود
const newStatus = item.vCode ? 'coded': 'pending';

if (!id) {
alert("خطأ: معرف الطلب غير موجود");
return;
}

const stickerConfirmed = await window.showConfirmModal({
  title: 'إلغاء الملصق',
  message: 'هل أنت متأكد من إلغاء/إزالة الملصق؟ سيتم إرجاع الحالة إلى الوضع الطبيعي.',
  confirmText: 'إلغاء الملصق',
  cancelText: 'تراجع',
  type: 'warning'
});
if (!stickerConfirmed) {
return;
}

document.getElementById('loadingSpinner').style.display = 'block';

try {
// Update only status (status_history column doesn't exist in database)
const { data: changedRows, error: statusError } = await window.supabaseClient
.from('orders')
.update({
status: newStatus
})
.eq('id', id).select('id');
if(!statusError && !changedRows?.length) throw new Error('لم يتغير أي سجل. راجع الصلاحيات وأعد المحاولة.');

if (statusError) {
console.error('خطأ في تغيير الحالة:', statusError);
throw statusError;
}

await logAdminAction(currentUsername, 'إلغاء ملصق', `تم إلغاء الملصق من مركبة ${item.vType} للمالك: ${item.owner} (الرقم المرجعي: ${item.refNumber})`);

document.getElementById('loadingSpinner').style.display = 'none';
document.getElementById('statusChangeModal').style.display = 'none';
alert("تم إلغاء الملصق وإرجاع الحالة إلى الوضع الطبيعي");
await loadAdminData();
} catch (error) {
document.getElementById('loadingSpinner').style.display = 'none';
console.error('خطأ:', error);
alert(`حدث خطأ: ${error.message}`);
}
};
}

const showComplaintsBtn = document.getElementById('showComplaintsBtn');
if (showComplaintsBtn) {
showComplaintsBtn.onclick = () => {
  isolateSection('complaintsTableContainer');
  loadComplaints();
};
}

// Bulk Import Button - Show vehicle type selection modal
{
  const bulkImportBtn = document.getElementById('bulkImportBtn');
  if (bulkImportBtn) {
    bulkImportBtn.onclick = () => {
      document.getElementById('bulkImportModal').style.display = 'block';
      document.getElementById('bulkImportFile').value = '';
      document.getElementById('importPreview').style.display = 'none';
      document.getElementById('importPreview').innerHTML = '';
    };
  }
}

// Complaint Reply Modal Handler
const confirmComplaintReplyBtn = document.getElementById('confirmComplaintReplyBtn');
if (confirmComplaintReplyBtn) {
confirmComplaintReplyBtn.onclick = async () => {
if(!['SUPER','ADMIN'].includes(getRole())) return;
if (!window.currentComplaintReply) return;

const { item, id } = window.currentComplaintReply;
const reply = document.getElementById('complaintReplyText').value.trim();
const sendWhatsApp = document.getElementById('sendWhatsAppReply').checked;

if (!reply) {
alert("يرجى كتابة نص الرد");
return;
}

if (!id) {
alert("خطأ: معرف الشكوى غير موجود");
console.error('Missing complaint ID:', window.currentComplaintReply);
return;
}

document.getElementById('loadingSpinner').style.display = 'block';

try {
const { data: changedRows, error } = await window.supabaseClient
.from('complaints')
.update({
reply: reply,
status: 'replied'})
.eq('id', id).select('id');
if(!error && !changedRows?.length) throw new Error('لم يتغير أي سجل. راجع الصلاحيات وأعد المحاولة.');

if (error) {
console.error('خطأ في تحديث الشكوى:', error);
throw error;
}

// Log complaint reply action
await logAdminAction(currentUsername, 'الرد على شكوى', `تم الرد على شكوى من نوع: ${item.type} للمواطن: ${item.ownerName}`);

// Send WhatsApp notification if checkbox is checked
if (sendWhatsApp && item.phone && item.phone.length === 11) {
const message = `*تم الرد على شكواك!*\n\n`+
`السيد/ة: ${item.ownerName}\n`+
`نوع الشكوى: ${item.type}\n\n`+
`*الرد من الإدارة:*\n${reply}\n\n`+
`للاستفسار: 01021102607\n\n`+
`_رئاسة مركز ومدينة كفر صقر_`;

const whatsappUrl = `https://wa.me/2${item.phone}?text=${encodeURIComponent(message)}`;
window.open(whatsappUrl, '_blank');
}

document.getElementById('loadingSpinner').style.display = 'none';
document.getElementById('complaintReplyModal').style.display = 'none';
alert("تم حفظ الرد بنجاح!"+ (sendWhatsApp && item.phone && item.phone.length === 11 ? "\n تم فتح واتساب لإرسال الرد": ""));

// Reload complaints to show updated data
await loadComplaints();

} catch (error) {
document.getElementById('loadingSpinner').style.display = 'none';
console.error('خطأ في الرد على الشكوى:', error);
alert(`حدث خطأ أثناء حفظ الرد:\n\n${error.message || error.toString()}\n\nيرجى المحاولة مرة أخرى`);
}
};
} // end if confirmComplaintReplyBtn

{
  const showAdminLogsBtn = document.getElementById('showAdminLogsBtn');
  if (showAdminLogsBtn) {
    showAdminLogsBtn.onclick = () => {
      isolateSection('adminLogsTableContainer');
      loadAdminLogs();
    };
  }

  const showAvailableCodesBtn = document.getElementById('showAvailableCodesBtn');
  if (showAvailableCodesBtn) {
    showAvailableCodesBtn.onclick = () => showAvailableCodes();
  }
}

// Show available (unused) codes - server-side version
async function showAvailableCodes() {
  isolateSection('availableCodesContainer');

document.getElementById('loadingSpinner').style.display = 'block';

try {
  const allCodes=await window.fetchAllRows('orders','id, code, owner_name, phone, national_id');

  const usedCodes = new Set();
  const usedCodesDetails = {};
  let maxUsedCode = 0;

  allCodes.forEach(item => {
    if (!item.code) return;
    const codeNum = parseInt(item.code);
    if (!Number.isSafeInteger(codeNum) || codeNum<1 || codeNum>999999999) return;
    usedCodes.add(String(codeNum));
    usedCodesDetails[String(codeNum)] = {
      owner: item.owner_name || 'غير محدد',
      phone: item.phone || 'غير محدد',
      nationalId: item.national_id || 'غير محدد'};
    if (codeNum > maxUsedCode) maxUsedCode = codeNum;
  });

  const codeEnd = maxUsedCode > 0 ? maxUsedCode : 100;
  const availableCodes = [];
  for (let i = 1; i <= codeEnd && availableCodes.length < 200; i++) {
    if (!usedCodes.has(i.toString())) availableCodes.push(i.toString());
  }

  window.codeRangeEnd = codeEnd;
  window.maxUsedCode = maxUsedCode;
  window.usedCodesDetails = usedCodesDetails;

  document.getElementById('totalCodesCount').textContent = `${codeEnd} (آخر كود: ${maxUsedCode})`;
  document.getElementById('availableCodesCount').textContent = `${codeEnd-usedCodes.size} (أول 200 كود بالأسفل)`;
  document.getElementById('usedCodesCount').textContent = usedCodes.size;

  const codesList = document.getElementById('availableCodesList');
  codesList.innerHTML = '';

  if (availableCodes.length === 0) {
    codesList.innerHTML = `<p style="text-align:center;color:var(--text3);font-size:1rem;padding:40px;grid-column:1/-1;">جميع الأكواد من 1 إلى ${maxUsedCode} مستخدمة</p>`;
  } else {
    availableCodes.forEach(code => {
      const codeBox = document.createElement('div');
      codeBox.style.cssText = 'background:#1E293B; border:1px solid rgba(16,185,129,0.25); color:#34D399; padding:10px 8px; border-radius:8px; text-align:center; font-weight:700; font-size:1.05rem; cursor:pointer; transition:all 0.2s; font-family:monospace;';
      codeBox.textContent = code;
      codeBox.onmouseover = function() { this.style.borderColor='#10B981'; this.style.background='rgba(16,185,129,0.15)'; };
      codeBox.onmouseout  = function() { this.style.borderColor='rgba(16,185,129,0.25)'; this.style.background='#1E293B'; };
      codeBox.onclick = function() {
        document.getElementById('searchCodeInput').value = code;
        searchForCode();
      };
      codesList.appendChild(codeBox);
    });
  }
} catch (e) {
  console.error('خطأ في جلب الأكواد:', e);
  alert('خطأ في تحميل الأكواد: '+ e.message);
} finally {
  document.getElementById('loadingSpinner').style.display = 'none';
}
}

// Search for specific code
function searchForCode() {
const searchInput = document.getElementById('searchCodeInput');
const resultDiv = document.getElementById('searchCodeResult');
const codeToSearch = searchInput.value.trim();

if (!codeToSearch || codeToSearch === '') {
resultDiv.style.display = 'block';
resultDiv.style.background = 'rgba(245, 158, 11, 0.1)';
resultDiv.style.border = '1px solid rgba(245, 158, 11, 0.25)';
resultDiv.style.color = '#FBBF24';
resultDiv.innerHTML = 'يرجى إدخال رقم الكود';
return;
}

const codeNum = parseInt(codeToSearch);
const maxCode = window.codeRangeEnd || 2500;
if (codeNum < 1 || codeNum > maxCode) {
resultDiv.style.display = 'block';
resultDiv.style.background = 'rgba(239, 68, 68, 0.1)';
resultDiv.style.border = '1px solid rgba(239, 68, 68, 0.25)';
resultDiv.style.color = '#F87171';
resultDiv.innerHTML = `رقم الكود يجب أن يكون بين 1 و ${maxCode}<br><small style="font-size: 0.85rem; color: var(--text3);">(آخر كود مستخدم في النظام: ${window.maxUsedCode || maxCode})</small>`;
return;
}

// Check if code is used
if (window.usedCodesDetails && window.usedCodesDetails[codeToSearch]) {
const details = window.usedCodesDetails[codeToSearch];
resultDiv.style.display = 'block';
resultDiv.style.background = 'rgba(239, 68, 68, 0.08)';
resultDiv.style.border = '1px solid rgba(239, 68, 68, 0.25)';
resultDiv.style.color = 'var(--text)';
resultDiv.innerHTML = `<div style="text-align: right; padding: 10px;">
<p style="margin: 5px 0; font-size: 1.15rem; color: #F87171; font-weight: 700;"><i class="ri-close-circle-line"></i> الكود <strong>${window.sanitizeText(codeToSearch)}</strong> محجوز</p>
<hr style="margin: 12px 0; border: none; border-top: 1px solid rgba(239, 68, 68, 0.2);">
<p style="margin: 5px 0;"><strong>المالك:</strong> ${window.sanitizeText(details.owner)}</p>
<p style="margin: 5px 0;"><strong>الهاتف:</strong> ${window.sanitizeText(details.phone)}</p>
<p style="margin: 5px 0;"><strong>الرقم القومي:</strong> ${window.sanitizeText(details.nationalId)}</p>
</div>
`;
} else {
// Check if code is within range
const codeNum = parseInt(codeToSearch);
if (codeNum > (window.maxUsedCode || 0)) {
resultDiv.style.display = 'block';
resultDiv.style.background = 'rgba(245, 158, 11, 0.1)';
resultDiv.style.border = '1px solid rgba(245, 158, 11, 0.25)';
resultDiv.style.color = '#FBBF24';
resultDiv.innerHTML = `الكود <strong>${codeToSearch}</strong> خارج النطاق الحالي<br><small style="font-size: 0.85rem; color: var(--text3);">(آخر كود مستخدم: ${window.maxUsedCode || 0})</small>`;
} else {
resultDiv.style.display = 'block';
resultDiv.style.background = 'rgba(16, 185, 129, 0.1)';
resultDiv.style.border = '1px solid rgba(16, 185, 129, 0.25)';
resultDiv.style.color = '#34D399';
resultDiv.innerHTML = `<i class="ri-checkbox-circle-line"></i> الكود <strong>${codeToSearch}</strong> متاح ويمكن استخدامه`;
}
}
}

// Filter functions
function showAllOrders() {
    window._newRequestsMode = false;
    window._stickerMode = false;
    if (typeof window.switchToVehicleSection === 'function') {
      window.switchToVehicleSection('tuktuk');
    } else {
      window.currentFilter = 'tuktuk';
      if (typeof loadPage === 'function') loadPage(1);
    }
}

function showAllOrdersInTable() { showAllOrders(); }

function showStickerAppliedOrders() {
    window._newRequestsMode = false;
    window._stickerMode = true;
    window.currentFilter = 'tuktuk';  // الملصق خاص بالتوكتوك فقط
    isolateSection('ordersTableContainer');
    if (typeof loadPage === 'function') loadPage(1);
}

// Show new requests (pending - from citizens portal) — توكتوك فقط
function showNewRequests() {
    window._newRequestsMode = true;
    window._stickerMode = false;
    window.currentFilter = 'tuktuk';  // توكتوك فقط — الميكروباص لا يمر بمرحلة الطلبات الجديدة
    window.currentSearch = '';
    window.currentSearchType = 'all';
    // عزل جدول الطلبات الجديدة
    isolateSection('ordersTableContainer');
    if (typeof loadPage === 'function') loadPage(1);
}

function showComplaintsTable() {
    isolateSection('complaintsTableContainer');
    const filterStatus = document.getElementById('filterStatus');
    if (filterStatus) filterStatus.style.display = 'none';
    loadComplaints();
}

// Make functions global
window.showAllOrders = showAllOrders;
window.showStickerAppliedOrders = showStickerAppliedOrders;
window.showNewRequests = showNewRequests;
// filterByVehicleType معرّفة في pagination.js — لا نعيد تعريفها هنا لتجنب التعارض
window.showComplaintsTable = showComplaintsTable;

// ── Date Filter Functions ──────────────────────────────────
window.clearDateFilter = function() {
  const from = document.getElementById('filterFromDate');
  const to   = document.getElementById('filterToDate');
  if (from) from.value = '';
  if (to)   to.value   = '';
  window._dateFrom = null;
  window._dateTo   = null;
  document.getElementById('dateFilterModal').style.display = 'none';
  if (typeof loadPage === 'function') loadPage(1);
};

document.addEventListener('DOMContentLoaded', function() {
  const applyBtn = document.getElementById('applyDateFilterBtn');
  if (applyBtn) {
    applyBtn.onclick = function() {
      const from = document.getElementById('filterFromDate').value;
      const to   = document.getElementById('filterToDate').value;
      if (!from && !to) { alert('يرجى تحديد تاريخ واحد على الأقل'); return; }
      window._dateFrom = from || null;
      window._dateTo   = to   || null;
      document.getElementById('dateFilterModal').style.display = 'none';
      if (typeof loadPage === 'function') loadPage(1);
    };
  }
});

// Show Activity Log
function showActivityLog(item) {
const modal = document.getElementById('activityLogModal');
const content = document.getElementById('activityLogContent');
const history = item.statusHistory || [];

let html = `<div style="background: var(--bg3); padding: 18px; border-radius: var(--r-md); margin-bottom: 20px; border: 1px solid var(--border);">
<h4 style="color: var(--text); margin: 0 0 10px 0; font-size: 1rem;"><i class="ri-file-info-line"></i> معلومات الطلب:</h4>
<p style="margin: 5px 0;"><strong>المالك:</strong> ${window.sanitizeText(item.owner)}</p>
<p style="margin: 5px 0;"><strong>الرقم المرجعي:</strong> ${window.sanitizeText(item.refNumber) || 'N/A'}</p>
<p style="margin: 5px 0;"><strong>نوع المركبة:</strong> ${window.sanitizeText(item.vType)}</p>
</div>
`;

if (history.length === 0) {
html += '<p style="text-align: center; color: var(--text3); padding: 40px;">لا يوجد سجل عمليات</p>';
} else {
html += '<div style="position: relative; padding-right: 30px;">';
history.forEach((log, index) => {
const statusInfo = window.getStatusDisplay(log.status);
const isLast = index === history.length - 1;
html += `<div style="position: relative; margin-bottom: 20px;">
<div style="position: absolute; right: -30px; top: 0; width: 18px; height: 18px; background: ${statusInfo.color}; border-radius: 50%; border: 2px solid var(--bg); box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
${!isLast ? '<div style="position: absolute; right: -22px; top: 18px; width: 2px; height: calc(100% + 20px); background: var(--border);"></div>': ''}
<div style="background: var(--bg3); padding: 16px; border-radius: var(--r-md); border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
<span style="background: rgba(16, 185, 129, 0.12); color: #34D399; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 0.8rem;">${statusInfo.text}</span>
<span style="color: var(--text3); font-size: 0.8rem;">${window.formatDateTime(log.timestamp)}</span>
</div>
${log.note ? `<p style="margin: 8px 0 0 0; color: var(--text2); line-height: 1.5; font-size: 0.85rem;">${window.sanitizeText(log.note)}</p>`: ''}
${log.by ? `<p style="margin: 8px 0 0 0; color: var(--text3); font-size: 0.8rem;">بواسطة: ${log.by === 'SUPER'? 'مدير عام': log.by === 'ADMIN'? 'مشرف': window.sanitizeText(log.by)}</p>`: ''}
</div>
</div>
`;
});
html += '</div>';
}

content.innerHTML = html;
modal.style.display = 'block';
}

window.showActivityLog = showActivityLog;

// Load Admin Logs
async function loadAdminLogs() {

try {
const logs = await window.fetchAllRows('supervisor_logs');
logs.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));

const tableBody = document.getElementById('adminLogsTableBody');
tableBody.innerHTML = '';

if (!logs || logs.length === 0) {
tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text3);">لا يوجد سجل عمليات</td></tr>';
return;
}

logs.forEach(item => {
const roleText = item.user_role === 'SUPER'? 'مدير عام': item.user_role === 'ADMIN'? 'مشرف': 'عرض فقط';
const roleStyle = item.user_role === 'SUPER'? 'background: rgba(239, 68, 68, 0.15); color: #F87171;' : item.user_role === 'ADMIN'? 'background: rgba(16, 185, 129, 0.15); color: #34D399;' : 'background: rgba(148, 163, 184, 0.15); color: #94A3B8;';

const tr = document.createElement('tr');
tr.innerHTML = `<td style="padding: 14px 16px; border-bottom: 1px solid var(--border); font-weight:bold;">
<span style="${roleStyle} padding: 4px 10px; border-radius: 6px; font-size: 0.85rem;">
${window.sanitizeText(item.username)}
</span>
<br><small style="color: var(--text3); font-size: 0.78rem;">${roleText}</small>
</td>
<td style="padding: 14px 16px; border-bottom: 1px solid var(--border); font-weight:600; color: var(--text);">${window.sanitizeText(item.action)}</td>
<td style="padding: 14px 16px; border-bottom: 1px solid var(--border); color: var(--text2);">${window.sanitizeText(item.details)}</td>
<td style="padding: 14px 16px; border-bottom: 1px solid var(--border); font-size:0.85rem; color: var(--text3);">${window.formatDateTime(item.timestamp)}</td>
<td style="padding: 14px 16px; border-bottom: 1px solid var(--border); font-family: monospace; color: var(--text3);">${window.sanitizeText(item.ip_address || 'N/A')}</td>
`;
tableBody.appendChild(tr);
});

} catch (error) {
console.error('خطأ في تحميل سجل المشرفين:', error);
document.getElementById('adminLogsTableBody').innerHTML = '<tr><td colspan="5"style="text-align: center; padding: 40px; color: var(--danger);"> حدث خطأ في تحميل السجل</td></tr>';
}
}

// Export Excel - Enhanced Version
{
  const exportExcelBtn = document.getElementById('exportExcelBtn');
  if (exportExcelBtn) {
  exportExcelBtn.onclick = async () => {
if(getRole()!=='SUPER') return;
const exportConfirmed = await window.showConfirmModal({
  title: 'تصدير البيانات إلى Excel',
  message: 'سيتم تصدير جميع بيانات المركبات والشكاوى. قد يستغرق الأمر بضع ثوانٍ.',
  confirmText: 'تصدير',
  cancelText: 'إلغاء',
  type: 'info'
});
if (!exportConfirmed) {
return;
}

const loadingDiv = document.createElement('div');
loadingDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:30px;border-radius:15px;box-shadow:0 10px 40px rgba(0,0,0,0.3);z-index:10000;text-align:center;';
loadingDiv.innerHTML = '<div style="font-size:3rem;margin-bottom:15px;"></div><div style="font-size:1.2rem;color:#333;font-weight:600;">جاري تصدير البيانات...</div><div style="margin-top:10px;color:#666;">يرجى الانتظار</div>';
document.body.appendChild(loadingDiv);

try {
const allVehicles = await window.fetchAllRows('orders');
const allComplaints = await window.fetchAllRows('complaints');

// Create workbook
const wb = XLSX.utils.book_new();

// Sort vehicles by code (ascending)
allVehicles.sort((a, b) => {
const codeA = parseInt(a.code) || 999999;
const codeB = parseInt(b.code) || 999999;
return codeA - codeB;
});

// Sheet 1: Vehicles Data
const vehiclesData = [
['اسم المالك', 'الرقم القومي', 'رقم الهاتف', 'نوع المركبة', 'رقم اللوحة', 'الكود', 'الحالة', 'تاريخ التقديم']
];

allVehicles.forEach(vehicle => {
// Format date
const date = new Date(vehicle.submitted_at);
const formattedDate = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} - ${date.getHours() > 12 ? date.getHours() - 12 : date.getHours()}:${String(date.getMinutes()).padStart(2, '0')} ${date.getHours() >= 12 ? 'م': 'ص'}`;

// Status text
const statusText = window.getStatusDisplay(vehicle.status).text;

vehiclesData.push([
vehicle.owner_name || '-',
vehicle.national_id || '-',
vehicle.phone || '-',
vehicle.vehicle_type || '-',
vehicle.license_plate || '-',
vehicle.code || '-',
statusText,
formattedDate
]);
});

const vehiclesSheet = XLSX.utils.aoa_to_sheet(vehiclesData);

// Format phone and national_id columns as text to prevent Excel from adding dots
const range = XLSX.utils.decode_range(vehiclesSheet['!ref']);
for (let R = range.s.r + 1; R <= range.e.r; ++R) {
// Column B (index 1) = الرقم القومي
const nationalIdCell = XLSX.utils.encode_cell({ r: R, c: 1 });
if (vehiclesSheet[nationalIdCell]) {
vehiclesSheet[nationalIdCell].t = 's'; // Set as string
vehiclesSheet[nationalIdCell].z = '@'; // Text format
}
// Column C (index 2) = رقم الهاتف
const phoneCell = XLSX.utils.encode_cell({ r: R, c: 2 });
if (vehiclesSheet[phoneCell]) {
vehiclesSheet[phoneCell].t = 's'; // Set as string
vehiclesSheet[phoneCell].z = '@'; // Text format
}
}

vehiclesSheet['!cols'] = [
{ wch: 20 }, // اسم المالك
{ wch: 18 }, // الرقم القومي
{ wch: 15 }, // رقم الهاتف
{ wch: 15 }, // نوع المركبة
{ wch: 15 }, // رقم اللوحة
{ wch: 12 }, // الكود
{ wch: 15 }, // الحالة
{ wch: 25 }  // تاريخ التقديم
];
XLSX.utils.book_append_sheet(wb, vehiclesSheet, 'بيانات المركبات');

// Sheet 3: Complaints Data
if (allComplaints && allComplaints.length > 0) {
const complaintsData = [
['اسم المقدم', 'رقم الهاتف', 'نوع الشكوى', 'التفاصيل', 'الحالة', 'الرد', 'تاريخ التقديم']
];

allComplaints.forEach(complaint => {
// Format date
const date = new Date(complaint.submitted_at);
const formattedDate = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} - ${date.getHours() > 12 ? date.getHours() - 12 : date.getHours()}:${String(date.getMinutes()).padStart(2, '0')} ${date.getHours() >= 12 ? 'م': 'ص'}`;

// Status text
const statusText = complaint.status === 'replied'? 'تم الرد': 'قيد المراجعة';

complaintsData.push([
complaint.owner_name || '-',
complaint.phone || '-',
complaint.complaint_type || '-',
complaint.details || '-',
statusText,
complaint.reply || '-',
formattedDate
]);
});

const complaintsSheet = XLSX.utils.aoa_to_sheet(complaintsData);

// Format phone column as text to prevent Excel from adding dots
const compRange = XLSX.utils.decode_range(complaintsSheet['!ref']);
for (let R = compRange.s.r + 1; R <= compRange.e.r; ++R) {
// Column B (index 1) = رقم الهاتف
const phoneCell = XLSX.utils.encode_cell({ r: R, c: 1 });
if (complaintsSheet[phoneCell]) {
complaintsSheet[phoneCell].t = 's'; // Set as string
complaintsSheet[phoneCell].z = '@'; // Text format
}
}

complaintsSheet['!cols'] = [
{ wch: 20 }, // اسم المقدم
{ wch: 15 }, // رقم الهاتف
{ wch: 15 }, // نوع الشكوى
{ wch: 40 }, // التفاصيل
{ wch: 15 }, // الحالة
{ wch: 40 }, // الرد
{ wch: 25 }  // تاريخ التقديم
];
XLSX.utils.book_append_sheet(wb, complaintsSheet, 'الشكاوى');
}

// Write file
const fileName = `منظومة_كفر_صقر_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}.xlsx`;
XLSX.writeFile(wb, fileName);

loadingDiv.remove();
alert(`تم تصدير البيانات بنجاح!\n\n الإحصائيات:\n• ${allVehicles.length} مركبة\n• ${allComplaints.length} شكوى\n\n الملف: ${fileName}`);

} catch (error) {
loadingDiv.remove();
console.error('خطأ في التصدير:', error);
alert('حدث خطأ أثناء تصدير البيانات: '+ error.message);
}
};
  } // end if exportExcelBtn
} // end block

// Search - استخدام نظام Pagination الجديد
// تم نقل دالة البحث إلى نظام Pagination

// Make functions and variables global
window.viewImages = viewImages;

// uploadLocalToSupabaseBtn — removed (LocalStorage deprecated, data is in Supabase only)

// ============================================

// ═══════════════════════════════════════════════════════════════
// لوحة الصيانة - SUPER فقط
// ═══════════════════════════════════════════════════════════════

// ── 1. تنظيف السجلات المكررة ────────────────────────────────
// ── 2. تقرير السلامة (Health Check) ─────────────────────────
// ── مركز الإحصائيات الشامل ─────────────────────────────────
window.openStatsModal = async function() {
if(!window.currentStaffRole) return;
  const modal = document.getElementById('statsDashboardModal');
  if (!modal) return;

  modal.style.display = 'flex';
  ['dashTotal','dashTuktuk','dashMicrobus','dashSticker',
   'dashComplaints','dashReplied','dashToday','dashPending'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '…';
  });

  try {
    const today = new Date();
    today.setHours(0,0,0,0);
    const todayISO = today.getTime();

    // ── التوكتوك: license_plate فارغ أو null ──
    const TUKTUK_FILTER  = 'license_plate.is.null,license_plate.eq.';
    // ── الميكروباص: license_plate موجود وغير فارغ ──

    const [
      { count: total },
      { count: tuktuk },
      { count: microbus },
      // الملصق خاص بالتوكتوك فقط
      { count: sticker },
      { count: complaints },
      { count: replied },
      // طلبات اليوم — توكتوك فقط (التسجيل الجديد)
      { count: todayReqs },
      // معلق بدون كود — توكتوك فقط
      { count: pending },
    ] = await Promise.all([
      // إجمالي الكل
      window.supabaseClient.from('orders').select('*',{count:'exact',head:true}),
      // توكتوك فقط
      window.supabaseClient.from('orders').select('*',{count:'exact',head:true})
        .or(TUKTUK_FILTER),
      // ميكروباص فقط
      window.supabaseClient.from('orders').select('*',{count:'exact',head:true})
        .not('license_plate','is',null).neq('license_plate',''),
      // ملصق — توكتوك فقط (الميكروباص لا يمر بهذه المرحلة)
      window.supabaseClient.from('orders').select('*',{count:'exact',head:true})
        .or(TUKTUK_FILTER).eq('status','sticker_applied'),
      // شكاوى
      window.supabaseClient.from('complaints').select('*',{count:'exact',head:true}),
      // شكاوى تم الرد عليها
      window.supabaseClient.from('complaints').select('*',{count:'exact',head:true})
        .eq('status','replied'),
      // طلبات اليوم — توكتوك فقط
      window.supabaseClient.from('orders').select('*',{count:'exact',head:true})
        .or(TUKTUK_FILTER).gte('submitted_at', todayISO),
      // توكتوك بدون كود (معلق للتكويد)
      window.supabaseClient.from('orders').select('*',{count:'exact',head:true})
        .or(TUKTUK_FILTER).or('code.is.null,code.eq.'),
    ]);

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val ?? 0;
    };
    set('dashTotal',      total);
    set('dashTuktuk',     tuktuk);
    set('dashMicrobus',   microbus);
    set('dashSticker',    sticker);
    set('dashComplaints', complaints);
    set('dashReplied',    replied);
    set('dashToday',      todayReqs);
    set('dashPending',    pending);
  } catch(e) {
    console.error('Stats error:', e);
    ['dashTotal','dashTuktuk','dashMicrobus','dashSticker',
     'dashComplaints','dashReplied','dashToday','dashPending'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
  }
};

// ── تقرير السلامة (محتفظ به للتوافق مع الكود القديم) ────────
window.runHealthCheck = window.openStatsModal;

// ── 3. تصدير نسخة احتياطية JSON ─────────────────────────────
window.exportBackup = async function() {
  const role = getRole();
  if (role !== 'SUPER') { alert('هذه الأداة متاحة للمدير العام فقط'); return; }

  document.getElementById('loadingSpinner').style.display = 'block';
  try {
    const [orders, complaints] = await Promise.all([
      window.fetchAllRows('orders'), window.fetchAllRows('complaints')
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      exportedBy: sessionStorage.getItem('username') || 'SUPER',
      orders,
      complaints
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_kafrsaqr_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    await window.logSupervisorAction('تصدير نسخة احتياطية', `تم تصدير ${orders.length} طلب و ${complaints.length} شكوى`);
    document.getElementById('loadingSpinner').style.display = 'none';
    alert('تم تصدير النسخة الاحتياطية بنجاح');
  } catch (e) {
    document.getElementById('loadingSpinner').style.display = 'none';
    alert('خطأ: '+ e.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   إدارة حسابات المشرفين (خاص بالمدير العام SUPER فقط)
═══════════════════════════════════════════════════════════════ */
function _escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.openStaffManagementModal = async function() {
  const role = getRole();
  if (role !== 'SUPER') {
    alert('هذه الميزة مخصصة للمدير العام فقط.');
    return;
  }
  const modal = document.getElementById('staffManagementModal');
  if (!modal) return;
  modal.style.display = 'flex';
  await window.loadStaffAccountsList();
};

window.loadStaffAccountsList = async function() {
  const listContainer = document.getElementById('staffAccountsList');
  if (!listContainer) return;
  listContainer.innerHTML = '<p style="text-align:center;color:var(--text3);font-size:0.85rem;">جاري التحميل...</p>';

  try {
    const { data: staffList, error } = await window.supabaseClient.rpc('get_staff_list');
    if (error) throw error;

    if (!staffList || staffList.length === 0) {
      listContainer.innerHTML = '<p style="text-align:center;color:var(--text3);font-size:0.85rem;">لا توجد حسابات أخرى مسجلة.</p>';
      return;
    }

    listContainer.innerHTML = staffList.map(s => {
      const isSelf = (s.username || '').toLowerCase() === 'eltohamy'|| s.role === 'SUPER';
      const roleBadge = s.role === 'SUPER'? '<span style="background:rgba(201,168,76,0.15);color:var(--gold);padding:3px 8px;border-radius:6px;font-size:0.75rem;font-weight:700;">مدير عام (SUPER)</span>': '<span style="background:rgba(52,152,219,0.15);color:var(--blue);padding:3px 8px;border-radius:6px;font-size:0.75rem;font-weight:700;">بحث فقط (VIEWER)</span>';

      return `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div>
            <div style="font-weight:700;font-size:0.92rem;color:var(--text);display:flex;align-items:center;gap:8px;">
              <span> ${_escapeHtml(s.username)}</span>
              ${roleBadge}
            </div>
            <div style="font-size:0.78rem;color:var(--text3);margin-top:3px;">
              ${_escapeHtml(s.full_name || 'بدون اسم')}
            </div>
          </div>
          <div>
            ${!isSelf ? `<button data-staff-id="${_escapeHtml(s.user_id)}" data-staff-name="${_escapeHtml(s.username)}"class="btn"style="background:rgba(231,76,60,0.12);color:var(--red);border:1px solid rgba(231,76,60,0.3);padding:6px 12px;font-size:0.8rem;border-radius:8px;cursor:pointer;">
                <i class="ri-delete-bin-line"></i> حذف
              </button>
            `: '<span style="font-size:0.75rem;color:var(--gold);font-weight:700;">حسابك الرئيسي</span>'}
          </div>
        </div>
      `;
    }).join('');
    listContainer.querySelectorAll('[data-staff-id]').forEach(button => { button.onclick = () => window.handleDeleteStaff(button.dataset.staffId, button.dataset.staffName); });
  } catch (err) {
    console.error('Failed to load staff list:', err);
    listContainer.innerHTML = '<p style="text-align:center;color:var(--red);font-size:0.85rem;">فشل تحميل قائمة الحسابات: '+ _escapeHtml(err.message || '') + '</p>';
  }
};

window.handleCreateSupervisor = async function() {
if(getRole()!=='SUPER') return;
  const usernameInput = document.getElementById('newStaffUsername');
  const fullNameInput = document.getElementById('newStaffFullName');
  const passwordInput = document.getElementById('newStaffPassword');
  const btn = document.getElementById('btnCreateSupervisor');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const fullName = fullNameInput ? fullNameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';

  if (!username || username.length < 3) {
    alert('يرجى إدخال اسم مستخدم صحيح (3 أحرف إنجليزية على الأقل وبدون مسافات).');
    return;
  }
  if (!password || password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    alert('كلمة المرور تحتاج 12 خانة على الأقل وحروفًا كبيرة وصغيرة وأرقامًا.');
    return;
  }

  btn.disabled = true;
  btn.innerText = 'جاري الإنشاء...';

  try {
    const { data, error } = await window.supabaseClient.rpc('create_supervisor_account', {
      p_username: username,
      p_password: password,
      p_full_name: fullName,
      p_role: 'VIEWER'});

    if (error) throw error;

    alert(`تم إنشاء حساب المشرف بنجاح!\n\nاسم الدخول: ${username}\nالصلاحية: استعلام وبحث فقط\n\nيدخل المشرف بكتابة اسمه وكلمة المرور في شاشة الدخول.`);
    if (usernameInput) usernameInput.value = '';
    if (fullNameInput) fullNameInput.value = '';
    if (passwordInput) passwordInput.value = '';
    await window.loadStaffAccountsList();
  } catch (err) {
    console.error('Failed to create supervisor:', err);
    alert('فشل إنشاء الحساب: '+ (err.message || 'خطأ غير متوقع'));
  } finally {
    btn.disabled = false;
    btn.innerText = 'إنشاء الحساب فوراً';
  }
};

window.handleDeleteStaff = async function(userId, username) {
if(getRole()!=='SUPER') return;
  const staffDelConfirmed = await window.showConfirmModal({
    title: 'حذف حساب المشرف',
    message: `هل أنت متأكد من حذف حساب المشرف (${username}) نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`,
    confirmText: 'حذف الحساب',
    cancelText: 'إلغاء',
    type: 'danger'
  });
  if (!staffDelConfirmed) return;

  try {
    const { error } = await window.supabaseClient.rpc('delete_staff_account', { p_user_id: userId });
    if (error) throw error;
    alert(`تم حذف حساب المشرف (${username}) بنجاح.`);
    await window.loadStaffAccountsList();
  } catch (err) {
    console.error('Failed to delete staff account:', err);
    alert('فشل حذف الحساب: '+ (err.message || ''));
  }
};

// ── EOF ──

