// طبقة لتجميع القياسات (مشتركة بين المسافة والمساحة)
const measureLayer = L.layerGroup().addTo(map);

// ==================== قياس المسافة ====================
let measuring = false;
let distancePoints = [];
let tempDistLine = null;
let tempDistMarkers = [];

const MeasureControl = L.Control.extend({
  options: { position: "topleft" },
  onAdd: function () {
    const container = L.DomUtil.create("div", "leaflet-bar measure-control");
    const btn = L.DomUtil.create("a", "measure-btn", container);
    btn.href = "#";
    btn.title = "قياس المسافة ";
    btn.innerHTML = '<i class="fa-solid fa-ruler fa-xs"></i>';

    L.DomEvent.on(btn, "click", L.DomEvent.stop)
              .on(btn, "click", toggleMeasure);
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    return container;
  }
});
map.addControl(new MeasureControl());

function toggleMeasure() {
  if (measuringArea) toggleAreaMeasure();

  measuring = !measuring;

  if (measuring) {
    distancePoints = [];
    map.getContainer().classList.add("measuring-cursor");
    map.doubleClickZoom.disable();
    if (tempDistLine) { map.removeLayer(tempDistLine); tempDistLine = null; }
    map.on("click", onMapClick);
    map.on("dblclick", onDistanceDblClick);
    map.on("mousemove", onMapMouseMove);
  } else {
    map.getContainer().classList.remove("measuring-cursor");
    map.doubleClickZoom.enable();
    map.off("click", onMapClick);
    map.off("dblclick", onDistanceDblClick);
    map.off("mousemove", onMapMouseMove);
    clearDistanceTemp();
    distancePoints = [];
  }
}

function clearDistanceTemp() {
  tempDistMarkers.forEach(m => map.removeLayer(m));
  tempDistMarkers = [];
  if (tempDistLine) { map.removeLayer(tempDistLine); tempDistLine = null; }
}

function onMapClick(e) {
  // تجاهل النقرة الثانية من الدبل كليك
  if (e.originalEvent && e.originalEvent.detail >= 2) return;

  distancePoints.push(e.latlng);

  // نقطة مؤقتة
  const dot = L.circleMarker(e.latlng, {
    radius: 5, weight: 2, color: "rgba(228, 17, 45, 1)",
    fillColor: "#fff", fillOpacity: 1, interactive: false
  }).addTo(map);
  tempDistMarkers.push(dot);

  // تحديث الخط المؤقت
  if (tempDistLine) map.removeLayer(tempDistLine);
  if (distancePoints.length > 1) {
    tempDistLine = L.polyline(distancePoints, {
      color: "black", weight: 2, opacity: 0.8, dashArray: "6,6"
    }).addTo(map);
  }
}

function onMapMouseMove(e) {
  if (distancePoints.length === 0) return;
  const latlngs = [...distancePoints, e.latlng];
  if (!tempDistLine) {
    tempDistLine = L.polyline(latlngs, { color: "black", weight: 2, opacity: 0.8, dashArray: "6,6" }).addTo(map);
  } else {
    tempDistLine.setLatLngs(latlngs);
  }
}

function onDistanceDblClick(e) {
  if (distancePoints.length < 2) {
    showToast("حدد نقطتين على الأقل", "error",1500);
    toggleMeasure();
    return;
  }

  // حساب المسافة الكلية بـ Turf.js
  const coords = distancePoints.map(p => [p.lng, p.lat]);
  const line = turf.lineString(coords);
  const distance = turf.length(line, { units: "meters" });
  const text = distance >= 1000
    ? (distance / 1000).toFixed(2) + " كم"
    : distance.toFixed(1) + " متر";

  // مسح المؤقت
  clearDistanceTemp();

  // رسم الخط النهائي
  const finalLine = L.polyline(distancePoints, { color: "white", weight: 3 });

  // نقاط الزوايا النهائية
  distancePoints.forEach(p => {
    measureLayer.addLayer(L.circleMarker(p, {
      radius: 5, weight: 2, color: "rgba(228, 17, 45, 1)",
      fillColor: "#fff", fillOpacity: 1, interactive: false
    }));
  });

  // Tooltip في المنتصف
  const mid = finalLine.getBounds().getCenter();
  const label = L.tooltip({
    permanent: true, direction: "center", className: "measure-label"
  }).setLatLng(mid).setContent("المسافة: " + text).addTo(map);

  measureLayer.addLayer(finalLine);
  measureLayer.addLayer(label);

  toggleMeasure();
}

