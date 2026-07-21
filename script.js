
// منع تناثر الأحداث فقط عندما النقر داخل عناصر واجهة المستخدم التفاعلية
const uiLayer = document.getElementById("ui-layer");

if (uiLayer) {
  const interactiveSelectors = ['.search-box', '.search-container', '#search-input', '#search-btn', '.dashboard-btn', '.dropdown-select', '.add-form', '.suggestion-item'];

  const stopMapInteraction = (e) => {
    if (e.target.closest && interactiveSelectors.some(sel => e.target.closest(sel))) {
      e.stopPropagation();
    }
  };

  // إيقاف التفاعل مع الخريطة عند النقر داخل عناصر واجهة المستخدم
  uiLayer.addEventListener('click', stopMapInteraction);

  // إيقاف تكبير/تصغير الخريطة عند النقر المزدوج داخل الحقول التفاعلية
  uiLayer.addEventListener('dblclick', stopMapInteraction);

  // عند التمرير بالماوس فوق الحقول الإدخالية، منع تمرير الخريطة
  uiLayer.addEventListener('wheel', (e) => {
    if (e.target.closest && e.target.closest('input, select, textarea')) {
      e.stopPropagation();
    }
  });
}

// هان كل الاعتماد عليها فلازم اركز شوي معها هي عبارة عن ارراي مجهزة لاستقبال الداتا 
let allServices = [];

//temporary layers for showing nearest-service visuals
let nearestLine = null;
let nearestBuffer = null;
let nearestDistanceLabel = null;

// Function to clear nearest service visuals (called when user marker is removed)
window.clearNearestVisuals = function() {
  if (nearestLine) { 
    map.removeLayer(nearestLine); 
    nearestLine = null; 
  }
  if (nearestBuffer) { 
    map.removeLayer(nearestBuffer); 
    nearestBuffer = null; 
  }
  if (nearestDistanceLabel) { 
    map.removeLayer(nearestDistanceLabel); 
    nearestDistanceLabel = null; 
  }
};

function attachTempMarkerCloseHandler(marker) {
  marker.once('popupopen', (e) => {
    const popupElement = e.popup.getElement();
    const closeBtn = popupElement && popupElement.querySelector('.leaflet-popup-close-button');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (tempMarker === marker) {
          map.removeLayer(tempMarker);
          tempMarker = null;
        }
      });
    }
  });
}


// طبقة مخصصة لجميع الخدمات
const servicesLayer = L.layerGroup().addTo(map);

// جلب البيانات من سوبا
async function loadServicesFromSupabase() {
  const { data, error } = await sb
    .from("medicalServices") 
    .select("id, name, type, area, status, operator, image_url, geom")
    .eq("ServiceStatus", "Approved"); // جلب فقط الخدمات الموافق عليها

  if (error) {
    console.error("خطأ أثناء جلب البيانات:", error);
    return;
  }

  // التحقق من البيانات (للتشخيص)
  if (data && data.length > 0) {
    console.log("عينة من البيانات:", data[0]);
  }

  allServices = data;          // حفظ كل الخدمات
  drawServicesOnMap(allServices);
}

// متغير التحكم
let useCluster = true; // يبدا العرض بالتجمعات

// طبقتا العرض
const clusterGroup = L.markerClusterGroup({
  showCoverageOnHover: false,
  maxClusterRadius: 40,
  disableClusteringAtZoom: 16,
});

function drawServicesOnMap(services) {
  // مسح الطبقتين
  servicesLayer.clearLayers();
  clusterGroup.clearLayers();

  // إضافة/إزالة الطبقة المناسبة
  if (useCluster) {
    map.addLayer(clusterGroup);
    map.removeLayer(servicesLayer);
  } else {
    map.addLayer(servicesLayer);
    map.removeLayer(clusterGroup);
  }

  // رسم النقاط على الطبقة المختارة
  services.forEach(service => {
    if (!service.geom) return;
    const geojson = service.geom;

    const geoLayer = L.geoJSON(geojson, {
      pointToLayer: (feature, latLng) => {
        const marker = L.marker(latLng, { icon: getIconByType(service.type) })
         .on('click', () => {openDrawer(service);});
        service.marker = marker;
        return marker;
        
      }
    });

    // إضافة للطبقة المناسبة فقط
    useCluster
      ? clusterGroup.addLayer(geoLayer)
      : geoLayer.addTo(servicesLayer);
  });
}

