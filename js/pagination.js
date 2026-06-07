// ═══════════════════════════════════════════════════════════════
// pagination.js - Server-Side Pagination v3.0
// ═══════════════════════════════════════════════════════════════

window.currentPage    = 1;
window.recordsPerPage = 100;
window.totalRecords   = 0;
window.currentFilter  = 'all';   // all / tuktuk / microbus
window.currentSearch  = '';
window.currentSearchType = 'all';
window.isLoading      = false;

// ── FETCH FROM SUPABASE ──────────────────────────────────────
async function fetchPage(page, search, searchType, filter) {
  const from = (page - 1) * window.recordsPerPage;
  const to   = from + window.recordsPerPage - 1;

  let query = window.supabaseClient
    .from('orders')
    .select('*', { count: 'exact' });

  // ── عزل تام: فرض فلتر نوع المركبة دائماً ──
  if (filter === 'tuktuk') {
    // التوكتوك: لا يملك license_plate أو قيمته فارغة
    query = query.or('license_plate.is.null,license_plate.eq.');
    if (window._newRequestsMode) {
      query = query.or('code.is.null,code.eq.');
    }
    if (window._stickerMode) {
      query = query.eq('status', 'sticker_applied');
    }
  } else if (filter === 'microbus') {
    // الميكروباص: يملك license_plate غير فارغ — لا يظهر أي توكتوك هنا أبداً
    query = query.not('license_plate', 'is', null).neq('license_plate', '');
  }
  // filter === 'all': لا قيد على النوع

  // ── البحث السياقي ──
  if (search && search.trim()) {
    const s = search.trim();

    if (searchType === 'name')
      query = query.ilike('owner_name', `%${s}%`);
    else if (searchType === 'code')
      query = query.eq('code', s);
    else if (searchType === 'plate')
      query = query.ilike('license_plate', `%${s}%`);
    else if (searchType === 'nationalId')
      query = query.eq('national_id', s);
    else if (searchType === 'phone')
      query = query.ilike('phone', `%${s}%`);
    else if (searchType === 'chassis')
      query = query.ilike('chassis_number', `%${s}%`);
    else if (searchType === 'motor')
      query = query.ilike('motor_number', `%${s}%`);
    else {
      // searchType === 'all' — يبحث في الحقول المناسبة للقسم فقط
      if (filter === 'microbus') {
        query = query.or(
          `owner_name.ilike.%${s}%,license_plate.ilike.%${s}%,national_id.eq.${s},phone.ilike.%${s}%`
        );
      } else if (filter === 'tuktuk') {
        query = query.or(
          `owner_name.ilike.%${s}%,code.eq.${s},national_id.eq.${s},phone.ilike.%${s}%,chassis_number.ilike.%${s}%,motor_number.ilike.%${s}%`
        );
      } else {
        // all
        query = query.or(
          `owner_name.ilike.%${s}%,code.eq.${s},national_id.eq.${s},phone.ilike.%${s}%,license_plate.ilike.%${s}%,chassis_number.ilike.%${s}%,motor_number.ilike.%${s}%`
        );
      }
    }
  }

  // ── فلتر التاريخ (اختياري) ──
  if (window._dateFrom) {
    query = query.gte('submitted_at', window._dateFrom + 'T00:00:00');
  }
  if (window._dateTo) {
    query = query.lte('submitted_at', window._dateTo + 'T23:59:59');
  }

  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  // Sort: التوكتوك بالكود رقمياً، الميكروباص بـ license_plate أبجدياً
  const sorted = (data || []).sort((a, b) => {
    if (filter === 'microbus') {
      return (a.license_plate || '').localeCompare(b.license_plate || '', 'ar');
    }
    const ca = a.code ? parseInt(a.code) : 999999;
    const cb = b.code ? parseInt(b.code) : 999999;
    return ca - cb;
  });

  return { data: sorted, count: count || 0 };
}

