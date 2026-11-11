import './style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
const app = document.querySelector('main');
const grid = document.querySelector('#product-grid');
const motionButton = document.querySelector('.motion-toggle');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const saveData = navigator.connection?.saveData === true;
let paused = reduceMotion.matches || saveData;
let manuallyPaused = false;
let products = [];
let activeFilter = 'All';
let controllers = [];
let intersectionObserver;
let motionContext;

document.querySelector('#year').textContent = new Date().getFullYear();

function syncMotionButton() {
  motionButton.setAttribute('aria-pressed', String(paused));
  motionButton.querySelector('.motion-label').textContent = paused ? 'Play rotation' : 'Pause rotation';
  motionButton.querySelector('.motion-icon').textContent = paused ? '▷' : 'Ⅱ';
}
syncMotionButton();
motionButton.addEventListener('click', () => {
  paused = !paused;
  manuallyPaused = paused;
  syncMotionButton();
});
reduceMotion.addEventListener('change', () => {
  paused = reduceMotion.matches || manuallyPaused || saveData;
  syncMotionButton();
});

function createPiece(product, index) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.dataset.category = product.category;
  const key = `piece-${index}`;
  card.innerHTML = `
    <div class="object-stage" aria-label="${escapeHtml(product.title)}, four views across 180 degrees">
      <span class="piece-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      ${product.views.map((view, i) => `<img ${i === 0 ? 'class="is-active"' : ''} data-src="${escapeHtml(view)}" alt="${i === 0 ? escapeHtml(product.title) : ''}" ${i !== 0 ? 'aria-hidden="true"' : ''} width="800" height="800" decoding="async" />`).join('')}
      <span class="object-turn-label" aria-hidden="true">TURN ME</span>
    </div>
    <div class="view-controls">
      <button class="view-arrow view-prev" type="button" aria-label="Previous view of ${escapeHtml(product.title)}">←</button>
      <input class="view-range" type="range" min="0" max="3" step="1" value="0" aria-label="Rotate ${escapeHtml(product.title)}" aria-valuetext="View 1 of 4" />
      <button class="view-arrow view-next" type="button" aria-label="Next view of ${escapeHtml(product.title)}">→</button>
      <span class="view-caption" aria-hidden="true">180°</span>
    </div>
    <details class="piece-details"><summary><span class="piece-title">${escapeHtml(product.title)}<span class="piece-category">${escapeHtml(product.category)}</span></span><span class="detail-plus" aria-hidden="true">+</span></summary><div class="piece-description"><p>${escapeHtml(product.description)}</p><p class="piece-medium">${escapeHtml(product.material || 'Sculptural object')} · ${escapeHtml(String(product.year || '2026'))}</p></div></details>`;
  const stage = card.querySelector('.object-stage');
  const images = [...stage.querySelectorAll('img')];
  const range = card.querySelector('.view-range');
  let view = 0;
  let direction = 1;
  let inView = false;
  let hovered = false;
  let interactionUntil = 0;
  let loaded = false;
  let autoTick = index % 4;

  function loadImages() {
    if (loaded) return;
    loaded = true;
    images.forEach((image, i) => {
      image.src = image.dataset.src;
      if (i !== 0) image.fetchPriority = 'low';
    });
  }
  function show(next, fromUser = false) {
    next = Math.max(0, Math.min(3, Math.round(next)));
    if (fromUser) interactionUntil = performance.now() + 5000;
    if (view === next) return;
    images[view].classList.remove('is-active');
    images[next].classList.add('is-active');
    view = next;
    range.value = String(view);
    range.setAttribute('aria-valuetext', `View ${view + 1} of 4`);
  }
  range.addEventListener('input', () => { loadImages(); show(Number(range.value), true); });
  card.querySelector('.view-prev').addEventListener('click', () => { loadImages(); show((view + 3) % 4, true); });
  card.querySelector('.view-next').addEventListener('click', () => { loadImages(); show((view + 1) % 4, true); });
  stage.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') hovered = true; });
  stage.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    loadImages();
    const bounds = stage.getBoundingClientRect();
    show(Math.min(3, Math.floor(((event.clientX - bounds.left) / bounds.width) * 4)), true);
  });
  stage.addEventListener('pointerleave', () => { hovered = false; interactionUntil = performance.now() + 2000; });
  card.querySelector('details').addEventListener('toggle', () => ScrollTrigger.refresh());
  const controller = {
    card,
    setVisible(value) { inView = value; if (value) loadImages(); },
    tick() {
      if (paused || document.hidden || !inView || card.hidden || hovered || card.contains(document.activeElement) || performance.now() < interactionUntil) return;
      autoTick++;
      if (autoTick % 2 !== 0) return;
      if (view === 3) direction = -1;
      if (view === 0) direction = 1;
      show(view + direction);
    }
  };
  controllers.push(controller);
  card._pieceController = controller;
  return card;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function updateFilter(next) {
  activeFilter = next;
  document.querySelectorAll('.filter').forEach(button => {
    const active = button.dataset.filter === next;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  let count = 0;
  controllers.forEach(({ card }) => {
    card.hidden = next !== 'All' && card.dataset.category !== next;
    if (!card.hidden) count++;
  });
  document.querySelector('#collection-status').textContent = `${count} ${next === 'All' ? 'pieces' : next.toLowerCase()} in the collection.`;
  ScrollTrigger.refresh();
}
document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => updateFilter(button.dataset.filter)));

