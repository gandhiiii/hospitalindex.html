function renderLostFound(container) {
    container.innerHTML = `
        <div class="flex-between mb-4">
            <div class="search-box">
                <input type="text" class="form-control" id="lostSearch" placeholder="Search items..." oninput="renderLostList()">
            </div>
            <div>
                <button class="btn btn-primary" onclick="showLostForm('lost')">+ Report Lost</button>
                <button class="btn btn-success" onclick="showLostForm('found')">+ Report Found</button>
            </div>
        </div>

        <div class="tabs">
            <button class="tab-btn active" onclick="switchLostTab('all',this)">All</button>
            <button class="tab-btn" onclick="switchLostTab('lost',this)">Lost</button>
            <button class="tab-btn" onclick="switchLostTab('found',this)">Found</button>
            <button class="tab-btn" onclick="switchLostTab('returned',this)">Returned</button>
        </div>

        <div class="card">
            <div class="table-responsive">
                <table>
                    <thead><tr>
                        <th>Item Name</th><th>Type</th><th>Description</th><th>Date</th>
                        <th>Location</th><th>Reported By</th><th>Status</th><th>Actions</th>
                    </tr></thead>
                    <tbody id="lostTableBody"></tbody>
                </table>
            </div>
        </div>
    `;
    renderLostList();
}

let lostFilter = 'all';

function switchLostTab(filter, btn) {
    lostFilter = filter;
    document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderLostList();
}

function renderLostList() {
    const items = DB.get('lostfound');
    const search = (document.getElementById('lostSearch')?.value || '').toLowerCase();
    let filtered = items.filter(i =>
        i.itemName.toLowerCase().includes(search) ||
        i.description.toLowerCase().includes(search) ||
        i.location.toLowerCase().includes(search) ||
        i.reportedBy.toLowerCase().includes(search)
    );
    if (lostFilter !== 'all') filtered = filtered.filter(i => i.type === lostFilter || (lostFilter === 'returned' && i.status === 'returned'));

    const tbody = document.getElementById('lostTableBody');
    if (!tbody) return;
    tbody.innerHTML = filtered.slice().reverse().map(i => `
        <tr>
            <td><strong>${i.itemName}</strong></td>
            <td><span class="badge ${i.type === 'lost' ? 'badge-danger' : 'badge-success'}">${i.type.toUpperCase()}</span></td>
            <td>${i.description.substring(0, 50)}${i.description.length > 50 ? '...' : ''}</td>
            <td>${APP.formatDate(i.createdAt)}</td>
            <td>${i.location || '-'}</td>
            <td>${i.reportedBy}</td>
            <td><span class="badge ${i.status === 'returned' ? 'badge-success' : i.type === 'found' ? 'badge-info' : 'badge-danger'}">${i.status}</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewLostItem('${i.id}')">View</button>
                ${i.status !== 'returned' ? `<button class="btn btn-sm btn-success" onclick="markReturned('${i.id}')">Returned</button>` : ''}
                <button class="btn btn-sm btn-danger" onclick="deleteLostItem('${i.id}')">Del</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="8" class="empty-state">No lost & found records</td></tr>';
}

function showLostForm(type) {
    const form = `
        <form id="lostForm">
            <input type="hidden" name="type" value="${type}">
            <div class="grid-2">
                <div class="form-group">
                    <label>Item Name *</label>
                    <input type="text" name="itemName" class="form-control" placeholder="${type === 'lost' ? 'Item that was lost' : 'Item that was found'}" required>
                </div>
                <div class="form-group">
                    <label>Reported By *</label>
                    <input type="text" name="reportedBy" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Location *</label>
                    <input type="text" name="location" class="form-control" placeholder="Where it was lost/found" required>
                </div>
                <div class="form-group">
                    <label>Date of Incident</label>
                    <input type="date" name="incidentDate" class="form-control" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label>Contact Info</label>
                    <input type="text" name="contactInfo" class="form-control" placeholder="Phone or address">
                </div>
                <div class="form-group">
                    <label>Category</label>
                    <select name="category" class="form-control">
                        <option value="Personal">Personal</option>
                        <option value="Electronics">Electronics</option>
                        <option value="Document">Document</option>
                        <option value="Clothing">Clothing</option>
                        <option value="Jewelry">Jewelry</option>
                        <option value="Money">Money</option>
                        <option value="Medical">Medical</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Description *</label>
                <textarea name="description" class="form-control" rows="3" required></textarea>
            </div>
            <div class="form-group">
                <label>Action Taken</label>
                <textarea name="actionTaken" class="form-control" rows="2" placeholder="e.g. Informed security, logged in register"></textarea>
            </div>
        </form>
    `;
    openFormModal(`${type === 'lost' ? 'Report Lost Item' : 'Report Found Item'}`, form, `saveLostItem()`);
}

function saveLostItem() {
    const data = getFormData('lostForm');
    if (!data.itemName || !data.reportedBy || !data.location || !data.description) {
        APP.notify('Please fill required fields', 'error'); return;
    }
    data.status = data.type === 'lost' ? 'lost' : 'found';
    data.returnedTo = '';
    data.returnedAt = '';
    DB.add('lostfound', data);
    APP.notify(`${data.type === 'lost' ? 'Lost item' : 'Found item'} reported`, 'success');
    renderLostList();
}

function viewLostItem(id) {
    const i = DB.getById('lostfound', id);
    if (!i) return;
    showModal(`
        <div class="modal-header">
            <h3>${i.itemName}</h3>
            <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="grid-2">
            <div><strong>Type:</strong> <span class="badge ${i.type === 'lost' ? 'badge-danger' : 'badge-success'}">${i.type.toUpperCase()}</span></div>
            <div><strong>Category:</strong> ${i.category || '-'}</div>
            <div><strong>Location:</strong> ${i.location}</div>
            <div><strong>Date:</strong> ${APP.formatDate(i.incidentDate || i.createdAt)}</div>
            <div><strong>Reported By:</strong> ${i.reportedBy}</div>
            <div><strong>Contact:</strong> ${i.contactInfo || '-'}</div>
            <div><strong>Status:</strong> <span class="badge ${i.status === 'returned' ? 'badge-success' : 'badge-danger'}">${i.status.toUpperCase()}</span></div>
            ${i.returnedTo ? `<div><strong>Returned To:</strong> ${i.returnedTo}</div>` : ''}
            ${i.returnedAt ? `<div><strong>Returned At:</strong> ${APP.formatDateTime(i.returnedAt)}</div>` : ''}
        </div>
        <div class="mt-4"><strong>Description:</strong><br>${i.description}</div>
        ${i.actionTaken ? `<div class="mt-2"><strong>Action Taken:</strong><br>${i.actionTaken}</div>` : ''}
    `);
}

function markReturned(id) {
    const item = DB.getById('lostfound', id);
    if (!item) return;
    const name = prompt('Item returned to (name):');
    if (!name) return;
    DB.update('lostfound', id, {
        status: 'returned',
        returnedTo: name,
        returnedAt: new Date().toISOString()
    });
    APP.notify('Item marked as returned', 'success');
    renderLostList();
}

function deleteLostItem(id) {
    confirmAction('Delete this record?', () => {
        DB.delete('lostfound', id);
        renderLostList();
    });
}
