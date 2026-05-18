(() => {
  'use strict';

  // ── Scroll reveals ─────────────────────────────────────────────────────
  // Initialized immediately so below-the-fold sections animate the moment
  // the user scrolls to them, independent of the preloader timing. Elements
  // already in view at script start (hero) get `.in` synchronously so they
  // don't flicker. Calling twice is a no-op via the `revealsInitialized` flag.
  let revealsInitialized = false;
  function initReveals(){
    if(revealsInitialized) return;
    revealsInitialized = true;

    const targets = document.querySelectorAll('.reveal, .reveal-text, .reveal-blur');
    if(!targets.length) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const supportsObserver = 'IntersectionObserver' in window;

    if(prefersReducedMotion || !supportsObserver){
      targets.forEach(el => el.classList.add('in'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      for(const entry of entries){
        if(entry.isIntersecting){
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      }
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });

    const triggerBottom = (window.innerHeight || document.documentElement.clientHeight) * 0.92;
    targets.forEach(el => {
      if(el.getBoundingClientRect().top < triggerBottom){
        el.classList.add('in');
      } else {
        io.observe(el);
      }
    });
  }
  initReveals();


  // ── Preloader ──────────────────────────────────────────────────────────
  const preloader = document.getElementById('preloader');
  const MIN_LOADER_MS = 1200;
  const SAFETY_NET_MS = 6000;
  const loadStart = performance.now();
  let loaderDone = false;

  function dismissLoader(){
    if(loaderDone) return;
    loaderDone = true;
    const elapsed = performance.now() - loadStart;
    const wait = Math.max(0, MIN_LOADER_MS - elapsed);
    setTimeout(() => {
      if(preloader) preloader.classList.add('gone');
      document.documentElement.classList.remove('locked');
      document.body.classList.remove('locked');
      document.body.classList.remove('preload');
    }, wait);
  }

  if(document.readyState === 'complete'){
    dismissLoader();
  } else {
    window.addEventListener('load', dismissLoader, { once: true });
    setTimeout(dismissLoader, SAFETY_NET_MS);
  }


  // ── Smooth in-page anchors ─────────────────────────────────────────────
  const SCROLL_OFFSET = 24;
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if(!link) return;
    const href = link.getAttribute('href');
    if(!href || href === '#') return;
    const target = document.getElementById(href.slice(1));
    if(!target) return;
    e.preventDefault();
    const y = Math.max(0, target.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET);
    window.scrollTo({ top: y, behavior: 'smooth' });
    if(history.replaceState) history.replaceState(null, '', href);
  });


  // ── Horizontal auto-scroller factory ───────────────────────────────────
  // Drives a horizontal rail's scrollLeft via rAF for smooth auto-scroll,
  // while letting native touch/wheel/drag interaction take over briefly.
  // Items are cloned once so the loop wraps seamlessly by snapping
  // scrollLeft back when it passes the halfway mark of scrollWidth.
  function makeAutoScroller(viewport, track, opts = {}){
    if(!viewport || !track || !track.children.length) return null;

    const speed = opts.speed ?? 32;
    const idleResumeMs = opts.idleResumeMs ?? 1500;
    const pauseOnHover = opts.pauseOnHover ?? false;
    const onCloneAttr = opts.onCloneAttr;

    const originals = Array.from(track.children);
    originals.forEach(item => {
      const clone = item.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      if(onCloneAttr) onCloneAttr(clone);
      track.appendChild(clone);
    });

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let pausedUntil = 0;
    let hoverPaused = false;
    let lastFrame = performance.now();
    let pixelDebt = 0;

    function loopGuard(){
      const half = track.scrollWidth / 2;
      if(half > 0 && viewport.scrollLeft >= half){
        viewport.scrollLeft -= half;
      } else if(viewport.scrollLeft < 0){
        viewport.scrollLeft += half;
      }
    }

    function tick(now){
      const dt = Math.min(now - lastFrame, 100) / 1000;
      lastFrame = now;
      if(!reduced && !hoverPaused && now > pausedUntil){
        pixelDebt += speed * dt;
        const whole = Math.floor(pixelDebt);
        if(whole > 0){
          viewport.scrollLeft += whole;
          pixelDebt -= whole;
        }
        loopGuard();
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    const nudgePause = () => { pausedUntil = performance.now() + idleResumeMs; };

    if(pauseOnHover){
      viewport.addEventListener('mouseenter', () => { hoverPaused = true; });
      viewport.addEventListener('mouseleave', () => { hoverPaused = false; nudgePause(); });
      viewport.addEventListener('focusin', () => { hoverPaused = true; });
      viewport.addEventListener('focusout', () => { hoverPaused = false; nudgePause(); });
    }
    viewport.addEventListener('touchstart', nudgePause, { passive: true });
    viewport.addEventListener('wheel', nudgePause, { passive: true });
    viewport.addEventListener('scroll', loopGuard, { passive: true });

    return { nudgePause, loopGuard };
  }


  // ── Marquee ────────────────────────────────────────────────────────────
  const marquee = document.querySelector('.marquee');
  if(marquee){
    makeAutoScroller(marquee, marquee.querySelector('.track'), {
      speed: 36,
      idleResumeMs: 1200,
    });
  }


  // ── Testimonial ticker ─────────────────────────────────────────────────
  const testiRail = document.getElementById('testiRail');
  if(testiRail){
    const track = testiRail.querySelector('.testi-track');
    const ticker = makeAutoScroller(testiRail, track, {
      speed: 28,
      idleResumeMs: 2500,
      pauseOnHover: true,
      onCloneAttr: (clone) => {
        clone.querySelectorAll('a, button, [tabindex]').forEach(el => el.setAttribute('tabindex', '-1'));
      },
    });

    if(ticker && track){
      document.querySelectorAll('.testi-arrow').forEach(btn => {
        btn.addEventListener('click', () => {
          const firstCard = track.querySelector('.testi');
          const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : 380;
          const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 20;
          const step = cardWidth + gap;
          const dir = btn.classList.contains('prev') ? -1 : 1;
          testiRail.scrollBy({ left: step * dir, behavior: 'smooth' });
          ticker.nudgePause();
        });
      });
    }
  }


  // ── About visual crossfade ─────────────────────────────────────────────
  const visualStack = document.querySelector('.visual-stack');
  if(visualStack){
    const slides = Array.from(visualStack.querySelectorAll('.visual-slide'));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(slides.length > 1 && !reducedMotion){
      const HOLD_MS = 4000;
      let index = 0;
      let timerId = null;
      let inView = false;

      function advance(){
        slides[index].classList.remove('is-active');
        index = (index + 1) % slides.length;
        slides[index].classList.add('is-active');
      }
      function start(){
        if(timerId) return;
        timerId = setInterval(advance, HOLD_MS);
      }
      function stop(){
        if(!timerId) return;
        clearInterval(timerId);
        timerId = null;
      }

      if('IntersectionObserver' in window){
        const io = new IntersectionObserver((entries) => {
          for(const entry of entries){
            inView = entry.isIntersecting;
            if(inView) start(); else stop();
          }
        }, { threshold: 0.2 });
        io.observe(visualStack);
      } else {
        start();
      }

      document.addEventListener('visibilitychange', () => {
        if(document.hidden) stop();
        else if(inView) start();
      });
    }
  }


  // ── Live clock ─────────────────────────────────────────────────────────
  const clockEl = document.getElementById('liveClock');
  if(clockEl){
    const pad = (n) => String(n).padStart(2, '0');
    const tick = () => {
      const d = new Date();
      clockEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    tick();
    setInterval(tick, 30000);
  }


  // ── Custom cursor (fine-pointer devices only) ──────────────────────────
  const supportsFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if(supportsFinePointer){
    const html = document.documentElement;
    const body = document.body;

    const dot = document.createElement('div');
    dot.className = 'cursor cursor-dot';
    dot.setAttribute('aria-hidden', 'true');
    const ring = document.createElement('div');
    ring.className = 'cursor cursor-ring';
    ring.setAttribute('aria-hidden', 'true');
    body.appendChild(dot);
    body.appendChild(ring);
    html.classList.add('cursor-on');

    const INTERACTIVE = 'a, button, [role="button"], input, textarea, select, label, [data-cursor]';
    let mouseX = -100, mouseY = -100;
    let ringX = -100, ringY = -100;
    const EASE = 0.2;
    let firstMove = true;

    function tick(){
      ringX += (mouseX - ringX) * EASE;
      ringY += (mouseY - ringY) * EASE;
      dot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
      ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if(firstMove){
        ringX = mouseX;
        ringY = mouseY;
        html.classList.add('cursor-ready');
        firstMove = false;
      }
      const isInteractive = !!(e.target && e.target.closest && e.target.closest(INTERACTIVE));
      body.classList.toggle('cursor-on-link', isInteractive);
    });
    document.addEventListener('mouseleave', () => html.classList.remove('cursor-ready'));
    document.addEventListener('mouseenter', () => { if(!firstMove) html.classList.add('cursor-ready'); });
    document.addEventListener('mousedown', () => body.classList.add('cursor-down'));
    document.addEventListener('mouseup', () => body.classList.remove('cursor-down'));
  }
})();
