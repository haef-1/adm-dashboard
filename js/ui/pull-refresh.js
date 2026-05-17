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
      const progress = Math.min(pull / THRESHOLD, 1);
      indicator.style.transform = "translateY(" + (pull - 40) + "px)";
      indicator.querySelector(".ptr-spinner").style.setProperty("--ptr-progress", (progress * 360) + "deg");
      indicator.classList.toggle("ready", pull >= THRESHOLD);
    }, { passive: true });

    sc.addEventListener("touchend", () => {
      if (!pulling) return;
      pulling = false;
      if (indicator.classList.contains("ready")) {
        indicator.classList.add("refreshing");
        indicator.style.transform = "translateY(20px)";
        const spinner = indicator.querySelector(".ptr-spinner");
        let deg = 0;
        function animateFill() {
          deg += 4;
          if (deg > 360) deg = 0;
          spinner.style.setProperty("--ptr-progress", deg + "deg");
          requestAnimationFrame(animateFill);
        }
        requestAnimationFrame(animateFill);
        setTimeout(() => location.reload(), 600);
      } else {
        indicator.style.transform = "translateY(-100%)";
        indicator.querySelector(".ptr-spinner").style.setProperty("--ptr-progress", "0deg");
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
