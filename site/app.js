(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.08 });
  for (const element of document.querySelectorAll('.reveal')) {
    // Only prepare offscreen sections; content remains readable without JavaScript.
    if (element.getBoundingClientRect().top < window.innerHeight) continue;
    element.classList.add('is-prepared');
    observer.observe(element);
  }
  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    observer.disconnect();
    document.querySelectorAll('.is-prepared').forEach((element) => element.classList.add('is-visible'));
  });
})();