loadServicesFromSupabase();


// ============= وظيفة البحث عن الخدمات =============

// دالة البحث عن خدمة
function searchService(searchText) {
  if (!searchText || searchText.trim() === "") {
    showToast(" الرجاء إدخال اسم الخدمة", "error",1500);
    return;
  }

  const searchTerm = searchText.trim().toLowerCase();
  
  // البحث في allServices (مطابقة جزئية)
  const foundService = allServices.find(service => {
    if (!service.name) return false;
    return service.name.toLowerCase().includes(searchTerm);
  });

  if (!foundService) {
    showToast("الخدمة غير موجودة", "error");
    return;
  }

  // التوجيه إلى الخدمة
  goToService(foundService);
}

// دالة استخراج الإحداثيات من GeoJSON (متوافقة مع PostGIS)
function extractCoordinatesFromGeoJSON(geojson) {
  // PostGIS قد يعيد أنواع مختلفة من GeoJSON
  let geometry = null;
  
  if (geojson.type === "Point") {
    // GeoJSON Point مباشرة
    return geojson.coordinates; // [lng, lat]
  } else if (geojson.type === "Feature") {
    // GeoJSON Feature
    geometry = geojson.geometry;
  } else if (geojson.type === "FeatureCollection" && geojson.features && geojson.features.length > 0) {
    // GeoJSON FeatureCollection - نأخذ أول feature
    geometry = geojson.features[0].geometry;
  } else if (geojson.geometry) {
    // قد يكون geometry مدمج مباشرة
    geometry = geojson.geometry;
  }
  
  if (geometry && geometry.type === "Point") {
    return geometry.coordinates; // [lng, lat]
  }
  
  return null;
}

// دالة التوجيه إلى الخدمة على الخريطة (متوافقة مع PostGIS)
function goToService(service) {
  if (!service.geom) {
    showToast(" لا توجد إحداثيات لهذه الخدمة", "error");
    return;
  }

  try {
    const geojson = service.geom;
    
    // استخراج الإحداثيات من GeoJSON (متوافق مع PostGIS)
    const coordinates = extractCoordinatesFromGeoJSON(geojson);
    
    if (!coordinates || coordinates.length < 2) {
      showToast("نوع بيانات مكانية غير مدعوم", "error");
      return;
    }
    
    const [lng, lat] = coordinates;

    // التوجيه إلى الموقع مع تكبير مناسب
    map.setView([lat, lng], 16);

    // استخدام المرجع المحفوظ مباشرة (بدون بحث معقد)
    if (service.marker) {
      // فتح popup مباشرة باستخدام المرجع
      setTimeout(() => {
       openDrawer(service);

      }, 300); // تأخير بسيط لضمان اكتمال التوجيه
    } else {
      // في حالة عدم وجود المرجع، نبحث في servicesLayer
      servicesLayer.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          const markerLat = layer.getLatLng().lat;
          const markerLng = layer.getLatLng().lng;
          
          // مقارنة الإحداثيات (مع هامش صغير للأخطاء العائمة)
          if (Math.abs(markerLat - lat) < 0.0001 && Math.abs(markerLng - lng) < 0.0001) {
            layer.openPopup();
          }
        }
      });
    }

    showToast(` تم العثور على: ${service.name}`,"success");
    resetFilters();
  }
   catch (error) {
    console.error("خطأ في معالجة البيانات المكانية:", error);
    showToast(" حدث خطأ أثناء البحث", "error");
  }
}

