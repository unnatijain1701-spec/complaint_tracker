const content = document.getElementById('content');
const complaintId = new URLSearchParams(window.location.search).get('id');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function optionsHtml(values, selected) {
  return values.map((v) => `<option${v === selected ? ' selected' : ''}>${v}</option>`).join('');
}

function auditTrailHtml(entries) {
  if (!entries || entries.length === 0) return '<p>No changes recorded yet.</p>';
  const rows = entries
    .map(
      (e) => `
      <tr>
        <td>${new Date(e.changed_at).toLocaleString()}</td>
        <td>${escapeHtml(e.changed_by)}</td>
        <td>${escapeHtml(e.field_changed)}</td>
        <td>${escapeHtml(e.old_value)}</td>
        <td>${escapeHtml(e.new_value)}</td>
      </tr>`
    )
    .join('');
  return `
    <table>
      <thead><tr><th>When</th><th>Who</th><th>Field</th><th>Old Value</th><th>New Value</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

async function loadComplaint() {
  if (!complaintId) {
    content.innerHTML = '<div class="message error">No complaint id given.</div>';
    return;
  }

  try {
    const res = await fetch(`/api/complaints/${complaintId}`);
    if (!res.ok) {
      content.innerHTML = '<div class="message error">Complaint not found.</div>';
      return;
    }
    const c = await res.json();

    const fields = [
      ['Date Received', c.date_received?.slice(0, 10)],
      ['Date Logged', new Date(c.date_logged).toLocaleString()],
      ['Customer', c.customer_name],
      ['SKU', c.sku],
      ['Plant', c.plant],
      ['Complaint Type', c.complaint_type],
      ['Channel', c.channel],
      ['Description', c.description],
      ['Priority (suggested)', c.priority_suggested || '—'],
      ['Priority (final)', c.priority_final || '—'],
      ['Status', c.status],
      ['Assigned To', c.assigned_to || '—'],
      ['Logged By', c.logged_by || '—'],
      ['SLA Due', c.sla_due_at ? new Date(c.sla_due_at).toLocaleString() : '—'],
      ['Resolution Notes', c.resolution_notes || '—'],
      ['Resolution Date', c.resolution_date ? new Date(c.resolution_date).toLocaleString() : '—'],
      ['Root Cause', c.root_cause || '—'],
    ];

    const fieldHtml = fields
      .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`)
      .join('');

    const attachmentsHtml = c.attachments && c.attachments.length
      ? c.attachments
          .map(
            (a) => `<a href="/uploads/${encodeURIComponent(a.file_path)}" target="_blank">
              <img src="/uploads/${encodeURIComponent(a.file_path)}" alt="${escapeHtml(a.original_filename)}" />
            </a>`
          )
          .join('')
      : '<p>No attachments.</p>';

    content.innerHTML = `
      <h2>Complaint #${c.id}</h2>
      <dl class="field-grid">${fieldHtml}</dl>
      <h3>Attachments</h3>
      <div class="attachments">${attachmentsHtml}</div>
      <h3>Update</h3>
      <div id="update-message"></div>
      <form id="update-form">
        <label>
          Status
          <select name="status">${optionsHtml(['Open', 'In Progress', 'Resolved', 'Closed'], c.status)}</select>
        </label>
        <label>
          Priority
          <select name="priority_final">${optionsHtml(['Critical', 'High', 'Medium', 'Low'], c.priority_final)}</select>
        </label>
        <label>
          Assigned To
          <input type="text" name="assigned_to" value="${escapeHtml(c.assigned_to || '')}" />
        </label>
        <label>
          Resolution Notes
          <textarea name="resolution_notes">${escapeHtml(c.resolution_notes || '')}</textarea>
        </label>
        <label>
          Root Cause
          <input type="text" name="root_cause" value="${escapeHtml(c.root_cause || '')}" />
        </label>
        <button type="submit">Save Update</button>
      </form>
      <h3>Audit Trail</h3>
      ${auditTrailHtml(c.audit_log)}
    `;

    document.getElementById('update-form').addEventListener('submit', handleUpdateSubmit);
  } catch (err) {
    content.innerHTML = '<div class="message error">Network error.</div>';
  }
}

async function handleUpdateSubmit(e) {
  e.preventDefault();
  const messageEl = document.getElementById('update-message');
  messageEl.innerHTML = '';

  const payload = Object.fromEntries(new FormData(e.target).entries());

  try {
    const res = await fetch(`/api/complaints/${complaintId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      messageEl.innerHTML = `<div class="message error">${(data.errors || [data.error]).join('; ')}</div>`;
      return;
    }

    messageEl.innerHTML = '<div class="message success">Saved.</div>';
    loadComplaint();
  } catch (err) {
    messageEl.innerHTML = '<div class="message error">Network error.</div>';
  }
}

loadComplaint();
