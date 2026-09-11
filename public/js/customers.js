const content = document.getElementById('content');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

async function loadCustomers() {
  try {
    const res = await fetch('/api/customers');
    if (res.status === 403) {
      content.innerHTML = '<div class="message error">Admin access required.</div>';
      return;
    }
    if (!res.ok) {
      content.innerHTML = '<div class="message error">Failed to load customers.</div>';
      return;
    }
    const customers = await res.json();

    const rows = customers
      .map(
        (c) => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td><button type="button" class="delete-customer" data-id="${c.id}" data-name="${escapeHtml(c.name)}">Remove</button></td>
      </tr>`
      )
      .join('');

    content.innerHTML = `
      <p>${customers.length} customer${customers.length === 1 ? '' : 's'} in the list. This list powers the searchable dropdown on the "Log Complaint" form.</p>

      <table>
        <thead><tr><th>Name</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="2">No customers yet.</td></tr>'}</tbody>
      </table>

      <h2>Add a Customer</h2>
      <div id="add-message"></div>
      <form id="add-customer-form">
        <label>
          Customer Name
          <input type="text" name="name" required />
        </label>
        <button type="submit">Add Customer</button>
      </form>

      <h2>Import from Excel</h2>
      <p>Upload an .xlsx file with customer names in the first column (a header row like "Customer" or "Name" is fine and gets skipped automatically).</p>
      <div id="import-message"></div>
      <form id="import-form">
        <label>
          Excel File
          <input type="file" name="file" accept=".xlsx" required />
        </label>
        <button type="submit">Import</button>
      </form>
    `;

    document.getElementById('add-customer-form').addEventListener('submit', handleAddCustomer);
    document.getElementById('import-form').addEventListener('submit', handleImport);
    document.querySelectorAll('.delete-customer').forEach((btn) => {
      btn.addEventListener('click', () => handleDeleteCustomer(btn.dataset.id, btn.dataset.name));
    });
  } catch (err) {
    content.innerHTML = '<div class="message error">Network error.</div>';
  }
}

async function handleAddCustomer(e) {
  e.preventDefault();
  const messageEl = document.getElementById('add-message');
  messageEl.innerHTML = '';

  const name = e.target.name.value;

  try {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();

    if (!res.ok) {
      messageEl.innerHTML = `<div class="message error">${(data.errors || [data.error]).join('; ')}</div>`;
      return;
    }

    messageEl.innerHTML = `<div class="message success">Added ${escapeHtml(data.name)}.</div>`;
    loadCustomers();
  } catch (err) {
    messageEl.innerHTML = '<div class="message error">Network error.</div>';
  }
}

async function handleImport(e) {
  e.preventDefault();
  const messageEl = document.getElementById('import-message');
  messageEl.innerHTML = '';

  const formData = new FormData(e.target);

  try {
    const res = await fetch('/api/customers/import', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      messageEl.innerHTML = `<div class="message error">${data.error || 'Import failed.'}</div>`;
      return;
    }

    messageEl.innerHTML = `<div class="message success">Added ${data.added}, skipped ${data.skipped} duplicate(s), out of ${data.total} found in the file.</div>`;
    loadCustomers();
  } catch (err) {
    messageEl.innerHTML = '<div class="message error">Network error.</div>';
  }
}

async function handleDeleteCustomer(id, name) {
  if (!confirm(`Remove "${name}" from the customer list?`)) return;

  try {
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to remove customer.');
      return;
    }
    loadCustomers();
  } catch (err) {
    alert('Network error.');
  }
}

loadCustomers();