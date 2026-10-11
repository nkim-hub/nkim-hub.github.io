// Shared behavior for every page: mobile menu, footer year, and the home-page contact form.

const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.querySelector('.site-nav');

function setMenu(open) {
  siteNav.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}

if (navToggle && siteNav) {
  navToggle.addEventListener('click', () => setMenu(!siteNav.classList.contains('open')));

  siteNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setMenu(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && siteNav.classList.contains('open')) {
      setMenu(false);
      navToggle.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (siteNav.classList.contains('open') && !event.target.closest('.nav-wrap')) {
      setMenu(false);
    }
  });
}

document.querySelectorAll('.js-year').forEach((el) => {
  el.textContent = new Date().getFullYear();
});

// Home page consultation form
const contactForm = document.getElementById('contactForm');

if (contactForm) {
  const note = document.getElementById('contactNote');

  const rules = {
    name: (v) => (v.trim().length >= 2 ? '' : 'Please enter your full name.'),
    email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Please enter an email like name@example.com.'),
    phone: (v) => (!v.trim() || v.replace(/\D/g, '').length >= 10 ? '' : 'Please enter a 10-digit phone number, or leave it blank.'),
    area: (v) => (v ? '' : 'Please choose the type of matter.'),
    message: (v) => (v.trim().length >= 10 ? '' : 'Please describe your situation in a sentence or two.'),
    consent: (_, el) => (el.checked ? '' : 'Please confirm you have read the notice.'),
  };

  function check(name) {
    const el = contactForm.elements[name];
    const error = rules[name](el.value, el);
    const msg = document.getElementById(`${el.id}-error`);
    el.setAttribute('aria-invalid', error ? 'true' : 'false');
    if (msg) msg.textContent = error;
    return !error;
  }

  Object.keys(rules).forEach((name) => {
    const el = contactForm.elements[name];
    el.addEventListener('blur', () => check(name));
    el.addEventListener('change', () => check(name));
  });

  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const failed = Object.keys(rules).filter((name) => !check(name));

    if (failed.length) {
      note.className = 'form-note';
      note.textContent = 'Please fix the highlighted fields.';
      contactForm.elements[failed[0]].focus();
      return;
    }

    const firstName = contactForm.elements.name.value.trim().split(' ')[0];
    note.className = 'form-note success';
    note.textContent = `Thank you, ${firstName}. This is a demo site, so your request was not sent. On a live site, our intake team would reply within one business day.`;
    contactForm.reset();
    contactForm.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  });
}
