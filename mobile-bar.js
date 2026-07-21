// ===== شريط الموبايل =====
let mobileBarInitialized = false;

function updateMobileBarVisibility() {
  const mobileBar = document.getElementById('mobile-bar');
  if (!mobileBar) return;

  if (window.innerWidth <= 799) {
    mobileBar.style.display = 'flex';
  } else {
    mobileBar.style.display = 'none';
  }
}

function initializeMobileBar() {
  // تحديث الظهور دائماً عند أي تغيير
  updateMobileBarVisibility();

  // تسجيل الأحداث مرة واحدة فقط
  if (mobileBarInitialized) return;
  mobileBarInitialized = true;

  const mobSearchBtn         = document.getElementById('mob-search-btn');
  const mobFilterBtn         = document.getElementById('mob-filter-btn');
  const mobSearchBox         = document.getElementById('mob-search-box');
  const mobFilterPanel       = document.getElementById('mob-filter-panel');
  const mobSearchInput       = document.getElementById('mob-search-input');
  const mobSearchGo          = document.getElementById('mob-search-go');
  const mobSearchSuggestions = document.getElementById('mob-search-suggestions');
  const mobFilterType        = document.getElementById('mob-filter-type');
  const mobFilterRegion      = document.getElementById('mob-filter-region');
  const mobileBar            = document.getElementById('mobile-bar');

  if (!mobileBar) return;

  // ===== زر البحث =====
  if (mobSearchBtn) {
    mobSearchBtn.addEventListener('click', () => {
      const isOpen = mobSearchBox && !mobSearchBox.classList.contains('hidden');
      if (isOpen) {
        mobSearchBox.classList.add('hidden');
        mobSearchBtn.classList.remove('active');
      } else {
        if (mobFilterPanel) mobFilterPanel.classList.add('hidden');
        if (mobFilterBtn)   mobFilterBtn.classList.remove('active');
        if (mobSearchBox)   mobSearchBox.classList.remove('hidden');
        mobSearchBtn.classList.add('active');
        if (mobSearchInput) mobSearchInput.focus();
      }
    });
  }

  // ===== تنفيذ البحث =====
  const hideMobSuggestions = () => {
    if (mobSearchSuggestions) {
      mobSearchSuggestions.classList.add('hidden');
      mobSearchSuggestions.innerHTML = '';
    }
  };

  const showMobSuggestions = (text) => {
    if (!mobSearchSuggestions || typeof getSearchSuggestions !== 'function') return;
    const suggestions = getSearchSuggestions(text);
    showSuggestions(suggestions, mobSearchSuggestions, mobSearchInput);
  };

  if (mobSearchGo) {
    mobSearchGo.addEventListener('click', () => {
      const text = mobSearchInput ? mobSearchInput.value.trim() : '';
      if (!text) {
        showToast('الرجاء إدخال اسم الخدمة', 'error', 1500);
        return;
      }
      searchService(text);
      hideMobSuggestions();
      if (mobSearchBox)   mobSearchBox.classList.add('hidden');
      if (mobSearchBtn)   mobSearchBtn.classList.remove('active');
      if (mobSearchInput) mobSearchInput.value = '';
    });
  }

  if (mobSearchInput) {
    mobSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); if (mobSearchGo) mobSearchGo.click(); }
    });
    mobSearchInput.addEventListener('input', (e) => {
      const text = e.target.value.trim();
      text ? showMobSuggestions(text) : hideMobSuggestions();
    });
    mobSearchInput.addEventListener('focus', () => {
      const text = mobSearchInput.value.trim();
      if (text) showMobSuggestions(text);
    });
    mobSearchInput.addEventListener('blur', () => setTimeout(hideMobSuggestions, 180));
  }

  // ===== زر الفلتر =====
  if (mobFilterBtn) {
    mobFilterBtn.addEventListener('click', () => {
      const isOpen = mobFilterPanel && !mobFilterPanel.classList.contains('hidden');
      if (isOpen) {
        mobFilterPanel.classList.add('hidden');
        mobFilterBtn.classList.remove('active');
      } else {
        if (mobSearchBox)   mobSearchBox.classList.add('hidden');
        if (mobSearchBtn)   mobSearchBtn.classList.remove('active');
        if (mobFilterPanel) mobFilterPanel.classList.remove('hidden');
        mobFilterBtn.classList.add('active');
      }
    });
  }

  // ===== تطبيق الفلتر =====
  function applyMobileFilters() {
    const typeValue = mobFilterType ? mobFilterType.value : '';
    const areaValue = mobFilterRegion ? mobFilterRegion.value : '';
    const filtered  = allServices.filter(service => {
      const matchType = !typeValue || service.type === typeValue;
      const matchArea = !areaValue || service.area === areaValue;
      return matchType && matchArea;
    });
    drawServicesOnMap(filtered);
    if (mobFilterPanel) mobFilterPanel.classList.add('hidden');
    if (mobFilterBtn)   mobFilterBtn.classList.remove('active');
  }

  if (mobFilterType)   mobFilterType.addEventListener('change', applyMobileFilters);
  if (mobFilterRegion) mobFilterRegion.addEventListener('change', applyMobileFilters);

  // ===== إغلاق عند النقر خارج الشريط =====
  document.addEventListener('click', (e) => {
    if (!mobileBar.contains(e.target)) {
      if (mobSearchBox)   mobSearchBox.classList.add('hidden');
      if (mobFilterPanel) mobFilterPanel.classList.add('hidden');
      if (mobSearchBtn)   mobSearchBtn.classList.remove('active');
      if (mobFilterBtn)   mobFilterBtn.classList.remove('active');
      hideMobSuggestions();
    }
  });
}

// تشغيل عند التحميل
initializeMobileBar();

// تحديث الظهور عند تغيير حجم النافذة
window.addEventListener('resize', updateMobileBarVisibility);