// ==================== قياس المساحة ====================
let measuringArea = false;
let areaPoints = [];
let tempAreaMarkers = []; // نقاط مؤقتة
let tempAreaLine = null;
let tempAreaPolygon = null;

const AreaControl = L.Control.extend({
  options: { position: "topleft" },
  onAdd: function () {
    const container = L.DomUtil.create("div", "leaflet-bar measure-control");
    const btn = L.DomUtil.create("a", "", container);
    btn.href = "#";
    btn.title = "قياس المساحة ";
    btn.innerHTML = '<i class="fa-solid fa-pentagon fa-xs"></i>';

    L.DomEvent.on(btn, "click", L.DomEvent.stop)
              .on(btn, "click", toggleAreaMeasure);
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    return container;
  }
});
map.addControl(new AreaControl());

function toggleAreaMeasure() {
  // إيقاف المسافة إذا كانت شغالة
  if (measuring) toggleMeasure();

  measuringArea = !measuringArea;

  if (measuringArea) {
    areaPoints = [];
    map.getContainer().classList.add("measuring-cursor");
    map.doubleClickZoom.disable();
    map.on("click", onAreaClick);
    map.on("dblclick", onAreaDblClick);
  } else {
    map.getContainer().classList.remove("measuring-cursor");
    map.doubleClickZoom.enable();
    map.off("click", onAreaClick);
    map.off("dblclick", onAreaDblClick);
    clearAreaTemp();
    areaPoints = [];
  }
}

// مسح العناصر المؤقتة فقط (بدون حذف النتيجة النهائية من measureLayer)
function clearAreaTemp() {
  tempAreaMarkers.forEach(m => map.removeLayer(m));
  tempAreaMarkers = [];
  if (tempAreaLine) { map.removeLayer(tempAreaLine); tempAreaLine = null; }
  if (tempAreaPolygon) { map.removeLayer(tempAreaPolygon); tempAreaPolygon = null; }
}

function onAreaClick(e) {
  // تجاهل النقرة الثانية من الدبل كليك
  if (e.originalEvent && e.originalEvent.detail >= 2) return;

  areaPoints.push(e.latlng);

  // نقطة مؤقتة لكل نقرة — نفس ستايل المسافة
  const dot = L.circleMarker(e.latlng, {
    radius: 5, weight: 2,
    color: "rgba(228, 17, 45, 1)",
    fillColor: "#fff", fillOpacity: 1, interactive: false
  }).addTo(map);
  tempAreaMarkers.push(dot);

  // خط مؤقت
  if (tempAreaLine) map.removeLayer(tempAreaLine);
  if (areaPoints.length > 1) {
    tempAreaLine = L.polyline(areaPoints, {
      color: "black", dashArray: "6,6", weight: 2, opacity: 0.8
    }).addTo(map);
  }

  // مضلع مؤقت شفاف
  if (areaPoints.length > 2) {
    if (tempAreaPolygon) map.removeLayer(tempAreaPolygon);
    tempAreaPolygon = L.polygon(areaPoints, {
      color: "rgba(228, 17, 45, 1)", fillOpacity: 0.1, weight: 2, dashArray: "6,6"
    }).addTo(map);
  }
}

function onAreaDblClick(e) {
  if (areaPoints.length < 3) {
    showToast("حدد 3 نقاط على الأقل", "error",1500);
    toggleAreaMeasure();
    return;
  }

  // حساب المساحة بـ Turf.js
  const coords = areaPoints.map(p => [p.lng, p.lat]);
  coords.push(coords[0]); // إغلاق المضلع
  const polygon = turf.polygon([coords]);
  const area = turf.area(polygon);

  const text = area >= 1000000
    ? (area / 1000000).toFixed(3) + " كم²"
    : area.toFixed(1) + " م²";

  // مسح العناصر المؤقتة
  clearAreaTemp();

  // رسم المضلع النهائي — نفس لون المسافة
  const finalPolygon = L.polygon(areaPoints, {
    color: "white", weight: 3, fillOpacity: 0.15
  });
  const mid = finalPolygon.getBounds().getCenter();

  // نقاط الزوايا النهائية
  areaPoints.forEach(p => {
    measureLayer.addLayer(L.circleMarker(p, {
      radius: 5, weight: 2,
      color: "rgba(228, 17, 45, 1)",
      fillColor: "#fff", fillOpacity: 1, interactive: false
    }));
  });

  // Tooltip بنفس ستايل المسافة
  const label = L.tooltip({
    permanent: true, direction: "center", className: "measure-label"
  }).setLatLng(mid).setContent("المساحة: " + text).addTo(map);

  measureLayer.addLayer(finalPolygon);
  measureLayer.addLayer(label);

  toggleAreaMeasure();
}

