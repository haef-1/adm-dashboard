/* Pull-to-refresh for touch devices */
(() => {
  const THRESHOLD = 80;
  const MAX_PULL = 120;
  let startY = 0;
  let pulling = false;
  let indicator = null;

  function getScrollContainer() {
    return document.querySelector(".page-content");
  }

  function createIndicator() {
    const el = document.createElement("div");
    el.className = "ptr-indicator";
    el.innerHTML = '<div class="ptr-spinner"></div>';
    document.body.appendChild(el);
    return el;
  }

  function init() {
    if (!("ontouchstart" in window)) return;

    indicator = createIndicator();
    const sc = getScrollContainer();
    if (!sc) return;

    sc.addEventListener("touchstart", e => {
      if (sc.scrollTop <= 0) {
        startY = e.touches[0].clientY;
        pulling = true;
      }
    }, { passive: true });

    sc.addEventListener("touchmove", e => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy < 0 || sc.scrollTop > 0) {
        pulling = false;
        indicator.style.transform = "translateY(-100%)";
        indicator.classList.remove("ready");
        return;
      }
      const pull = Math.min(dy * 0.4, MAX_PULL);
      indicator.style.transform = "translateY(" + (pull - 40) + "px)";
      indicator.classList.toggle("ready", pull >= THRESHOLD * 0.4);
    }, { passive: true });

    sc.addEventListener("touchend", () => {
      if (!pulling) return;
      pulling = false;
      if (indicator.classList.contains("ready")) {
        indicator.classList.add("refreshing");
        indicator.style.transform = "translateY(20px)";
        setTimeout(() => location.reload(), 300);
      } else {
        indicator.style.transform = "translateY(-100%)";
        indicator.classList.remove("ready");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
