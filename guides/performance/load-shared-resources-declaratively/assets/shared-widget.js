// A small stand-in for a popular, unmodified JS widget script that many
// unrelated sites reference identically.
document.addEventListener('DOMContentLoaded', () => {
  const el = document.createElement('div');
  el.className = 'shared-widget';
  el.textContent = 'Shared widget loaded';
  document.body.appendChild(el);
});
