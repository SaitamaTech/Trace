const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav-links');
if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }));
}
const dialog = document.querySelector('.start-dialog');
document.querySelectorAll('[data-start]').forEach((button) => button.addEventListener('click', () => {
  if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
}));
dialog?.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());
dialog?.querySelector('.dialog-dismiss')?.addEventListener('click', () => dialog.close());
dialog?.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });

const infoDialog = document.querySelector('.info-dialog');
const infoPages = {
  Documentation: 'In the full local application, record events with timestamps and sources, create an investigation, add the relevant events, then connect their relationships. The timeline orders evidence chronologically, and deterministic checks explain any inconsistencies they find.',
  About: 'TRACE is a focused event-intelligence MVP built to reconstruct what happened across a system. The full project uses React, TypeScript, Vite, Node.js, Express, and SQLite, with no AI or paid API for analysis.',
  Privacy: 'This static preview has no analytics, account database, or data collection. The local full application stores account and investigation data in the operator-controlled SQLite database and uses bcrypt password hashes and HTTP-only session cookies.',
  Terms: 'This is an MVP product preview. In the full application, deterministic findings are prompts for human review, not proof of an incident. Production legal terms should be supplied and reviewed by the operator before a public service launch.'
};
document.querySelectorAll('[data-info]').forEach((link) => link.addEventListener('click', (event) => {
  event.preventDefault();
  const key = link.getAttribute('data-info');
  if (!infoDialog || !key || !infoPages[key]) return;
  infoDialog.querySelector('h2').textContent = key;
  infoDialog.querySelector('p').textContent = infoPages[key];
  infoDialog.showModal();
}));
infoDialog?.querySelector('.dialog-close')?.addEventListener('click', () => infoDialog.close());
infoDialog?.querySelector('.dialog-dismiss')?.addEventListener('click', () => infoDialog.close());
infoDialog?.addEventListener('click', (event) => { if (event.target === infoDialog) infoDialog.close(); });
