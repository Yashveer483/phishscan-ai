
// ── Reading progress bar ──
window.addEventListener('scroll', () => {
  const doc = document.documentElement;
  const scrolled = (doc.scrollTop / (doc.scrollHeight - doc.clientHeight)) * 100;
  document.getElementById('readingBar').style.width = scrolled + '%';
});

// ── Scroll reveal ──
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.08 });
document.querySelectorAll('.guide-section').forEach(s => observer.observe(s));

// ── Active TOC ──
const tocLinks = document.querySelectorAll('.toc-list a');
const sections = document.querySelectorAll('.guide-section');
const tocObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      tocLinks.forEach(l => l.classList.remove('active'));
      const id = e.target.getAttribute('id');
      const active = document.querySelector(`.toc-list a[href="#${id}"]`);
      if (active) active.classList.add('active');
    }
  });
}, { rootMargin: '-20% 0px -70% 0px' });
sections.forEach(s => tocObserver.observe(s));

// ── Quiz logic ──
function answer(qid, el, correct, explanation) {
  const container = document.getElementById(qid);
  if (container.dataset.answered) return;
  container.dataset.answered = true;
  container.querySelectorAll('.quiz-opt').forEach(o => {
    o.style.pointerEvents = 'none';
    o.style.opacity = '0.5';
  });
  el.style.opacity = '1';
  el.classList.add(correct ? 'correct' : 'wrong');
  const fb = document.getElementById(qid + '-fb');
  fb.textContent = (correct ? '✅ ' : '❌ ') + explanation;
  fb.className = 'quiz-feedback show ' + (correct ? 'correct-fb' : 'wrong-fb');
}