// دالة إيجاد أقرب خدمة بالنسبة لموقع المستخدم أو مركز الخريطة
function findNearestService() {
  if (!allServices || allServices.length === 0) {
    showToast(" لا توجد خدمات متاحة للتحليل", "error");
    return;
  }

  // يجب أن يحدد المستخدم موقعه أولاً (من زر تحديد الموقع مثلاً)
  if (!userMarker) {
    showToast(" حدد موقعك أولاً ثم اعد المحاولة   ", "error");
    return;
  }

  // نستخدم موقع المستخدم كنقطة مرجعية
  const referenceLatLng = userMarker.getLatLng();

     let nearestService = null;
  let minDistance = Infinity;

  allServices.forEach((service) => {
    if (!service.geom) return;

    try {
      const geojson = service.geom;
      const coordinates = extractCoordinatesFromGeoJSON(geojson);
      if (!coordinates || coordinates.length < 2) return;

      const [lng, lat] = coordinates;
      const serviceLatLng = L.latLng(lat, lng);

      const distance = referenceLatLng.distanceTo(serviceLatLng); // بالمتر

      if (distance < minDistance) {
        minDistance = distance;
        nearestService = service;
      }
    } catch (err) {
      console.error("خطأ أثناء حساب المسافة لأحد الخدمات:", err);
    }
  });

  if (!nearestService) {
    showToast(" لم يتم العثور على خدمات مكانية صالحة", "error");
    return;
  }

  // رسم مرئي بين موقع المستخدم والمؤسسة الأقرب لزيادة الثقة
  try {
    const geojson = nearestService.geom;
    const coords = extractCoordinatesFromGeoJSON(geojson);
    const [svcLng, svcLat] = coords;
    const serviceLatLng = L.latLng(svcLat, svcLng);

    // إزاله أي رسومات سابقة
    if (nearestLine) { map.removeLayer(nearestLine); nearestLine = null; }
    if (nearestBuffer) { map.removeLayer(nearestBuffer); nearestBuffer = null; }
    if (nearestDistanceLabel) { map.removeLayer(nearestDistanceLabel); nearestDistanceLabel = null; }

    // خط بين النقطتين
    // nearestLine = L.polyline([referenceLatLng, serviceLatLng], { color: '#a00e0e', weight: 3, opacity: 0.9 }).addTo(map);

    // دائرة (buffer) حول موقع المستخدم تمتد حتى أقرب خدمة
    nearestBuffer = L.circle(referenceLatLng, {
      radius: minDistance,
      color: '#000000 ',
      dashArray: '6,6',
      fillColor: '#ff0000 ',
      fillOpacity: 0.08,
      weight: 2,
    }).addTo(map);

    // تسمية المسافة في منتصف الخط
    const mid = L.latLng((referenceLatLng.lat + serviceLatLng.lat) / 2, (referenceLatLng.lng + serviceLatLng.lng) / 2);
    const distanceText = minDistance >= 1000 ? (minDistance / 1000).toFixed(2) + ' كم' : minDistance.toFixed(0) + ' متر';
    // nearestDistanceLabel = L.marker(mid, { interactive: false }).addTo(map)
    //   .bindTooltip(distanceText, { permanent: true, direction: 'center', className: 'nearest-distance-label' })
    //   .openTooltip();

    // ضبط مجال العرض ليشمل كل من المستخدم والخدمة
    
    const bounds = L.latLngBounds([referenceLatLng, serviceLatLng]);
    map.fitBounds(bounds.pad ? bounds.pad(0.2) : bounds.extend(bounds).pad ? bounds.pad(0.2) : bounds, { padding: [60, 60] });

    resetFilters();

    // فتح بوب أب للخدمة بعد ضبط العرض
    if (nearestService.marker) {
      setTimeout(() => openDrawer(nearestService), 500);
    } else {
      servicesLayer.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          const markerLat = layer.getLatLng().lat;
          const markerLng = layer.getLatLng().lng;
          if (Math.abs(markerLat - svcLat) < 0.0001 && Math.abs(markerLng - svcLng) < 0.0001) {
            setTimeout(() => openDrawer(layer.service), 500);
          }
        }
      });
    }

    showToast(` أقرب خدمة: ${nearestService.name} ( ${distanceText} )`, "success");
  } catch (err) {
    console.error('خطأ أثناء رسم المسار/المنطقة:', err);
    goToService(nearestService); // fallback
  }
}