// ── RENDER TABLE ─────────────────────────────────────────────
function renderTable(orders) {
  const tukBody = document.getElementById('dataTable');
  const micBody = document.getElementById('microbusDataTable');
  const tukCont = document.getElementById('ordersTableContainer');
  const micCont = document.getElementById('microbusTableContainer');

  if (!tukBody) return;

  // Convert DB row → item format
  const toItem = (o) => ({
    id: o.id,
    owner: o.owner_name || '—',
    nationalId: o.national_id || '',
    phone: o.phone || '',
    vType: o.vehicle_type || 'توكتوك',
    vYear: o.vehicle_year || '',
    chassisNumber: o.chassis_number || '',
    motorNumber: o.motor_number || '',
    address: o.address || '',
    vCode: o.code || '',                  // التوكتوك فقط — الميكروباص ليس له كود
    licensePlate: o.license_plate || '',  // الميكروباص فقط
    line: o.line || '',
    passengerCapacity: o.passenger_capacity || '',
    renewalDate: o.renewal_date || '',
    refNumber: o.ref_number || '',
    timestamp: o.submitted_at || Date.now(),
    status: o.status || 'pending',
    statusHistory: o.status_history || [],
    images: o.images || [],
  });

  const filter = window.currentFilter;

  // ── عزل تام: حسب الفلتر الحالي ──
  if (filter === 'microbus') {
    // إخفاء جدول التوكتوك تماماً
    if (tukCont) tukCont.style.display = 'none';
    tukBody.innerHTML = '';

    // عرض الميكروباص فقط
    if (micBody && micCont) {
      if (orders.length > 0) {
        micCont.style.display = 'block';
        const frag = document.createDocumentFragment();
        orders.forEach(o => frag.appendChild(window.createTableRow(toItem(o), 'microbus')));
        micBody.innerHTML = '';
        micBody.appendChild(frag);
      } else {
        micCont.style.display = 'block';
        micBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:rgba(255,255,255,0.4)">لا توجد نتائج</td></tr>';
      }
    }
    return;
  }

  if (filter === 'tuktuk') {
    // إخفاء جدول الميكروباص تماماً
    if (micCont) micCont.style.display = 'none';
    if (micBody) micBody.innerHTML = '';

    // عرض التوكتوك فقط
    if (tukCont) tukCont.style.display = 'block';
    if (orders.length > 0) {
      const frag = document.createDocumentFragment();
      orders.forEach(o => frag.appendChild(window.createTableRow(toItem(o), 'tuktuk')));
      tukBody.innerHTML = '';
      tukBody.appendChild(frag);
    } else {
      tukBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:rgba(255,255,255,0.4)">لا توجد نتائج</td></tr>';
    }
    return;
  }

  // filter === 'all' — فصل بناءً على license_plate
  const tukOrders = orders.filter(o => !o.license_plate || o.license_plate === '');
  const micOrders = orders.filter(o => o.license_plate && o.license_plate !== '');

  // Render tuktuk
  if (tukOrders.length > 0) {
    if (tukCont) tukCont.style.display = 'block';
    const frag = document.createDocumentFragment();
    tukOrders.forEach(o => frag.appendChild(window.createTableRow(toItem(o), 'tuktuk')));
    tukBody.innerHTML = '';
    tukBody.appendChild(frag);
  } else {
    if (tukCont) tukCont.style.display = 'none';
    tukBody.innerHTML = '';
  }

  // Render microbus
  if (micBody) {
    if (micOrders.length > 0) {
      if (micCont) micCont.style.display = 'block';
      const frag = document.createDocumentFragment();
      micOrders.forEach(o => frag.appendChild(window.createTableRow(toItem(o), 'microbus')));
      micBody.innerHTML = '';
      micBody.appendChild(frag);
    } else {
      if (micCont) micCont.style.display = 'none';
      micBody.innerHTML = '';
    }
  }
}

// ── UPDATE UI ────────────────────────────────────────────────
function updatePaginationUI(count) {
  window.totalRecords = count;
  const totalPages = Math.ceil(count / window.recordsPerPage) || 1;
  const pageText = `صفحة ${window.currentPage} من ${totalPages}`;

  // Top bar
  const pageInfo  = document.getElementById('pageInfo');
  if (pageInfo)  pageInfo.textContent  = pageText;

  // Bottom bar
  const pageInfo2  = document.getElementById('pageInfo2');
  if (pageInfo2)  pageInfo2.textContent  = pageText;

  // Floating (mobile)
  const floatPag  = document.getElementById('floatPagination');
  const floatInfo = document.getElementById('floatPageInfo');
  if (floatInfo) floatInfo.textContent = `${window.currentPage} / ${totalPages}`;
  if (floatPag && window.innerWidth <= 768 && document.body.classList.contains('admin-mode')) {
    floatPag.style.display = 'flex';
  }

  const loading = document.getElementById('loadingMoreInfo');
  if (loading) loading.style.display = 'none';
}

