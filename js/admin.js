// ═══════════════════════════════════════════════════════════════
// admin.js - لوحة التحكم الإدارية
// ═══════════════════════════════════════════════════════════════

// Admin Panel - Supabase Only
let currentEditId = "";

// دايماً اقرأ الدور من sessionStorage - لا تعتمد على المتغير المحلي
function getRole() { return sessionStorage.getItem('userRole') || 'VIEWER'; }
function getUsername() { return sessionStorage.getItem('username') || 'مجهول'; }

// للتوافق مع الكود القديم
Object.defineProperty(window, 'userRole', {
  get: () => sessionStorage.getItem('userRole') || '',
  set: (v) => sessionStorage.setItem('userRole', v)
});
Object.defineProperty(window, 'currentUsername', {
  get: () => sessionStorage.getItem('username') || '',
  set: (v) => sessionStorage.setItem('username', v)
});

// aliases محلية تقرأ من sessionStorage دايماً
let userRole     = { toString() { return getRole(); } };
let currentUsername = { toString() { return getUsername(); } };

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

if (confirm(confirmMessage)) {
window.open(whatsappUrl, '_blank');
return true;
}
return false;
}

window.sendWhatsAppNotification = sendWhatsAppNotification;

// Get Smart Next Code from Database
async function getSmartNextCode() {
try {
// Get ALL codes from Supabase database (with pagination)
let allCodes = [];
let from = 0;
const batchSize = 1000;
let hasMore = true;

while (hasMore) {
const { data: batch, error } = await window.supabaseClient
.from('orders')
.select('code')
.not('code', 'is', null)
.range(from, from + batchSize - 1);

if (error) {
console.error('❌ خطأ في جلب الأكواد من Supabase:', error);
throw error;
}

if (batch && batch.length > 0) {
allCodes = allCodes.concat(batch);
from += batchSize;
hasMore = batch.length === batchSize;
} else {
hasMore = false;
}
}


let maxCode = 0;

// Check Supabase codes
if (allCodes.length > 0) {
allCodes.forEach(item => {
if (item.code) {
const code = parseInt(item.code);
if (!isNaN(code) && code > maxCode) {
maxCode = code;
}
}
});
}


// Also check localStorage (in case there are codes not synced)
const localOrders = JSON.parse(localStorage.getItem('orders') || '[]');

localOrders.forEach(item => {
if (item.vCode) {
const code = parseInt(item.vCode);
if (!isNaN(code) && code > maxCode) {
maxCode = code;
}
}
});


// If no codes found, start from 100
if (maxCode === 0) {
maxCode = 100;
}

return { last: maxCode, next: maxCode + 1 };
} catch (error) {
console.error('❌ Error getting next code:', error);
return { last: 100, next: 101 };
}
}

// Make getSmartNextCode global
window.getSmartNextCode = getSmartNextCode;

// Get random available code
async function getRandomAvailableCode() {
try {
// Get ALL codes from Supabase (with pagination)
let allCodes = [];
let from = 0;
const batchSize = 1000;
let hasMore = true;

while (hasMore) {
const { data: batch, error } = await window.supabaseClient
.from('orders')
.select('code')
.not('code', 'is', null)
.range(from, from + batchSize - 1);

if (error) throw error;

if (batch && batch.length > 0) {
allCodes = allCodes.concat(batch);
from += batchSize;
hasMore = batch.length === batchSize;
} else {
hasMore = false;
}
}

// Get all used codes
const usedCodes = new Set();
if (allCodes.length > 0) {
allCodes.forEach(item => {
const code = parseInt(item.code);
if (!isNaN(code)) usedCodes.add(code);
});
}

// Also check localStorage
const localOrders = JSON.parse(localStorage.getItem('orders') || '[]');
localOrders.forEach(item => {
if (item.vCode) {
const code = parseInt(item.vCode);
if (!isNaN(code)) usedCodes.add(code);
}
});

// Find max code
let maxCode = 100;
usedCodes.forEach(code => {
if (code > maxCode) maxCode = code;
});


// Get all available codes (from 1 to maxCode)
const availableCodes = [];
for (let i = 1; i <= maxCode; i++) {
if (!usedCodes.has(i)) {
availableCodes.push(i);
}
}


if (availableCodes.length === 0) {
// No available codes, return next code
return maxCode + 1;
}

// Return random available code
const randomIndex = Math.floor(Math.random() * availableCodes.length);
const randomCode = availableCodes[randomIndex];
return randomCode;
} catch (error) {
console.error('Error getting random code:', error);
return 101;
}
}

window.getRandomAvailableCode = getRandomAvailableCode;

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
        if (btn) { btn.disabled = false; btn.innerText = 'دخول 🚀'; }
        if (emailInput) emailInput.disabled = false;
        if (passInput) passInput.disabled = false;
        localStorage.removeItem('loginLockoutTime');
        localStorage.setItem('loginAttempts', '0');
        hideCaptcha();
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
    
    // Check if CAPTCHA is needed
    const attempts = parseInt(localStorage.getItem('loginAttempts') || '0');
    if (attempts >= 3) {
      showCaptcha();
    } else {
      hideCaptcha();
    }
  }
}

function showCaptcha() {
  const captchaGroup = document.getElementById('captchaGroup');
  if (captchaGroup) captchaGroup.style.display = 'block';
  generateCaptcha();
}

function hideCaptcha() {
  const captchaGroup = document.getElementById('captchaGroup');
  if (captchaGroup) captchaGroup.style.display = 'none';
  const captchaAns = document.getElementById('captchaAnswer');
  if (captchaAns) captchaAns.value = '';
  window.currentCaptchaAnswer = null;
}