// ============= قائمة اقتراحات البحث =============

// دالة البحث عن اقتراحات (أول 3 نتائج)
function getSearchSuggestions(searchText) {
  if (!searchText || searchText.trim() === "") {
    return [];
  }

  const searchTerm = searchText.trim().toLowerCase();
  
  // البحث في allServices (مطابقة جزئية) - أول 3 نتائج
  const suggestions = allServices
    .filter(service => {
      if (!service.name) return false;
      return service.name.toLowerCase().includes(searchTerm);
    })
    .slice(0, 3); // حد أقصى 3 اقتراحات

  return suggestions;
}

let activeSuggestionIndex = -1;

function clearSuggestionHighlight() {
  if (!suggestionsContainer) return;
  const items = suggestionsContainer.querySelectorAll('.suggestion-item');
  items.forEach(item => item.classList.remove('active-suggestion'));
}

function highlightSuggestion(index) {
  if (!suggestionsContainer) return;
  const items = suggestionsContainer.querySelectorAll('.suggestion-item');
  if (!items.length) return;

  activeSuggestionIndex = Math.max(0, Math.min(index, items.length - 1));
  clearSuggestionHighlight();
  items[activeSuggestionIndex].classList.add('active-suggestion');
  items[activeSuggestionIndex].scrollIntoView({ block: 'nearest' });
}

function getVisibleSuggestions() {
  if (!suggestionsContainer) return [];
  return Array.from(suggestionsContainer.querySelectorAll('.suggestion-item'));
}

function selectActiveSuggestion() {
  if (!suggestionsContainer || activeSuggestionIndex < 0) return false;

  const items = suggestionsContainer.querySelectorAll('.suggestion-item');
  if (!items[activeSuggestionIndex]) return false;

  const selectedServiceName = items[activeSuggestionIndex].dataset.serviceName;
  const selectedService = allServices.find(service => service.name === selectedServiceName);

  if (!selectedService) return false;

  searchInput.value = selectedService.name;
  suggestionsContainer.classList.add('hidden');
  goToService(selectedService);
  return true;
}

// دالة عرض الاقتراحات
function showSuggestions(suggestions, targetContainer = document.getElementById("search-suggestions"), searchField = searchInput) {
  if (!targetContainer) return;

  targetContainer.innerHTML = "";
  activeSuggestionIndex = -1;

  if (suggestions.length === 0) {
    targetContainer.classList.add("hidden");
    return;
  }

  suggestions.forEach((service, index) => {
    const item = document.createElement("div");
    item.className = "suggestion-item";
    item.textContent = service.name;
    item.dataset.serviceName = service.name;
    item.dataset.index = index;

    item.addEventListener("click", () => {
      if (searchField) {
        searchField.value = service.name;
      }
      targetContainer.classList.add("hidden");
      goToService(service);
    });

    targetContainer.appendChild(item);
  });

  targetContainer.classList.remove("hidden");
}

// ربط زر البحث وحقل البحث
const searchBtn = document.getElementById("search-btn");
const searchInput = document.getElementById("search-input");
const suggestionsContainer = document.getElementById("search-suggestions");

