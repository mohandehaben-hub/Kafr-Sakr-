// ═══════════════════════════════════════════════════════════════
// app-utils.js — أدوات الأمان والمرافق العامة
// Phase 1: Security Hardening
// ═══════════════════════════════════════════════════════════════

// ── 1. حماية XSS: تنظيف أي نص قبل حقنه في innerHTML ──────────
window.sanitizeHTML = function(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};
window.sanitizeText = window.sanitizeHTML;

// ── 2. Modal تأكيد احترافي بدلاً من confirm() المتصفح ──────────
// يعود بـ Promise<boolean> ليتوافق مع async/await
window.showConfirmModal = function(options = {}) {
  return new Promise((resolve) => {
    const {
      title   = 'تأكيد الإجراء',
      message = 'هل أنت متأكد؟',
      confirmText = 'تأكيد',
      cancelText  = 'إلغاء',
      type        = 'warning'   // warning | danger | info
    } = options;

    // إنشاء overlay
    const overlay = document.createElement('div');
    overlay.id = 'appConfirmOverlay';
    overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 100000;
      animation: fadeInOverlay 0.2s ease;
    `;

    const colors = {
      warning: { accent: '#f59e0b', icon: 'ri-alert-fill' },
      danger:  { accent: '#ef4444', icon: 'ri-delete-bin-fill' },
      info:    { accent: '#3b82f6', icon: 'ri-information-fill' },
    };
    const c = colors[type] || colors.warning;

    const card = document.createElement('div');
    card.style.cssText = `
      background: #1a2332;
      border: 1px solid rgba(255,255,255,0.1);
      border-top: 3px solid ${c.accent};
      border-radius: 16px;
      padding: 28px 32px;
      max-width: 420px;
      width: 90%;
      text-align: center;
      box-shadow: 0 24px 64px rgba(0,0,0,0.5);
      animation: slideUpCard 0.25s cubic-bezier(0.4,0,0.2,1);
      font-family: 'Cairo', 'Tajawal', sans-serif;
      direction: rtl;
    `;

    card.innerHTML = `
      <style>
        @keyframes fadeInOverlay { from{opacity:0} to{opacity:1} }
        @keyframes slideUpCard { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        #appConfirmOverlay .confirm-icon { font-size:2.5rem; color:${c.accent}; margin-bottom:12px; display:block; }
        #appConfirmOverlay .confirm-title { color:#e2e8f0; font-size:1.1rem; font-weight:700; margin-bottom:10px; }
        #appConfirmOverlay .confirm-msg { color:#94a3b8; font-size:0.9rem; line-height:1.6; margin-bottom:24px; }
        #appConfirmOverlay .confirm-actions { display:flex; gap:12px; justify-content:center; }
        #appConfirmOverlay .btn-confirm {
          background: ${c.accent}; color: #fff; border: none;
          padding: 10px 28px; border-radius: 50px; font-size: 0.9rem;
          font-weight: 700; cursor: pointer; font-family: inherit;
          transition: opacity 0.2s;
        }
        #appConfirmOverlay .btn-confirm:hover { opacity: 0.85; }
        #appConfirmOverlay .btn-cancel {
          background: transparent; color: #94a3b8;
          border: 1px solid rgba(255,255,255,0.15);
          padding: 10px 28px; border-radius: 50px; font-size: 0.9rem;
          font-weight: 700; cursor: pointer; font-family: inherit;
          transition: all 0.2s;
        }
        #appConfirmOverlay .btn-cancel:hover { color: #e2e8f0; border-color: rgba(255,255,255,0.3); }
      </style>
      <i class="ri-${c.icon} confirm-icon"></i>
      <div class="confirm-title">${window.sanitizeHTML(title)}</div>
      <div class="confirm-msg">${window.sanitizeHTML(message)}</div>
      <div class="confirm-actions">
        <button class="btn-confirm" id="appConfirmYes">${window.sanitizeHTML(confirmText)}</button>
        <button class="btn-cancel"  id="appConfirmNo">${window.sanitizeHTML(cancelText)}</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    function cleanup(result) {
      overlay.style.animation = 'fadeInOverlay 0.15s ease reverse';
      setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 150);
      resolve(result);
    }

    card.querySelector('#appConfirmYes').addEventListener('click', () => cleanup(true));
    card.querySelector('#appConfirmNo').addEventListener('click',  () => cleanup(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', esc); }
    });
  });
};

// ── 3. معالج الأخطاء الموحد ────────────────────────────────────
window.handleError = function(error, context = '') {
  const msg = error?.message || error?.toString() || 'حدث خطأ غير متوقع';
  const prefix = context ? `[${context}] ` : '';
  if (window.showToast) {
    window.showToast(prefix + msg, 'error', 4000);
  }
  // في الإنتاج: لا نكشف تفاصيل التقنية للمستخدم
  // console.error خاص بالـ debugging فقط
};

// ── 4. تعطيل زر أثناء العملية (Rate Limiting مرئي) ───────────
window.setButtonLoading = function(btn, loading, originalText) {
  if (!btn) return;
  if (loading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = '<i class="ri-loader-4-line" style="animation:spin 1s linear infinite;display:inline-block"></i> جاري التنفيذ...';
    btn.disabled = true;
    btn.style.opacity = '0.7';
  } else {
    btn.innerHTML = originalText || btn.dataset.originalText || btn.innerHTML;
    btn.disabled = false;
    btn.style.opacity = '';
  }
};

// ── 5. مساعد تهيئة CSS للـ spinner ────────────────────────────
(function injectSpinnerStyle() {
  if (document.getElementById('appUtilsStyle')) return;
  const style = document.createElement('style');
  style.id = 'appUtilsStyle';
  style.textContent = `
    @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  `;
  document.head.appendChild(style);
})();