function generateCaptcha() {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const questEl = document.getElementById('captchaQuestion');
  if (questEl) {
    questEl.textContent = `${num1} + ${num2} = ?`;
  }
  window.currentCaptchaAnswer = num1 + num2;
  const captchaAns = document.getElementById('captchaAnswer');
  if (captchaAns) captchaAns.value = '';
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
const password = document.getElementById('loginPassword').value.trim();

if (!userInput || !password) {
alert("❌ يرجى إدخال اسم المستخدم وكلمة المرور");
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
  alert(`⚠️ تم حظر محاولات الدخول مؤقتاً بسبب محاولات خاطئة متكررة.`);
  return;
}

// Check CAPTCHA if attempts >= 3
const attemptsCount = parseInt(localStorage.getItem('loginAttempts') || '0');
if (attemptsCount >= 3) {
  const answerInput = document.getElementById('captchaAnswer').value.trim();
  if (!answerInput || parseInt(answerInput) !== window.currentCaptchaAnswer) {
    alert("❌ رمز التحقق البشري غير صحيح. يرجى المحاولة مرة أخرى.");
    
    let attempts = attemptsCount + 1;
    localStorage.setItem('loginAttempts', attempts);
    
    if (attempts >= 5) {
      const lockoutUntil = Date.now() + (15 * 60 * 1000); // 15 mins
      localStorage.setItem('loginLockoutTime', lockoutUntil.toString());
      localStorage.setItem('loginAttempts', '0');
      checkActiveLockout();
    } else {
      generateCaptcha();
    }
    return;
  }
}

// Show loading
const btn = document.getElementById('confirmLoginBtn');
const originalText = btn.innerText;
btn.innerText = '⏳ جاري التحقق...';
btn.disabled = true;

try {
// Sign in with secure authentication
const { data, error } = await window.supabaseClient.auth.signInWithPassword({
email: email,
password: password
});

if (error) {
console.error('❌ خطأ في تسجيل الدخول:', error);

let attempts = parseInt(localStorage.getItem('loginAttempts') || '0');
attempts += 1;
localStorage.setItem('loginAttempts', attempts);

if (attempts >= 5) {
  const lockoutUntil = Date.now() + (15 * 60 * 1000); // 15 mins
  localStorage.setItem('loginLockoutTime', lockoutUntil.toString());
  localStorage.setItem('loginAttempts', '0');
  checkActiveLockout();
  alert("⚠️ تم حظر محاولات الدخول لمدة 15 دقيقة بسبب محاولات خاطئة متكررة.");
} else {
  // رسالة توضيحية حسب نوع الخطأ
  if (error.message.includes('Invalid login credentials')) {
      alert(`❌ اسم المستخدم أو كلمة المرور غير صحيحة\n\nمحاولات متبقية قبل الحظر: ${5 - attempts}`);
  } else if (error.message.includes('Email not confirmed')) {
      alert("❌ البريد الإلكتروني غير مفعل\n\nيرجى تفعيل البريد الإلكتروني أولاً");
  } else {
      alert("❌ خطأ في تسجيل الدخول:\n\n" + error.message);
  }
  
  if (attempts >= 3) {
    showCaptcha();
  }
}

btn.innerText = originalText;
btn.disabled = false;
return;
}

// Clear Lockout on success
localStorage.removeItem('loginAttempts');
localStorage.removeItem('loginLockoutTime');
hideCaptcha();

// Successful login
const user = data.user;

// استعلام الصلاحية الحقيقية من جدول staff أو التعرف على Eltohamy
let detectedRole = 'SUPER';
let displayName = 'Eltohamy';

try {
  const { data: staffMember } = await window.supabaseClient
    .from('staff')
    .select('role, full_name, username')
    .eq('user_id', user.id)
    .maybeSingle();

  if (staffMember && staffMember.role) {
    detectedRole = staffMember.role;
    if (staffMember.username) displayName = staffMember.username;
  }
} catch (err) {
  console.warn('Could not fetch staff role from table:', err);
}

// Fallback role check
if (email.toLowerCase().includes('eltohamy') || email.toLowerCase().includes('super') || email.toLowerCase() === 'admin@kafrsaqr.com') {
  detectedRole = 'SUPER';
}

window.userRole = detectedRole;
userRole = detectedRole;
sessionStorage.setItem('userRole', detectedRole);

window.currentUsername = displayName;
currentUsername = displayName;

// Save session
sessionStorage.setItem('supabaseSession', JSON.stringify(data.session));
sessionStorage.setItem('adminRole', detectedRole);
sessionStorage.setItem('adminUsername', displayName);
sessionStorage.setItem('username', displayName);

// Hide login modal
document.getElementById('loginModal').style.display = 'none';

// Log admin login
await logAdminAction(currentUsername, 'تسجيل دخول', `دخول آمن إلى النظام`);

document.getElementById('portalSection').style.display = 'none';
document.getElementById('citizenPage').style.display = 'none';
document.getElementById('inquiryPage').style.display = 'none';
document.getElementById('complaintsPage').style.display = 'none';
document.getElementById('complaintInquiryPage').style.display = 'none';
document.getElementById('adminPage').style.display = 'block';

// Hide leadership section in admin panel
const leadershipSection = document.getElementById('leadershipSection');
if (leadershipSection) leadershipSection.style.display = 'none';

// Add admin mode class to body
document.body.classList.add('admin-mode');
window._navSource = 'admin';

// Update FAB button
const fabBtn = document.getElementById('fabLoginBtn');
if (fabBtn) {
fabBtn.innerHTML = '🚪';
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
if (sidebarToggle) sidebarToggle.style.display = window.innerWidth <= 768 ? 'inline-flex' : 'none';

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
  if (userRole === 'VIEWER' && _bulkImportBtn) {
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
console.error('❌ خطأ في تسجيل الدخول:', error);
alert("❌ حدث خطأ في تسجيل الدخول");
btn.innerText = originalText;
btn.disabled = false;
}
};

// Get Signed URL for Private Images
async function getSignedUrl(filePath) {
if (!filePath) return '';

// If it's already a full URL, return it
if (filePath.startsWith('http')) return filePath;

try {
const { data, error } = await window.supabaseClient.storage
.from('vehicle-images')
.createSignedUrl(filePath, 3600); // Valid for 1 hour

if (error) {
console.error('Error getting signed URL:', error);
return filePath;
}

return data.signedUrl;
} catch (err) {
console.error('Error:', err);
return filePath;
}
}

// View Images
async function viewImages(images) {
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
allImages.push({ url, label: '📸 صورة سيلفي' });
}
if (images.idCard) {
const url = await getSignedUrl(images.idCard);
allImages.push({ url, label: '🪪 صورة البطاقة' });
}
if (images.vehicleImage) {
const url = await getSignedUrl(images.vehicleImage);
allImages.push({ url, label: '🚜 صورة المركبة/الكود' });
}
if (images.problemImages && images.problemImages.length > 0) {
images.problemImages.forEach((url, index) => {
allImages.push({ url: url, label: `📷 صورة المشكلة ${index + 1}` });
});
}

if (allImages.length === 0) {
alert("⚠️ لا توجد صور متاحة للعرض");
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
function createTableRow(item, vehicleType) {
const tr = document.createElement('tr');
const userRole = sessionStorage.getItem('userRole') || 'VIEWER';
const currentUsername = sessionStorage.getItem('username') || 'مجهول';
const id = item.id;

// Row type class
tr.classList.add(vehicleType === 'microbus' ? 'row-microbus' : 'row-tuktuk');
if (item.status === 'sticker_applied') tr.classList.add('sticker-applied');

// Type badge
const typeBadge = vehicleType === 'microbus'
  ? `<span class="badge-microbus"><i class="ri-bus-line"></i> ميكروباص</span>`
  : `<span class="badge-tuktuk"><i class="ri-motorbike-line"></i> توكتوك</span>`;

// Actions button — opens modal
const actionsBtn = `<button class="btn-actions btn-open-actions"><i class="ri-more-2-fill"></i></button>`;

const s = window.sanitizeText || (x => x || '');

if (vehicleType === 'microbus') {
  tr.innerHTML = `
    <td class="td-bold">${s(item.owner) || '—'}</td>
    <td>${s(item.licensePlate) || '—'}</td>
    <td>${s(item.nationalId) || '—'}</td>
    <td class="td-addr" title="${s(item.line || item.address || '')}">${s(item.line || item.address) || '—'}</td>
    <td>${s(item.phone) || '—'}</td>
    <td>${typeBadge}</td>
    <td>
      <button class="btn-details btn-show-card">🪪 بطاقة</button>
      <button class="btn-details btn-show-details" style="margin-right:4px">التفاصيل</button>
    </td>
    <td>${actionsBtn}</td>`;
} else {
  const hasCode = item.vCode && item.vCode !== '';
  tr.innerHTML = `
    <td class="td-bold">${s(item.owner) || '—'}</td>
    <td class="${hasCode ? 'td-code-yes' : 'td-code-no'}">${s(item.vCode) || '—'}</td>
    <td class="td-mono">${s(item.nationalId) || '—'}</td>
    <td class="td-addr" title="${s(item.address || '')}">${s(item.address) || '—'}</td>
    <td>${s(item.phone) || '—'}</td>
    <td>${typeBadge}</td>
    <td>
      <button class="btn-details btn-show-card">🪪 بطاقة</button>
      <button class="btn-details btn-show-details" style="margin-right:4px">التفاصيل</button>
    </td>
    <td>${actionsBtn}</td>`;
}

// ── Dropdown toggle ──
// ── Actions modal button ──
const actionsOpenBtn = tr.querySelector('.btn-open-actions');
if (actionsOpenBtn) {
  actionsOpenBtn.onclick = () => {
    const modal = document.getElementById('actionsModal');
    const title = document.getElementById('actionsModalTitle');
    const btns  = document.getElementById('actionsModalBtns');
    title.textContent = 'إجراءات — ' + (item.owner || '');
    const rows = [];
    if (vehicleType === 'tuktuk' && userRole !== 'VIEWER') {
      rows.push({ icon:'ri-exchange-line', label:'تغيير الحالة',   cls:'btn-status' });
      rows.push({ icon:'ri-hashtag',       label:'تكويد المركبة',  cls:'btn-code' });
      rows.push({ icon:'ri-pencil-line',   label:'تعديل البيانات', cls:'btn-edit' });
    }
    if (vehicleType === 'microbus' && userRole !== 'VIEWER') {
      rows.push({ icon:'ri-pencil-line', label:'تعديل البيانات', cls:'btn-edit' });
    }
    rows.push({ icon:'ri-image-line', label:`عرض الصور (${item.images ? item.images.length : 0})`, cls:'view-btn-modal' });
    btns.innerHTML = rows.map(r =>
      `<button class="action-modal-btn ${r.cls}"><i class="${r.icon}"></i>${r.label}</button>`
    ).join('');
    if (userRole === 'SUPER') {
      btns.innerHTML += `<div class="action-modal-divider"></div>
        <button class="action-modal-btn danger btn-del-modal"><i class="ri-delete-bin-line"></i>حذف السجل</button>`;
    }
    const closeModal = () => { modal.style.display = 'none'; };
    btns.querySelector('.btn-edit')?.addEventListener('click', () => { closeModal(); document.getElementById('editOwnerName').value = item.owner; document.getElementById('editPhone').value = item.phone||''; document.getElementById('editVType').value = item.vType; document.getElementById('editVYear').value = item.vYear||''; document.getElementById('editAddress').value = item.address||''; document.getElementById('editModal').style.display = 'block'; });
    btns.querySelector('.view-btn-modal')?.addEventListener('click', () => { closeModal(); if(item.images&&item.images.length>0) window.viewImages(item.images); else alert('⚠️ لا توجد صور'); });
    btns.querySelector('.btn-status')?.addEventListener('click', () => { closeModal(); document.getElementById('statusChangeModal').style.display='block'; document.getElementById('statusNote').value=''; window.currentStatusChangeItem={item,id}; });
    btns.querySelector('.btn-code')?.addEventListener('click', async () => { closeModal(); if(item.vCode){alert('⚠️ المركبة مكودة بالفعل: '+item.vCode);return;} const info=await window.getSmartNextCode(); document.getElementById('codeHint').innerText=`آخر كود: (${info.last}) | المقترح: (${info.next})`; document.getElementById('manualCodeInput').value=info.next; document.getElementById('codeModal').style.display='block'; });
    btns.querySelector('.btn-del-modal')?.addEventListener('click', async () => { closeModal(); if(!confirm('هل أنت متأكد من حذف هذا الطلب؟'))return; const{error}=await window.supabaseClient.from('orders').delete().eq('id',id); if(error){alert('❌ فشل الحذف');return;} alert('✅ تم الحذف'); window.initializePagination([]); });
    modal.style.display = 'flex';
  };
}

const detailsBtn = tr.querySelector('.btn-show-details');
if (detailsBtn) {
  detailsBtn.onclick = () => {
    const modal = document.getElementById('detailsModal');
    const content = document.getElementById('detailsContent');
    const title = document.getElementById('detailsTitle');
    title.textContent = item.owner + ' — تفاصيل المركبة';
    const fields = vehicleType === 'microbus' ? [
      ['رقم اللوحة', item.licensePlate],
      ['الخط', item.line],
      ['عدد الركاب', item.passengerCapacity],
      ['تاريخ التجديد', item.renewalDate],
      ['رقم الشاسيه', item.chassisNumber],
      ['رقم الموتور', item.motorNumber],
      ['تاريخ التسجيل', window.formatDateTime(item.timestamp)],
    ] : [
      ['نوع المركبة', item.vType],
      ['الموديل', item.vYear],
      ['رقم الشاسيه', item.chassisNumber],
      ['رقم الموتور', item.motorNumber],
      ['الرقم المرجعي', item.refNumber],
      ['الحالة', item.status],
      ['تاريخ التسجيل', window.formatDateTime(item.timestamp)],
    ];
    content.innerHTML = fields.map(([label, val]) => `
      <div class="details-item">
        <span class="details-label">${label}</span>
        <span class="details-value">${val || '—'}</span>
      </div>`).join('');
    modal.style.display = 'flex';
  };
}

// ── بطاقة المالك ──
const cardBtn = tr.querySelector('.btn-show-card');
if (cardBtn) {
  cardBtn.onclick = () => {
    const modal = document.getElementById('citizenCardModal');

    // تصفير البيانات القديمة قبل الفتح
    modal.querySelector('#cardOwner').textContent      = 'جاري التحميل...';
    modal.querySelector('#cardCode').textContent       = '—';
    modal.querySelector('#cardCodeLabel').textContent  = 'الكود';
    modal.querySelector('#cardNationalId').textContent = '—';
    modal.querySelector('#cardAddress').textContent    = '—';
    modal.querySelector('#cardPhone').textContent      = '—';

    // تحديث badge نوع المركبة
    const typeBadgeEl = modal.querySelector('#cardVehicleTypeBadge');
    if (typeBadgeEl) {
      if (vehicleType === 'microbus') {
        typeBadgeEl.textContent = '🚐 ميكروباص';
        typeBadgeEl.style.background = 'rgba(52,152,219,0.12)';
        typeBadgeEl.style.color      = 'var(--blue)';
        typeBadgeEl.style.borderColor = 'rgba(52,152,219,0.3)';
      } else {
        typeBadgeEl.textContent = '🛺 توكتوك';
        typeBadgeEl.style.background  = 'var(--gold-bg)';
        typeBadgeEl.style.color       = 'var(--gold)';
        typeBadgeEl.style.borderColor = 'var(--gold-border)';
      }
    }

    // الميكروباص: يعرض رقم اللوحة — التوكتوك: يعرض الكود
    const code      = vehicleType === 'microbus' ? (item.licensePlate || '—') : (item.vCode || '—');
    const codeLabel = vehicleType === 'microbus' ? '🚗 رقم اللوحة' : '🔢 الكود';

    modal.querySelector('#cardOwner').textContent      = item.owner       || '—';
    modal.querySelector('#cardCode').textContent       = code;
    modal.querySelector('#cardCodeLabel').textContent  = codeLabel;
    modal.querySelector('#cardNationalId').textContent = item.nationalId  || '—';
    modal.querySelector('#cardAddress').textContent    = item.address || item.line || '—';
    modal.querySelector('#cardPhone').textContent      = item.phone        || '—';
    modal.style.display = 'flex';
  };
}

// ── View images ──
const viewBtn = tr.querySelector('.view-btn');
if (viewBtn) {
viewBtn.onclick = () => {
if (item.images && item.images.length > 0) {
window.viewImages(item.images);
} else {
alert("⚠️ لا توجد صور متاحة للعرض");
}
};
}

const editBtn = tr.querySelector('.btn-edit');
if (editBtn) {
editBtn.onclick = async () => {
document.getElementById('editOwnerName').value = item.owner;
document.getElementById('editPhone').value = item.phone || '';
document.getElementById('editVType').value = item.vType;
document.getElementById('editVYear').value = item.vYear || '';
document.getElementById('editAddress').value = item.address || '';
document.getElementById('editModal').style.display = 'block';
document.getElementById('confirmEditBtn').onclick = async () => {
const newOwner = document.getElementById('editOwnerName').value.trim();
const newPhone = document.getElementById('editPhone').value.trim();
const newVType = document.getElementById('editVType').value;
const newVYear = document.getElementById('editVYear').value;
const newAddress = document.getElementById('editAddress').value.trim();
if (!newOwner || !newPhone || newPhone.length !== 11) {
alert("❌ يرجى إكمال البيانات الأساسية بشكل صحيح");
return;
}
document.getElementById('loadingSpinner').style.display = 'block';
const { error: editError2 } = await window.supabaseClient
.from('orders')
.update({
owner_name: newOwner,
phone: newPhone,
vehicle_type: newVType,
vehicle_year: newVYear,
address: newAddress,
status_history: [...(item.statusHistory || []), {
status: item.status || 'pending',
timestamp: Date.now(),
note: "تم تعديل البيانات",
by: userRole
}]
})
.eq('id', id);
if (editError2) throw editError2;
await window.logAdminAction(currentUsername, 'تعديل بيانات', `تم تعديل بيانات مركبة ${item.vType} للمالك: ${item.owner} (الرقم المرجعي: ${item.refNumber})`);
document.getElementById('loadingSpinner').style.display = 'none';
document.getElementById('editModal').style.display = 'none';
alert("✅ تم التعديل بنجاح!");
await window.loadAdminData();
};
};
}

const delBtn = tr.querySelector('.btn-del');
if (delBtn) {
delBtn.onclick = async () => {
if (confirm("⚠️ هل أنت متأكد من حذف هذا الطلب نهائياً؟")) {
try {
const { error } = await window.supabaseClient
.from("orders")
.delete()
.eq("id", id);
if (error) {
console.error('❌ خطأ في الحذف:', error);
alert("❌ فشل الحذف: " + error.message);
return;
}
await window.logAdminAction(currentUsername, 'حذف طلب', `تم حذف طلب مركبة ${item.vType} للمالك: ${item.owner} (الرقم المرجعي: ${item.refNumber})`);
alert("✅ تم الحذف بنجاح");
await window.loadAdminData();
} catch (err) {
console.error('❌ خطأ في عملية الحذف:', err);
alert("❌ حدث خطأ أثناء الحذف");
}
}
};
}

// Tuktuk-specific buttons
if (vehicleType === 'tuktuk') {
const statusBtn = tr.querySelector('.btn-status');
if (statusBtn) {
statusBtn.onclick = async () => {
document.getElementById('statusChangeModal').style.display = 'block';
document.getElementById('statusNote').value = '';
document.getElementById('sendWhatsAppStatus').checked = true;
window.currentStatusChangeItem = { item, id };
};
}

const codeBtn = tr.querySelector('.btn-code');
if (codeBtn) {
codeBtn.onclick = async () => {
if (item.vCode) {
alert("⚠️ المركبة مكودة بالفعل برقم: " + item.vCode);
return;
}
const info = await window.getSmartNextCode();
document.getElementById('codeHint').innerText = `آخر كود في النظام: (${info.last}) | الكود المقترح: (${info.next})`;
document.getElementById('manualCodeInput').value = info.next;
document.getElementById('codeModal').style.display = 'block';

// Random Code Button Handler
const randomCodeBtn = document.getElementById('randomCodeBtn');
if (randomCodeBtn) {
randomCodeBtn.onclick = async () => {
const randomCode = await window.getRandomAvailableCode();
document.getElementById('manualCodeInput').value = randomCode;
};
}

document.getElementById('confirmCodeBtn').onclick = async () => {
const newCode = document.getElementById('manualCodeInput').value;
if (!newCode) {
alert("❌ يرجى إدخال كود صحيح");
return;
}
document.getElementById('loadingSpinner').style.display = 'block';
try {
const { data: existingCode, error: checkError } = await window.supabaseClient
.from('orders')
.select('id, owner_name, code')
.eq('code', newCode.toString())
.single();
if (existingCode) {
document.getElementById('loadingSpinner').style.display = 'none';
alert(`❌ الكود ${newCode} مستخدم بالفعل!\n\n👤 المالك: ${existingCode.owner_name}\n\n⚠️ يرجى استخدام كود آخر`);
return;
}
const { error } = await window.supabaseClient
.from('orders')
.update({
code: newCode.toString(),
coded_at: Date.now(),
status: "coded",
status_history: [...(item.statusHistory || []), {
status: "coded",
timestamp: Date.now(),
note: `تم التكويد برقم: ${newCode}`,
by: userRole
}]
})
.eq('id', id);
if (error) {
console.error('❌ خطأ في تكويد المركبة:', error);
throw error;
}
await window.logAdminAction(currentUsername, 'تكويد مركبة', `تم تكويد مركبة ${item.vType} للمالك: ${item.owner} بالكود: ${newCode}`);
document.getElementById('loadingSpinner').style.display = 'none';
document.getElementById('codeModal').style.display = 'none';
const sendWhatsApp = document.getElementById('sendWhatsAppCode').checked;
if (sendWhatsApp) {
const message = `🎉 *تم تكويد مركبتك بنجاح!*\n\n` +
`👤 السيد/ة: ${item.owner}\n` +
`🔢 كود المركبة: *${newCode}*\n` +
`🚜 نوع المركبة: ${item.vType}\n` +
`📋 الرقم المرجعي: ${item.refNumber}\n\n` +
`✅ يمكنك الآن استلام المركبة من المقر\n\n` +
`_رئاسة مركز ومدينة كفر صقر_`;
if (item.phone && item.phone.length === 11) {
const whatsappUrl = `https://wa.me/2${item.phone}?text=${encodeURIComponent(message)}`;
window.open(whatsappUrl, '_blank');
}
}
alert("✅ تم التكويد بنجاح!" + (sendWhatsApp && item.phone && item.phone.length === 11 ? "\n📱 تم فتح واتساب لإرسال الإشعار" : ""));
await window.loadAdminData();
} catch (error) {
document.getElementById('loadingSpinner').style.display = 'none';
console.error('❌ خطأ في عملية التكويد:', error);
alert(`❌ حدث خطأ أثناء التكويد:\n\n${error.message || error.toString()}\n\nيرجى المحاولة مرة أخرى`);
}
};
};
}
}

// Add green background for sticker_applied status
if (item.status === 'sticker_applied') {
tr.style.background = 'linear-gradient(135deg, rgba(22, 160, 133, 0.25) 0%, rgba(46, 204, 113, 0.25) 100%)';
tr.style.borderLeft = '4px solid #16a085';
}

return tr;
}

window.createTableRow = createTableRow;

async function loadAdminData() {
  // الـ pagination.js هو المسؤول عن تحميل البيانات من Supabase
  // loadAdminData بتستدعي loadPage(1) بس
  if (typeof loadPage === 'function') {
    await loadPage(1);
  } else if (typeof initializePagination === 'function') {
    initializePagination([]);
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
      badge.style.display = (newReqs > 0) ? 'inline-flex' : 'none';
    }
  } catch (err) {
    console.warn('⚠️ تعذّر تحديث الشارات:', err);
  }
}
window.updateSidebarBadges = updateSidebarBadges;

// Upload Excel Data
window.uploadExcelData = async function(file, vehicleType = 'ميكروباص', images = []) {
// ── التحقق من نوع المركبة — عزل تام بين النظامين ──
const VALID_TYPES = ['توكتوك', 'ميكروباص'];
if (!VALID_TYPES.includes(vehicleType)) {
  alert(`❌ نوع المركبة غير صحيح: "${vehicleType}"\nالقيم المقبولة: توكتوك أو ميكروباص`);
  return;
}
try {
// التحقق من وجود مكتبة XLSX
if (typeof XLSX === 'undefined') {
alert('❌ مكتبة XLSX غير محملة. يرجى إضافة المكتبة أولاً.');
console.error('XLSX library not loaded');
return;
}

const reader = new FileReader();
reader.onload = async function(e) {
try {
const data = new Uint8Array(e.target.result);
const workbook = XLSX.read(data, { type: 'array' });
const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
const jsonData = XLSX.utils.sheet_to_json(firstSheet);


// عرض أسماء الأعمدة المتاحة في الملف
if (jsonData.length > 0) {
}

// Show progress
document.getElementById('loadingSpinner').style.display = 'block';

let successCount = 0;
let errorCount = 0;
let duplicateCount = 0;

// Load existing data to check for duplicates
let existingRecords = [];
let from = 0;
const checkBatchSize = 1000;
let hasMore = true;

while (hasMore) {
const { data: batch, error } = await window.supabaseClient
.from('orders')
.select('*')
.range(from, from + checkBatchSize - 1);

if (error) {
console.error('Error loading existing records:', error);
break;
}

if (batch && batch.length > 0) {
existingRecords = existingRecords.concat(batch);
from += checkBatchSize;
hasMore = batch.length === checkBatchSize;
} else {
hasMore = false;
}
}

// Create Sets for fast lookup
const existingLicensePlates = new Set(
existingRecords
.filter(r => r.license_plate)
.map(r => r.license_plate.trim().toLowerCase())
);
const existingNationalIds = new Set(
existingRecords
.filter(r => r.national_id)
.map(r => r.national_id.trim())
);


// Convert images to base64 if provided
let imageDataArray = [];
if (images.length > 0) {
for (const imgFile of images) {
try {
const base64 = await new Promise((resolve, reject) => {
const imgReader = new FileReader();
imgReader.onload = () => resolve(imgReader.result);
imgReader.onerror = reject;
imgReader.readAsDataURL(imgFile);
});
imageDataArray.push(base64);
} catch (err) {
console.error('Error converting image:', err);
}
}
}

for (const row of jsonData) {
try {
// Extract data first - دعم أسماء أعمدة متعددة
const licensePlate = (row['رقم السيارة'] || row['رقم اللوحة'] || row['اللوحة'] || row['licensePlate'] || row['plate'] || '').toString().trim();
const nationalId = (row['الرقم القومي'] || row['رقم قومي'] || row['القومي'] || row['nationalId'] || row['national_id'] || '').toString().trim();
const ownerName = (row['إسم المالك'] || row['اسم المالك'] || row['الاسم'] || row['name'] || row['owner'] || '').toString().trim();

// Check for duplicates
let isDuplicate = false;
let duplicateReason = '';

if (vehicleType === 'ميكروباص' && licensePlate) {
if (existingLicensePlates.has(licensePlate.toLowerCase())) {
isDuplicate = true;
duplicateReason = `رقم السيارة ${licensePlate} موجود بالفعل`;
}
} else if (vehicleType === 'توكتوك' && nationalId) {
if (existingNationalIds.has(nationalId)) {
isDuplicate = true;
duplicateReason = `الرقم القومي ${nationalId} موجود بالفعل`;
}
}

if (isDuplicate) {
console.warn(`⚠️ تكرار: ${duplicateReason} - ${ownerName}`);
duplicateCount++;
continue; // Skip duplicate
}

// Generate ref_number
const refNumber = 'REF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();

// تحويل البيانات من Excel - دعم أعمدة متعددة
const orderData = {
owner_name: ownerName,
phone: String(row['الهاتف'] || row['رقم الهاتف'] || row['التليفون'] || row['phone'] || row['mobile'] || ''),
vehicle_type: vehicleType, // استخدام نوع المركبة المختار
license_plate: licensePlate,
address: row['الخط'] || row['العنوان'] || row['address'] || row['line'] || '',
vehicle_year: String(row['موديل السنة'] || row['الموديل'] || row['السنة'] || row['year'] || row['model'] || ''),
chassis_number: String(row['رقم الشاسية'] || row['الشاسيه'] || row['شاسيه'] || row['chassis'] || row['chassis_number'] || ''),
motor_number: String(row['رقم الموتور'] || row['الموتور'] || row['موتور'] || row['motor'] || row['motor_number'] || ''),
passenger_capacity: String(row['عدد الركاب'] || row['السعة'] || row['capacity'] || row['passenger_capacity'] || ''),
renewal_date: String(row['تاريخ التجديد'] || row['التاريخ'] || row['التجديد'] || row['renewal_date'] || row['date'] || ''),
line: row['الخط'] || row['إسم الخط'] || row['خط السير'] || row['line'] || '',
ref_number: refNumber,
status: 'completed',
submitted_at: Date.now(),
images: imageDataArray
};

// التحقق من البيانات الأساسية
if (!orderData.owner_name) {
console.warn('⚠️ سجل غير مكتمل (اسم المالك مفقود):', row);
errorCount++;
continue;
}

// حفظ في قاعدة البيانات
const { error } = await window.supabaseClient
.from('orders')
.insert([orderData]);

if (error) {
console.error('❌ خطأ في حفظ السجل:', error);
console.error('📋 بيانات السجل الذي فشل:', orderData);
errorCount++;
} else {
successCount++;
// Add to existing sets to prevent duplicates within same file
if (licensePlate) existingLicensePlates.add(licensePlate.toLowerCase());
if (nationalId) existingNationalIds.add(nationalId);
}
} catch (rowError) {
console.error('❌ خطأ في معالجة السجل:', rowError);
console.error('📋 الصف الذي فشل:', row);
errorCount++;
}
}

document.getElementById('loadingSpinner').style.display = 'none';

alert(`✅ تم رفع ${successCount} سجل ${vehicleType} بنجاح${imageDataArray.length > 0 ? ' مع ' + imageDataArray.length + ' صورة' : ''}\n${duplicateCount > 0 ? `⚠️ تم تجاهل ${duplicateCount} سجل مكرر\n` : ''}${errorCount > 0 ? `❌ فشل ${errorCount} سجل` : ''}`);

// إعادة تحميل البيانات
await loadAdminData();
} catch (error) {
document.getElementById('loadingSpinner').style.display = 'none';
console.error('❌ خطأ في قراءة ملف Excel:', error);
alert('❌ حدث خطأ في قراءة ملف Excel');
}
};

reader.readAsArrayBuffer(file);
} catch (error) {
console.error('❌ خطأ في رفع الملف:', error);
alert('❌ حدث خطأ في رفع الملف');
}
};

// Load Complaints
async function loadComplaints() {

try {
const { data: complaints, error } = await window.supabaseClient
.from('complaints')
.select('*')
.order('submitted_at', { ascending: false });

if (error) throw error;

const tableBody = document.getElementById('compTableBody');
tableBody.innerHTML = '';

// Update complaints badge
const compBadge = document.getElementById('compBadge');
if (compBadge) {
  const pending = complaints ? complaints.filter(c => c.status !== 'replied').length : 0;
  compBadge.textContent = pending;
  compBadge.style.display = pending > 0 ? 'inline-flex' : 'none';
}

if (!complaints || complaints.length === 0) {
tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #999;">لا توجد شكاوى</td></tr>';
return;
}

const role = getRole();

complaints.forEach((complaint) => {
const statusColor = complaint.status === 'replied' ? 'var(--secondary)' : 'var(--warning)';
const statusText = complaint.status === 'replied' ? '✅ تم الرد' : '⏳ قيد المراجعة';

const tr = document.createElement('tr');
tr.style.background = 'rgba(255, 255, 255, 0.85)';

const s = window.sanitizeText;
tr.innerHTML = `
<td style="padding: 18px; font-weight: 600;">${s(complaint.owner_name) || 'غير محدد'}</td>
<td style="padding: 18px; font-family: monospace;">${s(complaint.phone) || '-'}</td>
<td style="padding: 18px;"><span style="background: rgba(211, 84, 0, 0.1); color: var(--accent); padding: 6px 12px; border-radius: 8px; font-weight: 600;">${s(complaint.complaint_type) || 'غير محدد'}</span></td>
<td style="padding: 18px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${s(complaint.details) || '-'}">${s(complaint.details) || '-'}</td>
<td style="padding: 18px; text-align: center;">
<button class="btn btn-view-complaint-images" style="background: rgba(26, 82, 118, 0.12); color: var(--primary); padding: 8px 16px; font-weight: 600;">🖼️ عرض الصور</button>
</td>
<td style="padding: 18px;"><span style="background: ${statusColor}; color: white; padding: 6px 12px; border-radius: 8px; font-weight: bold;">${statusText}</span></td>
<td style="padding: 18px; display: flex; gap: 8px; flex-wrap: wrap;">
<button class="btn btn-reply-complaint" style="background: linear-gradient(135deg, var(--secondary) 0%, #229954 100%); color: white; padding: 8px 16px; font-weight: 600; display: ${role === 'VIEWER' ? 'none' : 'inline-flex'};">رد</button>
<button class="btn btn-delete-complaint" style="background: linear-gradient(135deg, var(--danger) 0%, #c0392b 100%); color: white; padding: 8px 16px; font-weight: 600; display: ${role === 'SUPER' ? 'inline-flex' : 'none'};">حذف</button>
</td>
${complaint.status === 'replied' && complaint.reply ? `<td style="padding:18px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--green);font-size:0.78rem;" title="${window.sanitizeText ? window.sanitizeText(complaint.reply) : complaint.reply}">${window.sanitizeText ? window.sanitizeText(complaint.reply).substring(0,60) : complaint.reply.substring(0,60)}...</td>` : `<td style="padding:18px;color:var(--text3);font-size:0.78rem;">لم يُرد بعد</td>`}
`;

// View images button
tr.querySelector('.btn-view-complaint-images').onclick = () => {
if (complaint.images) {
if (typeof complaint.images === 'object' && !Array.isArray(complaint.images)) {
showCategorizedImages(complaint.images);
} else if (Array.isArray(complaint.images)) {
viewImages(complaint.images);
}
} else {
alert("⚠️ لا توجد صور متاحة للعرض");
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
if (!confirm(`⚠️ هل أنت متأكد من حذف هذه الشكوى؟\n\nالمقدم من: ${complaint.owner_name}\nالنوع: ${complaint.complaint_type}\n\n⚠️ هذا الإجراء لا يمكن التراجع عنه!`)) {
return;
}

document.getElementById('loadingSpinner').style.display = 'block';

try {
const { error } = await window.supabaseClient
.from('complaints')
.delete()
.eq('id', complaint.id);

if (error) {
console.error('❌ خطأ في حذف الشكوى:', error);
throw error;
}

// Log delete action
await logAdminAction(currentUsername, 'حذف شكوى', `تم حذف شكوى من نوع: ${complaint.complaint_type} للمواطن: ${complaint.owner_name}`);

document.getElementById('loadingSpinner').style.display = 'none';
alert("✅ تم حذف الشكوى بنجاح!");

// Reload complaints
await loadComplaints();

} catch (error) {
document.getElementById('loadingSpinner').style.display = 'none';
console.error('❌ خطأ في حذف الشكوى:', error);
alert(`❌ حدث خطأ أثناء حذف الشكوى:\n\n${error.message || error.toString()}\n\nيرجى المحاولة مرة أخرى`);
}
};
}

tableBody.appendChild(tr);
});

} catch (error) {
console.error('❌ خطأ في تحميل الشكاوى:', error);
document.getElementById('compTableBody').innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--danger);">حدث خطأ في تحميل الشكاوى</td></tr>';
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
    if (toolbar) toolbar.style.display = isTableSection ? 'flex' : 'none';
    if (chips)   chips.style.display   = isTableSection ? 'block' : 'none';
    if (topPag)  topPag.style.display  = isTableSection ? 'flex' : 'none';
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
if (!window.currentStatusChangeItem) return;

const { item, id } = window.currentStatusChangeItem;
const note = document.getElementById('statusNote').value.trim();
const sendWhatsApp = document.getElementById('sendWhatsAppStatus').checked;
const userRole = window.userRole || sessionStorage.getItem('userRole') || 'ADMIN';
const currentUsername = window.currentUsername || sessionStorage.getItem('username') || 'مجهول';

const newStatus = 'sticker_applied';

if (!id) {
alert("❌ خطأ: معرف الطلب غير موجود");
return;
}

document.getElementById('loadingSpinner').style.display = 'block';

try {
// Update only status (status_history column doesn't exist in database)
const { error: statusError } = await window.supabaseClient
.from('orders')
.update({
status: newStatus
})
.eq('id', id);

if (statusError) {
console.error('❌ خطأ في تغيير الحالة:', statusError);
console.error('❌ تفاصيل الخطأ:', JSON.stringify(statusError, null, 2));
console.error('❌ ID:', id);
console.error('❌ newStatus:', newStatus);
alert(`❌ خطأ في تغيير الحالة:\n${statusError.message || statusError.hint || JSON.stringify(statusError)}`);
throw statusError;
}

await logAdminAction(currentUsername, 'لصق ملصق', `تم لصق الملصق على مركبة ${item.vType} للمالك: ${item.owner} (الرقم المرجعي: ${item.refNumber})`);

if (sendWhatsApp && item.phone && item.phone.length === 11) {
const message = `🏷️ *تم لصق الملصق!*\n\n` +
`👤 السيد/ة: ${item.owner}\n` +
`🚜 نوع المركبة: ${item.vType}\n` +
`🔢 كود المركبة: ${item.vCode || 'غير مكود'}\n` +
`📋 الرقم المرجعي: ${item.refNumber}\n\n` +
`✅ تم لصق الملصق الجديد على مركبتك\n\n` +
`_رئاسة مركز ومدينة كفر صقر_`;
const whatsappUrl = `https://wa.me/2${item.phone}?text=${encodeURIComponent(message)}`;
window.open(whatsappUrl, '_blank');
}

document.getElementById('loadingSpinner').style.display = 'none';
document.getElementById('statusChangeModal').style.display = 'none';
alert("✅ تم لصق الملصق بنجاح!" + (sendWhatsApp && item.phone && item.phone.length === 11 ? "\n📱 تم فتح واتساب لإرسال الإشعار" : ""));
await loadAdminData();
} catch (error) {
document.getElementById('loadingSpinner').style.display = 'none';
console.error('❌ خطأ:', error);
alert(`❌ حدث خطأ: ${error.message}`);
}
};
}

// Status Change Modal Handler - NO Button (Remove Sticker)
const confirmStickerNoBtn = document.getElementById('confirmStickerNoBtn');
if (confirmStickerNoBtn) {
confirmStickerNoBtn.onclick = async () => {
if (!window.currentStatusChangeItem) return;

const { item, id } = window.currentStatusChangeItem;
const note = document.getElementById('statusNote').value.trim();
const userRole = window.userRole || sessionStorage.getItem('userRole') || 'ADMIN';
const currentUsername = window.currentUsername || sessionStorage.getItem('username') || 'مجهول';

// إرجاع الحالة إلى "تم التكويد" أو "pending" حسب وجود كود
const newStatus = item.vCode ? 'coded' : 'pending';

if (!id) {
alert("❌ خطأ: معرف الطلب غير موجود");
return;
}

if (!confirm("⚠️ هل أنت متأكد من إلغاء/إزالة الملصق؟\nسيتم إرجاع الحالة إلى الوضع الطبيعي")) {
return;
}

document.getElementById('loadingSpinner').style.display = 'block';

try {
// Update only status (status_history column doesn't exist in database)
const { error: statusError } = await window.supabaseClient
.from('orders')
.update({
status: newStatus
})
.eq('id', id);

if (statusError) {
console.error('❌ خطأ في تغيير الحالة:', statusError);
throw statusError;
}

await logAdminAction(currentUsername, 'إلغاء ملصق', `تم إلغاء الملصق من مركبة ${item.vType} للمالك: ${item.owner} (الرقم المرجعي: ${item.refNumber})`);

document.getElementById('loadingSpinner').style.display = 'none';
document.getElementById('statusChangeModal').style.display = 'none';
alert("✅ تم إلغاء الملصق وإرجاع الحالة إلى الوضع الطبيعي");
await loadAdminData();
} catch (error) {
document.getElementById('loadingSpinner').style.display = 'none';
console.error('❌ خطأ:', error);
alert(`❌ حدث خطأ: ${error.message}`);
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
if (!window.currentComplaintReply) return;

const { item, id } = window.currentComplaintReply;
const reply = document.getElementById('complaintReplyText').value.trim();
const sendWhatsApp = document.getElementById('sendWhatsAppReply').checked;

if (!reply) {
alert("❌ يرجى كتابة نص الرد");
return;
}

if (!id) {
alert("❌ خطأ: معرف الشكوى غير موجود");
console.error('Missing complaint ID:', window.currentComplaintReply);
return;
}

document.getElementById('loadingSpinner').style.display = 'block';

try {
const { error } = await window.supabaseClient
.from('complaints')
.update({
reply: reply,
status: 'replied'
})
.eq('id', id);

if (error) {
console.error('❌ خطأ في تحديث الشكوى:', error);
throw error;
}

// Log complaint reply action
await logAdminAction(currentUsername, 'الرد على شكوى', `تم الرد على شكوى من نوع: ${item.type} للمواطن: ${item.ownerName}`);

// Send WhatsApp notification if checkbox is checked
if (sendWhatsApp && item.phone && item.phone.length === 11) {
const message = `✅ *تم الرد على شكواك!*\n\n` +
`👤 السيد/ة: ${item.ownerName}\n` +
`📋 نوع الشكوى: ${item.type}\n\n` +
`💬 *الرد من الإدارة:*\n${reply}\n\n` +
`📞 للاستفسار: 01021102607\n\n` +
`_رئاسة مركز ومدينة كفر صقر_`;

const whatsappUrl = `https://wa.me/2${item.phone}?text=${encodeURIComponent(message)}`;
window.open(whatsappUrl, '_blank');
}

document.getElementById('loadingSpinner').style.display = 'none';
document.getElementById('complaintReplyModal').style.display = 'none';
alert("✅ تم حفظ الرد بنجاح!" + (sendWhatsApp && item.phone && item.phone.length === 11 ? "\n📱 تم فتح واتساب لإرسال الرد" : ""));

// Reload complaints to show updated data
await loadComplaints();

} catch (error) {
document.getElementById('loadingSpinner').style.display = 'none';
console.error('❌ خطأ في الرد على الشكوى:', error);
alert(`❌ حدث خطأ أثناء حفظ الرد:\n\n${error.message || error.toString()}\n\nيرجى المحاولة مرة أخرى`);
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
  // جلب كل الأكواد من Supabase مباشرة
  let allCodes = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: batch, error } = await window.supabaseClient
      .from('orders')
      .select('code, owner_name, phone, national_id')
      .not('code', 'is', null)
      .neq('code', '')
      .range(from, from + batchSize - 1);

    if (error) throw error;
    if (batch && batch.length > 0) {
      allCodes = allCodes.concat(batch);
      from += batchSize;
      hasMore = batch.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  const usedCodes = new Set();
  const usedCodesDetails = {};
  let maxUsedCode = 0;

  allCodes.forEach(item => {
    if (!item.code) return;
    const codeNum = parseInt(item.code);
    if (isNaN(codeNum)) return;
    usedCodes.add(item.code.trim());
    usedCodesDetails[item.code.trim()] = {
      owner: item.owner_name || 'غير محدد',
      phone: item.phone || 'غير محدد',
      nationalId: item.national_id || 'غير محدد'
    };
    if (codeNum > maxUsedCode) maxUsedCode = codeNum;
  });

  const codeEnd = maxUsedCode > 0 ? maxUsedCode : 100;
  const availableCodes = [];
  for (let i = 1; i <= codeEnd; i++) {
    if (!usedCodes.has(i.toString())) availableCodes.push(i.toString());
  }

  window.codeRangeEnd = codeEnd;
  window.maxUsedCode = maxUsedCode;
  window.usedCodesDetails = usedCodesDetails;

  document.getElementById('totalCodesCount').textContent = `${codeEnd} (آخر كود: ${maxUsedCode})`;
  document.getElementById('availableCodesCount').textContent = availableCodes.length;
  document.getElementById('usedCodesCount').textContent = usedCodes.size;

  const codesList = document.getElementById('availableCodesList');
  codesList.innerHTML = '';

  if (availableCodes.length === 0) {
    codesList.innerHTML = `<p style="text-align:center;color:#e74c3c;font-size:1.2rem;padding:40px;grid-column:1/-1;">✅ جميع الأكواد من 1 إلى ${maxUsedCode} مستخدمة!</p>`;
  } else {
    availableCodes.forEach(code => {
      const codeBox = document.createElement('div');
      codeBox.style.cssText = 'background:linear-gradient(135deg,#27ae60,#2ecc71);color:white;padding:12px;border-radius:10px;text-align:center;font-weight:700;font-size:1.1rem;box-shadow:0 4px 10px rgba(39,174,96,0.3);cursor:pointer;transition:all 0.3s;';
      codeBox.textContent = code;
      codeBox.onmouseover = function() { this.style.transform='translateY(-5px)'; this.style.boxShadow='0 8px 20px rgba(39,174,96,0.5)'; };
      codeBox.onmouseout  = function() { this.style.transform='translateY(0)';    this.style.boxShadow='0 4px 10px rgba(39,174,96,0.3)'; };
      codeBox.onclick = function() {
        document.getElementById('searchCodeInput').value = code;
        searchForCode();
      };
      codesList.appendChild(codeBox);
    });
  }
} catch (e) {
  console.error('❌ خطأ في جلب الأكواد:', e);
  alert('❌ خطأ في تحميل الأكواد: ' + e.message);
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
resultDiv.style.background = 'rgba(243, 156, 18, 0.15)';
resultDiv.style.border = '2px solid #f39c12';
resultDiv.style.color = '#f39c12';
resultDiv.innerHTML = '⚠️ يرجى إدخال رقم الكود';
return;
}

const codeNum = parseInt(codeToSearch);
const maxCode = window.codeRangeEnd || 2500; // استخدام الرقم من الإعدادات
if (codeNum < 1 || codeNum > maxCode) {
resultDiv.style.display = 'block';
resultDiv.style.background = 'rgba(231, 76, 60, 0.15)';
resultDiv.style.border = '2px solid #e74c3c';
resultDiv.style.color = '#e74c3c';
resultDiv.innerHTML = `❌ رقم الكود يجب أن يكون بين 1 و ${maxCode}<br><small style="font-size: 0.9rem;">(آخر كود مستخدم في النظام: ${window.maxUsedCode || maxCode})</small>`;
return;
}

// Check if code is used
if (window.usedCodesDetails && window.usedCodesDetails[codeToSearch]) {
const details = window.usedCodesDetails[codeToSearch];
resultDiv.style.display = 'block';
resultDiv.style.background = 'rgba(231, 76, 60, 0.15)';
resultDiv.style.border = '2px solid #e74c3c';
resultDiv.style.color = '#e74c3c';
resultDiv.innerHTML = `
<div style="text-align: right; padding: 10px;">
<p style="margin: 5px 0; font-size: 1.2rem;">🔴 الكود <strong>${window.sanitizeText(codeToSearch)}</strong> محجوز</p>
<hr style="margin: 15px 0; border: none; border-top: 2px solid rgba(231, 76, 60, 0.3);">
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
resultDiv.style.background = 'rgba(243, 156, 18, 0.15)';
resultDiv.style.border = '2px solid #f39c12';
resultDiv.style.color = '#f39c12';
resultDiv.innerHTML = `⚠️ الكود <strong>${codeToSearch}</strong> خارج النطاق الحالي<br><small style="font-size: 0.9rem;">(آخر كود مستخدم: ${window.maxUsedCode || 0})</small>`;
} else {
resultDiv.style.display = 'block';
resultDiv.style.background = 'rgba(39, 174, 96, 0.15)';
resultDiv.style.border = '2px solid #27ae60';
resultDiv.style.color = '#27ae60';
resultDiv.innerHTML = `✅ الكود <strong>${codeToSearch}</strong> متاح ويمكن استخدامه`;
}
}
}

// Filter functions for stat cards
function showAllOrders() {
    window._newRequestsMode = false;
    window.currentFilter = 'all';
    if (typeof loadPage === 'function') loadPage(1);
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
      if (!from && !to) { alert('⚠️ يرجى تحديد تاريخ واحد على الأقل'); return; }
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

let html = `
<div style="background: linear-gradient(135deg, rgba(52, 73, 94, 0.1) 0%, rgba(44, 62, 80, 0.1) 100%); padding: 20px; border-radius: 15px; margin-bottom: 20px; border: 2px solid #34495e;">
<h4 style="color: #34495e; margin: 0 0 10px 0;">معلومات الطلب:</h4>
<p style="margin: 5px 0;"><strong>المالك:</strong> ${window.sanitizeText(item.owner)}</p>
<p style="margin: 5px 0;"><strong>الرقم المرجعي:</strong> ${window.sanitizeText(item.refNumber) || 'N/A'}</p>
<p style="margin: 5px 0;"><strong>نوع المركبة:</strong> ${window.sanitizeText(item.vType)}</p>
</div>
`;

if (history.length === 0) {
html += '<p style="text-align: center; color: #999; padding: 40px;">لا يوجد سجل عمليات</p>';
} else {
html += '<div style="position: relative; padding-right: 30px;">';
history.forEach((log, index) => {
const statusInfo = window.getStatusDisplay(log.status);
const isLast = index === history.length - 1;
html += `
<div style="position: relative; margin-bottom: 25px;">
<div style="position: absolute; right: -30px; top: 0; width: 20px; height: 20px; background: ${statusInfo.color}; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.2);"></div>
${!isLast ? '<div style="position: absolute; right: -21px; top: 20px; width: 2px; height: calc(100% + 25px); background: #ddd;"></div>' : ''}
<div style="background: white; padding: 20px; border-radius: 15px; border: 2px solid ${statusInfo.color}; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
<span style="background: ${statusInfo.color}; color: white; padding: 6px 12px; border-radius: 8px; font-weight: bold; font-size: 0.9rem;">${statusInfo.icon} ${statusInfo.text}</span>
<span style="color: #999; font-size: 0.85rem;">${window.formatDateTime(log.timestamp)}</span>
</div>
${log.note ? `<p style="margin: 10px 0 0 0; color: #555; line-height: 1.6;">${window.sanitizeText(log.note)}</p>` : ''}
${log.by ? `<p style="margin: 10px 0 0 0; color: #999; font-size: 0.85rem;">بواسطة: ${log.by === 'SUPER' ? 'مدير عام' : log.by === 'ADMIN' ? 'مشرف' : window.sanitizeText(log.by)}</p>` : ''}
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
const { data: logs, error } = await window.supabaseClient
.from('admin_logs')
.select('*')
.order('logged_at', { ascending: false });

if (error) throw error;

const tableBody = document.getElementById('adminLogsTableBody');
tableBody.innerHTML = '';

if (!logs || logs.length === 0) {
tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: #999;">لا يوجد سجل عمليات</td></tr>';
return;
}

logs.forEach(item => {
const roleIcon = item.role === 'SUPER' ? '👑' : item.role === 'ADMIN' ? '🔧' : '👁️';
const roleText = item.role === 'SUPER' ? 'مدير عام' : item.role === 'ADMIN' ? 'مشرف' : 'عرض فقط';

const tr = document.createElement('tr');
tr.innerHTML = `
<td style="padding: 18px; background: rgba(255, 255, 255, 0.85); font-weight:bold;">
<span style="background: ${item.role === 'SUPER' ? '#e74c3c' : item.role === 'ADMIN' ? '#3498db' : '#95a5a6'}; color: white; padding: 6px 12px; border-radius: 8px; font-size: 0.9rem;">
${roleIcon} ${window.sanitizeText(item.username)}
</span>
<br><small style="color: #999; font-size: 0.85rem;">${roleText}</small>
</td>
<td style="padding: 18px; background: rgba(255, 255, 255, 0.85); font-weight:600; color: var(--primary);">${window.sanitizeText(item.action)}</td>
<td style="padding: 18px; background: rgba(255, 255, 255, 0.85); color: #555;">${window.sanitizeText(item.details)}</td>
<td style="padding: 18px; background: rgba(255, 255, 255, 0.85); font-size:0.9rem; color:#666;">${window.formatDateTime(item.logged_at)}</td>
<td style="padding: 18px; background: rgba(255, 255, 255, 0.85); font-family: monospace; color: #999;">${item.ip_address || 'N/A'}</td>
`;
tableBody.appendChild(tr);
});

} catch (error) {
console.error('❌ خطأ في تحميل سجل المشرفين:', error);
document.getElementById('adminLogsTableBody').innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--danger);">❌ حدث خطأ في تحميل السجل</td></tr>';
}
}

// Export Excel - Enhanced Version
{
  const exportExcelBtn = document.getElementById('exportExcelBtn');
  if (exportExcelBtn) {
  exportExcelBtn.onclick = async () => {
if (!confirm('📊 هل تريد تصدير كل البيانات إلى Excel؟\n\n✅ سيتم تصدير:\n• الإحصائيات الكاملة\n• جميع بيانات المركبات (بدون صور)\n• جميع الشكاوى (بدون صور)\n\nقد يستغرق الأمر بضع ثوانٍ...')) {
return;
}

const loadingDiv = document.createElement('div');
loadingDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:30px;border-radius:15px;box-shadow:0 10px 40px rgba(0,0,0,0.3);z-index:10000;text-align:center;';
loadingDiv.innerHTML = '<div style="font-size:3rem;margin-bottom:15px;">📊</div><div style="font-size:1.2rem;color:#333;font-weight:600;">جاري تصدير البيانات...</div><div style="margin-top:10px;color:#666;">يرجى الانتظار</div>';
document.body.appendChild(loadingDiv);

try {
// Load all vehicles data from Supabase
let allVehicles = [];
let from = 0;
const batchSize = 1000;
let hasMore = true;

while (hasMore) {
const { data: batch, error } = await window.supabaseClient
.from('orders')
.select('*')
.order('submitted_at', { ascending: false })
.range(from, from + batchSize - 1);

if (error) throw error;

if (batch && batch.length > 0) {
allVehicles = allVehicles.concat(batch);
from += batchSize;
hasMore = batch.length === batchSize;
} else {
hasMore = false;
}
}

// Load all complaints data
const { data: allComplaints, error: compError } = await window.supabaseClient
.from('complaints')
.select('*')
.order('submitted_at', { ascending: false });

if (compError) throw compError;

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
const formattedDate = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} - ${date.getHours() > 12 ? date.getHours() - 12 : date.getHours()}:${String(date.getMinutes()).padStart(2, '0')} ${date.getHours() >= 12 ? 'م' : 'ص'}`;

// Status text
const statusText = vehicle.status === 'coded' ? '✅ تم التكويد' : '⏳ قيد الانتظار';

vehiclesData.push([
vehicle.owner_name || '-',
vehicle.national_id || '-',
vehicle.phone || '-',
vehicle.vehicle_type || '-',
vehicle.plate_number || '-',
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
const formattedDate = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} - ${date.getHours() > 12 ? date.getHours() - 12 : date.getHours()}:${String(date.getMinutes()).padStart(2, '0')} ${date.getHours() >= 12 ? 'م' : 'ص'}`;

// Status text
const statusText = complaint.status === 'replied' ? '✅ تم الرد' : '⏳ قيد المراجعة';

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

document.body.removeChild(loadingDiv);
alert(`✅ تم تصدير البيانات بنجاح!\n\n📊 الإحصائيات:\n• ${totalVehicles} مركبة\n• ${totalComplaints} شكوى\n\n📁 الملف: ${fileName}`);

} catch (error) {
document.body.removeChild(loadingDiv);
console.error('❌ خطأ في التصدير:', error);
alert('❌ حدث خطأ أثناء تصدير البيانات: ' + error.message);
}
};
  } // end if exportExcelBtn
} // end block

// Clean Duplicates Main Button (same as cleanDuplicatesBtn)
const cleanDuplicatesMainBtn = document.getElementById('cleanDuplicatesMainBtn');
if (cleanDuplicatesMainBtn) {
cleanDuplicatesMainBtn.onclick = async () => {
if (!confirm('🧹 هل تريد حذف السجلات المكررة؟\n\nسيتم:\n✅ حذف التكرار من قاعدة البيانات\n✅ حذف التكرار من لوحة التحكم\n✅ الاحتفاظ بأحدث سجل فقط')) {
return;
}

const loadingDiv = document.createElement('div');
loadingDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:30px;border-radius:15px;box-shadow:0 10px 40px rgba(0,0,0,0.3);z-index:10000;text-align:center;';
loadingDiv.innerHTML = '<div style="font-size:3rem;margin-bottom:15px;">🧹</div><div style="font-size:1.2rem;color:#333;font-weight:600;">جاري حذف السجلات المكررة...</div><div style="margin-top:10px;color:#666;">يرجى الانتظار</div>';
document.body.appendChild(loadingDiv);

try {
// Load all data from Supabase (with pagination)
let allOrders = [];
let from = 0;
const batchSize = 1000;
let hasMore = true;

while (hasMore) {
const { data: batch, error } = await window.supabaseClient
.from('orders')
.select('*')
.order('submitted_at', { ascending: false })
.range(from, from + batchSize - 1);

if (error) throw error;

if (batch && batch.length > 0) {
allOrders = allOrders.concat(batch);
from += batchSize;
hasMore = batch.length === batchSize;
} else {
hasMore = false;
}
}


// Find duplicates by national_id
const seenNIDs = new Map();
const duplicateIds = [];

allOrders.forEach(order => {
if (!order.national_id) return;

if (seenNIDs.has(order.national_id)) {
const existing = seenNIDs.get(order.national_id);
const existingDate = new Date(existing.submitted_at || 0);
const currentDate = new Date(order.submitted_at || 0);

if (currentDate > existingDate) {
duplicateIds.push(existing.id);
seenNIDs.set(order.national_id, order);
} else {
duplicateIds.push(order.id);
}
} else {
seenNIDs.set(order.national_id, order);
}
});


if (duplicateIds.length === 0) {
loadingDiv.remove();
alert('✅ لا توجد سجلات مكررة!\n\nجميع السجلات فريدة.');
return;
}

// Delete duplicates from Supabase
const deleteBatchSize = 50;
let deletedCount = 0;

for (let i = 0; i < duplicateIds.length; i += deleteBatchSize) {
const batch = duplicateIds.slice(i, i + deleteBatchSize);
const { error: deleteError } = await window.supabaseClient
.from('orders')
.delete()
.in('id', batch);

if (deleteError) {
console.error('خطأ في حذف دفعة:', deleteError);
} else {
deletedCount += batch.length;
}
}

// Clean LocalStorage
const uniqueOrders = Array.from(seenNIDs.values()).map(order => ({
id: order.id,
owner: order.owner_name,
nationalId: order.national_id,
phone: order.phone,
address: order.address,
vType: order.vehicle_type,
vCode: order.code || '',
vYear: order.vehicle_year,
chassisNumber: order.chassis_number,
motorNumber: order.motor_number,
refNumber: order.ref_number,
timestamp: order.submitted_at,
status: order.status,
images: order.images || []
}));

// Data stored securely in Database

loadingDiv.remove();
alert(`✅ تم حذف السجلات المكررة بنجاح!\n\n🗑️ تم حذف: ${deletedCount} سجل مكرر\n✅ تم الاحتفاظ بـ: ${uniqueOrders.length} سجل فريد\n\n☁️ تم التنظيف من قاعدة البيانات`);

// Reload data
await loadAdminData();
} catch (error) {
loadingDiv.remove();
alert('❌ حدث خطأ أثناء حذف المكرر: ' + error.message);
console.error('Clean duplicates error:', error);
}
};
}

// Search - استخدام نظام Pagination الجديد
// تم نقل دالة البحث إلى نظام Pagination

// Make functions and variables global
window.viewImages = viewImages;

// uploadLocalToSupabaseBtn — removed (LocalStorage deprecated, data is in Supabase only)

// Cleanup Duplicates Button Handler
if (document.getElementById('cleanupDuplicatesBtn')) {
document.getElementById('cleanupDuplicatesBtn').onclick = async () => {
if (!confirm('⚠️ هل أنت متأكد من تنظيف البيانات المتكررة؟\n\nسيتم:\n✅ حذف السجلات المتكررة من قاعدة البيانات\n✅ حذف السجلات المتكررة من LocalStorage\n✅ الاحتفاظ بأول سجل فقط لكل رقم قومي\n\n⚠️ هذه العملية لا يمكن التراجع عنها!')) {
return;
}
document.getElementById('loadingSpinner').style.display = 'block';

try {

// Step 1: Load all data from Supabase
const { data: allSupabaseOrders, error: loadError } = await window.supabaseClient
.from('orders')
.select('*');

if (loadError) throw loadError;


// Step 2: Find duplicates by nationalId and refNumber
const seenNIDs = new Map(); // nationalId -> first record
const seenRefs = new Map(); // refNumber -> first record
const duplicatesToDelete = [];

allSupabaseOrders.forEach(order => {
let isDuplicate = false;

// Check nationalId duplicate
if (order.nationalId) {
if (seenNIDs.has(order.nationalId)) {
isDuplicate = true;
duplicatesToDelete.push({ id: order.id, reason: `رقم قومي مكرر: ${order.nationalId}` });
} else {
seenNIDs.set(order.nationalId, order);
}
}

// Check refNumber duplicate (only if not already marked as duplicate)
if (!isDuplicate && order.refNumber) {
if (seenRefs.has(order.refNumber)) {
isDuplicate = true;
duplicatesToDelete.push({ id: order.id, reason: `رقم مرجعي مكرر: ${order.refNumber}` });
} else {
seenRefs.set(order.refNumber, order);
}
}
});


if (duplicatesToDelete.length === 0) {
alert('✅ لا توجد بيانات متكررة!\n\nقاعدة البيانات نظيفة بالفعل.'); 
document.getElementById('loadingSpinner').style.display = 'none';
return;
}

// Step 3: Delete duplicates from Database
let deletedCount = 0;
for (const dup of duplicatesToDelete) {
try {
const { error } = await window.supabaseClient
.from('orders')
.delete()
.eq('id', dup.id);
if (error) throw error;
deletedCount++;
} catch (e) {
console.error(`❌ فشل حذف ${dup.id}:`, e);
}
}

// Step 4: Log the action
await logAdminAction(currentUsername, 'تنظيف البيانات المتكررة', `تم حذف ${deletedCount} سجل مكرر من قاعدة البيانات`); 
document.getElementById('loadingSpinner').style.display = 'none';
alert(`✅ تم تنظيف البيانات بنجاح!\n\n📊 الإحصائيات:\n🗑️ تم حذف ${deletedCount} سجل مكرر من قاعدة البيانات\n💾 تم تنظيف LocalStorage\n\n🔄 سيتم تحديث الصفحة الآن...`);
location.reload();

} catch (error) {
console.error('❌ خطأ في تنظيف البيانات:', error);
document.getElementById('loadingSpinner').style.display = 'none';
alert('❌ حدث خطأ أثناء تنظيف البيانات:\n' + error.message);
}
};
}

// Download Template
const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
if (downloadTemplateBtn) {
downloadTemplateBtn.onclick = () => {
const templateData = [
['الاسم الرباعي', 'الرقم القومي', 'رقم الهاتف', 'نوع المركبة', 'موديل السنة', 'اللون', 'العنوان', 'كود المركبة'],
['محمد أحمد علي حسن', '29501011234567', '01012345678', 'توكتوك', '2020', 'أحمر', 'كفر صقر - حي النصر', ''],
['فاطمة محمود سعيد إبراهيم', '29601021234568', '01098765432', 'موتوسيكل', '2021', 'أسود', 'البوها - شارع الجلاء', '']
];

const ws = XLSX.utils.aoa_to_sheet(templateData);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'نموذج البيانات');
XLSX.writeFile(wb, 'نموذج_استيراد_المركبات.xlsx');
};
}

