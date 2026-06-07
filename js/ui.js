// ═══════════════════════════════════════════════════════════════
// ui.js - واجهة المستخدم، التحقق، التنقل بين الصفحات
// ═══════════════════════════════════════════════════════════════


// Hide Header on Scroll Down in Admin Panel
let lastScrollTop = 0;
const header = document.querySelector('header');
const leadershipSection = document.getElementById('leadershipSection');
const adminPage = document.getElementById('adminPage');

window.addEventListener('scroll', function() {
// Only hide header when in admin panel
if (adminPage && adminPage.style.display !== 'none') {
let scrollTop = window.pageYOffset || document.documentElement.scrollTop;

if (scrollTop > lastScrollTop && scrollTop > 100) {
// Scrolling down - hide header and leadership
header.style.transform = 'translateY(-100%)';
header.style.transition = 'transform 0.3s ease';
if (leadershipSection) {
leadershipSection.style.transform = 'translateY(-100%)';
leadershipSection.style.transition = 'transform 0.3s ease';
}
} else {
// Scrolling up - show header and leadership
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

// Navigation Function
function openService(serviceId) {
  document.getElementById('portalSection').style.display = 'none';

  // تتبع المصدر — هل جاء من لوحة التحكم أم البوابة؟
  const fromAdmin = document.getElementById('adminPage').style.display === 'block';
  window._navSource = fromAdmin ? 'admin' : 'portal';

  if (fromAdmin) {
    document.getElementById('adminPage').style.display = 'none';
  }

  document.body.classList.add('in-service-page');

  if (serviceId === 'complaintsPage') {
    document.getElementById('complaintsSelectionPage').style.display = 'block';
    document.getElementById('complaintsPage').style.display = 'none';
  } else {
    document.getElementById(serviceId).style.display = 'block';
  }

  // تحديث نص أزرار الرجوع
  if (typeof updateBackButtons === 'function') updateBackButtons();
  if (typeof updateFABs === 'function') updateFABs();

  if (serviceId === 'citizenPage') {
    document.getElementById('vType').value = 'توكتوك';
  }
}

// فتح نموذج الشكوى حسب نوع المركبة
function openComplaintForm(vehicleType) {
document.getElementById('complaintsSelectionPage').style.display = 'none';
document.getElementById('complaintsPage').style.display = 'block';
// _navSource يبقى كما هو (portal أو admin) — لا نغيره هنا

// حفظ نوع المركبة
window.selectedComplaintVehicleType = vehicleType;

// عرض نوع المركبة
const typeDisplay = document.getElementById('selectedVehicleType');
const vehicleTypeDisplay = document.getElementById('vehicleTypeDisplay');
if (typeDisplay && vehicleTypeDisplay) {
typeDisplay.style.display = 'block';
vehicleTypeDisplay.textContent = vehicleType === 'توكتوك' ? '🛺 توكتوك' : '🚐 ميكروباص';
}

// تحديث Label وPlaceholder حسب نوع المركبة
const label = document.getElementById('vehicleIdLabel');
const input = document.getElementById('compVehicleId');
const hint = document.getElementById('vehicleIdHint');

if (vehicleType === 'توكتوك') {
label.textContent = 'رقم كود التقنين';
input.placeholder = 'مثال: 1234';
input.type = 'number';
hint.textContent = '✓ أدخل رقم الكود المكون من أرقام فقط';
} else {
label.textContent = 'رقم لوحة الميكروباص';
input.placeholder = 'مثال: ر ع و 1234';
input.type = 'text';
hint.textContent = '✓ أدخل رقم اللوحة (حروف عربية + أرقام)';
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
opt.value = day < 10 ? '0' + day : day.toString();
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
msgDiv.innerText = '❌ الرقم القومي يجب أن يكون 14 رقم';
input.style.borderColor = 'var(--danger)';
return false;
}

const century = nid[0];
if (!['2', '3'].includes(century)) {
msgDiv.style.display = 'block';
msgDiv.style.background = 'rgba(231, 76, 60, 0.1)';
msgDiv.style.color = 'var(--danger)';
msgDiv.innerText = '❌ الرقم القومي غير صحيح (يجب أن يبدأ بـ 2 أو 3)';
input.style.borderColor = 'var(--danger)';
return false;
}

const year = parseInt((century === '2' ? '19' : '20') + nid.substring(1, 3));
const month = parseInt(nid.substring(3, 5));
const day = parseInt(nid.substring(5, 7));

if (month < 1 || month > 12 || day < 1 || day > 31) {
msgDiv.style.display = 'block';
msgDiv.style.background = 'rgba(231, 76, 60, 0.1)';
msgDiv.style.color = 'var(--danger)';
msgDiv.innerText = '❌ تاريخ الميلاد في الرقم القومي غير صحيح';
input.style.borderColor = 'var(--danger)';
return false;
}

// Don't show the extracted birth date - just confirm the ID is valid
msgDiv.style.display = 'block';
msgDiv.style.background = 'rgba(39, 174, 96, 0.1)';
msgDiv.style.color = 'var(--secondary)';
msgDiv.innerText = '✅ الرقم القومي صحيح - الآن أدخل تاريخ ميلادك للتحقق';
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
const nidYear = parseInt((century === '2' ? '19' : '20') + nid.substring(1, 3));
const nidMonth = parseInt(nid.substring(3, 5));
const nidDay = parseInt(nid.substring(5, 7));

const selectedYear = parseInt(year);
const selectedMonth = parseInt(month);
const selectedDay = parseInt(day);

if (selectedYear === nidYear && selectedMonth === nidMonth && selectedDay === nidDay) {
msgDiv.style.display = 'block';
msgDiv.style.background = 'rgba(39, 174, 96, 0.1)';
msgDiv.style.color = 'var(--secondary)';
msgDiv.innerText = '✅ تاريخ الميلاد مطابق للرقم القومي - البيانات صحيحة';
document.getElementById('birthDay').style.borderColor = 'var(--secondary)';
document.getElementById('birthMonth').style.borderColor = 'var(--secondary)';
document.getElementById('birthYear').style.borderColor = 'var(--secondary)';
return true;
} else {
msgDiv.style.display = 'block';
msgDiv.style.background = 'rgba(231, 76, 60, 0.1)';
msgDiv.style.color = 'var(--danger)';
msgDiv.innerText = '❌ تاريخ الميلاد غير مطابق للرقم القومي - تأكد من البيانات'; 
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
    const d = new Date(typeof timestamp === 'number' ? timestamp : timestamp);
    return d.toLocaleDateString('ar-EG', { year:'numeric', month:'short', day:'numeric' });
  } catch(e) { return '—'; }
};

window.getStatusDisplay = function(status) {
const statusMap = {
pending: { text: 'قيد المراجعة', color: '#f39c12', icon: '⏳' },
approved: { text: 'تم القبول', color: '#3498db', icon: '✓' },
coded: { text: 'تم التكويد', color: '#27ae60', icon: '✅' },
sticker_applied: { text: 'تم لصق الملصق', color: '#16a085', icon: '�️' },
delivered: { text: 'تم التسليم', color: '#16a085', icon: '🎉' }
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
document.getElementById('compSelfie').onchange = updateComplaintImagesSummary; 
document.getElementById('compIdCard').onchange = updateComplaintImagesSummary; 
document.getElementById('compProblemImage').onchange = updateComplaintImagesSummary; 
document.getElementById('compVehicleImage').onchange = updateComplaintImagesSummary;