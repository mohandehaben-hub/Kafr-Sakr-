// ═══════════════════════════════════════════════════════════════
// storage.js - رفع الصور وأدوات قاعدة البيانات
// ═══════════════════════════════════════════════════════════════

// Upload to Cloud Storage (Private)
window.uploadToSupabaseStorage = async (file) => {
  // ✅ تحقق صارم من نوع الملف وحجمه
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`نوع الملف "${file.name}" غير مسموح. يُسمح فقط بـ JPG, PNG, WebP`);
  }
  if (file.size > MAX_SIZE) {
    throw new Error(`حجم الملف "${file.name}" يتجاوز 5MB`);
  }
  // منع SVG حتى لو جاء بـ MIME مختلف
  const ext = file.name.split('.').pop().toLowerCase();
  const BLOCKED_EXTENSIONS = ['svg', 'html', 'htm', 'exe', 'php', 'js', 'sh', 'bat'];
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    throw new Error(`امتداد الملف ".${ext}" غير مسموح`);
  }

return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.readAsDataURL(file);
reader.onload = async (e) => {
const img = new Image();
img.src = e.target.result;
img.onload = async () => {
const canvas = document.createElement('canvas');
const maxWidth = 1200; // زيادة الجودة
const scale = img.width > maxWidth ? maxWidth / img.width : 1;
canvas.width = img.width * scale;
canvas.height = img.height * scale;
const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

canvas.toBlob(async (blob) => {
try {
const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
const filePath = `images/${fileName}`;

const { data, error } = await window.supabaseClient.storage
.from('vehicle-images')
.upload(filePath, blob, {
contentType: 'image/jpeg',
cacheControl: '3600',
upsert: false
});

if (error) {
reject(new Error(`فشل رفع الصورة: ${error.message}`));
return;
}

// Return file path only (not public URL)
resolve(filePath);
} catch (error) {
reject(new Error(`خطأ في الرفع: ${error.message}`));
}
}, 'image/jpeg', 0.80); // زيادة الجودة من 0.70 إلى 0.80
};
};
});
};

// Format DateTime
function formatDateTime(ts) {
if (!ts) return "-";
const d = new Date(ts);
return d.toLocaleDateString('ar-EG') + " " + d.toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'});
}

// Make formatDateTime globally available
window.formatDateTime = formatDateTime;

// ═══════════════════════════════════════════════════════════════
// Database Helper Functions
// ═══════════════════════════════════════════════════════════════

// Add Order to Database
async function addOrderToSupabase(orderData) {
const { data, error } = await window.supabaseClient
.from('orders')
.insert([orderData])
.select();
if (error) throw error;
return data[0];
}

// Add Complaint to Database
async function addComplaintToSupabase(complaintData) {
const { data, error } = await window.supabaseClient
.from('complaints')
.insert([complaintData])
.select();
if (error) throw error;
return data[0];
}



// Submit Vehicle Registration
document.getElementById('submitBtn').onclick = async () => {
const btn = document.getElementById('submitBtn');
if (btn._submitting) return;
const _alert = window._origAlert || window.alert;
const files = document.getElementById('multiFiles').files;
const owner = document.getElementById('ownerName').value.trim();
const nid = document.getElementById('nationalId').value.trim();
const phone = document.getElementById('phone').value.trim();
const year = document.getElementById('vYear').value;
const address = document.getElementById('address').value.trim();
const vType = document.getElementById('vType').value;
const birthDate = document.getElementById('birthDate').value;

// التحقق من حجم الصور ونوعها
for (let file of files) {
if (file.size > 5242880) { // 5MB
    _alert(`❌ حجم الصورة "${file.name}" يتجاوز 5MB\nيرجى اختيار صور أصغر`);
    return;
}
if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
    _alert(`❌ الملف "${file.name}" غير صورة صحيحة\nيرجى استخدام JPG أو PNG أو WebP فقط`);
    return;
}
}

// Validate National ID
if (!validateNationalId(document.getElementById('nationalId'))) {
_alert("❌ يرجى إدخال رقم قومي صحيح (14 رقم)");
return;
}

// Verify Birth Date
if (!verifyBirthDate()) {
_alert("❌ تاريخ الميلاد غير مطابق للرقم القومي");
return;
}