// Clean Duplicates Button
const cleanDuplicatesBtn = document.getElementById('cleanDuplicatesBtn');
if (cleanDuplicatesBtn) {
cleanDuplicatesBtn.onclick = async () => {
if (!confirm('🧹 هل تريد تنظيف السجلات المكررة؟\n\nسيتم:\n✅ حذف التكرار من قاعدة البيانات\n✅ حذف التكرار من LocalStorage\n✅ الاحتفاظ بأحدث سجل فقط')) {
return;
}

const loadingDiv = document.createElement('div');
loadingDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:30px;border-radius:15px;box-shadow:0 10px 40px rgba(0,0,0,0.3);z-index:10000;text-align:center;';
loadingDiv.innerHTML = '<div style="font-size:3rem;margin-bottom:15px;">🧹</div><div style="font-size:1.2rem;color:#333;font-weight:600;">جاري تنظيف السجلات المكررة...</div><div style="margin-top:10px;color:#666;">يرجى الانتظار</div>';
document.body.appendChild(loadingDiv);

try {
// 1. Load all data from Supabase (with pagination for large datasets)
let allOrders = [];
let from = 0;
const batchSize = 1000;
let hasMore = true;

while (hasMore) {
const { data: batch, error } = await window.supabaseClient
.from('orders')
.select('*')
.order('submitted_at', { ascending: false })
.range(from, from + batchSize - 1);

if (error) throw error;

if (batch && batch.length > 0) {
allOrders = allOrders.concat(batch);
from += batchSize;
hasMore = batch.length === batchSize;
} else {
hasMore = false;
}
}


// 2. Find duplicates by national_id
const seenNIDs = new Map(); // national_id -> latest record
const duplicateIds = []; // IDs to delete

allOrders.forEach(order => {
if (!order.national_id) return; // Skip records without national_id

if (seenNIDs.has(order.national_id)) {
// Found duplicate - keep the newer one
const existing = seenNIDs.get(order.national_id);
const existingDate = new Date(existing.submitted_at || 0);
const currentDate = new Date(order.submitted_at || 0);

if (currentDate > existingDate) {
// Current is newer - delete existing, keep current
duplicateIds.push(existing.id);
seenNIDs.set(order.national_id, order);
} else {
// Existing is newer - delete current
duplicateIds.push(order.id);
}
} else {
// First occurrence - keep it
seenNIDs.set(order.national_id, order);
}
});


if (duplicateIds.length === 0) {
loadingDiv.remove();
alert('✅ لا توجد سجلات مكررة!\n\nجميع السجلات فريدة.');
return;
}

// 3. Delete duplicates from Supabase in batches
const deleteBatchSize = 50;
let deletedCount = 0;

for (let i = 0; i < duplicateIds.length; i += deleteBatchSize) {
const batch = duplicateIds.slice(i, i + deleteBatchSize);
const { error: deleteError } = await window.supabaseClient
.from('orders')
.delete()
.in('id', batch);

if (deleteError) {
console.error('خطأ في حذف دفعة:', deleteError);
} else {
deletedCount += batch.length;
}
}

// 4. Clean LocalStorage
const uniqueOrders = Array.from(seenNIDs.values()).map(order => ({
id: order.id,
owner: order.owner_name,
nationalId: order.national_id,
phone: order.phone,
address: order.address,
vType: order.vehicle_type,
vCode: order.code || '',
vYear: order.vehicle_year,
chassisNumber: order.chassis_number,
motorNumber: order.motor_number,
refNumber: order.ref_number,
timestamp: order.submitted_at,
status: order.status,
images: order.images || []
}));

// Data stored securely in Database

// 5. Reload data
loadingDiv.remove();
alert(`✅ تم تنظيف السجلات المكررة بنجاح!\n\n📊 الإحصائيات:\n• تم حذف: ${deletedCount} سجل مكرر\n• المتبقي: ${uniqueOrders.length} سجل فريد\n\nسيتم تحديث الجدول الآن...`);
await loadAdminData();

} catch (error) {
loadingDiv.remove();
console.error('❌ خطأ في تنظيف السجلات:', error);
alert(`❌ حدث خطأ أثناء تنظيف السجلات:\n\n${error.message}`);
}
};
}

