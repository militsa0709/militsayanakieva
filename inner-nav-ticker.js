(function () {
  const masks = document.querySelectorAll(".masthead__nav .subnav__mask");

  masks.forEach((mask) => {
    if (mask.dataset.tickerBound === "true") return;
    mask.dataset.tickerBound = "true";

    mask.addEventListener("mouseenter", () => {
      if (mask.dataset.animating === "true") return;

      const originalText = mask.querySelector(".subnav__text:not(.subnav__text--clone)");
      if (!originalText) return;

      mask.dataset.animating = "true";
      originalText.classList.remove("subnav__text--exit");
      originalText.style.opacity = "1";
      originalText.style.transform = "translate3d(0, 0, 0)";
      originalText.offsetWidth;
      originalText.classList.add("subnav__text--exit");

      const clone = originalText.cloneNode(true);
      clone.classList.remove("subnav__text--exit");
      clone.classList.add("subnav__text--clone", "subnav__text--enter");
      mask.appendChild(clone);

      originalText.addEventListener(
        "animationend",
        () => {
          originalText.classList.remove("subnav__text--exit");
          originalText.style.opacity = "0";
          originalText.style.transform = "translate3d(0, 0, 0)";
        },
        { once: true }
      );

      clone.addEventListener(
        "animationend",
        () => {
          clone.remove();
          originalText.style.opacity = "1";
          originalText.style.transform = "translate3d(0, 0, 0)";
          mask.dataset.animating = "false";
        },
        { once: true }
      );
    });
  });
})();
