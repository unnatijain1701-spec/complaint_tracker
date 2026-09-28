const form = document.getElementById('complaint-form');
const messageEl = document.getElementById('message');
const previewEl = document.getElementById('priority-preview');

function showMessage(text, type) {
  messageEl.innerHTML = `<div class="message ${type}">${text}</div>`;
}

async function loadCustomerOptions(plant) {
  try {
    const url = plant ? `/api/customers?plant=${encodeURIComponent(plant)}` : '/api/customers';
    const res = await fetch(url);
    if (!res.ok) return;
    const customers = await res.json();
    const datalist = document.getElementById('customer-options');
    datalist.innerHTML = customers.map((c) => `<option value="${c.name.replace(/"/g, '&quot;')}"></option>`).join('');
  } catch (err) {
    // customer list is a convenience; the field still works as free text
  }
}
loadCustomerOptions();

const plantSelect = document.getElementById('plant');
plantSelect.addEventListener('change', () => loadCustomerOptions(plantSelect.value));

const complaintTypeSelect = document.getElementById('complaint-type');
const complaintTypeOtherLabel = document.getElementById('complaint-type-other-label');
const complaintTypeOtherInput = document.getElementById('complaint-type-other');

complaintTypeSelect.addEventListener('change', () => {
  const isOther = complaintTypeSelect.value === 'Other';
  complaintTypeOtherLabel.style.display = isOther ? '' : 'none';
  complaintTypeOtherInput.required = isOther;
  if (!isOther) complaintTypeOtherInput.value = '';
});

const imagesInput = document.getElementById('images-input');
const selectedFilesEl = document.getElementById('selected-files');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function renderSelectedFiles() {
  const files = Array.from(imagesInput.files);
  selectedFilesEl.innerHTML = files
    .map(
      (f, i) => `<span class="file-chip">${escapeHtml(f.name)} <button type="button" class="remove-file" data-index="${i}" aria-label="Remove ${escapeHtml(f.name)}">&times;</button></span>`
    )
    .join('');
  selectedFilesEl.querySelectorAll('.remove-file').forEach((btn) => {
    btn.addEventListener('click', () => removeSelectedFile(Number(btn.dataset.index)));
  });
}

function removeSelectedFile(indexToRemove) {
  const dt = new DataTransfer();
  Array.from(imagesInput.files).forEach((file, i) => {
    if (i !== indexToRemove) dt.items.add(file);
  });
  imagesInput.files = dt.files;
  renderSelectedFiles();
}

imagesInput.addEventListener('change', renderSelectedFiles);

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
    selectedFilesEl.innerHTML = '';
  } catch (err) {
    showMessage('Network error — could not reach the server.', 'error');
  }
});