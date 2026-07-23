
// prevent map interaction when clicking on UI elements
const uiLayer = document.getElementById("ui-layer");

if (uiLayer) {
  const interactiveSelectors = ['.search-box', '.search-container', '#search-input', '#search-btn', '.dashboard-btn', '.dropdown-select', '.add-form', '.suggestion-item'];

  const stopMapInteraction = (e) => {
    if (e.target.closest && interactiveSelectors.some(sel => e.target.closest(sel))) {
      e.stopPropagation();
    }
  };

  uiLayer.addEventListener('click', stopMapInteraction);
  uiLayer.addEventListener('dblclick', stopMapInteraction);

  // تم إضافة { passive: false } هنا لإعلام المتصفح ومحاذاة السلوك برمجياً
  uiLayer.addEventListener('wheel', (e) => {
    if (e.target.closest && e.target.closest('input, select, textarea')) {
      e.stopPropagation();
    }
  }, { passive: false });
}


// All services data fetched from Supabase
let allServices = [];

// Temporary layers for showing nearest-service visuals
let nearestLine = null;
let nearestBuffer = null;
let nearestDistanceLabel = null;

// Clear nearest service visuals 
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


const servicesLayer = L.layerGroup().addTo(map);

// Get services from Supabase 
async function loadServicesFromSupabase() {
  const { data, error } = await sb
    .from("medicalServices") 
    .select("id, name, type, area, status, operator, image_url, geom")
    .eq("ServiceStatus", "Approved"); 
  if (error) {
    console.error("خطأ أثناء جلب البيانات:", error);
    return;
  }

  allServices = data;         
  drawServicesOnMap(allServices);
}

// Cluster Group
let useCluster = true; 

const clusterGroup = L.markerClusterGroup({
  showCoverageOnHover: false,
  maxClusterRadius: 40,
  disableClusteringAtZoom: 16,
});

function drawServicesOnMap(services) {
  servicesLayer.clearLayers();
  clusterGroup.clearLayers();

  if (useCluster) {
    map.addLayer(clusterGroup);
    map.removeLayer(servicesLayer);
  } else {
    map.addLayer(servicesLayer);
    map.removeLayer(clusterGroup);
  }

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

    useCluster
      ? clusterGroup.addLayer(geoLayer)
      : geoLayer.addTo(servicesLayer);
  });
}

loadServicesFromSupabase();


// Search services
function searchService(searchText) {
  if (!searchText || searchText.trim() === "") {
    showToast(" الرجاء إدخال اسم الخدمة", "error",1500);
    return;
  }

  const searchTerm = searchText.trim().toLowerCase();
  
  const foundService = allServices.find(service => {
    if (!service.name) return false;
    return service.name.toLowerCase().includes(searchTerm);
  });

  if (!foundService) {
    showToast("الخدمة غير موجودة", "error");
    return;
  }

  goToService(foundService);
}

// Extract coordinates from GeoJSON 
function extractCoordinatesFromGeoJSON(geojson) {
  let geometry = null;
  
  if (geojson.type === "Point") {
    return geojson.coordinates; 
  } else if (geojson.type === "Feature") {
    
    geometry = geojson.geometry;
  } else if (geojson.type === "FeatureCollection" && geojson.features && geojson.features.length > 0) {

    geometry = geojson.features[0].geometry;
  } else if (geojson.geometry) {

    geometry = geojson.geometry;
  }
  
  if (geometry && geometry.type === "Point") {
    return geometry.coordinates; 
  }
  
  return null;
}