if (searchBtn && searchInput) {
  searchBtn.addEventListener("click", () => {
    searchService(searchInput.value);
    if (suggestionsContainer) {
      suggestionsContainer.classList.add("hidden");
    }
  });

  searchInput.addEventListener("input", (e) => {
    const text = e.target.value;
    const Suggestions = getSearchSuggestions(text);
    showSuggestions(Suggestions);
  });

  searchInput.addEventListener("blur", () => {
    setTimeout(() => {
      if (suggestionsContainer) {
        suggestionsContainer.classList.add("hidden");
      }
    }, 200);
  });

  searchInput.addEventListener("keydown", (e) => {
    const suggestions = getVisibleSuggestions();
    const isSuggestionsVisible = suggestions.length > 0 && suggestionsContainer && !suggestionsContainer.classList.contains('hidden');

    if (e.key === "Escape") {
      if (suggestionsContainer) {
        suggestionsContainer.classList.add("hidden");
        activeSuggestionIndex = -1;
      }
    } else if (e.key === "ArrowDown") {
      if (isSuggestionsVisible) {
        e.preventDefault();
        const nextIndex = activeSuggestionIndex < 0 ? 0 : activeSuggestionIndex + 1;
        highlightSuggestion(nextIndex < suggestions.length ? nextIndex : 0);
      }
    } else if (e.key === "ArrowUp") {
      if (isSuggestionsVisible) {
        e.preventDefault();
        const nextIndex = activeSuggestionIndex < 0 ? suggestions.length - 1 : activeSuggestionIndex - 1;
        highlightSuggestion(nextIndex >= 0 ? nextIndex : suggestions.length - 1);
      }
    } else if (e.key === "Enter") {
      if (isSuggestionsVisible && selectActiveSuggestion()) {
        e.preventDefault();
      } else {
        searchService(searchInput.value);
        if (suggestionsContainer) {
          suggestionsContainer.classList.add("hidden");
        }
      }
    }
  });
}



// ============= الفلترة حسب النوع والمنطقة =============

function applyFilters() {
  const typeValue = document.getElementById("filter-type").value;
  const areaValue = document.getElementById("filter-region").value;

  // فلترة الخدمات حسب النوع والمنطقة
  const filtered = allServices.filter(service => {
    const matchType = typeValue === "" || service.type === typeValue;
    const matchArea = areaValue === "" || service.area === areaValue;
    return matchType && matchArea;
  });

  drawServicesOnMap(filtered);
}
// back the thing to the default state
function resetFilters() {
  const typeSelect = document.getElementById("filter-type");
  const areaSelect = document.getElementById("filter-region");

  if (typeSelect) typeSelect.value = "";
  if (areaSelect) areaSelect.value = "";
  drawServicesOnMap(allServices);
}

const filterType = document.getElementById("filter-type");
const filterRegion = document.getElementById("filter-region");

if (filterType && filterRegion) {
  filterType.addEventListener("change", applyFilters);
  filterRegion.addEventListener("change", applyFilters);
}

// في script.js أضف للموبايل
const mobFilterType   = document.getElementById("mob-filter-type");
const mobFilterRegion = document.getElementById("mob-filter-region");

if (mobFilterType)   mobFilterType.addEventListener("change", applyMobileFilters);
if (mobFilterRegion) mobFilterRegion.addEventListener("change", applyMobileFilters);

function applyMobileFilters() {
  const typeValue = mobFilterType.value;
  const areaValue = mobFilterRegion.value;
  const filtered  = allServices.filter(service => {
    const matchType = !typeValue || service.type === typeValue;
    const matchArea = !areaValue || service.area === areaValue;
    return matchType && matchArea;
  });
  drawServicesOnMap(filtered);
}

// ==================== دالة تحويل البيانات إلى صيغة الخريطة الحرارية ====================
function convertServicesToHeatPoints() {
  const heatPoints = [];

  if (!allServices || allServices.length === 0) {
    return heatPoints;
  }

  allServices.forEach((service) => {
    try {
      if (!service.geom) return;

      const geojson = service.geom;
      let coordinates = null;

      // استخراج الإحداثيات من GeoJSON بصيغ مختلفة
      if (geojson.type === "Point") {
        coordinates = geojson.coordinates; // [lng, lat]
      } else if (geojson.type === "Feature" && geojson.geometry) {
        if (geojson.geometry.type === "Point") {
          coordinates = geojson.geometry.coordinates;
        }
      } else if (geojson.type === "FeatureCollection" && geojson.features && geojson.features.length > 0) {
        if (geojson.features[0].geometry && geojson.features[0].geometry.type === "Point") {
          coordinates = geojson.features[0].geometry.coordinates;
        }
      } else if (geojson.geometry && geojson.geometry.type === "Point") {
        coordinates = geojson.geometry.coordinates;
      }

      if (coordinates && coordinates.length >= 2) {
        const [lng, lat] = coordinates;
        // صيغة L.heatLayer: [lat, lng, intensity]
        // الـ intensity = 1.0 (قيمة ثابتة يمكن تعديلها حسب الحاجة)
        heatPoints.push([lat, lng, 1.0]);
      }
    } catch (err) {
      console.warn("خطأ في معالجة بيانات الخدمة:", err);
    }
  });

  return heatPoints;
}



