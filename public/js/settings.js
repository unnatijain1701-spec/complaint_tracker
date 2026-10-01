const content = document.getElementById('content');

async function loadSettings() {
  try {
    const res = await fetch('/api/settings/sla');
    if (res.status === 403) {
      content.innerHTML = '<div class="message error">Admin access required — you don\'t have permission to view this page.</div>';
      return;
    }
    if (!res.ok) {
      content.innerHTML = '<div class="message error">Failed to load settings.</div>';
      return;
    }
    const hours = await res.json();

    content.innerHTML = `
      <h2>Complaint Resolution Deadlines</h2>
      <p>How many hours after logging a complaint it should be resolved by, based on its priority. Anything still Open/In Progress past this shows as OVERDUE on the Complaints list.</p>
      <div id="sla-message"></div>
      <form id="sla-form">
        <label>
          Critical (hours)
          <input type="number" name="Critical" min="1" step="1" value="${hours.Critical}" required />
        </label>
        <label>
          High (hours)
          <input type="number" name="High" min="1" step="1" value="${hours.High}" required />
        </label>
        <label>
          Medium (hours)
          <input type="number" name="Medium" min="1" step="1" value="${hours.Medium}" required />
        </label>
        <label>
          Low (hours)
          <input type="number" name="Low" min="1" step="1" value="${hours.Low}" required />
        </label>
        <button type="submit">Save</button>
      </form>
    `;

    document.getElementById('sla-form').addEventListener('submit', handleSaveSettings);
  } catch (err) {
    content.innerHTML = '<div class="message error">Network error.</div>';
  }
}

async function handleSaveSettings(e) {
  e.preventDefault();
  const messageEl = document.getElementById('sla-message');
  messageEl.innerHTML = '';

  const form = e.target;
  const payload = {
    Critical: form.Critical.value,
    High: form.High.value,
    Medium: form.Medium.value,
    Low: form.Low.value,
  };

  try {
    const res = await fetch('/api/settings/sla', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      messageEl.innerHTML = `<div class="message error">${(data.errors || [data.error]).join('; ')}</div>`;
      return;
    }

    messageEl.innerHTML = '<div class="message success">Saved.</div>';
  } catch (err) {
    messageEl.innerHTML = '<div class="message error">Network error.</div>';
  }
}

loadSettings();