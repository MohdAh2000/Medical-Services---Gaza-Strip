
// اعدادات العرض للخريطة الاساسية
const map = L.map('map', {
  center: [31.42, 34.39],
  zoom: 12,
  minZoom:10, 
  rotate: false, // 
  rotateControl: false, // تعطيل أداة التدوير 
}).setView([31.42, 34.39],11);
  map.doubleClickZoom.disable();

// طبقة OpenStreetMap (الخريطة الافتراضية)
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
});

  // طبقة القمر الصناعي ( Esri)
const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri'
  });

  //إضافة الطبقة الأساسية (OSM)
  osm.addTo(map);
  // أداة التحكم بين الطبقات
  const baseMaps = {
    "الخريطة العادية": osm,
    "القمر الصناعي": satellite
    
  };
  L.control.layers(baseMaps, null, {
    position: 'topright',
    collapsed: true
  }).addTo(map);
  
  // إضافة مقياس الرسم إلى الخريطة
   L.control.scale({
     position: 'bottomleft', 
     metric: true,          
     imperial: false        
   }).addTo(map);



