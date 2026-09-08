// ═══════════════════════════════════════════════════════════════
// pagination.js - Server-Side Pagination v3.0
// ═══════════════════════════════════════════════════════════════

window.currentPage    = 1;
window.recordsPerPage = 100;
window.totalRecords   = 0;
window.currentFilter  = 'tuktuk'; // tuktuk / microbus (لا يوجد خيار الكل للمركبات)
window.currentSearch  = '';
window.currentSearchType = 'all';
window.isLoading      = false;

// ── FETCH FROM SUPABASE ──────────────────────────────────────
async function fetchPage(page, search, searchType, filter) {
  const from = (page - 1) * window.recordsPerPage;
  const to   = from + window.recordsPerPage - 1;

  // ضمان عدم تمرير 'all'if (!filter || filter === 'all') filter = 'tuktuk';

  let query = window.supabaseClient
    .from('orders')
    .select('*', { count: 'exact'});

  // ── عزل تام: قسم الميكروباص أو قسم التوكتوك فقط ──
  if (filter === 'microbus') {
    // الميكروباص: يملك license_plate غير فارغ — لا يظهر أي توكتوك هنا أبداً
    query = query.not('license_plate', 'is', null).neq('license_plate', '');
  } else {
    // التوكتوك: لا يملك license_plate أو قيمته فارغة
    query = query.or('license_plate.is.null,license_plate.eq.');
    if (window._newRequestsMode) {
      query = query.or('code.is.null,code.eq.');
    }
    if (window._stickerMode) {
      query = query.eq('status', 'sticker_applied');
    }
  }

  // ── البحث السياقي ──
  if (search && search.trim()) {
    let s = search.trim();
    // تحويل الأرقام المشرقية إلى إنجليزية
    s = toAsciiDigits(s);
    // حماية من حقن فلاتر PostgREST بتطهير الرموز المحجوزة (المبني عليها عامل .or)
    s = s.replace(/[,()"\\]/g, '');
    if (!s) return { data: [], count: 0 };

    if (searchType === 'name')
      query = query.ilike('owner_name', `%${s}%`);
    else if (searchType === 'code') {
      const cleanCode = s.replace(/[^0-9]/g, '');
      if (cleanCode) {
        // بحث مرن بالكود: يدعم البحث بالأرقام الأولى أو الكود بالكامل
        query = query.ilike('code', `%${cleanCode}%`);
      } else {
        // إذا كتب الاسم وهو في وضع الكود، ابحث بالاسم تلقائياً
        query = query.ilike('owner_name', `%${s}%`);
      }
    }
    else if (searchType === 'plate') {
      // بحث مرن يطابق اللوحة سواء كانت الحروف متباعدة (ر ع و) أو متصلة
      const flexible = s.replace(/\s+/g, '%');
      query = query.ilike('license_plate', `%${flexible}%`);
    }
    else if (searchType === 'nationalId')
      query = query.ilike('national_id', `%${s}%`);
    else if (searchType === 'phone')
      query = query.ilike('phone', `%${s}%`);
    else if (searchType === 'chassis')
      query = query.ilike('chassis_number', `%${s}%`);
    else if (searchType === 'motor')
      query = query.ilike('motor_number', `%${s}%`);
    else {
      // searchType === 'all'— يبحث في حقول القسم المناسب
      if (filter === 'microbus') {
        const flexible = s.replace(/\s+/g, '%');
        query = query.or(
          `owner_name.ilike.%${s}%,license_plate.ilike.%${flexible}%,national_id.ilike.%${s}%,phone.ilike.%${s}%`);
      } else {
        // tuktuk
        query = query.or(
          `owner_name.ilike.%${s}%,code.ilike.%${s}%,national_id.ilike.%${s}%,phone.ilike.%${s}%,chassis_number.ilike.%${s}%,motor_number.ilike.%${s}%`);
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

  const filter = (window.currentFilter === 'microbus') ? 'microbus': 'tuktuk';

  // ── عزل تام: قسم الميكروباص أو قسم التوكتوك ──
  if (filter === 'microbus') {
    // إخفاء جدول التوكتوك تماماً
    if (tukCont) tukCont.style.display = 'none';
    if (tukBody) tukBody.innerHTML = '';

    // عرض الميكروباص فقط
    if (micBody && micCont) {
      micCont.style.display = 'block';
      if (orders.length > 0) {
        const frag = document.createDocumentFragment();
        orders.forEach(o => frag.appendChild(window.createTableRow(toItem(o), 'microbus')));
        micBody.innerHTML = '';
        micBody.appendChild(frag);
      } else {
        micBody.innerHTML = '<tr><td colspan="8"style="text-align:center;padding:24px;color:rgba(255,255,255,0.4)">لا توجد نتائج في قسم الميكروباص</td></tr>';
      }
    }
  } else {
    // إخفاء جدول الميكروباص تماماً
    if (micCont) micCont.style.display = 'none';
    if (micBody) micBody.innerHTML = '';

    // عرض التوكتوك فقط
    if (tukCont) tukCont.style.display = 'block';
    if (tukBody) {
      if (orders.length > 0) {
        const frag = document.createDocumentFragment();
        orders.forEach(o => frag.appendChild(window.createTableRow(toItem(o), 'tuktuk')));
        tukBody.innerHTML = '';
        tukBody.appendChild(frag);
      } else {
        tukBody.innerHTML = '<tr><td colspan="8"style="text-align:center;padding:24px;color:rgba(255,255,255,0.4)">لا توجد نتائج في قسم التوكتوك</td></tr>';
      }
    }
  }
}

// ── UPDATE UI ────────────────────────────────────────────────
function updatePaginationUI(count) {
  window.totalRecords = count;
  const totalPages = Math.ceil(count / window.recordsPerPage) || 1;
  const pageText = `صفحة ${window.currentPage} من ${totalPages}`;

  // Update single bottom bar
  const pageInfo = document.getElementById('pageInfo');
  if (pageInfo) pageInfo.textContent = pageText;

  const isFirst = window.currentPage <= 1;
  const isLast = window.currentPage >= totalPages;

  const prevBtn = document.getElementById('prevPageBtn');
  if (prevBtn) {
    prevBtn.disabled = isFirst;
    prevBtn.style.opacity = isFirst ? '0.45': '1';
    prevBtn.style.cursor = isFirst ? 'not-allowed': 'pointer';
  }

  const nextBtn = document.getElementById('nextPageBtn');
  if (nextBtn) {
    nextBtn.disabled = isLast;
    nextBtn.style.opacity = isLast ? '0.45': '1';
    nextBtn.style.cursor = isLast ? 'not-allowed': 'pointer';
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
    if (tukBody) tukBody.innerHTML = '<tr><td colspan="8"style="text-align:center;padding:24px;color:#f87171"> خطأ في تحميل البيانات</td></tr>';
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
      badge.style.display = (newReqs > 0) ? 'inline-flex': 'none';
    }

    // شارة الشكاوى غير المردود عليها
    const { count: compPending } = await window.supabaseClient
      .from('complaints').select('*', { count:'exact', head:true })
      .neq('status','replied');
    const compBadge = document.getElementById('compBadge');
    if (compBadge) {
      compBadge.textContent = compPending || 0;
      compBadge.style.display = (compPending > 0) ? 'inline-flex': 'none';
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
  window.recordsPerPage = val === 'all'? 500 : parseInt(val);
  loadPage(1);
};

// ── دالة تحويل الأرقام المشرقية (١٢٣) إلى إنجليزية (123) ──
function toAsciiDigits(str) {
  if (!str) return '';
  return String(str).replace(/[\u0660-\u0669]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48));
}
window.toAsciiDigits = toAsciiDigits;

// ── تنسيق لوحة السيارة تلقائياً: حروف متباعدة (ر ع و) + أرقام عادية (1234) ──
function formatLicensePlateString(val) {
  if (!val) return '';
  val = toAsciiDigits(val);

  const hasTrailingSpace = val.endsWith('');
  const letters = val.match(/[\u0621-\u064A]/g) || [];
  const digits  = val.match(/[0-9]/g) || [];

  let formatted = '';
  if (letters.length > 0 && digits.length > 0) {
    const firstLetter = val.search(/[\u0621-\u064A]/);
    const firstDigit  = val.search(/[0-9]/);
    if (firstDigit < firstLetter) {
      formatted = digits.join('') + ''+ letters.join('');
    } else {
      formatted = letters.join('') + ''+ digits.join('');
    }
  } else if (letters.length > 0) {
    formatted = letters.join('');
  } else if (digits.length > 0) {
    formatted = digits.join('');
  } else {
    return val;
  }

  if (hasTrailingSpace && !formatted.endsWith('')) {
    formatted += '';
  }
  return formatted;
}
window.formatLicensePlateString = formatLicensePlateString;

// ── معالج إدخال البحث التفاعلي ──
window.handleSearchInput = function(e) {
  const input = (e && e.target) ? e.target : document.getElementById('searchInput');
  if (!input) return;

  const sType = window.currentSearchType || (window.currentFilter === 'microbus'? 'plate': 'code');

  // تنسيق اللوحة تلقائياً عند البحث باللوحة أو إدخال حروف لوحة في قسم الميكروباص
  if (sType === 'plate'|| (window.currentFilter === 'microbus'&& sType === 'all')) {
    const prevPos = input.selectionStart;
    const prevLen = input.value.length;
    const formatted = formatLicensePlateString(input.value);
    if (formatted !== input.value) {
      input.value = formatted;
      if (prevPos >= prevLen) {
        input.setSelectionRange(formatted.length, formatted.length);
      }
    }
  } else if (sType === 'code') {
    // الكود: أرقام فقط وتحويل الأرقام العربية
    const prevVal = input.value;
    const converted = toAsciiDigits(prevVal).replace(/[^0-9]/g, '');
    if (converted !== prevVal) {
      input.value = converted;
    }
  }

  window.searchOrders();
};

// ── تغيير نوع فلتر البحث يدوياً من القائمة ──
window.onSearchTypeChange = function() {
  const searchType  = document.getElementById('searchType');
  const searchInput = document.getElementById('searchInput');
  if (!searchType || !searchInput) return;

  const val = searchType.value;
  window.currentSearchType = val;

  const placeholders = {
    code:       'ابحث برقم الكود (مثال: 123)...',
    plate:      'اكتب رقم اللوحة (مثال: ر ع و 1234)...',
    name:       'ابحث باسم المالك...',
    nationalId: 'ابحث بالرقم القومي (14 رقم)...',
    phone:      'ابحث برقم الهاتف...',
    chassis:    'ابحث برقم الشاسيه...',
    motor:      'ابحث برقم الموتور...',
    all:        'بحث شامل في كل الحقول...',
  };
  searchInput.placeholder = placeholders[val] || 'ابحث في السجلات...';

  // إعادة تنسيق النص المكتوب حالياً إن وجد
  if (val === 'plate'&& searchInput.value) {
    searchInput.value = formatLicensePlateString(searchInput.value);
  } else if (val === 'code'&& searchInput.value) {
    searchInput.value = toAsciiDigits(searchInput.value).replace(/[^0-9]/g, '');
  }

  window.searchOrders(true);
};

let _searchDebounceTimer = null;
window.searchOrders = function(immediate) {
  if (_searchDebounceTimer) {
    clearTimeout(_searchDebounceTimer);
    _searchDebounceTimer = null;
  }

  const exec = () => {
    const input = document.getElementById('searchInput');
    const type  = document.getElementById('searchType');
    window.currentSearch     = input ? input.value.trim() : '';
    window.currentSearchType = type  ? type.value : (window.currentFilter === 'microbus'? 'plate': 'code');
    loadPage(1);
  };

  if (immediate) {
    exec();
  } else {
    _searchDebounceTimer = setTimeout(exec, 220);
  }
};

window.filterByVehicleType = function(filter) {
  // لا يوجد شيء اسمه 'all'للمركبات: إما توكتوك أو ميكروباص
  filter = (filter === 'microbus') ? 'microbus': 'tuktuk';
  window.currentFilter = filter;

  // تحديث أزرار الأقسام (Chips) إن وجدت
  const chipTuk = document.getElementById('chipTuktuk');
  const chipMic = document.getElementById('chipMicrobus');
  if (chipTuk) chipTuk.classList.toggle('active', filter === 'tuktuk');
  if (chipMic) chipMic.classList.toggle('active', filter === 'microbus');

  // تحديث شريط تنقل الإدارة للموبايل
  const bnavTuk = document.getElementById('adminBnavTuktuk');
  const bnavMic = document.getElementById('adminBnavMicrobus');
  if (bnavTuk) bnavTuk.classList.toggle('active', filter === 'tuktuk');
  if (bnavMic) bnavMic.classList.toggle('active', filter === 'microbus');

  // تحديث عنوان شريط الصفحة وفق القسم النشط
  const barTitle = document.getElementById('adminPageBarTitle');
  if (barTitle) {
    barTitle.textContent = (filter === 'microbus') ? 'سجلات سيارات الميكروباص' : 'سجلات مركبات التوكتوك';
  }

  // تحديث خيارات البحث السياقي حسب نوع المركبة بدون أي كلمة افتراضي
  const searchType = document.getElementById('searchType');
  const searchInput = document.getElementById('searchInput');
  if (searchType) {
    if (searchInput) { searchInput.value = ''; window.currentSearch = ''; }

    const tuktukOpts = [
      { value: 'code',       label: 'الكود'},
      { value: 'name',       label: 'اسم المالك'},
      { value: 'nationalId', label: 'الرقم القومي'},
      { value: 'phone',      label: 'رقم الهاتف'},
      { value: 'chassis',    label: 'رقم الشاسيه'},
      { value: 'motor',      label: 'رقم الموتور'},
      { value: 'all',        label: 'بحث شامل'},
    ];
    const microbusOpts = [
      { value: 'plate',      label: 'رقم اللوحة'},
      { value: 'name',       label: 'اسم المالك / السائق'},
      { value: 'nationalId', label: 'الرقم القومي'},
      { value: 'phone',      label: 'رقم الهاتف'},
      { value: 'all',        label: 'بحث شامل'},
    ];

    const opts = (filter === 'microbus') ? microbusOpts : tuktukOpts;
    const defaultSearchType = (filter === 'microbus') ? 'plate': 'code';

    searchType.innerHTML = opts.map(o =>
      `<option value="${o.value}"${o.value === defaultSearchType ? 'selected': ''}>${o.label}</option>`).join('');

    searchType.value = defaultSearchType;
    window.currentSearchType = defaultSearchType;

    if (searchInput) {
      searchInput.placeholder = (filter === 'microbus')
        ? 'اكتب رقم اللوحة (مثال: ر ع و 1234)...': 'ابحث برقم الكود...';
    }
  }

  // إخفاء إشعار الفلتر القديم
  const statusEl = document.getElementById('filterStatus');
  if (statusEl) statusEl.style.display = 'none';

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

