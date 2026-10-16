(() => {
  const endpoint = '/api/citizen';
  let active = false;
  let scriptPromise;
  async function api(action, payload) {
    const response = await fetch(endpoint, {method:'POST', credentials:'omit', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action, ...payload})});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'تعذر إتمام التحقق.');
    return result;
  }
  function prepareTurnstile() {
    if (window.turnstile) return Promise.resolve();
    if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile/"]');
      if (existing) {
        const until = Date.now() + 15000;
        const timer = setInterval(() => {
          if (window.turnstile) { clearInterval(timer); resolve(); }
          else if (Date.now() > until) { clearInterval(timer); reject(new Error('تعذر تحميل التحقق الأمني. أعد تحميل الصفحة.')); }
        }, 100);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true;
      const timeout = setTimeout(() => { scriptPromise = null; script.remove(); reject(new Error('تعذر تحميل التحقق الأمني.')); }, 15000);
      script.onload = () => { clearTimeout(timeout); window.turnstile ? resolve() : reject(new Error('تعذر تشغيل التحقق الأمني.')); };
      script.onerror = () => { clearTimeout(timeout); scriptPromise = null; script.remove(); reject(new Error('تعذر تحميل التحقق الأمني.')); };
      document.head.append(script);
    });
    return scriptPromise;
  }
  async function verifyEmail(purpose) {
    if (active) throw new Error('أكمل التحقق المفتوح أولًا.');
    active = true;
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog'); dialog.className = 'citizen-otp-dialog'; dialog.dir = 'rtl';
    dialog.setAttribute('aria-labelledby', 'citizenOtpTitle');
    dialog.innerHTML = `<form method="dialog" class="citizen-otp-form">
      <h2 id="citizenOtpTitle">تأكيد البريد</h2>
      <label for="citizenOtpEmail">البريد الإلكتروني</label>
      <input id="citizenOtpEmail" type="email" autocomplete="email" maxlength="254" required dir="ltr">
      <div id="citizenOtpChallenge"></div>
      <button id="citizenOtpSend" type="button">إرسال الرمز</button>
      <div id="citizenOtpCodeGroup" hidden><label for="citizenOtpCode">الرمز (6 أرقام)</label>
      <input id="citizenOtpCode" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" dir="ltr">
      <button id="citizenOtpVerify" type="button">تأكيد</button></div>
      <p id="citizenOtpStatus" role="status" aria-live="polite"></p>
      <button id="citizenOtpCancel" type="button">إلغاء</button></form>`;
    document.body.append(dialog); dialog.showModal();
    let widget, challengeId, challengeToken = '', resolved = false, retryTimer;
    const status = text => { dialog.querySelector('#citizenOtpStatus').textContent = text; };
    const sendButton = dialog.querySelector('#citizenOtpSend');
    const codeInput = dialog.querySelector('#citizenOtpCode');
    const cancelLoading = event => { event?.preventDefault(); dialog.close(); };
    dialog.addEventListener('cancel', cancelLoading);
    dialog.querySelector('#citizenOtpCancel').onclick = () => cancelLoading();
    try {
      await prepareTurnstile();
      if (!dialog.open) throw new Error('تم إلغاء التحقق.');
      dialog.removeEventListener('cancel', cancelLoading);
      widget = window.turnstile.render('#citizenOtpChallenge', {sitekey:'0x4AAAAAAFX9HKrfcoJ_Z69Z', action:'citizen-otp',
        theme:'auto', language:'ar', size:'flexible', callback:token => { challengeToken = token; },
        'expired-callback':() => { challengeToken = ''; }, 'error-callback':() => { challengeToken = ''; status('تعذر التحقق الأمني. أعد المحاولة.'); }});
      return await new Promise((resolve, reject) => {
        dialog.querySelector('form').addEventListener('submit', e => e.preventDefault());
        const cancel = () => { if (!resolved) { resolved = true; reject(new Error('تم إلغاء التحقق.')); } };
        dialog.addEventListener('cancel', e => { e.preventDefault(); cancel(); });
        dialog.querySelector('#citizenOtpCancel').onclick = cancel;
        sendButton.onclick = async () => {
          const emailInput = dialog.querySelector('#citizenOtpEmail');
          if (!emailInput.reportValidity()) return;
          if (!challengeToken) { status('أكمل التحقق أولًا.'); return; }
          sendButton.disabled = true; status('جارٍ الإرسال…');
          try {
            const result = await api('start', {email:emailInput.value, purpose, captcha:challengeToken});
            if (!dialog.isConnected) return;
            challengeId = result.id; emailInput.readOnly = true;
            dialog.querySelector('#citizenOtpCodeGroup').hidden = false;
            status('أرسلنا الرمز إلى بريدك. صالح لمدة 5 دقائق.'); codeInput.focus();
            retryTimer = setTimeout(() => { sendButton.disabled = false; sendButton.textContent = 'إرسال رمز جديد'; }, 60000);
          } catch (e) { status(e.message); sendButton.disabled = false; }
          finally { challengeToken = ''; if (dialog.isConnected) window.turnstile.reset(widget); }
        };
        dialog.querySelector('#citizenOtpVerify').onclick = async () => {
          if (!challengeId || !/^\d{6}$/.test(codeInput.value)) { status('اكتب الرمز: 6 أرقام.'); return; }
          const button = dialog.querySelector('#citizenOtpVerify'); button.disabled = true;
          try { const result = await api('verify', {id:challengeId, code:codeInput.value}); resolved = true; resolve(result); }
          catch (e) { status(e.message); button.disabled = false; }
        };
      });
    } finally {
      clearTimeout(retryTimer);
      if (widget !== undefined) window.turnstile?.remove(widget);
      dialog.close(); dialog.remove(); active = false; previousFocus?.focus();
    }
  }
  window.getCitizenClient = async purpose => {
    if (window.currentStaffRole) return window.supabaseClient;
    // During staged rollout the old citizen flow stays usable until the database is locked.
    const response = await fetch(endpoint, {cache:'no-store', credentials:'omit'});
    if (!response.ok) throw new Error('خدمة التحقق غير متاحة مؤقتًا. حاول لاحقًا.');
    const config = await response.json();
    if (!config.enabled) return window.supabaseClient;
    const verified = await verifyEmail(purpose);
    async function call(action, payload) {
      try { return {data:(await api(action, {token:verified.token, payload})).data, error:null}; }
      catch (error) { return {data:null, error}; }
    }
    return {
      citizen:true,
      rpc(name, args) {
        const mapping = {get_my_order:'order_lookup', get_my_complaints:'complaint_lookup', check_nid_available:'check_nid_available', can_submit_complaint:'can_submit_complaint'};
        return call(mapping[name], {national_id:args.p_national_id, owner_name:args.p_owner_name, phone:args.p_phone});
      },
      from(table) { return {insert:rows => call(table === 'orders' ? 'order' : 'complaint', Array.isArray(rows) ? rows[0] : rows)}; },
      async citizenUpload(blob) {
        const response = await fetch(endpoint, {method:'POST', credentials:'omit', headers:{'Content-Type':'image/jpeg','X-Citizen-Proof':verified.token}, body:blob});
        const result = await response.json(); if (!response.ok) throw new Error(result.error || 'تعذر رفع الصورة.'); return result.path;
      }
    };
  };
})();
