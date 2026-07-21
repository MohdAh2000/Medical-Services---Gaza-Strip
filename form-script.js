

// ===== STATE =====
let currentStep  = 1;
const TOTAL_STEPS = 4;
let selectedLat  = null;
let selectedLng  = null;
let formMap      = null;
let tempMarker   = null;
let gazaBoundary = null;
let toastTimer   = null;

// ===== تحميل حدود غزة =====
fetch('GazaBoun.geojson')
  .then(r => r.json())
  .then(data => { gazaBoundary = data.features; });

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  updateUI();
  bindEvents();
});

// ===== ربط الأحداث =====
function bindEvents() {
  document.getElementById('btn-next').addEventListener('click', nextStep);
  document.getElementById('btn-prev').addEventListener('click', prevStep);
  document.getElementById('btn-submit').addEventListener('click', submitForm);

  // معاينة الصورة
  document.getElementById('f-image').addEventListener('change', handleImagePreview);

  // منع كتابة أرقام في اسم الخدمة
  document.getElementById('f-name').addEventListener('input', function() {
    this.value = this.value.replace(/[0-9]/g, '');
  });

  // إزالة حالة الخطأ عند الكتابة
  ['f-name', 'f-type', 'f-area', 'f-status', 'f-operator'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('change', () => clearError(el));
    el.addEventListener('input',  () => clearError(el));
  });
}

// ===== التنقل بين الخطوات =====
function nextStep() {
  if (!validateStep(currentStep)) return;
  if (currentStep < TOTAL_STEPS) {
    currentStep++;
    updateUI();
  }
}

function prevStep() {
  if (currentStep > 1) {
    currentStep--;
    updateUI();
  }
}

// ===== تحديث الواجهة =====
function updateUI() {
  // إخفاء كل الخطوات
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    document.getElementById(`step-${i}`).classList.remove('active');

    const item   = document.getElementById(`step-item-${i}`);
    const circle = item.querySelector('.step-circle');
    item.classList.remove('active', 'done');

    if (i < currentStep) {
      item.classList.add('done');
      circle.innerHTML = '✓';
    } else {
      circle.textContent = i;
      if (i === currentStep) item.classList.add('active');
    }
  }

  // تحديث الخطوط الفاصلة
  document.querySelectorAll('.step-divider').forEach((div, idx) => {
    div.classList.toggle('done', idx + 1 < currentStep);
  });

  // تفعيل الخطوة الحالية
  document.getElementById(`step-${currentStep}`).classList.add('active');

  // أزرار التنقل
  const btnPrev   = document.getElementById('btn-prev');
  const btnNext   = document.getElementById('btn-next');
  const btnSubmit = document.getElementById('btn-submit');

  btnPrev.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
  btnNext.style.display    = currentStep < TOTAL_STEPS ? 'flex' : 'none';
  btnSubmit.style.display  = currentStep === TOTAL_STEPS ? 'flex' : 'none';

  // تهيئة الخريطة عند الخطوة 3
  if (currentStep === 3) setTimeout(initMap, 50);

  // ملء بيانات المراجعة عند الخطوة 4
  if (currentStep === 4) fillReview();
}

// ===== التحقق من كل خطوة =====
function validateStep(step) {
  let valid = true;

  if (step === 1) {
    valid = validateField('f-name',   'err-name')   && valid;
    valid = validateSelect('f-type',   'err-type')   && valid;
    valid = validateSelect('f-area',   'err-area')   && valid;
    valid = validateSelect('f-status', 'err-status') && valid;
  }

  if (step === 2) {
    valid = validateSelect('f-operator', 'err-operator') && valid;
  }

  if (step === 3) {
    if (!selectedLat || !selectedLng) {
      document.getElementById('err-location').classList.add('visible');
      valid = false;
    }
  }

  return valid;
}

function validateField(inputId, errId) {
  const el  = document.getElementById(inputId);
  const err = document.getElementById(errId);
  if (!el.value.trim()) {
    el.classList.add('error');
    err.classList.add('visible');
    return false;
  }
  clearError(el);
  err.classList.remove('visible');
  return true;
}

function validateSelect(selectId, errId) {
  const el  = document.getElementById(selectId);
  const err = document.getElementById(errId);
  if (!el.value) {
    el.classList.add('error');
    err.classList.add('visible');
    return false;
  }
  clearError(el);
  err.classList.remove('visible');
  return true;
}

function clearError(el) {
  el.classList.remove('error');
}