// ==================== دالة تبديل الخريطة الحرارية ====================
function toggleHeatMap(btn) {
  const heatBtn = btn || document.getElementById("heat-btn");

  if (heatMapActive) {
    // إيقاف الخريطة الحرارية
    if (heatMapLayer) {
      map.removeLayer(heatMapLayer);
      heatMapLayer = null;
    }

    // إعادة عرض نقاط الخدمات إذا كانت مخفية
    if (servicesLayer && !map.hasLayer(servicesLayer)) {
      map.addLayer(servicesLayer);
    }
    // إعادة العرض حسب حالة الـ cluster
      if (useCluster) {
       map.addLayer(clusterGroup);
      } else {
     map.addLayer(servicesLayer);
}

    heatMapActive = false;
    if (heatBtn) {
      heatBtn.style.backgroundColor = "";
      heatBtn.style.color = "";
    }
    showToast(" تم إيقاف الخريطة الحرارية",  "success",1500);
   
  } else {
    // تشغيل الخريطة الحرارية
    if (!allServices || allServices.length === 0) {
      showToast(" لا توجد خدمات لعرضها على الخريطة الحرارية", "error");
      return;
    }

    const heatPoints = convertServicesToHeatPoints();

    if (heatPoints.length === 0) {
      showToast(" لم يتم العثور على نقاط صحيحة", "error");
      return;
    }
   // إخفاء طبقة العرض الحالية
    if (useCluster) {
      if (map.hasLayer(clusterGroup)) map.removeLayer(clusterGroup);
    } else {
      if (map.hasLayer(servicesLayer)) map.removeLayer(servicesLayer);
    }
   

    // إنشاء طبقة الخريطة الحرارية
    heatMapLayer = L.heatLayer(heatPoints, {
      radius: 30,
      blur: 25,
      maxZoom: 12,
      gradient: {
        0.0: "#ffee00",
        0.25: "#fcc910",
        0.5: "	#ff9844",
        0.75: "#ee5e2e",
        1.0: "#ec0400"
      }
    }).addTo(map);

    heatMapActive = true;
   
    if (heatBtn) {
      heatBtn.style.backgroundColor = "#e21a1ad3";
      heatBtn.style.color = "white";
      
    }
    showToast(` تم تفعيل الخريطة الحرارية `, "success",1500);
  }
}
// 1. تحديد العنصر الذي سيعرض الإحداثيات من الـ HTML
const coordsDiv = document.getElementById('coordinates-display');

// 2. الاستماع لحركة الماوس على الخريطة وتحديث النص
map.on('mousemove', function(e) {
  const lat = e.latlng.lat.toFixed(5); // جلب خط العرض وتقريبه لـ 5 أرقام عشرية لدقة احترافية
  const lng = e.latlng.lng.toFixed(5); // جلب خط الطول وتقريبه لـ 5 أرقام عشرية
  
  // تحديث النص داخل الحاوية
  coordsDiv.innerHTML = ` خط الطول: ${lng} | خط العرض: ${lat} `;
});

// const searchBtn = document.getElementById('search-btn');
// const searchInput = document.getElementById('search-input');

// على الموبايل فقط
if (window.innerWidth <= 768) {
  searchBtn.addEventListener('click', (e) => {

    // إذا الحقل مغلق — افتحه فقط
    if (!searchInput.classList.contains('expanded')) {
      e.stopPropagation();
      searchInput.classList.add('expanded');
      searchInput.focus();
      return;
    }

    // إذا الحقل مفتوح — نفذ البحث
    searchService(searchInput.value);
    suggestionsContainer.classList.add('hidden');
  });

  // إغلاق الحقل عند النقر خارجه
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      searchInput.classList.remove('expanded');
    }
  });
}