async function loadCollection() {
  grid.setAttribute('aria-busy', 'true');
  document.querySelector('#collection-error').hidden = true;
  try {
    const response = await fetch('/products.json');
    if (!response.ok) throw new Error('Collection unavailable');
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('Collection unavailable');
    products = data.filter(product => product.title && product.views?.length === 4);
    controllers = [];
    grid.replaceChildren(...products.map(createPiece));
    document.querySelector('#total-count').textContent = String(products.length).padStart(2, '0');
    intersectionObserver?.disconnect();
    intersectionObserver = new IntersectionObserver(entries => entries.forEach(entry => entry.target._pieceController.setVisible(entry.isIntersecting)), { rootMargin: '200px 0px' });
    controllers.forEach(({ card }) => intersectionObserver.observe(card));
    updateFilter(activeFilter);
    setupProductMotion();
  } catch {
    document.querySelector('#collection-error').hidden = false;
  } finally {
    grid.setAttribute('aria-busy', 'false');
  }
}
document.querySelector('#retry-collection').addEventListener('click', loadCollection);

const media = gsap.matchMedia();
media.add('(prefers-reduced-motion: no-preference)', () => {
  const intro = gsap.timeline({ defaults: { duration: 1, ease: 'power3.out' } });
  intro.from('.hero h1 span', { yPercent: 28, opacity: 0, stagger: .12 }, .1)
    .from('.hero-aside', { y: 15, opacity: 0 }, .35)
    .from('.hero-image', { scale: 1.045, duration: 1.4 }, .2);
  gsap.to('.hero-image', { yPercent: 5, ease: 'none', scrollTrigger: { trigger: '.hero-image-wrap', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.from('.section-intro h2, .section-intro p', { y: 35, opacity: 0, stagger: .12, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: '.section-intro', start: 'top 88%', once: true } });
  gsap.from('.idea h2', { x: -45, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: '.idea', start: 'top 75%', once: true } });
  gsap.to('.idea-shift', { xPercent: -5, ease: 'none', scrollTrigger: { trigger: '.idea', start: 'top bottom', end: 'bottom top', scrub: 1 } });
  gsap.to('.idea-spark', { rotation: 150, ease: 'none', scrollTrigger: { trigger: '.idea', start: 'top bottom', end: 'bottom top', scrub: 1 } });
  gsap.from('.inquiry-link h2', { y: 35, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.inquiries', start: 'top 80%', once: true } });
}, app);

function setupProductMotion() {
  motionContext?.revert();
  motionContext = gsap.matchMedia();
  motionContext.add('(prefers-reduced-motion: no-preference)', () => {
    const triggers = ScrollTrigger.batch('.product-card', {
      start: 'top 96%', once: true,
      onEnter: cards => gsap.fromTo(cards, { y: 25, opacity: 0 }, { y: 0, opacity: 1, stagger: .06, duration: .7, ease: 'power3.out', clearProps: 'transform,opacity' })
    });
    return () => triggers.forEach(trigger => trigger.kill());
  }, grid);
  ScrollTrigger.refresh();
}

window.setInterval(() => controllers.forEach(controller => controller.tick()), 650);
document.fonts.ready.then(() => ScrollTrigger.refresh());
loadCollection();