// ==================== زر المسح (مشترك) ====================
const ClearMeasureControl = L.Control.extend({
  options: { position: "topleft" },
  onAdd: function () {
    const container = L.DomUtil.create("div", "leaflet-bar measure-control");
    const btn = L.DomUtil.create("a", "clear-measure-btn", container);
    btn.href = "#";
    btn.title = "مسح جميع القياسات";
    btn.innerHTML = '<i class="fa-solid fa-trash-can fa-xs"></i>';

    L.DomEvent.on(btn, "click", L.DomEvent.stop)
              .on(btn, "click", () => {
                // إيقاف أي وضع قياس نشط
                if (measuring) toggleMeasure();
                if (measuringArea) toggleAreaMeasure();
                // مسح كل القياسات
                measureLayer.clearLayers();
              });
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    return container;
  }
});
map.addControl(new ClearMeasureControl());

// ==================== ESC للإلغاء ====================
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (measuring) toggleMeasure();
    if (measuringArea) toggleAreaMeasure();
  }
});

// =================================
// زر تحديد الموقع
const LocateControl = L.Control.extend({
  options: { position: "topleft" },
  onAdd: function () {
    const container = L.DomUtil.create("div", "leaflet-bar locate-control");
    const btn = L.DomUtil.create("a", "locate-btn", container);
    btn.href = "#";
    btn.title = "تحديد موقعي الحالي";
    btn.innerHTML = '<i class="fa-solid fa-location-crosshairs fa-lg"></i>';

    L.DomEvent.on(btn, "click", L.DomEvent.stop)
              .on(btn, "click", locateUser);
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    return container;
  }
});

// ==========================
// التحليلات الجغرافية - زر أقرب خدمة
const analysisControl = L.control({ position: "topleft" });

analysisControl.onAdd = function (mapInstance) {
  const div = L.DomUtil.create("div", "leaflet-control leaflet-bar");

  const link = L.DomUtil.create("a", "", div);
  link.href = "#";
  link.title = "أقرب خدمة";
  link.id = "nearestBtn";
  link.innerHTML = '<i class="fa-solid fa-street-view fa-lg"></i>';

  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);

  L.DomEvent.on(link, "click", (e) => {
    L.DomEvent.stop(e);
    findNearestService();
  });

  return div;
};

analysisControl.addTo(map);


// ==========================================
map.addControl(new LocateControl());

// المتغيرات للاحتفاظ بالماركر والدائرة
let userMarker = null;
let userCircle = null;

