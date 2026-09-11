const form = document.getElementById('login-form');
const messageEl = document.getElementById('message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  messageEl.innerHTML = '';

  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      messageEl.innerHTML = `<div class="message error">${data.error || 'Login failed'}</div>`;
      return;
    }

    const params = new URLSearchParams(window.location.search);
    window.location.href = params.get('next') || 'complaints.html';
  } catch (err) {
    messageEl.innerHTML = '<div class="message error">Network error.</div>';
  }
});
