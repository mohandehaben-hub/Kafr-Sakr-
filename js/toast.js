// ═══════════════════════════════════════════════════════════════
// toast.js - نظام الإشعارات بدل alert()
// ═══════════════════════════════════════════════════════════════

// إنشاء عنصر الـ toast في الـ DOM
(function() {
  const el = document.createElement('div');
  el.id = 'toastContainer';
  el.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 99999;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: none;
  `;
  document.body.appendChild(el);
})();

window.showToast = function(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');

  const colors = {
    success: { bg: 'rgba(0,200,150,0.95)', border: '#00c896', icon: '✅' },
    error:   { bg: 'rgba(224,53,53,0.95)',  border: '#e03535', icon: '❌' },
    warning: { bg: 'rgba(245,200,66,0.95)', border: '#f5c842', icon: '⚠️' },
    info:    { bg: 'rgba(26,127,232,0.95)', border: '#1a7fe8', icon: 'ℹ️' },
  };
  const c = colors[type] || colors.info;

  toast.style.cssText = `
    background: ${c.bg};
    border: 1px solid ${c.border};
    color: white;
    padding: 12px 20px;
    border-radius: 50px;
    font-family: 'Cairo', sans-serif;
    font-size: 0.88rem;
    font-weight: 700;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    pointer-events: none;
    white-space: nowrap;
    opacity: 0;
    transform: translateY(16px);
    transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
    max-width: 90vw;
    text-align: center;
  `;
  toast.textContent = c.icon + ' ' + msg;
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
  if (m.startsWith('✅') || m.startsWith('تم')) {
    window.showToast(m.replace('✅','').trim(), 'success');
  } else if (m.startsWith('❌') || m.startsWith('خطأ') || m.startsWith('فشل')) {
    window.showToast(m.replace('❌','').trim(), 'error');
  } else if (m.startsWith('⚠️') || m.startsWith('تحذير')) {
    window.showToast(m.replace('⚠️','').trim(), 'warning');
  } else {
    window.showToast(m, 'info');
  }
};

// للحالات التي تحتاج blocking (confirm بديل)
// لا نستبدل confirm() لأنه يُستخدم للتأكيد الفعلي

