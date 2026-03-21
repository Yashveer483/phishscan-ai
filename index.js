
// ── Scroll Reveal ──
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ── Hero Particles ──
const container = document.getElementById('particles');
for (let i = 0; i < 24; i++) {
  const p = document.createElement('div');
  p.className = 'particle';
  p.style.cssText = `
    left: ${Math.random() * 100}%;
    bottom: ${Math.random() * 20}%;
    animation-duration: ${8 + Math.random() * 12}s;
    animation-delay: ${Math.random() * 10}s;
    width: ${2 + Math.random() * 4}px;
    height: ${2 + Math.random() * 4}px;
    opacity: ${0.2 + Math.random() * 0.5};
  `;
  container.appendChild(p);
}



// ── Navbar scroll effect ──
window.addEventListener('scroll', () => {
  const nav = document.querySelector('nav');
  if (window.scrollY > 40) {
    nav.style.borderBottomColor = 'rgba(0,212,255,0.1)';
  } else {
    nav.style.borderBottomColor = 'var(--border-d)';
  }
});