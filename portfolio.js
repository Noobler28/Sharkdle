const root = document.documentElement;
const spotlight = document.querySelector(".spotlight");

window.addEventListener("pointermove", (event) => {
  root.style.setProperty("--pointer-x", `${event.clientX}px`);
  root.style.setProperty("--pointer-y", `${event.clientY}px`);
  if (spotlight) {
    spotlight.style.opacity = "1";
  }
});

const revealItems = document.querySelectorAll(".reveal, .intro-section, .bento-card, .lab-grid article");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.18 });

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}
