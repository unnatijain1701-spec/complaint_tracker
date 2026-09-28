const PLANTS = ['Rai', 'Jaipur', 'Bangalore', 'Mumbai', 'Hyderabad', 'Other'];

const loadErrorEl = document.getElementById('load-error');
const countEl = document.getElementById('customer-count');
const tbodyEl = document.getElementById('customers-tbody');
const tableEl = document.getElementById('customers-table');
const viewPlantSelect = document.getElementById('view-plant');
const showCustomersBtn = document.getElementById('show-customers-btn');
const addPlantSelect = document.getElementById('add-plant');
const importHelpEl = document.getElementById('import-help');

viewPlantSelect.insertAdjacentHTML('beforeend', PLANTS.map((p) => `<option>${p}</option>`).join(''));
addPlantSelect.insertAdjacentHTML('beforeend', PLANTS.map((p) => `<option>${p}</option>`).join(''));
importHelpEl.textContent = `Upload an .xlsx file with one sheet per plant — name each sheet exactly after a plant (${PLANTS.join(', ')}) and list that plant's customer names in the sheet's first column (a header row like "Customer" or "Name" is fine and gets skipped automatically). Sheets not named after a plant are skipped.`;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

async function loadCustomers(plant) {
  if (!plant) {
    tableEl.style.display = 'none';
    countEl.textContent = '';
    loadErrorEl.innerHTML = '<div class="message error">Select a plant and click "Show Customers".</div>';
    return;
  }
  try {
    const res = await fetch(`/api/customers?plant=${encodeURIComponent(plant)}`);
    if (res.status === 403) {
      loadErrorEl.innerHTML = '<div class="message error">Admin access required.</div>';
      tableEl.style.display = 'none';
      return;
    }
    if (!res.ok) {
      loadErrorEl.innerHTML = '<div class="message error">Failed to load customers.</div>';
      tableEl.style.display = 'none';
      return;
    }
    loadErrorEl.innerHTML = '';
    const customers = await res.json();

    countEl.textContent = `${customers.length} customer${customers.length === 1 ? '' : 's'} for ${plant}.`;

    tbodyEl.innerHTML = customers
      .map(
        (c) => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.plant)}</td>
        <td><button type="button" class="delete-customer" data-id="${c.id}" data-name="${escapeHtml(c.name)}">Remove</button></td>
      </tr>`
      )
      .join('') || '<tr><td colspan="3">No customers yet for this plant.</td></tr>';

    tbodyEl.querySelectorAll('.delete-customer').forEach((btn) => {
      btn.addEventListener('click', () => handleDeleteCustomer(btn.dataset.id, btn.dataset.name));
    });

    tableEl.style.display = '';
  } catch (err) {
    loadErrorEl.innerHTML = '<div class="message error">Network error.</div>';
    tableEl.style.display = 'none';
  }
}

showCustomersBtn.addEventListener('click', () => loadCustomers(viewPlantSelect.value));

async function handleAddCustomer(e) {
  e.preventDefault();
  const messageEl = document.getElementById('add-message');
  messageEl.innerHTML = '';

  const name = e.target.name.value;
  const plant = e.target.plant.value;

  try {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, plant }),
    });
    const data = await res.json();

    if (!res.ok) {
      messageEl.innerHTML = `<div class="message error">${(data.errors || [data.error]).join('; ')}</div>`;
      return;
    }

    messageEl.innerHTML = `<div class="message success">Added ${escapeHtml(data.name)}.</div>`;
    e.target.reset();
    if (viewPlantSelect.value) loadCustomers(viewPlantSelect.value);
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

    const unrecognizedNote = data.unrecognizedSheets && data.unrecognizedSheets.length
      ? ` Skipped sheet(s) not named after a plant: ${data.unrecognizedSheets.map(escapeHtml).join(', ')}.`
      : '';
    messageEl.innerHTML = `<div class="message success">Added ${data.added}, skipped ${data.skipped} duplicate(s), out of ${data.total} found in the file.${unrecognizedNote}</div>`;
    e.target.reset();
    if (viewPlantSelect.value) loadCustomers(viewPlantSelect.value);
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
    loadCustomers(viewPlantSelect.value);
  } catch (err) {
    alert('Network error.');
  }
}

document.getElementById('add-customer-form').addEventListener('submit', handleAddCustomer);
document.getElementById('import-form').addEventListener('submit', handleImport);