// ── MAIN LOAD ────────────────────────────────────────────────
async function loadPage(page) {
  if (window.isLoading) return;
  window.isLoading = true;

  const loading = document.getElementById('loadingMoreInfo');
  if (loading) loading.style.display = 'inline-block';

  try {
    const { data, count } = await fetchPage(
      page,
      window.currentSearch,
      window.currentSearchType,
      window.currentFilter
    );

    window.currentPage = page;
    renderTable(data);
    updatePaginationUI(count);

    // Update stats on first load
    if (page === 1 && !window.currentSearch) {
      updateStats();
    }
  } catch (err) {
    const tukBody = document.getElementById('dataTable');
    if (tukBody) tukBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:#f87171">❌ خطأ في تحميل البيانات</td></tr>';
  } finally {
    window.isLoading = false;
  }
}

// ── STATS ────────────────────────────────────────────────────
async function updateStats() {
  try {
    // شارة الطلبات الجديدة — توكتوك فقط بدون كود (الميكروباص لا يمر بمرحلة التكويد)
    const { count: newReqs } = await window.supabaseClient
      .from('orders').select('*', { count:'exact', head:true })
      .or('license_plate.is.null,license_plate.eq.')   // توكتوك فقط
      .or('code.is.null,code.eq.');                     // بدون كود بعد
    const badge = document.getElementById('newRequestsBadge');
    if (badge) {
      badge.textContent = newReqs || 0;
      badge.style.display = (newReqs > 0) ? 'inline-flex' : 'none';
    }

    // شارة الشكاوى غير المردود عليها
    const { count: compPending } = await window.supabaseClient
      .from('complaints').select('*', { count:'exact', head:true })
      .neq('status','replied');
    const compBadge = document.getElementById('compBadge');
    if (compBadge) {
      compBadge.textContent = compPending || 0;
      compBadge.style.display = (compPending > 0) ? 'inline-flex' : 'none';
    }
  } catch(e) { console.error('Stats error:', e); }
}

// ── PUBLIC API ───────────────────────────────────────────────
window.changePage = function(direction) {
  const totalPages = Math.ceil(window.totalRecords / window.recordsPerPage) || 1;
  const newPage = window.currentPage + direction;
  if (newPage < 1 || newPage > totalPages) return;
  loadPage(newPage);
};

window.changeRecordsPerPage = function() {
  const val = document.getElementById('recordsPerPage').value;
  window.recordsPerPage = val === 'all' ? 500 : parseInt(val);
  loadPage(1);
};

window.searchOrders = function() {
  const input = document.getElementById('searchInput');
  const type  = document.getElementById('searchType');
  window.currentSearch     = input ? input.value.trim() : '';
  window.currentSearchType = type  ? type.value : 'all';
  loadPage(1);
};