// ===== تهيئة الخريطة =====
function initMap() {
  if (formMap) { formMap.invalidateSize(); return; }

  formMap = L.map('form-map', {
    center: [31.42, 34.39],
    zoom: 11,
    doubleClickZoom: false,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(formMap);

  // رسم حدود غزة
  if (gazaBoundary) {
    L.geoJSON({ type: 'FeatureCollection', features: gazaBoundary }, {
      style: { fillOpacity: 0.05, color: '#0F2854', weight: 1.5, dashArray: '5,5' }
    }).addTo(formMap);
  }

  // حدث النقر على الخريطة
  formMap.on('click', onMapClick);

  setTimeout(() => formMap.invalidateSize(), 100);
}

function onMapClick(e) {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;

  // التحقق من حدود غزة
  if (gazaBoundary) {
    const point    = turf.point([lng, lat]);
    const isInside = gazaBoundary.some(f => turf.booleanPointInPolygon(point, f));
    if (!isInside) {
      showToast('لا يمكن اختيار موقع خارج حدود قطاع غزة', 'error');
      return;
    }
  }

  selectedLat = lat;
  selectedLng = lng;

  // تحريك الماركر أو إنشاؤه
  if (tempMarker) {
    tempMarker.setLatLng([lat, lng]);
  } else {
    tempMarker = L.marker([lat, lng]).addTo(formMap);
  }

  // تحديث عرض الإحداثيات
  const coordsBox = document.getElementById('coords-box');
  coordsBox.textContent = `خط العرض: ${lat.toFixed(5)} | خط الطول: ${lng.toFixed(5)}`;
  coordsBox.classList.add('selected');

  // إزالة رسالة الخطأ
  document.getElementById('err-location').classList.remove('visible');
}

// ===== معاينة الصورة =====
function handleImagePreview() {
  const input   = document.getElementById('f-image');
  const preview = document.getElementById('file-preview');
  const img     = document.getElementById('preview-img');

  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      img.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// ===== ملء بيانات المراجعة =====
function fillReview() {
  document.getElementById('rv-name').textContent     = document.getElementById('f-name').value;
  document.getElementById('rv-type').textContent     = document.getElementById('f-type').value;
  document.getElementById('rv-area').textContent     = document.getElementById('f-area').value;
  document.getElementById('rv-status').textContent   = document.getElementById('f-status').value;
  document.getElementById('rv-operator').textContent = document.getElementById('f-operator').value;
  document.getElementById('rv-coords').textContent   = selectedLat
    ? `${selectedLat.toFixed(5)}, ${selectedLng.toFixed(5)}`
    : '—';
}

// ===== الإرسال إلى Supabase =====
async function submitForm() {
  showToast('جاري إرسال الخدمة...', 'loading');

  try {
    const name      = document.getElementById('f-name').value.trim();// عشان تصل الداتا بيز منظفة
    const type      = document.getElementById('f-type').value;
    const area      = document.getElementById('f-area').value;
    const status    = document.getElementById('f-status').value;
    const operator  = document.getElementById('f-operator').value;
    const imageFile = document.getElementById('f-image').files[0];

    // رفع الصورة (اختياري)
    let image_url = null;
    if (imageFile) {
      const fileExt  = imageFile.name.split('.').pop();
      const filePath = `${Math.random()}-${Date.now()}.${fileExt}`;

      const { error: imgError } = await sb.storage
        .from('MedicalServicesImg')
        .upload(filePath, imageFile, { cacheControl: '3600', upsert: false });

      if (imgError) {
        console.error('Upload error:', imgError);
        showToast('فشل رفع الصورة: ' + imgError.message, 'error');
        return;
      }

      const urlResult = sb.storage.from('MedicalServicesImg').getPublicUrl(filePath);
      
      if (urlResult.error) {
        console.error('Public URL error:', urlResult.error);
        showToast('خطأ في الحصول على رابط الصورة: ' + urlResult.error.message, 'error');
        return;
      }
      
      image_url = urlResult.data.publicUrl;
      console.log('Generated public URL:', image_url);
    }

    // إرسال البيانات لجدول suggestions
    const { error } = await  sb.from('medicalServices').insert([{
      name,
      type,
      area,
      status,
      operator,
      lat: selectedLat,
      lng: selectedLng,
      image_url,
    }]);

 if (error) {
    console.error(error);

    if (!navigator.onLine) {
        showToast('فشل الاتصال بالإنترنت', 'error');
    } else {
        showToast('حدث خطأ أثناء الإرسال', 'error');
    }

    return;
}

    // ===== نجاح =====
    hideToast();
    showSuccessScreen();

  } catch (err) {
    console.error(err);
    showToast('خطأ غير متوقع، حاول مرة أخرى', 'error');
  }
}

// ===== شاشة النجاح =====
function showSuccessScreen() {
  // إخفاء الفورم وشريط التقدم والأزرار
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  document.getElementById('form-nav').style.display      = 'none';
  document.querySelector('.progress-bar-wrap').style.display = 'none';

  // إظهار شاشة النجاح
  document.getElementById('success-screen').classList.add('visible');
}

// ===== TOAST =====
function showToast(message, type = 'success', duration = 3000) {
  const toast = document.getElementById('toast');
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }

  const icons = {
    success: `<span class="toast-icon success-icon">✓</span>`,
    error:   `<span class="toast-icon error-icon">✕</span>`,
    loading: `<span class="toast-icon loading-icon">⟳</span>`,
  };

  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-inner">
      <button class="toast-close" onclick="hideToast()">×</button>
      <div class="toast-body">
        ${icons[type] || icons.success}
        <span class="toast-msg">${message}</span>
      </div>
      ${type !== 'loading' ? `<div class="toast-bar"></div>` : ''}
    </div>`;

  toast.classList.remove('hidden');

  if (type !== 'loading') {
    toastTimer = setTimeout(hideToast, duration);
  }
}

function hideToast() {
  const toast = document.getElementById('toast');
  toast.classList.add('hidden');
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
}
