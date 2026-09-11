const content = document.getElementById('content');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    if (res.status === 403) {
      content.innerHTML = '<div class="message error">Admin access required — you don\'t have permission to view this page.</div>';
      return;
    }
    if (!res.ok) {
      content.innerHTML = '<div class="message error">Failed to load users.</div>';
      return;
    }
    const users = await res.json();

    const rows = users
      .map(
        (u) => `
      <tr>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${u.is_admin ? 'Yes' : 'No'}</td>
        <td>${new Date(u.created_at).toLocaleDateString()}</td>
        <td><button type="button" class="delete-user" data-id="${u.id}" data-name="${escapeHtml(u.name)}">Remove</button></td>
      </tr>`
      )
      .join('');

    content.innerHTML = `
      <table>
        <thead>
          <tr><th>Name</th><th>Email</th><th>Admin</th><th>Added</th><th></th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <h2>Add a User</h2>
      <div id="add-message"></div>
      <form id="add-user-form">
        <label>
          Name
          <input type="text" name="name" required />
        </label>
        <label>
          Email
          <input type="email" name="email" required />
        </label>
        <label>
          Password
          <input type="password" name="password" required minlength="8" />
        </label>
        <label style="flex-direction:row;align-items:center;gap:0.5rem">
          <input type="checkbox" name="is_admin" style="width:auto" />
          Grant admin access (can manage users)
        </label>
        <button type="submit">Add User</button>
      </form>
    `;

    document.getElementById('add-user-form').addEventListener('submit', handleAddUser);
    document.querySelectorAll('.delete-user').forEach((btn) => {
      btn.addEventListener('click', () => handleDeleteUser(btn.dataset.id, btn.dataset.name));
    });
  } catch (err) {
    content.innerHTML = '<div class="message error">Network error.</div>';
  }
}

async function handleAddUser(e) {
  e.preventDefault();
  const messageEl = document.getElementById('add-message');
  messageEl.innerHTML = '';

  const form = e.target;
  const payload = {
    name: form.name.value,
    email: form.email.value,
    password: form.password.value,
    is_admin: form.is_admin.checked,
  };

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      messageEl.innerHTML = `<div class="message error">${(data.errors || [data.error]).join('; ')}</div>`;
      return;
    }

    messageEl.innerHTML = `<div class="message success">Added ${escapeHtml(data.name)}.</div>`;
    loadUsers();
  } catch (err) {
    messageEl.innerHTML = '<div class="message error">Network error.</div>';
  }
}

async function handleDeleteUser(id, name) {
  if (!confirm(`Remove ${name}'s login? They will no longer be able to log in.`)) return;

  try {
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to remove user.');
      return;
    }
    loadUsers();
  } catch (err) {
    alert('Network error.');
  }
}

loadUsers();