window.filterByVehicleType = function(filter) {
  window.currentFilter = filter;

  // تحديث عنوان الـ page bar
  const barTitle = document.getElementById('adminPageBarTitle');
  if (barTitle) {
    const labels = {
      all:      { icon: 'ri-truck-line',    text: 'جدول المركبات — الكل' },
      tuktuk:   { icon: 'ri-motorbike-line',text: 'جدول المركبات — توكتوك' },
      microbus: { icon: 'ri-bus-line',      text: 'جدول المركبات — ميكروباص' },
    };
    const l = labels[filter] || labels.all;
    barTitle.innerHTML = `<i class="${l.icon}"></i> ${l.text}`;
  }

  // تحديث خيارات البحث السياقي حسب نوع المركبة
  const searchType = document.getElementById('searchType');
  const searchInput = document.getElementById('searchInput');
  if (searchType) {
    if (searchInput) { searchInput.value = ''; window.currentSearch = ''; }
    searchType.value = 'all';
    window.currentSearchType = 'all';

    const tuktukOpts = [
      { value: 'all',        label: '🔍 الكل' },
      { value: 'code',       label: '🔢 الكود' },
      { value: 'name',       label: '👤 الاسم' },
      { value: 'nationalId', label: '🆔 الرقم القومي' },
      { value: 'chassis',    label: '⚙️ الشاسيه' },
      { value: 'motor',      label: '🔩 الموتور' },
    ];
    const microbusOpts = [
      { value: 'all',        label: '🔍 الكل' },
      { value: 'plate',      label: '🚗 رقم اللوحة' },
      { value: 'name',       label: '👤 الاسم' },
      { value: 'nationalId', label: '🆔 الرقم القومي' },
    ];
    const allOpts = [
      { value: 'all',        label: '🔍 الكل' },
      { value: 'name',       label: '👤 الاسم' },
      { value: 'code',       label: '🔢 الكود' },
      { value: 'nationalId', label: '🆔 الرقم القومي' },
      { value: 'phone',      label: '📱 الهاتف' },
      { value: 'chassis',    label: '⚙️ الشاسيه' },
      { value: 'motor',      label: '🔩 الموتور' },
    ];

    const opts = filter === 'tuktuk'   ? tuktukOpts
               : filter === 'microbus' ? microbusOpts
               : allOpts;

    searchType.innerHTML = opts.map(o =>
      `<option value="${o.value}">${o.label}</option>`
    ).join('');
  }

  // Update filter status
  const statusEl   = document.getElementById('filterStatus');
  const statusText = document.getElementById('filterStatusText');
  if (statusEl && statusText) {
    if (filter === 'all') { statusEl.style.display = 'none'; }
    else {
      statusEl.style.display = 'block';
      statusText.textContent = filter === 'tuktuk' ? 'عرض التوكتوك فقط' : 'عرض الميكروباص فقط';
    }
  }
  loadPage(1);
};

window.initializePagination = function(ordersArray) {
  // Called from old code — just load from server instead
  loadPage(1);
};

// ── SEARCH TYPE AUTO-SWITCH ──────────────────────────────────
// ملاحظة: لا نغير الفلتر تلقائياً عند تغيير نوع البحث
// الفلتر يتغير فقط من الـ sidebar أو الـ chips
document.addEventListener('DOMContentLoaded', function() {
  // intentionally empty — no auto-switch to prevent data mixing
});

// ── SUPERVISOR LOG ───────────────────────────────────────────
async function logSupervisorAction(action, details, recordId = null) {
  try {
    await window.supabaseClient.from('supervisor_logs').insert([{
      username:  sessionStorage.getItem('username') || 'غير معروف',
      user_role: sessionStorage.getItem('userRole') || 'VIEWER',
      action, details, record_id: recordId,
      timestamp: new Date().toISOString()
    }]);
  } catch(e) { /* silent */ }
}
window.logSupervisorAction = logSupervisorAction;

// ══════════════════════════════════════════════════════════
// 1. Session Timeout - تسجيل خروج تلقائي بعد 15 دقيقة خمول
// ══════════════════════════════════════════════════════════
(function initSessionTimeout() {
  const TIMEOUT_MS = 15 * 60 * 1000; // 15 دقيقة
  let timeoutId = null;

  function resetTimer() {
    // فقط لو المستخدم مسجل دخول في لوحة التحكم
    if (!sessionStorage.getItem('adminRole')) return;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      if (sessionStorage.getItem('adminRole')) {
        window.showToast('انتهت جلستك بسبب عدم النشاط. سيتم تسجيل الخروج...', 'warning', 4000);
        setTimeout(() => {
          sessionStorage.clear();
          location.reload();
        }, 4000);
      }
    }, TIMEOUT_MS);
  }

  ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(evt =>
    document.addEventListener(evt, resetTimer, { passive: true })
  );

  resetTimer();
  window._resetSessionTimer = resetTimer;
})();

// ══════════════════════════════════════════════════════════
// 2. Offline / Online Detection
// ══════════════════════════════════════════════════════════
window.addEventListener('offline', () => {
  window.showToast('انقطع الاتصال بالإنترنت', 'error', 0); // 0 = لا يختفي
});
window.addEventListener('online', () => {
  // إزالة toast الانقطاع وإظهار رسالة الاستعادة
  const container = document.getElementById('toastContainer');
  if (container) container.innerHTML = '';
  window.showToast('تم استعادة الاتصال', 'success', 3000);
});

