// 1. تعريف الأيقونات كـ SVG ديناميكي مع القيم الرقمية الكاملة والمكتوبة بوضوح
const mapIcons = {
  mainHospital: L.divIcon({
    html: '<svg viewBox="0 0 24 24" width="20" height="20" style="filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.4));"><circle cx="12" cy="12" r="9" fill="#ef4444" stroke="#ffffff" stroke-width="2"/><path d="M12 7v10M7 12h10" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/></svg>',
    className: "custom-svg-marker",
    iconSize: [20, 20],      // العرض والارتفاع المتوافق مع الـ SVG
    iconAnchor: [10, 10],    // المنتصف تماماً (العرض ÷ 2 , الارتفاع ÷ 2) لضمان ثبات الموقع
    popupAnchor: [0, -10]    // يظهر البوب أب فوق الأيقونة مباشرة
  }),

  fieldHospital: L.divIcon({
    html: '<svg viewBox="0 0 24 24" width="20" height="20" style="filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.4));"><circle cx="12" cy="12" r="9" fill="#3b82f6" stroke="#ffffff" stroke-width="2"/><path d="M12 7v10M7 12h10" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/></svg>',
    className: "custom-svg-marker",
    iconSize: [20,20],      
    iconAnchor: [10, 10],      
    popupAnchor: [0, -10]
  }),

  medicalPoint: L.divIcon({
    html: '<svg viewBox="0 0 24 24" width="20" height="20" style="filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.4));"><circle cx="12" cy="12" r="9" fill="#f59e0b" stroke="#ffffff" stroke-width="2"/><path d="M12 7v10M7 12h10" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/></svg>',
    className: "custom-svg-marker",
    iconSize: [20, 20],      
    iconAnchor: [10, 10],      
    popupAnchor: [0, -10]
  })
};

// 2. دالة اختيار الأيقونة (ممتازة وسريعة الأداء O(1))
function getIconByType (type) {
  switch (type) {
    case "مستشفى رئيسي":
      return mapIcons.mainHospital;
    case "مستشفى ميداني":
      return mapIcons.fieldHospital;
    case "نقطة طبية":
      return mapIcons.medicalPoint;
    default:
      return mapIcons.mainHospital; 
  }
}