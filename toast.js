let toastTimer = null;

function showToast(message, type = "success",duration = 3000) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  // إيقاف أي مؤقت سابق
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }

  // أيقونة حسب النوع
  const icons = {
    success: `<span class="toast-icon success-icon">✓</span>`,
    error:   `<span class="toast-icon error-icon">✕</span>`,
    loading: `<span class="toast-icon loading-icon">⟳</span>`,
  };

  // بناء المحتوى
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-inner">
      <button class="toast-close" onclick="hideToast()">×</button>
      <div class="toast-body">
        ${icons[type] || icons.success}
        <span class="toast-msg">${message}</span>
      </div>
      ${type !== "loading" ? `<div class="toast-bar"></div>` : ""}
    </div>
  `;

  toast.classList.remove("hidden");

  // إخفاء تلقائي بعد 3 ثوانٍ
  if (type !== "loading") {
    toastTimer = setTimeout(() => hideToast(), duration);
  }
}

function hideToast() {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.classList.add("hidden");
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
}
