function renderRoomChecklist(container) {
    container.innerHTML = `
        <div class="flex-between mb-4">
            <div class="search-box">
                <input type="text" class="form-control" id="roomSearch" placeholder="Search rooms..." oninput="renderRoomList()">
            </div>
            <button class="btn btn-primary" onclick="showRoomForm('pre-admission')">+ Pre-Admission Checklist</button>
            <button class="btn btn-info" onclick="showRoomForm('post-discharge')">+ Post-Discharge Checklist</button>
        </div>

        <div class="tabs">
            <button class="tab-btn active" onclick="switchRoomTab('all',this)">All</button>
            <button class="tab-btn" onclick="switchRoomTab('pre-admission',this)">Pre-Admission</button>
            <button class="tab-btn" onclick="switchRoomTab('post-discharge',this)">Post-Discharge</button>
            <button class="tab-btn" onclick="switchRoomTab('completed',this)">Completed</button>
        </div>

        <div class="card">
            <div class="table-responsive">
                <table>
                    <thead><tr>
                        <th>Room No</th><th>Type</th><th>Checked By</th><th>Date</th>
                        <th>Items OK</th><th>Issues</th><th>Status</th><th>Actions</th>
                    </tr></thead>
                    <tbody id="roomTableBody"></tbody>
                </table>
            </div>
        </div>
    `;
    renderRoomList();
}

let roomFilter = 'all';

function switchRoomTab(filter, btn) {
    roomFilter = filter;
    document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderRoomList();
}

const ROOM_ITEMS = {
    'pre-admission': [
        'Bed sheet clean', 'Pillow available', 'Blanket clean', 'IV stand working',
        'Bedside table clean', 'Call bell working', 'Lighting working', 'AC/Fan working',
        'TV remote working', 'Bathroom clean', 'Water supply', 'Soap/Towel placed',
        'Dustbin empty', 'Floor mopped', 'Window clean', 'Curtain clean',
        'Emergency button working', 'Medical gas outlet', 'Suction outlet', 'Oxygen outlet'
    ],
    'post-discharge': [
        'Bed sheet removed', 'Pillow cover removed', 'Blanket collected', 'IV stand cleaned',
        'Bedside table cleaned', 'Call bell checked', 'Lighting checked', 'AC/Fan checked',
        'TV remote collected', 'Bathroom disinfected', 'Water supply off', 'Soap/Towel removed',
        'Dustbin emptied', 'Floor disinfected', 'Window cleaned', 'Curtain removed for wash',
        'Emergency button tested', 'Medical gas off', 'Suction off', 'Oxygen off',
        'Mattress disinfected', 'Bed disinfected', 'Personal items collected', 'Lost & found checked'
    ]
};

function renderRoomList() {
    const checklists = DB.get('roomchecklists');
    const search = (document.getElementById('roomSearch')?.value || '').toLowerCase();
    let filtered = checklists.filter(r =>
        r.roomNo.toLowerCase().includes(search) ||
        r.checkedBy.toLowerCase().includes(search)
    );
    if (roomFilter !== 'all') {
        if (roomFilter === 'completed') {
            filtered = filtered.filter(r => r.status === 'completed');
        } else {
            filtered = filtered.filter(r => r.type === roomFilter);
        }
    }

    const tbody = document.getElementById('roomTableBody');
    if (!tbody) return;
    tbody.innerHTML = filtered.slice().reverse().map(r => {
        const items = r.items || {};
        const totalItems = Object.keys(items).length;
        const okItems = Object.values(items).filter(v => v === true).length;
        const issues = Object.entries(items).filter(([k, v]) => v === false).map(([k]) => k);
        const pct = totalItems > 0 ? Math.round((okItems / totalItems) * 100) : 0;

        return `<tr>
            <td><strong>${r.roomNo}</strong></td>
            <td><span class="badge ${r.type === 'pre-admission' ? 'badge-info' : 'badge-warning'}">${r.type === 'pre-admission' ? 'Pre-Admission' : 'Post-Discharge'}</span></td>
            <td>${r.checkedBy}</td>
            <td>${APP.formatDate(r.createdAt)}</td>
            <td>${okItems}/${totalItems}</td>
            <td>${issues.length > 0 ? `<span style="color:var(--danger)">${issues.length} issues</span>` : '<span style="color:var(--secondary)">None</span>'}</td>
            <td><span class="badge ${r.status === 'completed' ? 'badge-success' : 'badge-warning'}">${r.status}</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewRoomChecklist('${r.id}')">View</button>
                <button class="btn btn-sm btn-danger" onclick="deleteRoomChecklist('${r.id}')">Del</button>
            </td>
        </tr>`;
    }).join('') || '<tr><td colspan="8" class="empty-state">No room checklists</td></tr>';
}

