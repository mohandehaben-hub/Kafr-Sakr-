// config.js - إعدادات قاعدة البيانات

const SUPABASE_URL = window.SUPABASE_URL || 'https://xlieswavjjgqsnczesct.supabase.co';
const SUPABASE_KEY = window.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsaWVzd2F2ampncXNuY3plc2N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDY3ODMsImV4cCI6MjA4NjkyMjc4M30.B5UvhsGQ80h86pOTFa9Yd9YOjK1DaY-8KPN1mtLBRbk';

// Initialize Supabase Client
(function() {
    function initSupabase() {
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            checkExistingSession();
        } else {
            setTimeout(initSupabase, 100);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSupabase);
    } else {
        initSupabase();
    }

    async function checkExistingSession() {
        const savedSession = sessionStorage.getItem('supabaseSession');
        const savedRole = sessionStorage.getItem('adminRole');
        const savedUsername = sessionStorage.getItem('adminUsername');

        if (savedSession && savedRole && savedUsername) {
            try {
                const { data: { session }, error } = await window.supabaseClient.auth.getSession();
                if (session && !error) {                    window.currentUsername = savedUsername;
                    window.currentRole = savedRole;
                    window.userRole = savedRole;

                    ['portalSection','citizenPage','inquiryPage','complaintsPage',
                     'complaintInquiryPage','loginModal'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.style.display = 'none';
                    });

                    const adminPage = document.getElementById('adminPage');
                    if (adminPage) adminPage.style.display = 'block';
                    const loginBtn = document.getElementById('loginBtn');
                    if (loginBtn) loginBtn.style.display = 'none';
                    // أزرار الـ sidebar — تُظهر في الـ footer
                    const logoutBtn   = document.getElementById('logoutBtn');
                    const goPortalBtn = document.getElementById('goPortalBtn');
                    const goAdminBtn  = document.getElementById('goAdminBtn');
                    if (logoutBtn)   logoutBtn.style.display   = 'flex';
                    if (goPortalBtn) goPortalBtn.style.display = 'flex';
                    if (goAdminBtn)  goAdminBtn.style.display  = 'none';
                    window._navSource = 'admin';

                    if (typeof loadAdminData === 'function') {
                        await loadAdminData();
                        window.adminDataLoaded = true;
                    }
                    if (typeof loadComplaints === 'function') loadComplaints();

                    // admin-mode UI
                    document.body.classList.add('admin-mode');
                    window._navSource = 'admin';
                    const headerAdminBtn = document.getElementById('headerAdminBtn');
                    if (headerAdminBtn) headerAdminBtn.style.display = 'none';
                    const leadershipSection = document.getElementById('leadershipSection');
                    if (leadershipSection) leadershipSection.style.display = 'none';
                    const sidebarToggle = document.getElementById('sidebarToggleBtn');
                    if (sidebarToggle) sidebarToggle.style.display = window.innerWidth <= 768 ? 'inline-flex' : 'none';
                    const fabBtn = document.getElementById('fabLoginBtn');
                    if (fabBtn) { fabBtn.innerHTML = '🚪'; fabBtn.onclick = () => window.logoutAdmin && window.logoutAdmin(); }

                    // إظهار أدوات الصيانة للـ SUPER
                    if (savedRole === 'SUPER') {
                        const maintenanceTools = document.getElementById('maintenanceTools');
                        if (maintenanceTools) maintenanceTools.style.display = 'block';
                        const navLogs = document.getElementById('navLogs');
                        if (navLogs) navLogs.style.display = 'flex';
                        const navExport = document.getElementById('navExport');
                        if (navExport) navExport.style.display = 'flex';
                    }

                    // إخفاء أزرار الاستيراد للـ VIEWER
                    if (savedRole === 'VIEWER') {
                        const bulkImportBtn = document.getElementById('bulkImportBtn');
                        if (bulkImportBtn) bulkImportBtn.style.display = 'none';
                    }

                } else {
                    window.adminDataLoaded = false;
                    sessionStorage.clear();
                }
            } catch (err) {
                console.error('❌ خطأ في استعادة الجلسة:', err);
                window.adminDataLoaded = false;
                sessionStorage.clear();
            }
        }
    }
})();
