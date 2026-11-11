import './style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
const app = document.querySelector('main');
const grid = document.querySelector('#product-grid');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let products = [];
let activeFilter = 'All';
let controllers = [];
let intersectionObserver;
let motionContext;
let gallery3D;
let galleryPromise;

document.querySelector('#year').textContent = new Date().getFullYear();

function createPiece(product, index) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.dataset.category = product.category;
  const title = escapeHtml(product.title);
  const downloadSize = Number.isFinite(product.stlBytes) && product.stlBytes > 0 ? ` · ${(product.stlBytes / 1_000_000).toFixed(1)} MB` : '';
  card.innerHTML = `
    <div class="object-stage" tabindex="0" role="slider" aria-label="Turn ${title}" aria-valuemin="-90" aria-valuemax="90" aria-valuenow="0" aria-valuetext="0 degrees" aria-orientation="horizontal" aria-describedby="viewer-help viewer-keyboard-help viewer-state-${index}">
      <img class="viewer-background" src="${escapeHtml(product.background || '/assets/toy-world.webp')}" alt="" aria-hidden="true" width="1000" height="1000" loading="lazy" />
      <img class="object-poster" src="${escapeHtml(product.poster || product.views?.[0] || '')}" alt="${title}" width="1000" height="1000" loading="lazy" />
      <span class="piece-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      <span class="viewer-state" id="viewer-state-${index}">Interactive 3D</span>
      <span class="object-turn-label" aria-hidden="true">MOVE TO TURN</span>
    </div>
    <button class="retry-3d" type="button" hidden>Retry 3D</button>
    <details class="piece-details"><summary><span class="piece-title">${title}<span class="piece-category">${escapeHtml(product.category)}</span></span><span class="detail-plus" aria-hidden="true">+</span></summary><div class="piece-description"><p>${escapeHtml(product.description)}</p><p class="piece-medium">${escapeHtml(product.material || 'Sculptural object')} · ${escapeHtml(String(product.year || '2026'))}</p></div></details>
    <a class="stl-download" href="${escapeHtml(product.stl)}" download="poor-little-thing-${escapeHtml(product.id)}-assembly-mm.stl" aria-label="Download ${title} assembly STL in millimeters${downloadSize}">Download assembly STL<span>STL · mm${downloadSize}</span></a>`;
  card.querySelector('details').addEventListener('toggle', () => ScrollTrigger.refresh());
  const controller = gallery3D.add(card, product);
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
    const response = await fetch('/products.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('Collection unavailable');
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('Collection unavailable');
    products = data.filter(product => product.title && product.model && product.stl);
    if (!products.length) throw new Error('Collection unavailable');
    gallery3D = await (galleryPromise ||= import('./gallery-3d.js').then(({ createGallery3D }) => createGallery3D({ reduceMotion })));
    controllers.forEach(controller => controller.dispose());
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

document.fonts.ready.then(() => ScrollTrigger.refresh());
loadCollection();
