const purposes = new Set(['order', 'complaint', 'order_lookup', 'complaint_lookup']);
const actions = new Set([...purposes, 'check_nid_available', 'can_submit_complaint']);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const proofPattern = /^[a-f0-9]{64}$/;
const encoder = new TextEncoder();
function reply(data, status = 200) {
  return Response.json(data, {status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
  }});
}
function error(status, message) { return Object.assign(new Error(message), {status}); }
async function boundedBody(request, limit) {
  if (Number(request.headers.get('Content-Length')) > limit) throw error(413, 'حجم الطلب كبير.');
  const reader = request.body?.getReader();
  if (!reader) throw error(400, 'الطلب غير مكتمل.');
  const chunks = []; let size = 0;
  while (true) {
    const {done, value} = await reader.read(); if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw error(413, 'حجم الطلب كبير.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
const digest = value => crypto.subtle.digest('SHA-256', encoder.encode(value)).then(hex);
async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}
function randomCode() {
  const a = new Uint32Array(1); let n;
  do { crypto.getRandomValues(a); n = a[0]; } while (n >= 4294000000);
  return String(n % 1000000).padStart(6, '0');
}
async function rpc(env, name, payload = {}) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method:'POST', headers:{'Content-Type':'application/json', apikey:env.SUPABASE_SERVICE_KEY},
    body:JSON.stringify(payload), signal:AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // Never return raw database/provider errors or citizen data to the client.
    if (data?.code === '42501') throw error(403, 'التحقق غير صالح أو انتهى. اطلب رمزًا جديدًا.');
    if (['22023','23505','P0001'].includes(data?.code)) throw error(400, 'تعذر إتمام العملية. راجع البيانات أو تواصل مع مجلس المدينة.');
    throw error(503, 'الخدمة غير متاحة مؤقتًا. حاول لاحقًا.');
  }
  return data;
}
async function upload(request, env) {
  const token = request.headers.get('X-Citizen-Proof') || '';
  if (!proofPattern.test(token)) throw error(403, 'تحقق من بريدك أولًا.');
  if (request.headers.get('Content-Type') !== 'image/jpeg') throw error(415, 'يُسمح بصور JPEG المجهزة فقط.');
  const bytes = await boundedBody(request, 1572864);
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) {
    throw error(415, 'الصورة غير صالحة.');
  }
  let position=2, dimensions=false;
  while(position+4<Math.min(bytes.length,65536)) {
    if(bytes[position++]!==255) break;
    while(bytes[position]===255) position++;
    const marker=bytes[position++];
    const length=(bytes[position]<<8)|bytes[position+1];
    if(length<2 || position+length>bytes.length) break;
    if(marker===192 || marker===194) {
      const height=(bytes[position+3]<<8)|bytes[position+4], width=(bytes[position+5]<<8)|bytes[position+6];
      dimensions=length>=8 && width>0 && height>0 && width<=1200 && height<=1200; break;
    }
    if(marker===218 || marker===217) break;
    position+=length;
  }
  if(!dimensions) throw error(415, 'أبعاد الصورة أو صيغتها غير صالحة.');
  const reservation = await rpc(env, 'citizen_action', {p_proof_hash:await digest(token), p_action:'upload', p_payload:{size:bytes.length}});
  const path = `${reservation.prefix}${crypto.randomUUID()}.jpg`;
  const response = await fetch(`${env.SUPABASE_URL}/storage/v1/object/vehicle-images/${path}`, {
    method:'POST', headers:{apikey:env.SUPABASE_SERVICE_KEY,
      'Content-Type':'image/jpeg', 'x-upsert':'false'}, body:bytes, signal:AbortSignal.timeout(20000)
  });
  if (!response.ok) throw error(503, 'تعذر رفع الصورة. حاول لاحقًا.');
  return reply({path});
}
async function cleanup(env) {
  try {
    const paths=await rpc(env,'citizen_orphan_uploads');
    if(!paths?.length) return;
    await fetch(`${env.SUPABASE_URL}/storage/v1/object/vehicle-images`,{method:'DELETE',
      headers:{apikey:env.SUPABASE_SERVICE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({prefixes:paths}),signal:AbortSignal.timeout(15000)});
  } catch (_) { /* A later request retries cleanup; no citizen details enter logs. */ }
}
export async function onRequest(context) {
  const {request,env}=context;
  try {
    if (request.method !== 'GET' && request.method !== 'POST') return reply({error:'Method not allowed'}, 405);
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY || !env.CITIZEN_OTP_PEPPER || !env.BREVO_API_KEY || !env.TURNSTILE_SECRET) {
      throw error(503, 'جارٍ تجهيز خدمة التحقق. حاول لاحقًا.');
    }
    const enabled = await rpc(env, 'citizen_otp_enabled');
    if (request.method === 'GET') return reply({enabled:enabled === true});
    const origin = env.APP_ORIGIN || 'https://ks-smart-tok.com';
    if (request.headers.get('Origin') !== origin || new URL(request.url).origin !== origin) {
      throw error(403, 'مصدر الطلب غير مسموح.');
    }
    if (!enabled) throw error(503, 'جارٍ تجهيز خدمة التحقق. حاول لاحقًا.');
    if (request.headers.get('Content-Type') === 'image/jpeg') return await upload(request, env);
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw error(415, 'صيغة الطلب غير صالحة.');
    let body;
    try { body = JSON.parse(new TextDecoder().decode(await boundedBody(request, 65536))); }
    catch (e) { if(e.status) throw e; throw error(400, 'صيغة الطلب غير صالحة.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw error(400, 'صيغة الطلب غير صالحة.');
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip) throw error(403, 'تعذر التحقق من الاتصال.');
    const ipHash = await hmac(env.CITIZEN_OTP_PEPPER, 'ip:' + ip);
    if (body.action === 'start') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,63}$/.test(email)
          || !purposes.has(body.purpose) || typeof body.captcha !== 'string' || body.captcha.length > 2048) {
        throw error(400, 'أدخل بريدًا إلكترونيًا صحيحًا وأكمل التحقق.');
      }
      const challenge = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({secret:env.TURNSTILE_SECRET,
          response:body.captcha, remoteip:ip}), signal:AbortSignal.timeout(10000)
      });
      const checked = await challenge.json();
      if (!checked.success || checked.hostname !== new URL(origin).hostname || checked.action !== 'citizen-otp') {
        throw error(403, 'أكمل التحقق الأمني ثم أعد المحاولة.');
      }
      const id = crypto.randomUUID(), code = randomCode();
      const issued = await rpc(env, 'citizen_otp_issue', {p_id:id, p_email:email, p_purpose:body.purpose,
        p_code_hash:await hmac(env.CITIZEN_OTP_PEPPER, id + ':' + code), p_ip_hash:ipHash});
      if (!issued.ok) throw error(429, 'وصلت لحد المحاولات المتاح. انتظر قليلًا وحاول لاحقًا.');
      const message = `رمز التحقق الخاص بك: ${code}\nصالح لمدة 5 دقائق ولعملية واحدة. لا تشاركه مع أحد.\nإذا لم تطلبه فتجاهل الرسالة.\n\nمجلس مدينة كفر صقر، كفر صقر، الشرقية، 44681، مصر.`;
      const sent = await fetch('https://api.brevo.com/v3/smtp/email', {
        method:'POST', headers:{'api-key':env.BREVO_API_KEY, 'Content-Type':'application/json'},
        body:JSON.stringify({sender:{name:'مجلس مدينة كفر صقر - تقنين المركبات',email:'noreply@notify.ks-smart-tok.com'},
          to:[{email}], subject:'رمز التحقق - منظومة تقنين المركبات', textContent:message,
          htmlContent:`<html lang="ar" dir="rtl"><body><h2>تأكيد بريدك الإلكتروني</h2><p>رمز التحقق الخاص بك:</p><p style="font-size:32px;letter-spacing:8px">${code}</p><p>صالح لمدة 5 دقائق ولعملية واحدة. لا تشاركه مع أحد.</p><p>إذا لم تطلبه فتجاهل الرسالة.</p><footer>مجلس مدينة كفر صقر، كفر صقر، الشرقية، 44681، مصر.</footer></body></html>`,
          tags:['citizen-otp'], headers:{IdempotencyKey:id}}), signal:AbortSignal.timeout(15000)
      });
      await rpc(env, 'citizen_otp_mark_sent', {p_id:id, p_sent:sent.ok});
      if (!sent.ok) throw error(503, 'تعذر إرسال البريد الآن. حاول لاحقًا.');
      context.waitUntil?.(cleanup(env));
      return reply({id, expiresIn:300, retryAfter:60});
    }
    if (body.action === 'verify') {
      if (!uuid.test(body.id || '') || !/^\d{6}$/.test(body.code || '')) throw error(400, 'أدخل رمز التحقق المكون من 6 أرقام.');
      const token = hex(crypto.getRandomValues(new Uint8Array(32)));
      const verified = await rpc(env, 'citizen_otp_verify', {p_id:body.id,
        p_code_hash:await hmac(env.CITIZEN_OTP_PEPPER, body.id + ':' + body.code), p_ip_hash:ipHash,
        p_proof_hash:await digest(token)});
      if (!verified.ok) throw error(403, 'الرمز غير صحيح أو انتهت صلاحيته.');
      return reply({token, id:verified.id, purpose:verified.purpose, expiresIn:900});
    }
    if (actions.has(body.action) && proofPattern.test(body.token || '') && body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)) {
      const data = await rpc(env, 'citizen_action', {p_proof_hash:await digest(body.token), p_action:body.action, p_payload:body.payload});
      return reply({data});
    }
    throw error(400, 'الطلب غير صالح.');
  } catch (e) { return reply({error:e.status ? e.message : 'الخدمة غير متاحة مؤقتًا. حاول لاحقًا.'}, e.status || 503); }
}