let importedData = [];

// Read Excel File (OLD CODE - Element doesn't exist, using new import modal instead)
const bulkImportFileElement = document.getElementById('bulkImportFile');
if (bulkImportFileElement) {
bulkImportFileElement.onchange = async (e) => {
const file = e.target.files[0];
if (!file) return;

const reader = new FileReader();
reader.onload = (event) => {
try {
const data = new Uint8Array(event.target.result);
const workbook = XLSX.read(data, { type: 'array' });
const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

if (jsonData.length < 2) {
alert('❌ الملف فارغ أو لا يحتوي على بيانات');
return;
}


// Try Fixed Columns First (B-H format)
let useFixedColumns = false;
const columnMap = {};
let dataStartRow = 1; // Default: data starts from row 1

// الترتيب الثابت للأعمدة (نفس import_excel.html):
// A=0 (رقم تسلسلي أو فاضي)
// B=1 (الكود), C=2 (الاسم), D=3 (الرقم القومي), E=4 (العنوان), 
// F=5 (الشاسيه), G=6 (الموتور), H=7 (رقم التليفون)

// Check if data follows fixed column format
// Look for actual data (skip header rows)
let foundFixedFormat = false;
for (let i = 1; i < Math.min(jsonData.length, 5); i++) {
if (jsonData[i] && jsonData[i].length >= 4) {
const colC = jsonData[i][2]; // Column C - الاسم
const colD = jsonData[i][3]; // Column D - الرقم القومي

// Skip if row looks like header
const colCStr = String(colC || '').trim();
const colDStr = String(colD || '').trim();
if (colCStr.includes('اسم') || colCStr.includes('الاسم') || 
    colDStr.includes('قومي') || colDStr.includes('الرقم') ||
    colCStr.includes('name') || colDStr.includes('national')) {
continue; // Skip header row
}

// Check if C has name and D has national ID
if (colC && colD) {
const nameStr = String(colC).trim();
const nidStr = String(colD).replace(/[^0-9]/g, '');

// If C looks like a name (length > 2) and D has digits
if (nameStr.length > 2 && nidStr.length >= 10) {
foundFixedFormat = true;
dataStartRow = i;
break;
}
}
}
}

if (foundFixedFormat) {
useFixedColumns = true;
}

if (useFixedColumns) {
// Fixed columns: B=1, C=2, D=3, E=4, F=5, G=6, H=7
// نفس الترتيب في import_excel.html
columnMap.vCode = 1;        // B - الكود
columnMap.owner = 2;        // C - الاسم
columnMap.nationalId = 3;   // D - الرقم القومي
columnMap.address = 4;      // E - العنوان
columnMap.chassisNumber = 5; // F - الشاسيه
columnMap.motorNumber = 6;   // G - الموتور
columnMap.phone = 7;         // H - رقم التليفون
} else {
// Smart Column Detection
const headers = jsonData[0].map(h => String(h).toLowerCase().trim());

const patterns = {
owner: ['اسم', 'الاسم', 'المالك', 'name', 'owner'],
nationalId: ['رقم قومي', 'القومي', 'بطاقة', 'national', 'id'],
phone: ['هاتف', 'تليفون', 'موبايل', 'phone', 'mobile'],
vType: ['نوع', 'المركبة', 'type', 'vehicle'],
vYear: ['موديل', 'سنة', 'year', 'model'],
vColor: ['لون', 'color'],
address: ['عنوان', 'address', 'العنوان'],
vCode: ['كود', 'code', 'الكود'],
chassisNumber: ['شاسيه', 'chassis', 'الشاسيه'],
motorNumber: ['موتور', 'motor', 'الموتور']
};

// Match columns automatically
for (let i = 0; i < headers.length; i++) {
const header = headers[i];
for (const [key, keywords] of Object.entries(patterns)) {
if (keywords.some(kw => header.includes(kw))) {
columnMap[key] = i;
break;
}
}
}

}

// Check required columns
if (columnMap.owner === undefined || columnMap.nationalId === undefined) {
alert('❌ لم يتم العثور على الأعمدة الأساسية (الاسم والرقم القومي)\n\nتأكد من:\n• استخدام الترتيب الصحيح للأعمدة (B-H)\n• أو وضع أسماء الأعمدة في الصف الأول');
return;
}

importedData = [];
const preview = document.getElementById('importPreview');

// Determine starting row for data processing
const startRow = useFixedColumns ? dataStartRow : 1;

let previewHTML = `<h4 style="color: #8e44ad; margin-top: 0;">معاينة البيانات المستوردة (${jsonData.length - startRow} سجل):</h4>
<p style="color: #666; margin-bottom: 15px;">✅ ${useFixedColumns ? 'تم استخدام الأعمدة الثابتة (B-H)' : 'تم اكتشاف الأعمدة تلقائياً'}</p>
<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
<thead>
<tr style="background: #8e44ad; color: white;">
<th style="padding: 8px; border: 1px solid #ddd;">#</th>
<th style="padding: 8px; border: 1px solid #ddd;">الكود</th>
<th style="padding: 8px; border: 1px solid #ddd;">الاسم</th>
<th style="padding: 8px; border: 1px solid #ddd;">الرقم القومي</th>
<th style="padding: 8px; border: 1px solid #ddd;">الهاتف</th>
<th style="padding: 8px; border: 1px solid #ddd;">الشاسيه</th>
<th style="padding: 8px; border: 1px solid #ddd;">الموتور</th>
<th style="padding: 8px; border: 1px solid #ddd;">الحالة</th>
</tr>
</thead>
<tbody>`;

for (let i = startRow; i < jsonData.length; i++) {
const row = jsonData[i];
if (!row || row.length === 0) continue;

// Skip empty rows (check if any cell has data)
const hasData = row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
if (!hasData) continue;

// Skip if no owner or national ID
if (!row[columnMap.owner] || !row[columnMap.nationalId]) continue;

const record = {
owner: String(row[columnMap.owner] || '').trim(),
nationalId: String(row[columnMap.nationalId] || '').replace(/[^0-9]/g, ''),
phone: String(row[columnMap.phone] || '').replace(/[^0-9]/g, ''),
vType: row[columnMap.vType] || 'توكتوك',
vYear: row[columnMap.vYear] || new Date().getFullYear(),
vColor: row[columnMap.vColor] || '',
address: row[columnMap.address] || '',
vCode: row[columnMap.vCode] ? String(row[columnMap.vCode]).trim() : '',
chassisNumber: row[columnMap.chassisNumber] ? String(row[columnMap.chassisNumber]).trim() : '',
motorNumber: row[columnMap.motorNumber] ? String(row[columnMap.motorNumber]).trim() : ''
};

// Validation (more lenient like import_excel.html)
const isValid = record.owner.length >= 3 && record.nationalId.length >= 10 && (!record.phone || record.phone.length === 11);
importedData.push(record);

const rowNumber = i - startRow + 1; // Calculate correct row number
previewHTML += `<tr style="background: ${isValid ? 'rgba(39, 174, 96, 0.1)' : 'rgba(231, 76, 60, 0.1)'};">
<td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${rowNumber}</td>
<td style="padding: 6px; border: 1px solid #ddd; font-weight: bold; color: ${record.vCode ? '#3498db' : '#999'};">${record.vCode || '-'}</td>
<td style="padding: 6px; border: 1px solid #ddd;">${record.owner}</td>
<td style="padding: 6px; border: 1px solid #ddd; font-family: monospace; font-size: 0.85rem;">${record.nationalId}</td>
<td style="padding: 6px; border: 1px solid #ddd; font-family: monospace;">${record.phone || '-'}</td>
<td style="padding: 6px; border: 1px solid #ddd; font-family: monospace; font-size: 0.8rem; color: ${record.chassisNumber ? '#27ae60' : '#999'};">${record.chassisNumber || '-'}</td>
<td style="padding: 6px; border: 1px solid #ddd; font-family: monospace; font-size: 0.8rem; color: ${record.motorNumber ? '#27ae60' : '#999'};">${record.motorNumber || '-'}</td>
<td style="padding: 6px; border: 1px solid #ddd; font-weight: bold; color: ${isValid ? 'var(--secondary)' : 'var(--danger)'};">${isValid ? '✅' : '❌'}</td>
</tr>`;
}

previewHTML += '</tbody></table>';
preview.innerHTML = previewHTML;
preview.style.display = 'block';

alert(`✅ تم قراءة ${importedData.length} سجل من الملف\n${useFixedColumns ? '📍 تم استخدام الأعمدة الثابتة (B-H)' : '🧠 تم اكتشاف الأعمدة تلقائياً'}`);
} catch (error) {
alert('❌ خطأ في قراءة الملف: ' + error.message);
console.error(error);
}
};
reader.readAsArrayBuffer(file);
};
} // End of bulkImportFileElement check