if (!owner || nid.length !== 14 || phone.length !== 11 || !year || !vType || files.length === 0 || !birthDate) {
_alert("❌ يرجى إكمال جميع البيانات المطلوبة");
return;
}

// Check duplicate with birth date verification - يتم التحقق في Supabase
document.getElementById('loadingSpinner').style.display = 'block';
btn.disabled = true;
btn._submitting = true;

try {
const imgUrls = [];
btn.innerText = "جاري رفع الصور...";
for (let i = 0; i < files.length; i++) {
const url = await window.uploadToSupabaseStorage(files[i]);
imgUrls.push(url);
btn.innerText = `جاري رفع الصورة ${i + 1} من ${files.length}...`;
}

const refNumber = 'KS-' + Date.now().toString().slice(-8);

// Prepare data with encryption for sensitive fields
let dataToSave = {
owner_name: owner,
national_id: nid,
phone,
vehicle_type: vType,
vehicle_year: year,
address,
images: imgUrls,
submitted_at: Date.now(),
ref_number: refNumber,
status: "pending",
code: ""
};

// Save to Database
await addOrderToSupabase(dataToSave); 
document.getElementById('loadingSpinner').style.display = 'none';
btn.disabled = false;
btn.innerText = '📋 تسجيل المركبة';

// Send confirmation WhatsApp to citizen
const confirmMessage = `✅ *تم تسجيل طلبك بنجاح!*\n\n` +
`👤 السيد/ة: ${owner}\n` +
`🚜 نوع المركبة: ${vType}\n` +
`📋 الرقم المرجعي: *${refNumber}*\n\n` +
`⏳ سيتم مراجعة طلبك والتواصل معك قريباً\n\n` +
`📞 للاستفسار: 01021102607\n\n` +
`_رئاسة مركز ومدينة كفر صقر_`;

// Auto-send WhatsApp
if (phone && phone.length === 11) {
const whatsappUrl = `https://wa.me/2${phone}?text=${encodeURIComponent(confirmMessage)}`;
window.open(whatsappUrl, '_blank');
}

alert(`تم تسجيل بياناتك بنجاح!\n\nرقمك المرجعي: ${refNumber}\n\nسيتم فتح واتساب لإرسال تأكيد الاستلام`);
setTimeout(() => location.reload(), 3000);
} catch (e) {
document.getElementById('loadingSpinner').style.display = 'none';
alert("❌ حدث خطأ: " + e.message);
btn.disabled = false;
btn._submitting = false;
btn.innerText = "إرسال الطلب";
}
};