function goToService(service) {
  if (!service.geom) {
    showToast(" لا توجد إحداثيات لهذه الخدمة", "error");
    return;
  }

  try {
    const geojson = service.geom;
    const coordinates = extractCoordinatesFromGeoJSON(geojson);
    
    if (!coordinates || coordinates.length < 2) {
      showToast("نوع بيانات مكانية غير مدعوم", "error");
      return;
    }
  
    const [lng, lat] = coordinates;

    map.setView([lat, lng], 16);

    // Saved marker
    if (service.marker) {
      setTimeout(() => {
       openDrawer(service);

      }, 300); 
    } else {
      
      servicesLayer.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          const markerLat = layer.getLatLng().lat;
          const markerLng = layer.getLatLng().lng;
          
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

// Closest facility
async function findNearestService() {
   
  if (!userMarker) {
    showToast("حدد موقعك أولاً ثم أعد المحاولة", "error");
    return;
  }

  const referenceLatLng = userMarker.getLatLng();

  // PostGIS function 
  const { data, error } = await sb.rpc("find_nearest_service", {
    user_lat: referenceLatLng.lat,
    user_lng: referenceLatLng.lng
  });

  if (error) {
    console.error(error);
    showToast("حدث خطأ أثناء البحث عن أقرب خدمة", "error");
    return;
  }

  if (!data || data.length === 0) {
    showToast("لم يتم العثور على خدمات معتمدة", "error");
    return;
  }
  const nearestResult = data[0];

  const nearestService = allServices.find(
    s => String(s.id) === String(nearestResult.id)
  );

  if (!nearestService) {
    showToast("تعذر مطابقة الخدمة على الخريطة", "error");
    return;
  }

  const minDistance = nearestResult.distance_meters;

  try {
    const geojson = nearestService.geom;
    const coords = extractCoordinatesFromGeoJSON(geojson);

    if (!coords || coords.length < 2) {
      showToast("بيانات الموقع غير صالحة", "error");
      return;
    }

    const [svcLng, svcLat] = coords;
    const serviceLatLng = L.latLng(svcLat, svcLng);

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

    nearestBuffer = L.circle(referenceLatLng, {
      radius: minDistance,
      color: '#000000',
      dashArray: '6,6',
      fillColor: '#ff0000',
      fillOpacity: 0.08,
      weight: 2,
    }).addTo(map);

    const distanceText = minDistance >= 1000
      ? (minDistance / 1000).toFixed(2) + ' كم'
      : minDistance.toFixed(0) + ' متر';

    const bounds = L.latLngBounds([referenceLatLng, serviceLatLng]);
    map.fitBounds(bounds.pad(0.2), { padding: [60, 60] });

    // reset filters to prevent conflict
    resetFilters();

    if (nearestService.marker) {
      setTimeout(() => {
        openDrawer(nearestService);
      }, 500);
    }

    showToast(
      `أقرب خدمة: ${nearestService.name} (${distanceText})`,
      "success"
    );

  } catch (err) {
    console.error('خطأ أثناء رسم المنطقة:', err);
    goToService(nearestService); 
  }
}
// Suggestions  
function getSearchSuggestions(searchText) {
  if (!searchText || searchText.trim() === "") {
    return [];
  }

  const searchTerm = searchText.trim().toLowerCase();
  
//  Search in allServices
  const suggestions = allServices
    .filter(service => {
      if (!service.name) return false;
      return service.name.toLowerCase().includes(searchTerm);
    })
    .slice(0, 3); 

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

// display suggestions
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

// Filters
function applyFilters() {
  const typeValue = document.getElementById("filter-type").value;
  const areaValue = document.getElementById("filter-region").value;

  const filtered = allServices.filter(service => {
    const matchType = typeValue === "" || service.type === typeValue;
    const matchArea = areaValue === "" || service.area === areaValue;
    return matchType && matchArea;
  });

  drawServicesOnMap(filtered);
}
// Reset filters
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

// filer for mobile
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

// Heatmap
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

      if (geojson.type === "Point") {
        coordinates = geojson.coordinates; 
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
        heatPoints.push([lat, lng, 1.0]);
      }
    } catch (err) {
      console.warn("خطأ في معالجة بيانات الخدمة:", err);
    }
  });

  return heatPoints;
}

function toggleHeatMap(btn) {
  const heatBtn = btn || document.getElementById("heat-btn");

  if (heatMapActive) {
    if (heatMapLayer) {
      map.removeLayer(heatMapLayer);
      heatMapLayer = null;
    }

    if (servicesLayer && !map.hasLayer(servicesLayer)) {
      map.addLayer(servicesLayer);
    }
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
    if (!allServices || allServices.length === 0) {
      showToast(" لا توجد خدمات لعرضها على الخريطة الحرارية", "error");
      return;
    }

    const heatPoints = convertServicesToHeatPoints();

    if (heatPoints.length === 0) {
      showToast(" لم يتم العثور على نقاط صحيحة", "error");
      return;
    }
    if (useCluster) {
      if (map.hasLayer(clusterGroup)) map.removeLayer(clusterGroup);
    } else {
      if (map.hasLayer(servicesLayer)) map.removeLayer(servicesLayer);
    }
   
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
// Cordinates display
const coordsDiv = document.getElementById('coordinates-display');

map.on('mousemove', function(e) {
  const lat = e.latlng.lat.toFixed(5); 
  const lng = e.latlng.lng.toFixed(5); 
  
  coordsDiv.innerHTML = ` خط الطول: ${lng} | خط العرض: ${lat} `;
});

// mobile
if (window.innerWidth <= 768) {
  searchBtn.addEventListener('click', (e) => {

    if (!searchInput.classList.contains('expanded')) {
      e.stopPropagation();
      searchInput.classList.add('expanded');
      searchInput.focus();
      return;
    }

    searchService(searchInput.value);
    suggestionsContainer.classList.add('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      searchInput.classList.remove('expanded');
    }
  });
}