function locateUser() {
  if (!navigator.geolocation) {
    showToast("المتصفح لا يدعم تحديد الموقع","error");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracy = pos.coords.accuracy;

      // إزالة الماركر القديم والدائرة إن وجدت
      if (userMarker) map.removeLayer(userMarker);
      if (userCircle) map.removeLayer(userCircle);

 // إضافة ماركر للموقع ويمكن سحبه لتعديل الموقع
    userMarker = L.marker([lat, lng], {
    draggable: true,
    autoPan: true,
     }).addTo(map).bindPopup("موقعي الحالي<br><small>اسحب العلامة لتغيير موقعك</small>").openPopup();

      userMarker.on('dragend', (dragEvent) => {
        const movedLatLng = dragEvent.target.getLatLng();
        // showToast(`تم تحديث موقعك إلى ${movedLatLng.lat.toFixed(5)}, ${movedLatLng.lng.toFixed(5)}`, "info", 2000);
      });


      userMarker.once('popupopen', (e) => {
        const closeBtn = e.popup._container.querySelector('.leaflet-popup-close-button');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => {
            if (userMarker) {
              map.removeLayer(userMarker);
              userMarker = null;
            }
            if (userCircle) {
              map.removeLayer(userCircle);
              userCircle = null;
            }
            // Also remove nearest service visuals when user marker is closed
            if (window.clearNearestVisuals) {
              window.clearNearestVisuals();
            }
          });
        }
      });

      userMarker.openPopup();

      showToast("تم تحديد موقعك بنجاح ","success",1500 )
        

      // تحريك الخريطة إلى موقع المستخدم
      map.setView([lat, lng], 15);
    },
    (err) => {
      showToast("تعذر الحصول على الموقع:  "  + err.message, "error",2000);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// الخريطة الحرارية

// ==================== متغيرات الخريطة الحرارية ====================
let heatMapLayer = null;
let heatMapActive = false;

// ==================== زر الخريطة الحرارية ====================
const HeatControl = L.Control.extend({
  options: { position: "topleft" },
  onAdd: function () {
    const container = L.DomUtil.create("div", "leaflet-bar measure-control");
    const btn = L.DomUtil.create("a", "", container);
    btn.href = "#";
    btn.title = "الخريطة الحرارية";
    btn.innerHTML = '<i class="fa-solid fa-fire fa-xs"></i>';
    btn.id = "heat-btn"; // إضافة معرّف للزر

    L.DomEvent.on(btn, "click", L.DomEvent.stop)
              .on(btn, "click", () => toggleHeatMap(btn));
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    return container;
  }
});
map.addControl(new HeatControl());


// =============== زر عن الموقع=====================

// ==========================
// صندوق مستقل لمعلومات الموقع
const WebsiteInfo = L.control({ position: "topleft" });

WebsiteInfo.onAdd = function () {
  const div = L.DomUtil.create("div", "leaflet-control leaflet-bar");

  const infoLink = L.DomUtil.create("a", "", div);
  infoLink.href = "#";
  infoLink.title = "معلومات عن الموقع";
  infoLink.id = "WebsiteInfoBtn";
  infoLink.innerHTML = '<i class="fa-solid fa-circle-info fa-lg"></i>';

  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);

  L.DomEvent.on(infoLink, "click", (e) => {
    L.DomEvent.stop(e);
    openWebsiteInfoModal();
  });

  return div;
};

WebsiteInfo.addTo(map);

function openWebsiteInfoModal() {
  if (document.getElementById('website-info-modal')) return;

  // إنشاء الخلفية المظلمة وتعيين الكلاس الخاص بها
  const overlay = document.createElement('div');
  overlay.id = 'website-info-modal';
  overlay.className = 'website-info-overlay';

  // إنشاء المودال وتعيين الكلاس
  const modal = document.createElement('div');
  modal.className = 'website-info-modal';

  // زر الإغلاق
  const closeBtn = document.createElement('button');
  closeBtn.className = 'website-info-close-btn';
  closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  closeBtn.onclick = () => overlay.remove();

  // عنوان المودال
  const title = document.createElement('h3');
  title.className = 'website-info-title';
  title.textContent = 'معلومات حول الموقع';

  // محتوى المودال مع استخدام الكلاسات الجديدة بدلاً من الستايل المضمن
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="website-info-card website-info-card-blue">
      <p style="display:flex;align-items:center;gap:8px;">
        <span><b>المطور:</b> ${window.devName || 'Mohamed Al-Habbash'}</span>
        <a id="dev-github-link" href="${window.devGit || 'https://github.com/repos'}" target="_blank" rel="noopener noreferrer" title="GitHub" style="color:#0F2854;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">
          <i class="fa-brands fa-github fa-lg"></i>
        </a>
      </p>

      <p><b>التقنيات المستخدمة:</b> ${window.docsInfo || 'HTML5, CSS3, JavaScript, Leaflet.js, Supabase, Looker Studio Dashboard'}</p>
    </div>
    <div class="website-info-card website-info-card-yellow">
      <p><b>هدف المشروع:</b> ${window.docsInfo || 'تم تطوير هذا الموقع لتسهيل الوصول إلى الخدمات الطبية في قطاع غزة وعرضها على الخريطة بشكل واضح وفعال.'}</p>
    </div>
    <div class="website-info-card website-info-card-green">
      <p><b>الإصدار:</b> ${window.docsInfo || 'نسخة أولية MVP سيتم التطوير مستقبلا'}</p>
      <p><b>ملاحظة:</b> ${window.docsInfo || 'المشروع هو جهد شخصي ولا يتبع اي جهة رسمية.'}</p>
    </div>
  `;

  // تركيب المكونات داخل بعضها
  modal.appendChild(closeBtn);
  modal.appendChild(title);
  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // إغلاق عند الضغط خارج المودال
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}