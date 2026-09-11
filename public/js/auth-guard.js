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
      if (nav && spacer) {
        if (!document.getElementById('manage-customers-link')) {
          const customersLink = document.createElement('a');
          customersLink.id = 'manage-customers-link';
          customersLink.href = 'customers.html';
          customersLink.textContent = 'Manage Customers';
          nav.insertBefore(customersLink, spacer);
        }
        if (!document.getElementById('manage-users-link')) {
          const usersLink = document.createElement('a');
          usersLink.id = 'manage-users-link';
          usersLink.href = 'users.html';
          usersLink.textContent = 'Manage Users';
          nav.insertBefore(usersLink, spacer);
        }
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