// Confirm Import
const confirmImportBtn = document.getElementById('confirmImportBtn');
if (confirmImportBtn) {
confirmImportBtn.onclick = async () => {
if (importedData.length === 0) {
alert('❌ لا توجد بيانات للاستيراد');
return;
}

if (!confirm(`هل أنت متأكد من استيراد ${importedData.length} سجل إلى قاعدة البيانات؟\n\n⚠️ سيتم إضافة السجلات الجديدة فقط (لن يتم تعديل السجلات الموجودة)`)) {
return;
}
document.getElementById('loadingSpinner').style.display = 'block';
document.getElementById('importProgress').style.display = 'block';
document.getElementById('confirmImportBtn').disabled = true;

let successCount = 0;
let errorCount = 0;
let duplicateCount = 0;
const errors = [];

// Helper function to update progress
const updateProgress = (current, total, status) => {
const percent = Math.round((current / total) * 100); 
document.getElementById('progressBar').style.width = percent + '%'; 
document.getElementById('progressText').textContent = percent + '%'; 
document.getElementById('progressStatus').textContent = status;
};

try {
// Load existing data from Supabase (with pagination for accurate duplicate check)
updateProgress(0, 100, '⏳ جاري تحميل البيانات من قاعدة البيانات...');

let existingOrders = [];
let from = 0;
const loadBatchSize = 1000;
let hasMore = true;

while (hasMore) {
const { data: batch, error } = await window.supabaseClient
.from('orders')
.select('national_id')
.not('national_id', 'is', null)
.range(from, from + loadBatchSize - 1);

if (error) throw error;

if (batch && batch.length > 0) {
existingOrders = existingOrders.concat(batch);
from += loadBatchSize;
hasMore = batch.length === loadBatchSize;
} else {
hasMore = false;
}
}


// Create a Set of existing national IDs for fast lookup
const existingNIDs = new Set(existingOrders.map(o => o.national_id));

updateProgress(10, 100, '⏳ جاري معالجة البيانات...');
const codeInfo = await getSmartNextCode();
let nextCode = codeInfo.next;

// Process all records
const recordsToAdd = [];
const totalRecords = importedData.length;

for (let i = 0; i < totalRecords; i++) {
const record = importedData[i];

// Update progress every 10 records
if (i % 10 === 0) {
const progress = 10 + Math.round((i / totalRecords) * 40); // 10-50%
updateProgress(progress, 100, `⏳ معالجة السجل ${i + 1} من ${totalRecords}...`);
}

// More lenient validation (like import_excel.html)
if (!record.owner || record.owner.length < 3) {
errorCount++;
errors.push(`السجل ${i + 1}: اسم غير صحيح`);
continue;
}

if (!record.nationalId || record.nationalId.length < 10) {
errorCount++;
errors.push(`السجل ${i + 1}: رقم قومي غير صحيح`);
continue;
}

// Check duplicate in localStorage (much faster)
if (existingNIDs.has(record.nationalId)) {
duplicateCount++;
continue;
}

// Only use code if it exists in Excel, don't auto-generate
const finalCode = record.vCode || null;

const refNumber = 'KS-IMP-' + Date.now().toString().slice(-8) + '-' + i;

const newRecord = {
owner: record.owner,
nationalId: record.nationalId,
phone: record.phone || '',
vType: record.vType,
vYear: record.vYear,
vColor: record.vColor || '',
vDesc: `موديل ${record.vYear}${record.vColor ? ' - لون ' + record.vColor : ''}`,
address: record.address || '',
chassisNumber: record.chassisNumber || '',
motorNumber: record.motorNumber || '',
images: [],
timestamp: Date.now(),
codedAt: record.vCode ? Date.now() : null,
vCode: finalCode,
refNumber: refNumber,
importedBy: 'admin',
importedAt: Date.now(),
status: record.vCode ? "coded" : "pending",
statusHistory: [{
status: record.vCode ? "coded" : "pending",
timestamp: Date.now(),
note: record.vCode ? `استيراد مع كود: ${finalCode}` : "استيراد من Excel - بانتظار التكويد",
by: userRole
}]
};

recordsToAdd.push(newRecord);
existingNIDs.add(record.nationalId); // Add to set to prevent duplicates within import
successCount++;
}

// Save to Supabase first (primary storage)
updateProgress(50, 100, '☁️ جاري الحفظ في قاعدة البيانات...');
const batchSize = 50; // Supabase batchis 500, we use 50 for safety
for (let i = 0; i < recordsToAdd.length; i += batchSize) {
const batch = recordsToAdd.slice(i, i + batchSize);

// Update progress
const progress = 60 + Math.round((i / recordsToAdd.length) * 35); // 60-95%
updateProgress(progress, 100, `☁️ حفظ ${Math.min(i + batchSize, recordsToAdd.length)} من ${recordsToAdd.length} في قاعدة البيانات...`);

// Save batch to Supabase in parallel (much faster!)
const savePromises = batch.map(async (record) => {
try {
const { error } = await window.supabaseClient
.from('orders')
.insert([{
owner_name: record.owner,
national_id: record.nationalId,
phone: record.phone,
vehicle_type: record.vType,
vehicle_year: record.vYear,
address: record.address,
chassis_number: record.chassisNumber,
motor_number: record.motorNumber,
images: record.images || [],
submitted_at: record.timestamp, // ✅ REQUIRED FIELD
ref_number: record.refNumber,
status: record.status,
code: record.vCode || null
}]);
if (error) throw error;
return true;
} catch (e) {
console.error('❌ خطأ في حفظ السجل:', {
message: e.message,
details: e.details,
hint: e.hint,
code: e.code,
fullError: e,
recordData: {
owner_name: record.owner,
national_id: record.nationalId,
phone: record.phone,
vehicle_type: record.vType,
vehicle_year: record.vYear
}
});
errorCount++;
errors.push(`خطأ: ${e.message || e.toString()}`);
return null;
}
});
await Promise.all(savePromises);

}

// Update LocalStorage cache after successful Supabase save
updateProgress(95, 100, '💾 جاري تحديث الذاكرة المحلية...');
await loadAdminData(); // Reload from Supabase to update LocalStorage

updateProgress(100, 100, '✅ اكتمل الاستيراد!');
document.getElementById('loadingSpinner').style.display = 'none';
document.getElementById('importProgress').style.display = 'none';
document.getElementById('bulkImportModal').style.display = 'none';

let resultMsg = `✅ اكتمل الاستيراد!\n\n📊 الإحصائيات:\n✅ نجح: ${successCount} سجل\n⚠️ مكرر (تم تخطيه): ${duplicateCount} سجل\n❌ فشل: ${errorCount} سجل\n\n📁 إجمالي السجلات المعالجة: ${importedData.length}\n\n☁️ تم الحفظ في قاعدة البيانات: ${successCount} سجل\n💾 تم الحفظ في لوحة التحكم: ${successCount} سجل`;
if (errors.length > 0 && errors.length <= 5) {
resultMsg += '\n\n❌ الأخطاء:\n' + errors.slice(0, 5).join('\n');
if (errors.length > 5) {
resultMsg += `\n... و ${errors.length - 5} أخطاء أخرى`;
}
}
alert(resultMsg);

} catch (error) {
document.getElementById('loadingSpinner').style.display = 'none';
document.getElementById('importProgress').style.display = 'none';
document.getElementById('confirmImportBtn').disabled = false;
alert('❌ حدث خطأ أثناء الاستيراد: ' + error.message);
console.error('Import error:', error);
}
};
}