function showRoomForm(type) {
    const items = ROOM_ITEMS[type] || [];
    let itemsHtml = items.map(item => `
        <label class="permission-item" style="background:var(--white);border:1px solid var(--light-gray);">
            <input type="checkbox" name="checkItem" value="${item}" checked>
            <span>${item}</span>
        </label>
    `).join('');

    const form = `
        <form id="roomForm">
            <input type="hidden" name="type" value="${type}">
            <div class="grid-2">
                <div class="form-group">
                    <label>Room / Ward No *</label>
                    <input type="text" name="roomNo" class="form-control" placeholder="e.g. 101, ICU-2" required>
                </div>
                <div class="form-group">
                    <label>Checked By *</label>
                    <input type="text" name="checkedBy" class="form-control" required>
                </div>
            </div>
            <div class="form-group">
                <label>Checklist Items</label>
                <div class="permission-grid">${itemsHtml}</div>
            </div>
            <div class="form-group">
                <label>Remarks / Issues Found</label>
                <textarea name="remarks" class="form-control" rows="2"></textarea>
            </div>
        </form>
    `;
    openFormModal(`${type === 'pre-admission' ? 'Pre-Admission' : 'Post-Discharge'} Room Checklist`, form, `saveRoomChecklist()`, true);
}

function saveRoomChecklist() {
    const form = document.getElementById('roomForm');
    const roomNo = form.querySelector('[name="roomNo"]')?.value;
    const checkedBy = form.querySelector('[name="checkedBy"]')?.value;
    const type = form.querySelector('[name="type"]')?.value;
    const remarks = form.querySelector('[name="remarks"]')?.value || '';

    if (!roomNo || !checkedBy) { APP.notify('Room no and checker required', 'error'); return; }

    const items = {};
    form.querySelectorAll('[name="checkItem"]').forEach(cb => {
        items[cb.value] = cb.checked;
    });

    DB.add('roomchecklists', {
        roomNo, checkedBy, type, items, remarks,
        status: 'completed'
    });
    APP.notify('Room checklist completed', 'success');
    renderRoomList();
}

function viewRoomChecklist(id) {
    const r = DB.getById('roomchecklists', id);
    if (!r) return;
    const items = r.items || {};
    const okItems = Object.entries(items).filter(([, v]) => v === true);
    const issues = Object.entries(items).filter(([, v]) => v === false);

    let itemsHtml = '';
    if (okItems.length > 0) {
        itemsHtml += `<div class="mt-2"><strong>✅ Passed (${okItems.length}):</strong><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">`;
        itemsHtml += okItems.map(([k]) => `<span style="background:#e6f4ea;padding:2px 8px;border-radius:4px;font-size:12px;">${k}</span>`).join('');
        itemsHtml += `</div></div>`;
    }
    if (issues.length > 0) {
        itemsHtml += `<div class="mt-2"><strong>❌ Failed (${issues.length}):</strong><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">`;
        itemsHtml += issues.map(([k]) => `<span style="background:#fce8e6;padding:2px 8px;border-radius:4px;font-size:12px;">${k}</span>`).join('');
        itemsHtml += `</div></div>`;
    }

    showModal(`
        <div class="modal-header">
            <h3>Room ${r.roomNo} - ${r.type === 'pre-admission' ? 'Pre-Admission' : 'Post-Discharge'}</h3>
            <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="grid-2">
            <div><strong>Checked By:</strong> ${r.checkedBy}</div>
            <div><strong>Date:</strong> ${APP.formatDateTime(r.createdAt)}</div>
            <div><strong>Status:</strong> <span class="badge badge-success">${r.status.toUpperCase()}</span></div>
            <div><strong>Overall:</strong> ${okItems.length}/${Object.keys(items).length} items passed</div>
        </div>
        ${itemsHtml}
        ${r.remarks ? `<div class="mt-4"><strong>Remarks:</strong><br>${r.remarks}</div>` : ''}
    `, true);
}

function deleteRoomChecklist(id) {
    confirmAction('Delete this checklist?', () => {
        DB.delete('roomchecklists', id);
        renderRoomList();
    });
}
