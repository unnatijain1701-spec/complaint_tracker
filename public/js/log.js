const form = document.getElementById('complaint-form');
const messageEl = document.getElementById('message');
const previewEl = document.getElementById('priority-preview');

function showMessage(text, type) {
  messageEl.innerHTML = `<div class="message ${type}">${text}</div>`;
}

async function loadCustomerOptions() {
  try {
    const res = await fetch('/api/customers');
    if (!res.ok) return;
    const customers = await res.json();
    const datalist = document.getElementById('customer-options');
    datalist.innerHTML = customers.map((c) => `<option value="${c.name.replace(/"/g, '&quot;')}"></option>`).join('');
  } catch (err) {
    // customer list is a convenience; the field still works as free text
  }
}
loadCustomerOptions();

function debounce(fn, delayMs) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

async function updatePriorityPreview() {
  const description = form.description.value;
  const complaint_type = form.complaint_type.value;
  const customer_name = form.customer_name.value;
  const sku = form.sku.value;

  if (!description && !complaint_type) {
    previewEl.style.display = 'none';
    return;
  }

  try {
    const res = await fetch('/api/complaints/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, complaint_type, customer_name, sku }),
    });
    if (!res.ok) return;
    const data = await res.json();

    previewEl.style.display = '';
    previewEl.className = 'message';
    previewEl.innerHTML = `Suggested priority: <span class="priority-badge priority-${data.priority_suggested}">${data.priority_suggested}</span>${data.auto_critical ? ' (auto-flagged from description keywords)' : ''}`;
  } catch (err) {
    // preview is a convenience; ignore network errors here
  }
}

const debouncedPreview = debounce(updatePriorityPreview, 400);
['description', 'complaint_type', 'customer_name', 'sku'].forEach((name) => {
  form[name].addEventListener('input', debouncedPreview);
  form[name].addEventListener('change', debouncedPreview);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  messageEl.innerHTML = '';

  const formData = new FormData(form);

  try {
    const res = await fetch('/api/complaints', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      showMessage((data.errors || [data.error || 'Failed to log complaint']).join('; '), 'error');
      return;
    }

    showMessage(`Complaint #${data.id} logged successfully.`, 'success');
    form.reset();
    previewEl.style.display = 'none';
  } catch (err) {
    showMessage('Network error — could not reach the server.', 'error');
  }
});