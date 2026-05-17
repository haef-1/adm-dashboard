/* Pull-to-refresh for touch devices */
(() => {
  const THRESHOLD = 80;
  const MAX_PULL = 120;
  let startY = 0;
  let pulling = false;
  let indicator = null;
  let spinner = null;

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
    spinner = indicator.querySelector(".ptr-spinner");
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
        spinner.style.transform = "";
        return;
      }
      const pull = Math.min(dy * 0.4, MAX_PULL);
      const progress = Math.min(pull / THRESHOLD, 1);
      indicator.style.transform = "translateY(" + (pull - 40) + "px)";
      const fillDeg = Math.min(progress / 0.9, 1) * 324;
      spinner.style.setProperty("--ptr-progress", fillDeg + "deg");
      if (progress >= 0.9) {
        const rotateDeg = Math.min((progress - 0.9) / 0.1, 1) * 270;
        spinner.style.transform = "rotate(" + rotateDeg + "deg)";
      } else {
        spinner.style.transform = "";
      }
      indicator.classList.toggle("ready", pull >= THRESHOLD);
    }, { passive: true });

    sc.addEventListener("touchend", () => {
      if (!pulling) return;
      pulling = false;
      if (indicator.classList.contains("ready")) {
        indicator.style.transform = "translateY(20px)";
        let rot = 0, fill = 72;
        function animateFill() {
          rot += 6;
          if (fill < 324) fill += 4;
          if (fill > 324) fill = 324;
          spinner.style.setProperty("--ptr-progress", fill + "deg");
          spinner.style.transform = "rotate(" + rot + "deg)";
          if (indicator.classList.contains("refreshing")) requestAnimationFrame(animateFill);
        }
        indicator.classList.add("refreshing");
        requestAnimationFrame(animateFill);
        setTimeout(() => location.reload(), 600);
      } else {
        indicator.style.transform = "translateY(-100%)";
        spinner.style.setProperty("--ptr-progress", "0deg");
        spinner.style.transform = "";
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