// On page load - check for existing admin session (OLD CODE - DISABLED)
// This is now handled by the Supabase session restore in the init script above
/*
(function() {
const savedAuth = sessionStorage.getItem('adminAuth');
const savedRole = sessionStorage.getItem('adminRole');
const savedUsername = sessionStorage.getItem('adminUsername');

if (savedAuth === 'true' && savedRole && savedUsername) {
// Auto-restore admin session
window.userRole = savedRole;
window.currentUsername = savedUsername;
userRole = savedRole;
currentUsername = savedUsername; 
document.getElementById('portalSection').style.display = 'none'; 
document.getElementById('adminPage').style.display = 'block'; 
document.getElementById('goPortalBtn').style.display = 'inline-flex'; 
document.getElementById('logoutBtn').style.display = 'inline-flex'; 
document.getElementById('loginBtn').style.display = 'none';

// Show/hide supervisor log button based on role
{
  const _logsBtn2   = document.getElementById('showAdminLogsBtn');
  const _exportBtn2 = document.getElementById('exportExcelBtn');
  if (userRole === 'SUPER') {
    if (_logsBtn2)   _logsBtn2.style.display   = 'inline-block';
    if (_exportBtn2) _exportBtn2.style.display = 'inline-block';
  } else {
    if (_logsBtn2)   _logsBtn2.style.display   = 'none';
    if (_exportBtn2) _exportBtn2.style.display = 'none';
  }

  // Show/hide cleanup buttons based on role
  const _cleanupBtn2     = document.getElementById('cleanupDuplicatesBtn');
  const _cleanupMainBtn2 = document.getElementById('cleanDuplicatesMainBtn');
  if (userRole !== 'SUPER') {
    if (_cleanupBtn2)     _cleanupBtn2.style.display     = 'none';
    if (_cleanupMainBtn2) _cleanupMainBtn2.style.display = 'none';
  }
}

}
})();
*/

