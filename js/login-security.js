// The public site key identifies this widget; its secret stays in Supabase Auth.
(() => {
  const sitekey = '0x4AAAAAAFX9HKrfcoJ_Z69Z';
  let widgetId = null;
  let loading = false;
  const status = message => {
    const el = document.getElementById('loginChallengeStatus');
    if (el) el.textContent = message;
  };
  function render() {
    if (widgetId !== null) return;
    widgetId = window.turnstile.render('#loginChallenge', {
      sitekey, theme: 'auto', size: 'flexible', language: 'ar',
      callback: () => status('تم التحقق. يمكنك تسجيل الدخول.'),
      'expired-callback': () => status('انتهى التحقق. أعد المحاولة.'),
      'error-callback': () => status('تعذر التحقق. تحقق من الاتصال وأعد المحاولة.')
    });
  }
  function prepare() {
    if (window.turnstile) { render(); return; }
    if (loading) return;
    loading = true;
    status('جارٍ التحقق من الاتصال الآمن…');
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => {
      if (!window.turnstile) {
        loading = false; script.remove(); status('تعذر تشغيل التحقق. أغلق نافذة الدخول وأعد المحاولة.'); return;
      }
      window.turnstile.ready(render);
    };
    script.onerror = () => { loading = false; script.remove(); status('تعذر تحميل التحقق. أغلق نافذة الدخول وافتحها للمحاولة مجددًا.'); };
    document.head.append(script);
  }
  window.getLoginCaptchaToken = () => {
    const token = widgetId !== null && window.turnstile?.getResponse(widgetId);
    if (!token) { prepare(); throw new Error('انتظر اكتمال التحقق الأمني قبل تسجيل الدخول.'); }
    return token;
  };
  window.resetLoginCaptcha = () => {
    if (widgetId !== null) window.turnstile?.reset(widgetId);
  };
  const modal = document.getElementById('loginModal');
  if (modal) new MutationObserver(() => {
    if (modal.style.display !== 'none') prepare();
  }).observe(modal, {attributes: true, attributeFilter: ['style']});
})();
