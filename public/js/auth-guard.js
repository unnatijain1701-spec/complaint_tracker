(async function () {
  try {
    const res = await fetch('/api/session');
    if (!res.ok) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `login.html?next=${next}`;
      return;
    }
    const user = await res.json();

    const userInfoEl = document.getElementById('user-info');
    if (userInfoEl) userInfoEl.textContent = user.name;

    if (user.is_admin) {
      const nav = document.querySelector('nav');
      const spacer = document.querySelector('nav .nav-spacer');
      if (nav && spacer && !document.getElementById('manage-users-link')) {
        const link = document.createElement('a');
        link.id = 'manage-users-link';
        link.href = 'users.html';
        link.textContent = 'Manage Users';
        nav.insertBefore(link, spacer);
      }
    }

    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
      logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = 'login.html';
      });
    }
  } catch (err) {
    window.location.href = 'login.html';
  }
})();