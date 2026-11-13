import './style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { COLLECTION_GROUPS, PRODUCTS_PER_SECTION } from './collection-groups.js';

gsap.registerPlugin(ScrollTrigger);
const app = document.querySelector('main');
const sections = document.querySelector('#collection-sections');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let products = [];
let controllers = [];
let intersectionObserver;
let gallery3D;
let galleryPromise;

document.querySelector('#year').textContent = new Date().getFullYear();

function createPiece(product, index) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.dataset.category = product.category;
  const title = escapeHtml(product.title);
  card.innerHTML = `
    <div class="object-stage" tabindex="0" role="slider" aria-label="Turn ${title}" aria-valuemin="-180" aria-valuemax="180" aria-valuenow="0" aria-valuetext="0 degrees" aria-orientation="horizontal" aria-describedby="viewer-keyboard-help viewer-state-${index}">
      <img class="viewer-background" src="${escapeHtml(product.background || '/assets/backgrounds/supplied-scene-01.png?v=ebdb635a0c8b')}" alt="" aria-hidden="true" width="1000" height="1000" loading="lazy" />
      <span class="viewer-shadow" aria-hidden="true"></span>
      <img class="object-poster" src="${escapeHtml(product.poster || product.views?.[0] || '')}" alt="${title}" width="1000" height="1000" loading="lazy" />
      <span class="viewer-state sr-only" id="viewer-state-${index}">Interactive 3D</span>
    </div>
    <button class="retry-3d" type="button" hidden>Retry 3D</button>
    <div class="piece-heading"><h4 class="piece-title">${title}</h4><a class="cults-link" href="${escapeHtml(product.cultsUrl)}" target="_blank" rel="noopener noreferrer" aria-label="View ${title} on Cults3D for $6.66" aria-describedby="cults-tooltip-${index}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/></svg><span class="cults-tooltip" id="cults-tooltip-${index}" role="tooltip">View on Cults3D · $6.66</span></a></div>`;
  const cultsLink = card.querySelector('.cults-link');
  cultsLink.addEventListener('keydown', event => {
    if (event.key === 'Escape') cultsLink.classList.add('tooltip-dismissed');
  });
  cultsLink.addEventListener('pointerenter', () => cultsLink.classList.remove('tooltip-dismissed'));
  cultsLink.addEventListener('focus', () => cultsLink.classList.remove('tooltip-dismissed'));
  const controller = gallery3D.add(card, product);
  controllers.push(controller);
  card._pieceController = controller;
  return card;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function createProductSection(group, groupProducts, firstIndex) {
  const section = document.createElement('section');
  section.className = 'product-section';
  section.id = group.id;
  section.setAttribute('aria-labelledby', `${group.id}-heading`);
  section.innerHTML = `
    <div class="section-heading"><h3 id="${group.id}-heading">${group.title}</h3><p>${groupProducts.length} pieces</p></div>
    <div class="product-grid" id="${group.id}-products"></div>`;
  const cards = groupProducts.map((product, index) => {
    const card = createPiece(product, firstIndex + index);
    card.hidden = index >= PRODUCTS_PER_SECTION;
    return card;
  });
  const grid = section.querySelector('.product-grid');
  grid.append(...cards);

  if (cards.length > PRODUCTS_PER_SECTION) {
    const button = document.createElement('button');
    button.className = 'show-more';
    button.type = 'button';
    button.textContent = `Show more ${group.title.toLowerCase()}`;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', grid.id);
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') !== 'true';
      cards.slice(PRODUCTS_PER_SECTION).forEach(card => {
        card.hidden = !expanded;
        if (!expanded) card._pieceController.setVisible(false);
      });
      button.setAttribute('aria-expanded', String(expanded));
      button.textContent = `Show ${expanded ? 'fewer' : 'more'} ${group.title.toLowerCase()}`;
      document.querySelector('#collection-status').textContent = `Showing ${expanded ? cards.length : PRODUCTS_PER_SECTION} of ${cards.length} ${group.title.toLowerCase()}.`;
      ScrollTrigger.refresh();
      if (expanded) {
        const firstNewCard = cards[PRODUCTS_PER_SECTION];
        const stage = firstNewCard.querySelector('.object-stage');
        const firstControl = stage.tabIndex >= 0 ? stage : firstNewCard.querySelector('.cults-link');
        firstControl.focus({ preventScroll: true });
        firstControl.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      } else {
        button.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      }
    });
    section.append(button);
  }
  return section;
}

async function loadCollection() {
  sections.setAttribute('aria-busy', 'true');
  document.querySelector('#collection-error').hidden = true;
  try {
    const response = await fetch('/products.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('Collection unavailable');
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('Collection unavailable');
    products = data.filter(product => product.title && product.model && product.cultsUrl);
    if (!products.length) throw new Error('Collection unavailable');
    const categories = new Set(COLLECTION_GROUPS.map(group => group.title));
    if (products.some(product => !categories.has(product.category))) throw new Error('Unknown product category');
    gallery3D = await (galleryPromise ||= import('./gallery-3d.js').then(({ createGallery3D }) => createGallery3D({ reduceMotion })));
    controllers.forEach(controller => controller.dispose());
    controllers = [];
    let productIndex = 0;
    const sectionNodes = [];
    for (const group of COLLECTION_GROUPS) {
      const groupProducts = products.filter(product => product.category === group.title);
      if (!groupProducts.length) continue;
      sectionNodes.push(createProductSection(group, groupProducts, productIndex));
      productIndex += groupProducts.length;
    }
    sections.replaceChildren(...sectionNodes);
    intersectionObserver?.disconnect();
    intersectionObserver = new IntersectionObserver(entries => entries.forEach(entry => entry.target._pieceController.setVisible(entry.isIntersecting)), { rootMargin: '200px 0px' });
    controllers.forEach(({ card }) => intersectionObserver.observe(card));
    const visibleCount = controllers.filter(({ card }) => !card.hidden).length;
    document.querySelector('#collection-status').textContent = `${products.length} pieces in ${sectionNodes.length} sections. Showing ${visibleCount} pieces.`;
    ScrollTrigger.refresh();
  } catch {
    document.querySelector('#collection-error').hidden = false;
  } finally {
    sections.setAttribute('aria-busy', 'false');
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
  gsap.from('.idea h2', { x: -45, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: '.idea', start: 'top 75%', once: true } });
  gsap.to('.idea-shift', { xPercent: -5, ease: 'none', scrollTrigger: { trigger: '.idea', start: 'top bottom', end: 'bottom top', scrub: 1 } });
  gsap.to('.idea-spark', { rotation: 150, ease: 'none', scrollTrigger: { trigger: '.idea', start: 'top bottom', end: 'bottom top', scrub: 1 } });
  gsap.from('.inquiry-link h2', { y: 35, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.inquiries', start: 'top 80%', once: true } });
}, app);

document.fonts.ready.then(() => ScrollTrigger.refresh());
loadCollection();
