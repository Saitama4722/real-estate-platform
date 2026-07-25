/**
 * Появление секций при скролле. Навесьте .ctr-reveal (и .d1/.d2/.d3 для стаггера),
 * вызовите initReveal(). Срабатывает один раз; при prefers-reduced-motion CSS показывает всё сразу.
 */
export function initReveal(root) {
  var nodes = (root || document).querySelectorAll('.ctr-reveal');
  if (!('IntersectionObserver' in window)) {
    nodes.forEach(function (n) { n.classList.add('is-in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  nodes.forEach(function (n) { io.observe(n); });
}

/** Компактная шапка после 24px скролла. */
export function initStickyHeader(selector) {
  var h = document.querySelector(selector || '.ctr-header');
  if (!h) return;
  var apply = function () { h.classList.toggle('is-compact', window.scrollY > 24); };
  apply();
  window.addEventListener('scroll', apply, { passive: true });
}

/** Пульс подтверждения на иконочной кнопке (избранное, сравнение). */
export function popIcon(btn) {
  btn.classList.remove('is-popping');
  void btn.offsetWidth;
  btn.classList.add('is-popping');
}
