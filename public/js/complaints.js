const tbody = document.getElementById('complaints-body');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function priorityBadge(priority) {
  if (!priority) return '<span class="priority-badge" style="background:#999">Unset</span>';
  return `<span class="priority-badge priority-${priority}">${priority}</span>`;
}

function currentFilterParams() {
  const params = new URLSearchParams();
  const search = document.getElementById('filter-search').value.trim();
  const sku = document.getElementById('filter-sku').value.trim();
  const customer = document.getElementById('filter-customer').value.trim();
  const plant = document.getElementById('filter-plant').value;
  const status = document.getElementById('filter-status').value;
  const priority = document.getElementById('filter-priority').value;
  const dateFrom = document.getElementById('filter-date-from').value;
  const dateTo = document.getElementById('filter-date-to').value;

  if (search) params.set('search', search);
  if (sku) params.set('sku', sku);
  if (customer) params.set('customer', customer);
  if (plant) params.set('plant', plant);
  if (status) params.set('status', status);
  if (priority) params.set('priority', priority);
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);

  return params;
}

async function loadComplaints() {
  tbody.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';

  const params = currentFilterParams();

  try {
    const res = await fetch(`/api/complaints?${params.toString()}`);
    const rows = await res.json();

    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="8">Error loading complaints.</td></tr>`;
      return;
    }

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8">No complaints found.</td></tr>';
      return;
    }

    tbody.innerHTML = rows
      .map((r) => {
        const isOverdue =
          ['Open', 'In Progress'].includes(r.status) && r.sla_due_at && new Date(r.sla_due_at) < new Date();
        return `
      <tr class="complaint-row${isOverdue ? ' overdue' : ''}" data-id="${r.id}" style="cursor:pointer">
        <td>${r.id}</td>
        <td>${escapeHtml(r.date_received?.slice(0, 10))}</td>
        <td>${escapeHtml(r.customer_name)}</td>
        <td>${escapeHtml(r.sku)}</td>
        <td>${escapeHtml(r.plant)}</td>
        <td>${escapeHtml(r.complaint_type)}</td>
        <td>${priorityBadge(r.priority_final)}</td>
        <td>${escapeHtml(r.status)}${isOverdue ? ' <span class="priority-badge priority-Critical">OVERDUE</span>' : ''}</td>
      </tr>`;
      })
      .join('');

    tbody.querySelectorAll('.complaint-row').forEach((row) => {
      row.addEventListener('click', () => {
        window.location.href = `complaint-detail.html?id=${row.dataset.id}`;
      });
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8">Network error.</td></tr>';
  }
}

document.getElementById('filter-apply').addEventListener('click', loadComplaints);
document.getElementById('filter-export').addEventListener('click', () => {
  const params = currentFilterParams();
  window.location.href = `/api/complaints/export?${params.toString()}`;
});
loadComplaints();