// ── دالة تنظيف النصوص لمنع XSS ──────────────────────────────
function sanitizeText(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
window.sanitizeText = sanitizeText;

// ── التحقق الصارم من المدخلات ────────────────────────────────
function validateInputs(nid, phone) {
  const _alert = window._origAlert || window.alert;
  if (!/^\d{14}$/.test(nid)) {
    _alert("❌ الرقم القومي يجب أن يتكون من 14 رقماً صحيحاً فقط");
    return false;
  }
  if (!/^\d{11}$/.test(phone)) {
    _alert("❌ رقم الهاتف يجب أن يتكون من 11 رقماً صحيحاً فقط");
    return false;
  }
  return true;
}

// Inquiry Button
document.getElementById('inquiryBtn').onclick = async () => {
const owner = document.getElementById('inqOwnerName').value.trim();
const nid = document.getElementById('inqNationalId').value.trim();
const phone = document.getElementById('inqPhone').value.trim();

if (!owner || !validateInputs(nid, phone)) return;

document.getElementById('loadingSpinner').style.display = 'block';
const inquiryBtn = document.getElementById('inquiryBtn');
inquiryBtn.disabled = true;
inquiryBtn.innerHTML = '<i class="ri-loader-4-line"></i> جاري الاستعلام...';

try {
const { data: orders, error } = await window.supabaseClient
  .rpc('get_my_order', {
    p_national_id: nid,
    p_owner_name: owner,
    p_phone: phone
  });

if (error) throw error;

const rawData = orders && orders.length > 0 ? orders[0] : null;

// Convert Supabase data to expected format
const data = rawData ? {
id: rawData.id,
owner: rawData.owner_name,
nationalId: rawData.national_id,
phone: rawData.phone,
vType: rawData.vehicle_type,
vYear: rawData.vehicle_year,
address: rawData.address,
vCode: rawData.code,
refNumber: rawData.ref_number,
timestamp: rawData.submitted_at,
codedAt: rawData.coded_at,
status: rawData.status,
statusHistory: rawData.status_history || [],
images: rawData.images || []
} : null;

const resultDiv = document.getElementById('inquiryResult');

if (!data) {
resultDiv.style.display = 'block';
resultDiv.style.background = 'linear-gradient(135deg, rgba(231, 76, 60, 0.1) 0%, rgba(192, 57, 43, 0.1) 100%)';
resultDiv.style.border = '3px solid var(--danger)';
resultDiv.innerHTML = `
<i style="font-size: 80px; display: block; margin-bottom: 20px;">❌</i>
<h3 style="color: var(--danger); margin-bottom: 15px; font-size: 1.8rem;">لا توجد بيانات مطابقة</h3>
<p class="inquiry-text-muted" style="font-size: 1.1rem;">تأكد من صحة البيانات المدخلة</p>
`;
} else {
const statusInfo = window.getStatusDisplay(data.status || 'pending');

// Build status history HTML with admin info
let historyHTML = '';
if (data.statusHistory && data.statusHistory.length > 0) {
historyHTML = '<div class="inquiry-history-container">';
historyHTML += '<h4 style="margin: 0 0 20px 0; font-size: 1.3rem;">📋 سجل حالة الطلب</h4>';
historyHTML += '<div style="position: relative; padding-right: 30px;">';

data.statusHistory.forEach((log, index) => {
const logStatusInfo = window.getStatusDisplay(log.status);
const isLast = index === data.statusHistory.length - 1;

        // Admin info
        let adminInfo = '';
        if (log.by) {
          const sanitizedBy = sanitizeText(log.by);
          if (log.by === 'SUPER') {
            adminInfo = '<span style="background: #e74c3c; color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; margin-right: 10px;">👑 مدير عام</span>';
          } else if (log.by === 'ADMIN') {
            adminInfo = '<span style="background: #3498db; color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; margin-right: 10px;">🔧 مشرف</span>';
          } else if (log.by === 'system') {
            adminInfo = '<span style="background: #95a5a6; color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; margin-right: 10px;">🤖 النظام</span>';
          } else {
            adminInfo = `<span style="background: #7f8c8d; color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; margin-right: 10px;">👤 ${sanitizedBy}</span>`;
          }
        }

        historyHTML += `
<div style="position: relative; margin-bottom: ${isLast ? '0' : '25px'};">
<div style="position: absolute; right: -30px; top: 5px; width: 18px; height: 18px; background: ${logStatusInfo.color}; border-radius: 50%; border: 3px solid var(--bg2); box-shadow: 0 2px 8px rgba(0,0,0,0.4); z-index: 2;"></div>
${!isLast ? '<div style="position: absolute; right: -21px; top: 23px; width: 2px; height: calc(100% + 25px); background: var(--border2); z-index: 1;"></div>' : ''}
<div class="inquiry-history-item" style="border-right: 4px solid ${logStatusInfo.color};">
<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 10px;">
<div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
<span style="background: ${logStatusInfo.color}; color: white; padding: 6px 14px; border-radius: 8px; font-weight: bold; font-size: 0.95rem;">${logStatusInfo.icon} ${logStatusInfo.text}</span>
${adminInfo}
</div>
<span class="inquiry-text-muted" style="font-size: 0.85rem; font-weight: 600;">${window.formatDateTime(log.timestamp)}</span>
</div>
${log.note ? `<p style="margin: 10px 0 0 0; line-height: 1.6; font-size: 0.95rem;">💬 ${sanitizeText(log.note)}</p>` : ''}
</div>
</div>
`;
      });

historyHTML += '</div></div>';
}

if (data.vCode && data.vCode !== "") {
resultDiv.style.display = 'block';
resultDiv.style.background = 'linear-gradient(135deg, rgba(39, 174, 96, 0.08) 0%, rgba(46, 204, 113, 0.08) 100%)';
resultDiv.style.border = '3px solid var(--secondary)';
resultDiv.innerHTML = `
<div style="text-align: center;">
<i style="font-size: 90px; display: block; margin-bottom: 20px; animation: pulse 2s infinite;">✅</i>
<h3 style="color: var(--secondary); margin-bottom: 25px; font-size: 2rem; font-weight: 900;">تم التكويد بنجاح!</h3>
</div>

<div style="background: linear-gradient(135deg, var(--secondary) 0%, #229954 100%); padding: 35px; border-radius: 25px; margin: 25px 0; box-shadow: 0 10px 30px rgba(39, 174, 96, 0.3); text-align: center;">
<p style="color: rgba(255,255,255,0.9); font-size: 1.1rem; margin-bottom: 12px; font-weight: 600;">كود المركبة الخاص بك</p>
<h2 style="color: white; font-size: 4.5rem; font-weight: 900; margin: 0; text-shadow: 0 4px 10px rgba(0,0,0,0.2); letter-spacing: 3px;">${data.vCode}</h2>
<button onclick="navigator.clipboard.writeText('${data.vCode}').then(()=>window.showToast('تم نسخ الكود','success'))" style="margin-top:16px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);color:white;padding:8px 20px;border-radius:20px;cursor:pointer;font-family:'Cairo',sans-serif;font-weight:700;font-size:0.85rem;">نسخ الكود</button>
</div>

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 25px 0;">
<div class="inquiry-card" style="text-align: center;">
<p class="inquiry-text-muted" style="font-size: 0.9rem; margin: 0 0 8px 0;">نوع المركبة</p>
<p class="inquiry-text-primary" style="font-size: 1.3rem; font-weight: bold; margin: 0;">🚜 ${data.vType}</p>
</div>
<div class="inquiry-card" style="text-align: center;">
<p class="inquiry-text-muted" style="font-size: 0.9rem; margin: 0 0 8px 0;">الموديل</p>
<p class="inquiry-text-primary" style="font-size: 1.3rem; font-weight: bold; margin: 0;">📅 ${data.vYear || 'غير محدد'}</p>
</div>

</div>

<div class="inquiry-card">
<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
<div>
<p class="inquiry-text-muted" style="font-size: 0.85rem; margin: 0 0 5px 0;">📋 الرقم المرجعي</p>
<p class="inquiry-text-primary" style="font-size: 1.1rem; font-weight: bold; margin: 0; font-family: monospace;">${data.refNumber || 'N/A'}</p>
</div>
<div>
<p class="inquiry-text-muted" style="font-size: 0.85rem; margin: 0 0 5px 0;">📅 تاريخ التكويد</p>
<p class="inquiry-text-primary" style="font-size: 1.1rem; font-weight: bold; margin: 0;">${window.formatDateTime(data.codedAt)}</p>
</div>
</div>
</div>

${historyHTML}

<div style="background: linear-gradient(135deg, rgba(52, 152, 219, 0.1) 0%, rgba(41, 128, 185, 0.1) 100%); padding: 20px; border-radius: 15px; margin-top: 25px; border: 2px solid rgba(52, 152, 219, 0.3); text-align: center;">
<p style="margin: 0; color: var(--info); font-size: 1rem; line-height: 1.8;">
<strong style="font-size: 1.1rem;">✅ يمكنك الآن استلام المركبة</strong><br>
<span style="font-size: 0.95rem;">توجه إلى مقر رئاسة المركز مع المستندات المطلوبة</span>
</p>
</div>
`;
} else {
resultDiv.style.display = 'block';
resultDiv.style.background = 'linear-gradient(135deg, rgba(243, 156, 18, 0.08) 0%, rgba(214, 137, 16, 0.08) 100%)';
resultDiv.style.border = '3px solid var(--warning)';
resultDiv.innerHTML = `
<div style="text-align: center;">
<i style="font-size: 90px; display: block; margin-bottom: 20px; animation: pulse 2s infinite;">${statusInfo.icon}</i>
<h3 style="color: var(--warning); margin-bottom: 20px; font-size: 2rem; font-weight: 900;">${statusInfo.text}</h3>
</div>

<div style="background: ${statusInfo.color}; color: white; padding: 25px; border-radius: 20px; margin: 25px 0; text-align: center; box-shadow: 0 8px 25px rgba(0,0,0,0.15);">
<p style="margin: 0; font-size: 1.3rem; font-weight: bold;">${statusInfo.icon} ${statusInfo.text}</p>
<p style="margin: 10px 0 0 0; font-size: 1rem; opacity: 0.95;">طلبك قيد المعالجة من قبل الإدارة</p>
</div>

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 25px 0;">
<div class="inquiry-card" style="text-align: center;">
<p class="inquiry-text-muted" style="font-size: 0.9rem; margin: 0 0 8px 0;">نوع المركبة</p>
<p class="inquiry-text-primary" style="font-size: 1.3rem; font-weight: bold; margin: 0;">🚜 ${data.vType}</p>
</div>
<div class="inquiry-card" style="text-align: center;">
<p class="inquiry-text-muted" style="font-size: 0.9rem; margin: 0 0 8px 0;">الموديل</p>
<p class="inquiry-text-primary" style="font-size: 1.3rem; font-weight: bold; margin: 0;">📅 ${data.vYear || 'غير محدد'}</p>
</div>

</div>

<div class="inquiry-card">
<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
<div>
<p class="inquiry-text-muted" style="font-size: 0.85rem; margin: 0 0 5px 0;">📋 الرقم المرجعي</p>
<p class="inquiry-text-primary" style="font-size: 1.1rem; font-weight: bold; margin: 0; font-family: monospace;">${data.refNumber || 'N/A'}</p>
</div>
<div>
<p class="inquiry-text-muted" style="font-size: 0.85rem; margin: 0 0 5px 0;">📅 تاريخ التسجيل</p>
<p class="inquiry-text-primary" style="font-size: 1.1rem; font-weight: bold; margin: 0;">${window.formatDateTime(data.timestamp)}</p>
</div>
</div>
</div>

${historyHTML}

<div style="background: linear-gradient(135deg, rgba(243, 156, 18, 0.1) 0%, rgba(214, 137, 16, 0.1) 100%); padding: 20px; border-radius: 15px; margin-top: 25px; border: 2px solid rgba(243, 156, 18, 0.3); text-align: center;">
<p style="margin: 0; color: var(--warning); font-size: 1rem; line-height: 1.8;">
<strong style="font-size: 1.1rem;">⏳ يرجى الانتظار</strong><br>
<span style="font-size: 0.95rem;">سيتم مراجعة طلبك والتواصل معك قريباً</span>
</p>
</div>
`;
}
}
document.getElementById('loadingSpinner').style.display = 'none';
} catch (error) {
document.getElementById('loadingSpinner').style.display = 'none';
alert("❌ حدث خطأ: " + error.message);
} finally {
  const inquiryBtn = document.getElementById('inquiryBtn');
  if (inquiryBtn) { inquiryBtn.disabled = false; inquiryBtn.innerHTML = '🔍 استعلام الآن'; }
  // إظهار زر الطباعة لو في نتيجة
  const printBtn = document.getElementById('inquiryPrintBtn');
  const resultDiv = document.getElementById('inquiryResult');
  if (printBtn && resultDiv && resultDiv.style.display !== 'none') {
    printBtn.style.display = 'block';
  }
}
};

// Submit Complaint
document.getElementById('submitCompBtn').onclick = async () => {
const btn = document.getElementById('submitCompBtn');
const _alert = window._origAlert || window.alert;

// ✅ Anti-Spam: منع إرسال أكثر من شكوى كل 5 دقائق
const SPAM_KEY = 'lastComplaintTime';
const COOLDOWN = 5 * 60 * 1000;
const lastTime = parseInt(localStorage.getItem(SPAM_KEY) || '0');
if (Date.now() - lastTime < COOLDOWN) {
  const remaining = Math.ceil((COOLDOWN - (Date.now() - lastTime)) / 60000);
  _alert(`⚠️ يرجى الانتظار ${remaining} دقيقة قبل إرسال شكوى أخرى`);
  return;
}
const ownerName = document.getElementById('compOwnerName').value.trim();
const nid = document.getElementById('compNationalId').value.trim();
const phone = document.getElementById('compPhone').value.trim();
const vehicleId = document.getElementById('compVehicleId').value.trim();
const compType = document.getElementById('compType').value;
const details = document.getElementById('compDetails').value.trim();

// الحصول على نوع المركبة المحفوظ
const vehicleType = window.selectedComplaintVehicleType || 'توكتوك';

// Get all image files
const selfie = document.getElementById('compSelfie').files[0];
const idCard = document.getElementById('compIdCard').files[0];
const problemImages = document.getElementById('compProblemImage').files;
const vehicleImage = document.getElementById('compVehicleImage').files[0];

if (!ownerName || !validateInputs(nid, phone) || !vehicleId || !compType || !details) {
_alert("❌ يرجى إكمال جميع البيانات المطلوبة");
return;
}

if (!selfie || !idCard || !vehicleImage) {
_alert("❌ يرجى رفع الصور المطلوبة:\n• صورة سيلفي\n• صورة البطاقة\n• صورة المركبة/الكود");
return;
}; 
document.getElementById('loadingSpinner').style.display = 'block';
btn.disabled = true;
btn.innerText = "جاري الإرسال...";

try {
const imgUrls = {
selfie: '',
idCard: '',
problemImages: [],
vehicleImage: ''
};

// Upload selfie
btn.innerText = "جاري رفع صورة السيلفي...";
imgUrls.selfie = await window.uploadToSupabaseStorage(selfie);

// Upload ID card
btn.innerText = "جاري رفع صورة البطاقة...";
imgUrls.idCard = await window.uploadToSupabaseStorage(idCard);

// Upload vehicle image
btn.innerText = "جاري رفع صورة المركبة...";
imgUrls.vehicleImage = await window.uploadToSupabaseStorage(vehicleImage);

// Upload problem images
if (problemImages.length > 0) {
for (let i = 0; i < problemImages.length; i++) {
btn.innerText = `جاري رفع صورة المشكلة ${i + 1} من ${problemImages.length}...`;
const url = await window.uploadToSupabaseStorage(problemImages[i]);
imgUrls.problemImages.push(url);
}
}

await addComplaintToSupabase({
owner_name: ownerName,
national_id: nid,
phone,
vehicle_type: vehicleType,
vehicle_id: vehicleId,
complaint_type: compType,
details,
images: imgUrls,
status: 'pending',
reply: '',
submitted_at: Date.now()
}); 
// ✅ تسجيل وقت الإرسال لمنع الإزعاج
localStorage.setItem('lastComplaintTime', Date.now().toString());
document.getElementById('loadingSpinner').style.display = 'none';

// Send confirmation WhatsApp to citizen
const confirmMessage = `✅ *تم استلام شكواك بنجاح!*\n\n` +
`👤 السيد/ة: ${ownerName}\n` +
`📋 نوع الشكوى: ${compType}\n` +
`📸 تم رفع جميع الصور المطلوبة\n\n` +
`⏳ سيتم مراجعة شكواك والرد عليك في أقرب وقت\n\n` +
`📞 للاستفسار: 01021102607\n\n` +
`_رئاسة مركز ومدينة كفر صقر_`;

// Auto-send WhatsApp (no confirmation needed for citizen's own submission)
if (phone && phone.length === 11) {
const whatsappUrl = `https://wa.me/2${phone}?text=${encodeURIComponent(confirmMessage)}`;
window.open(whatsappUrl, '_blank');
}

alert("✅ تم إرسال شكواك بنجاح!\n\n📋 تم رفع جميع الصور المطلوبة\n⏳ سيتم المراجعة والرد في أقرب وقت.\n\n📱 سيتم فتح واتساب لإرسال تأكيد الاستلام");
location.reload();
} catch (error) {
document.getElementById('loadingSpinner').style.display = 'none';
alert("❌ خطأ: " + error.message);
btn.disabled = false;
btn.innerText = "إرسال الشكوى ✉️";
}
};

// Complaint Inquiry
document.getElementById('complaintInquiryBtn').onclick = async () => {
const owner = document.getElementById('compInqOwnerName').value.trim();
const nid = document.getElementById('compInqNationalId').value.trim();
const phone = document.getElementById('compInqPhone').value.trim();

if (!owner || !validateInputs(nid, phone)) return;

document.getElementById('loadingSpinner').style.display = 'block';

try {
// ✅ استخدام RPC الآمنة بدل الاستعلام المباشر
const { data: complaints, error } = await window.supabaseClient
.rpc('get_my_complaints', {
  p_national_id: nid,
  p_owner_name: owner,
  p_phone: phone
});

if (error) throw error;

const resultDiv = document.getElementById('complaintInquiryResult');

if (!complaints || complaints.length === 0) {
resultDiv.style.display = 'block';
resultDiv.innerHTML = `
<div style="background: linear-gradient(135deg, rgba(231, 76, 60, 0.1) 0%, rgba(192, 57, 43, 0.1) 100%); padding: 40px; border-radius: 25px; text-align: center; border: 3px solid var(--danger);">
<i style="font-size: 80px; display: block; margin-bottom: 20px;">❌</i>
<h3 style="color: var(--danger); margin-bottom: 15px; font-size: 1.8rem;">لا توجد شكاوى مطابقة</h3>
<p class="inquiry-text-muted" style="font-size: 1.1rem;">تأكد من صحة البيانات المدخلة</p>
</div>
`;
} else {
let complaintsHTML = '';
complaints.forEach((data) => {
const statusColor = data.status === 'replied' ? 'var(--secondary)' : 'var(--warning)';
const statusText = data.status === 'replied' ? '✅ تم الرد' : '⏳ قيد المراجعة';
const statusBg = data.status === 'replied' ? 'rgba(39, 174, 96, 0.08)' : 'rgba(243, 156, 18, 0.08)';

complaintsHTML += `
<div style="background: linear-gradient(135deg, ${statusBg} 0%, ${statusBg} 100%); padding: 30px; border-radius: 20px; margin-bottom: 20px; border: 3px solid ${statusColor};">
<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
<h3 style="color: ${statusColor}; margin: 0; font-size: 1.5rem;">${sanitizeText(data.complaint_type) || 'شكوى'}</h3>
<span style="background: ${statusColor}; color: white; padding: 8px 16px; border-radius: 10px; font-weight: bold;">${statusText}</span>
</div>
<div class="inquiry-subcard" style="margin-bottom: 15px; padding: 16px 20px;">
<p class="inquiry-text-primary" style="margin: 0; line-height: 1.8;"><strong style="color: var(--gold);">التفاصيل:</strong><br>${sanitizeText(data.details) || 'لا توجد تفاصيل'}</p>
</div>
<p class="inquiry-text-muted" style="font-size: 0.9rem;"><strong>تاريخ التقديم:</strong> ${window.formatDateTime(data.submitted_at)}</p>
${data.images ? `
<div style="margin: 15px 0;">
<button class="btn btn-view-inquiry-images" data-id="${sanitizeText(data.id)}" style="background: rgba(211, 84, 0, 0.1); color: var(--accent); padding: 10px 20px; border-radius: 12px; font-weight: bold;">🖼️ عرض الصور المرفقة</button>
</div>
` : ''}
${data.status === 'replied' && data.reply ? `
<div style="background: linear-gradient(135deg, rgba(39, 174, 96, 0.1) 0%, rgba(46, 204, 113, 0.1) 100%); padding: 20px; border-radius: 15px; border: 2px solid var(--secondary); margin-top: 15px;">
<p style="color: var(--secondary); margin: 0 0 10px 0; font-weight: bold; font-size: 1.1rem;">💬 الرد من الإدارة:</p>
<p class="inquiry-text-primary" style="margin: 0; line-height: 1.8;">${sanitizeText(data.reply)}</p>
</div>
` : `
<div style="background: rgba(243, 156, 18, 0.1); padding: 15px; border-radius: 10px; text-align: center; margin-top: 15px;">
<p style="color: var(--warning); margin: 0; font-weight: bold;">⏳ شكواك قيد المراجعة، سيتم الرد في أقرب وقت</p>
</div>
`}
</div>
`;
});

resultDiv.style.display = 'block';
resultDiv.innerHTML = `
<h3 style="text-align: center; color: var(--text); margin-bottom: 30px; font-size: 1.8rem;">شكاويك (${complaints.length})</h3>
${complaintsHTML}
`;

// Add event listeners for image viewing buttons
const complaintsData = {};
complaints.forEach((data) => {
complaintsData[data.id] = data;
});

resultDiv.querySelectorAll('.btn-view-inquiry-images').forEach(btn => {
btn.onclick = () => {
const compId = btn.getAttribute('data-id');
const data = complaintsData[compId];
if (data && data.images) {
if (typeof data.images === 'object' && !Array.isArray(data.images)) {
// New format: categorized images
showCategorizedImages(data.images);
} else if (Array.isArray(data.images)) {
// Old format: array of images
viewImages(data.images);
}
} else {
alert("⚠️ لا توجد صور متاحة للعرض");
}
};
});
}
document.getElementById('loadingSpinner').style.display = 'none';
} catch (error) {
document.getElementById('loadingSpinner').style.display = 'none';
alert("❌ حدث خطأ: " + error.message);
console.error(error);
}
};