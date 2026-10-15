// Trusted static handlers extracted from HTML; no eval or inline script execution.
(function() {
  document.querySelectorAll('[data-app-error="0"]').forEach(element => {
    element.addEventListener('error', function(event) {
      const result = (function(event) { this.onerror=null;this.src='sharkiya_flag.png' }).call(this, event);
      if(result === false) event.preventDefault();
    }, {once:true});
  });
  document.querySelectorAll('[data-app-click="1"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { goToAdmin() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="2"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('loginBtn').click() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="3"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.smartBack() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="4"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { bnavGo('portalSection','bnav-home') }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="5"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { bnavGo('citizenPage','bnav-register') }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="6"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { bnavGo('inquiryPage','bnav-inquiry') }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="7"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { bnavGo('complaintsPage','bnav-complaint') }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="8"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { bnavLogin() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="9"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.switchToVehicleSection('tuktuk') }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="10"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.switchToVehicleSection('microbus') }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="11"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { sidebarNav('newRequests') }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="12"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { sidebarNav('complaints') }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="13"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.openAdminQuickMenu() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="14"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { bnavGo('citizenPage', 'bnav-register') }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="15"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { bnavGo('complaintsSelectionPage', '') }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="16"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { bnavGo('citizenPage', 'bnav-register') }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="17"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { bnavGo('inquiryPage', 'bnav-inquiry') }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="18"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { quickInquirySearch() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="19"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { openWASheet() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="20"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { closeWASheet() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="21"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.smartBack() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-input="22"]').forEach(element => {
    element.addEventListener('input', function(event) {
      const result = (function(event) { validateNationalId(this) }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-change="23"]').forEach(element => {
    element.addEventListener('change', function(event) {
      const result = (function(event) { verifyBirthDate() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-change="24"]').forEach(element => {
    element.addEventListener('change', function(event) {
      const result = (function(event) { verifyBirthDate() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-change="25"]').forEach(element => {
    element.addEventListener('change', function(event) {
      const result = (function(event) { verifyBirthDate() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="26"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.smartBack() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="27"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.print() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="28"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.smartBack() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="29"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { openComplaintForm('توكتوك') }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="30"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { openComplaintForm('ميكروباص') }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="31"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.smartBack() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="32"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.smartBack() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-change="33"]').forEach(element => {
    element.addEventListener('change', function(event) {
      const result = (function(event) { window.onSearchTypeChange() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-input="34"]').forEach(element => {
    element.addEventListener('input', function(event) {
      const result = (function(event) { window.handleSearchInput(event) }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="35"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.changePage(-1) }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="36"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.changePage(1) }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-change="37"]').forEach(element => {
    element.addEventListener('change', function(event) {
      const result = (function(event) { window.changeRecordsPerPage() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="38"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { searchForCode() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="39"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('imgModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="40"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('codeModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="41"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('codeModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="42"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('bulkImportModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="43"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('editModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="44"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('editModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="45"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('activityLogModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="46"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { closeLoginModal() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="47"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { closeLoginModal() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-error="48"]').forEach(element => {
    element.addEventListener('error', function(event) {
      const result = (function(event) { this.onerror=null;this.src='sharkiya_flag.png' }).call(this, event);
      if(result === false) event.preventDefault();
    }, {once:true});
  });
  document.querySelectorAll('[data-app-keypress="49"]').forEach(element => {
    element.addEventListener('keypress', function(event) {
      const result = (function(event) { if(event.key==='Enter')document.getElementById('confirmLoginBtn').click() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="50"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { toggleLoginPassword() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="51"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('dateFilterModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="52"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { clearDateFilter() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="53"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('statusChangeModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="54"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('statusChangeModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="55"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('complaintReplyModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="56"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('complaintReplyModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="57"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('supervisorLogModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="58"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { if(event.target===this)this.style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="59"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('vehicleDossierModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="60"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('actionsModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="61"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('detailsModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="62"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('devTeamModal').style.display='flex' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="63"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { if(event.target===this)this.style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="64"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('citizenCardModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="65"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.print() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="66"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('citizenCardModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="67"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { if(event.target===this)window.closeAdminQuickMenu() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="68"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.closeAdminQuickMenu() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="69"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.closeAdminQuickMenu();window.openStatsModal() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="70"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.closeAdminQuickMenu();window.goToPortalFromAdmin() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="71"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.closeAdminQuickMenu();window.openStaffManagementModal() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="72"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.closeAdminQuickMenu();window.logoutAdmin() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="73"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { if(event.target===this)this.style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="74"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('statsDashboardModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="75"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.switchToVehicleSection('tuktuk');document.getElementById('statsDashboardModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="76"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.switchToVehicleSection('microbus');document.getElementById('statsDashboardModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="77"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { showStickerAppliedOrders();document.getElementById('statsDashboardModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="78"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('statsDashboardModal').style.display='none';sidebarNav('complaints') }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="79"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.openStatsModal() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="80"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { if(event.target===this)this.style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="81"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('staffManagementModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="82"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.handleCreateSupervisor() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="83"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { if(event.target===this)this.style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="84"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { document.getElementById('devTeamModal').style.display='none' }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="85"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { if(event.target===this)window.closeLogoutModal() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="86"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.confirmLogoutAdmin() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
  document.querySelectorAll('[data-app-click="87"]').forEach(element => {
    element.addEventListener('click', function(event) {
      const result = (function(event) { window.closeLogoutModal() }).call(this, event);
      if(result === false) event.preventDefault();
    });
  });
})();
