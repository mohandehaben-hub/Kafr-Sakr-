// ═══════════════════════════════════════════════════════════════
// toast.js - نظام الإشعارات الحديث الموحد
// ═══════════════════════════════════════════════════════════════

function getOrCreateToastContainer() {
  let el = document.getElementById('toastContainer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toastContainer';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      pointer-events: none;
    `;
    if (document.body) {
      document.body.appendChild(el);
    }
  }
  return el;
}

// تهيئة مبكرة عند تحميل الصفحة
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', getOrCreateToastContainer);
} else {
  getOrCreateToastContainer();
}

window.showToast = function(msg, type = 'info', duration = 3500) {
  const container = getOrCreateToastContainer();
  if (!container) return;

  const toast = document.createElement('div');

  const colors = {
    success: { bg: 'rgba(16,185,129,0.95)', border: '#10b981', icon: '<i class="ri-checkbox-circle-fill"></i>' },
    error:   { bg: 'rgba(239,68,68,0.95)',   border: '#ef4444', icon: '<i class="ri-close-circle-fill"></i>' },
    warning: { bg: 'rgba(245,158,11,0.95)',  border: '#f59e0b', icon: '<i class="ri-alert-fill"></i>' },
    info:    { bg: 'rgba(59,130,246,0.95)',  border: '#3b82f6', icon: '<i class="ri-information-fill"></i>' },
  };
  const c = colors[type] || colors.info;

  toast.style.cssText = `
    background: ${c.bg};
    border: 1px solid ${c.border};
    color: white;
    padding: 11px 22px;
    border-radius: 50px;
    font-family: 'Cairo', 'Tajawal', sans-serif;
    font-size: 0.88rem;
    font-weight: 700;
    box-shadow: 0 10px 28px rgba(0,0,0,0.35);
    pointer-events: none;
    white-space: pre-line;
    opacity: 0;
    transform: translateY(16px);
    transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
    max-width: 90vw;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    direction: rtl;
    text-align: center;
  `;

  const safeMsg = window.sanitizeHTML ? window.sanitizeHTML(msg) : String(msg);
  toast.innerHTML = `${c.icon} <span>${safeMsg}</span>`;
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
  });

  // Animate out
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(16px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

// استبدال alert() بـ toast في كل الملفات
window._origAlert = window.alert;
window.alert = function(msg) {
  if (!msg) return;
  const m = msg.toString();
  if (m.startsWith('تم') || m.includes('بنجاح')) {
    window.showToast(m.trim(), 'success', 3500);
  } else if (m.startsWith('خطأ') || m.startsWith('فشل') || m.includes('غير صحيح') || m.includes('غير مطابق') || m.includes('يجب') || m.includes('يرجى') || m.includes('خاطئة') || m.includes('حظر')) {
    window.showToast(m.trim(), 'error', 4500);
  } else if (m.startsWith('تحذير') || m.includes('تنبيه')) {
    window.showToast(m.trim(), 'warning', 4000);
  } else {
    window.showToast(m.trim(), 'info', 3500);
  }
};
