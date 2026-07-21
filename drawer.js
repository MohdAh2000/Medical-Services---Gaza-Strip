// ===== DRAWER =====
const drawer      = document.getElementById('drawer');
const drawerClose = document.getElementById('drawer-close');

// ===== فتح الـ Drawer =====
function openDrawer(service) {
  fillDrawer(service);
  drawer.classList.add('open');

  // إخفاء mobile-bar عند فتح الـ Drawer على الموبايل
  if (window.innerWidth <= 768) {
    const mb = document.getElementById('mobile-bar');
    if (mb) mb.style.display = 'none'; // إخفاء فقط وليس حذف
  }

  // // remove mobile helper bar if exists (legacy)
  // const mb = document.getElementById('mobile-bar');
  // if (mb) mb.remove();
}

// ===== إغلاق الـ Drawer =====
function closeDrawer() {
  drawer.classList.remove('open');

  // إعادة إظهار mobile-bar
  if (window.innerWidth <= 768) {
    const mb = document.getElementById('mobile-bar');
    if (mb) mb.style.display = 'flex';
  }
}

// ensure restoration when closeDrawer is called programmatically
// const originalCloseDrawer = closeDrawer;
// closeDrawer = function() {
//   originalCloseDrawer();
//   setTimeout(restoreHeaderControls, 80);
// };

// // Ensure header controls are visible again (fallback) when drawer closed
// function restoreHeaderControls() {
//   try {
//     const selectors = ['.tabs-row .search-box', '.tabs-row .dashboard-btn', '.tabs-row .dropdown-select'];
//     selectors.forEach(sel => {
//       document.querySelectorAll(sel).forEach(el => {
//         el.style.display = '';
//       });
//     });
//   } catch (e) {
//     // ignore
//   }
// }

// // call restore after closing to ensure UI returns to normal
// drawerClose.addEventListener('click', () => setTimeout(restoreHeaderControls, 80));
// document.addEventListener('keydown', (e) => {
//   if (e.key === 'Escape') setTimeout(restoreHeaderControls, 80);
// });

// زر الإغلاق
drawerClose.addEventListener('click', closeDrawer);

// ESC للإغلاق
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDrawer();
});

// ===== ملء بيانات الـ Drawer =====
function fillDrawer(service) {

  // الاسم
  document.getElementById('drawer-name').textContent =
    service.name + " .." || '—';

  // النوع
  document.getElementById('drawer-type').textContent =
   "النوع: " + service.type || '—';

  // المنطقة
  document.getElementById('drawer-area').textContent =
    "المحافظة: " + service.area || '—';

  // الجهة المشغلة
  document.getElementById('drawer-operator').textContent =
     "الجهة المشغلة: " + service.operator || 'غير محدد';

  // الحالة — مع لون مناسب
  const statusEl = document.getElementById('drawer-status');
  const status   =   service.status || '—';
  statusEl.textContent = "الحالة: " +status;
  statusEl.className   = 'drawer-status';

  if (status === 'تعمل بشكل كامل') {
    statusEl.classList.add('active') ;
  } else if (status === 'تعمل جزئياً') {
    statusEl.classList.add('partial');
  } else if (status === 'مغلقة') {
    statusEl.classList.add('closed');
  }

  // الصورة
  const img         = document.getElementById('drawer-img');
  const placeholder = document.getElementById('drawer-img-placeholder');



  if (service.image_url) {
    const imageUrl = service.image_url.trim();
    
    img.onerror = null;
    img.onload = null;
    
    img.onload = () => {
      console.log('✓ Image loaded successfully');
      img.classList.add('visible');
      placeholder.classList.add('hidden');
    };
    
    
    
    img.src = imageUrl;
  } else {
    img.src = '';
    img.classList.remove('visible');
    placeholder.classList.remove('hidden');
  }

  // ===== استخراج الإحداثيات من geom =====
  let lat = null;
  let lng = null;

  if (service.geom) {
    try {
      const geojson = service.geom;
      let coords = null;

      if (geojson.type === 'Point') {
        coords = geojson.coordinates;
      } else if (geojson.type === 'Feature' && geojson.geometry?.type === 'Point') {
        coords = geojson.geometry.coordinates;
      }

      if (coords) {
        lng = coords[0];
        lat = coords[1];
      }
    } catch (e) {
      console.warn('خطأ في قراءة geom:', e);
    }
  }

  // زر نسخ الإحداثيات
  const coordsBtn = document.getElementById('drawer-coords-btn');
  if (lat && lng) {
    coordsBtn.onclick = () => {
      navigator.clipboard.writeText(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
        .then(() => showToast('تم نسخ الإحداثيات', 'success', 2000))
        .catch(() => showToast('فشل النسخ', 'error', 2000));
    };
  } else {
    coordsBtn.onclick = () => showToast('لا توجد إحداثيات متاحة', 'error', 2000);
  }

  // زر فتح في Google Maps
  const mapsBtn = document.getElementById('drawer-maps-btn');
  if (lat && lng) {
    mapsBtn.href = `https://www.google.com/maps?q=${lat},${lng}`;
  } else {
    mapsBtn.href = '#';
  }
}