// ============================================

// ═══════════════════════════════════════════════════════════════
// لوحة الصيانة - SUPER فقط
// ═══════════════════════════════════════════════════════════════

// ── 1. تنظيف السجلات المكررة ────────────────────────────────
window.cleanupDuplicates = async function() {
  const role = sessionStorage.getItem('userRole');
  if (role !== 'SUPER') { alert('❌ هذه الأداة متاحة للمدير العام فقط'); return; }
  if (!confirm('⚠️ سيتم حذف السجلات المكررة بالرقم القومي مع الإبقاء على الأحدث. هل أنت متأكد؟')) return;

  document.getElementById('loadingSpinner').style.display = 'block';
  try {
    // جلب كل الطلبات مرتبة من الأحدث للأقدم
    const { data, error } = await window.supabaseClient
      .from('orders')
      .select('id, national_id, submitted_at')
      .not('national_id', 'is', null)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    const seen = new Map();
    const toDelete = [];

    data.forEach(row => {
      if (!row.national_id) return;
      if (seen.has(row.national_id)) {
        toDelete.push(row.id); // الأقدم يُحذف
      } else {
        seen.set(row.national_id, row.id);
      }
    });

    if (toDelete.length === 0) {
      document.getElementById('loadingSpinner').style.display = 'none';
      alert('✅ لا توجد سجلات مكررة');
      return;
    }

    // حذف على دفعات
    const batchSize = 100;
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = toDelete.slice(i, i + batchSize);
      await window.supabaseClient.from('orders').delete().in('id', batch);
    }

    await window.logSupervisorAction('تنظيف مكرر', `تم حذف ${toDelete.length} سجل مكرر`);
    document.getElementById('loadingSpinner').style.display = 'none';
    alert(`✅ تم حذف ${toDelete.length} سجل مكرر بنجاح`);
    await loadAdminData();
  } catch (e) {
    document.getElementById('loadingSpinner').style.display = 'none';
    alert('❌ خطأ: ' + e.message);
  }
};

