// ═══════════════════════════════════════════════
//  PROJECT ZERO TRUST — index.js
// ═══════════════════════════════════════════════

// ── Scroll Reveal ──────────────────────────────
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('visible');
  });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ── Navbar scroll effect ────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  if (window.scrollY > 40) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}, { passive: true });

// ── Active nav link on scroll ───────────────────
const sections = document.querySelectorAll('section[id]');
const navLinks  = document.querySelectorAll('.nav-link');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      navLinks.forEach(l => l.classList.remove('active'));
      const active = document.querySelector(`.nav-link[href="#${e.target.id}"]`);
      if (active) active.classList.add('active');
    }
  });
}, { threshold: 0.4 });

sections.forEach(s => sectionObserver.observe(s));

// ── Mobile Menu ────────────────────────────────
const mobileToggle = document.getElementById('mobileToggle');
const mobileMenu   = document.getElementById('mobileMenu');

mobileToggle?.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
  mobileToggle.textContent = mobileMenu.classList.contains('open') ? '✕' : '☰';
});

function closeMobile() {
  mobileMenu.classList.remove('open');
  mobileToggle.textContent = '☰';
}

// ── Animated vector feed (live-feeling terminal) ──
const feedLines = [
  '&gt; MD5_HASH: 7E9A4B2C...',
  '&gt; PKT_RECV: 192.168.1.1',
  '&gt; SCAN_READY: 100%',
  '&gt; THREAT_DB: SYNCED',
  '&gt; NLP_MODEL: LOADED',
  '&gt; RULE_ENG: ACTIVE',
  '&gt; LIME_XAI: READY',
  '&gt; BERT_MDL: v2.1',
];

const feedEl = document.getElementById('vf1');
if (feedEl) {
  let idx = 0;
  const lines = [
    document.getElementById('vf1'),
    document.getElementById('vf2'),
    document.getElementById('vf3'),
  ];

  setInterval(() => {
    const line = lines[idx % lines.length];
    if (line) {
      line.style.opacity = '0';
      setTimeout(() => {
        line.innerHTML = feedLines[Math.floor(Math.random() * feedLines.length)];
        line.style.transition = 'opacity 0.4s';
        line.style.opacity = '1';
      }, 200);
    }
    idx++;
  }, 2000);
}

// ── Smooth scroll for anchor links ────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      closeMobile();
    }
  });
});

// ── Server rack LED animation randomizer ──────────
document.querySelectorAll('.server-unit').forEach((unit, i) => {
  setInterval(() => {
    unit.style.opacity = Math.random() > 0.15 ? '1' : '0.4';
  }, 1000 + i * 300);
});

// ── Page load animation stagger ───────────────────
document.addEventListener('DOMContentLoaded', () => {
  const heroLeft = document.querySelector('.hero-left');
  if (heroLeft) {
    heroLeft.style.opacity = '0';
    heroLeft.style.transform = 'translateY(20px)';
    setTimeout(() => {
      heroLeft.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
      heroLeft.style.opacity = '1';
      heroLeft.style.transform = 'translateY(0)';
    }, 100);
  }

  const heroRight = document.querySelector('.hero-right');
  if (heroRight) {
    heroRight.style.opacity = '0';
    setTimeout(() => {
      heroRight.style.transition = 'opacity 0.8s ease 0.3s';
      heroRight.style.opacity = '1';
    }, 100);
  }
});