// ── 2. تقرير السلامة (Health Check) ─────────────────────────
// ── مركز الإحصائيات الشامل ─────────────────────────────────
window.openStatsModal = async function() {
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
    const todayISO = today.toISOString();

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
  const role = sessionStorage.getItem('userRole');
  if (role !== 'SUPER') { alert('❌ هذه الأداة متاحة للمدير العام فقط'); return; }

  document.getElementById('loadingSpinner').style.display = 'block';
  try {
    const [ordersRes, complaintsRes] = await Promise.all([
      window.supabaseClient.from('orders').select('*').order('submitted_at', { ascending: false }),
      window.supabaseClient.from('complaints').select('*').order('submitted_at', { ascending: false })
    ]);

    if (ordersRes.error) throw ordersRes.error;
    if (complaintsRes.error) throw complaintsRes.error;

    const backup = {
      exportedAt: new Date().toISOString(),
      exportedBy: sessionStorage.getItem('username') || 'SUPER',
      orders: ordersRes.data,
      complaints: complaintsRes.data
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_kafrsaqr_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    await window.logSupervisorAction('تصدير نسخة احتياطية', `تم تصدير ${ordersRes.data.length} طلب و ${complaintsRes.data.length} شكوى`);
    document.getElementById('loadingSpinner').style.display = 'none';
    alert('✅ تم تصدير النسخة الاحتياطية بنجاح');
  } catch (e) {
    document.getElementById('loadingSpinner').style.display = 'none';
    alert('❌ خطأ: ' + e.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   إدارة حسابات المشرفين (خاص بالمدير العام SUPER فقط)
═══════════════════════════════════════════════════════════════ */
function _escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.openStaffManagementModal = async function() {
  const role = sessionStorage.getItem('userRole');
  if (role !== 'SUPER') {
    alert('❌ هذه الميزة مخصصة للمدير العام فقط.');
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
  listContainer.innerHTML = '<p style="text-align:center;color:var(--text3);font-size:0.85rem;">⏳ جاري التحميل...</p>';

  try {
    const { data: staffList, error } = await window.supabaseClient.rpc('get_staff_list');
    if (error) throw error;

    if (!staffList || staffList.length === 0) {
      listContainer.innerHTML = '<p style="text-align:center;color:var(--text3);font-size:0.85rem;">لا توجد حسابات أخرى مسجلة.</p>';
      return;
    }

    listContainer.innerHTML = staffList.map(s => {
      const isSelf = (s.username || '').toLowerCase() === 'eltohamy' || s.role === 'SUPER';
      const roleBadge = s.role === 'SUPER'
        ? '<span style="background:rgba(201,168,76,0.15);color:var(--gold);padding:3px 8px;border-radius:6px;font-size:0.75rem;font-weight:700;">مدير عام (SUPER)</span>'
        : '<span style="background:rgba(52,152,219,0.15);color:var(--blue);padding:3px 8px;border-radius:6px;font-size:0.75rem;font-weight:700;">بحث فقط (VIEWER)</span>';

      return `
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div>
            <div style="font-weight:700;font-size:0.92rem;color:var(--text);display:flex;align-items:center;gap:8px;">
              <span>👤 ${_escapeHtml(s.username)}</span>
              ${roleBadge}
            </div>
            <div style="font-size:0.78rem;color:var(--text3);margin-top:3px;">
              ${_escapeHtml(s.full_name || 'بدون اسم')}
            </div>
          </div>
          <div>
            ${!isSelf ? `
              <button onclick="window.handleDeleteStaff('${s.user_id}', '${_escapeHtml(s.username)}')" class="btn" style="background:rgba(231,76,60,0.12);color:var(--red);border:1px solid rgba(231,76,60,0.3);padding:6px 12px;font-size:0.8rem;border-radius:8px;cursor:pointer;">
                <i class="ri-delete-bin-line"></i> حذف
              </button>
            ` : '<span style="font-size:0.75rem;color:var(--gold);font-weight:700;">حسابك الرئيسي</span>'}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load staff list:', err);
    listContainer.innerHTML = '<p style="text-align:center;color:var(--red);font-size:0.85rem;">فشل تحميل قائمة الحسابات: ' + (err.message || '') + '</p>';
  }
};

window.handleCreateSupervisor = async function() {
  const usernameInput = document.getElementById('newStaffUsername');
  const fullNameInput = document.getElementById('newStaffFullName');
  const passwordInput = document.getElementById('newStaffPassword');
  const btn = document.getElementById('btnCreateSupervisor');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const fullName = fullNameInput ? fullNameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';

  if (!username || username.length < 3) {
    alert('❌ يرجى إدخال اسم مستخدم صحيح (3 أحرف إنجليزية على الأقل وبدون مسافات).');
    return;
  }
  if (!password || password.length < 6) {
    alert('❌ كلمة المرور يجب أن تكون 6 خانات على الأقل.');
    return;
  }

  btn.disabled = true;
  btn.innerText = '⏳ جاري الإنشاء...';

  try {
    const { data, error } = await window.supabaseClient.rpc('create_supervisor_account', {
      p_username: username,
      p_password: password,
      p_full_name: fullName,
      p_role: 'VIEWER'
    });

    if (error) throw error;

    alert(`✅ تم إنشاء حساب المشرف بنجاح!\n\nاسم الدخول: ${username}\nالصلاحية: استعلام وبحث فقط\n\nيدخل المشرف بكتابة اسمه وكلمة المرور في شاشة الدخول.`);
    if (usernameInput) usernameInput.value = '';
    if (fullNameInput) fullNameInput.value = '';
    if (passwordInput) passwordInput.value = '';
    await window.loadStaffAccountsList();
  } catch (err) {
    console.error('Failed to create supervisor:', err);
    alert('❌ فشل إنشاء الحساب: ' + (err.message || 'خطأ غير متوقع'));
  } finally {
    btn.disabled = false;
    btn.innerText = '➕ إنشاء الحساب فوراً';
  }
};

window.handleDeleteStaff = async function(userId, username) {
  if (!confirm(`هل أنت متأكد من حذف حساب المشرف (${username}) نهائياً؟`)) return;

  try {
    const { error } = await window.supabaseClient.rpc('delete_staff_account', { p_user_id: userId });
    if (error) throw error;
    alert(`✅ تم حذف حساب المشرف (${username}) بنجاح.`);
    await window.loadStaffAccountsList();
  } catch (err) {
    console.error('Failed to delete staff account:', err);
    alert('❌ فشل حذف الحساب: ' + (err.message || ''));
  }
};

// ── EOF ──

