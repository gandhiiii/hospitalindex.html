function renderPhase2(container) {
    container.innerHTML = `
        <div class="tabs" style="margin-bottom:16px;">
            <button class="tab-btn active" onclick="switchP2MainTab('material',this)">📦 Material Tracking</button>
            <button class="tab-btn" onclick="switchP2MainTab('tasks',this)">📋 Tasks & Gantt</button>
            <button class="tab-btn" onclick="switchP2MainTab('reports',this)">📊 Reports & Excel</button>
        </div>
        <div id="p2MainContent">
            ${renderP2MaterialTab()}
        </div>
    `;
    setTimeout(() => renderP2List(), 50);
}

let p2MainTab = 'material';

/* ═══════════════════════════════════════════
   TAB 1: Material Tracking (existing code)
   ═══════════════════════════════════════════ */

function renderP2MaterialTab() {
    return `
        <div class="flex-between mb-4">
            <div>
                <h3 style="margin:0;">Phase 2 Infra & Development</h3>
                <span style="font-size:13px;color:var(--gray);">Track construction materials, vehicle entries, and site supplies</span>
            </div>
            <div style="display:flex;gap:6px;">
                <button class="btn btn-success" onclick="showP2Form('in')">+ Material In</button>
                <button class="btn btn-warning" onclick="showP2Form('out')">+ Material Out</button>
            </div>
        </div>
        <div class="grid-4 mb-4" id="p2Stats"></div>
        <div class="card">
            <div class="flex-between mb-2" style="padding:0 0 8px 0;">
                <div class="search-box">
                    <input type="text" class="form-control" id="p2Search" placeholder="Search material, vehicle, supplier..." oninput="renderP2List()">
                </div>
                <div class="tabs" style="margin:0;">
                    <button class="tab-btn active" onclick="switchP2Tab('all',this)">All</button>
                    <button class="tab-btn" onclick="switchP2Tab('in',this)">Inward</button>
                    <button class="tab-btn" onclick="switchP2Tab('out',this)">Outward</button>
                </div>
            </div>
            <div class="table-responsive">
                <table>
                    <thead><tr>
                        <th>Date/Time</th><th>Material Name</th><th>Direction</th><th>Quantity</th>
                        <th>Vehicle No</th><th>Driver</th><th>Supplier</th><th>Entered By</th><th>Actions</th>
                    </tr></thead>
                    <tbody id="p2TableBody"></tbody>
                </table>
            </div>
        </div>
    `;
}

switchP2MainTab = function(tab, btn) {
    p2MainTab = tab;
    document.querySelectorAll('#pageContent .tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const content = document.getElementById('p2MainContent');
    if (!content) return;
    if (tab === 'material') {
        content.innerHTML = renderP2MaterialTab();
        setTimeout(() => { renderP2List(); }, 50);
    } else if (tab === 'tasks') {
        content.innerHTML = renderP2TasksTab();
        setTimeout(() => { renderP2TaskList(); }, 50);
    } else if (tab === 'reports') {
        content.innerHTML = renderP2ReportsTab();
        setTimeout(() => { renderP2ReportData(); }, 50);
    }
};

let p2Filter = 'all';

function switchP2Tab(filter, btn) {
    p2Filter = filter;
    document.querySelectorAll('#p2MainContent .tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderP2List();
}

function renderP2List() {
    const entries = DB.get('phase2');
    const search = (document.getElementById('p2Search')?.value || '').toLowerCase();

    const totalIn = entries.filter(e => e.direction === 'in').reduce((s, e) => s + (parseFloat(e.quantity) || 0), 0);
    const totalOut = entries.filter(e => e.direction === 'out').reduce((s, e) => s + (parseFloat(e.quantity) || 0), 0);
    const entryCount = entries.length;
    const uniqueVehicles = new Set(entries.map(e => e.vehicleNo).filter(Boolean)).size;
    const statsEl = document.getElementById('p2Stats');
    if (statsEl) {
        statsEl.innerHTML = `
            <div class="stat-card" style="border-left-color:var(--success)"><div class="stat-value">${totalIn.toFixed(1)}</div><div class="stat-label">Total Inward</div></div>
            <div class="stat-card" style="border-left-color:var(--danger)"><div class="stat-value">${totalOut.toFixed(1)}</div><div class="stat-label">Total Outward</div></div>
            <div class="stat-card" style="border-left-color:var(--info)"><div class="stat-value">${entryCount}</div><div class="stat-label">Total Entries</div></div>
            <div class="stat-card" style="border-left-color:var(--warning)"><div class="stat-value">${uniqueVehicles}</div><div class="stat-label">Vehicles</div></div>
        `;
    }

    let filtered = entries.filter(e =>
        e.materialName.toLowerCase().includes(search) ||
        e.vehicleNo.toLowerCase().includes(search) ||
        (e.supplier || '').toLowerCase().includes(search) ||
        (e.driverName || '').toLowerCase().includes(search)
    );
    if (p2Filter === 'in') filtered = filtered.filter(e => e.direction === 'in');
    else if (p2Filter === 'out') filtered = filtered.filter(e => e.direction === 'out');

    const tbody = document.getElementById('p2TableBody');
    if (!tbody) return;
    tbody.innerHTML = filtered.slice().reverse().map(e => `
        <tr>
            <td>${APP.formatDateTime(e.dateTime || e.createdAt)}</td>
            <td><strong>${e.materialName}</strong></td>
            <td><span class="badge ${e.direction === 'in' ? 'badge-success' : 'badge-danger'}">${e.direction.toUpperCase()}</span></td>
            <td>${e.quantity} ${e.unit || 'pcs'}</td>
            <td>${e.vehicleNo || '-'}</td>
            <td>${e.driverName || '-'} ${e.driverPhone ? '('+e.driverPhone+')' : ''}</td>
            <td>${e.supplier || '-'}</td>
            <td>${e.enteredBy || '-'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewP2Entry('${e.id}')">View</button>
                <button class="btn btn-sm btn-danger" onclick="deleteP2Entry('${e.id}')">Del</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="9" class="empty-state">No entries yet</td></tr>';
}

function showP2Form(direction) {
    const user = AUTH.currentUser();
    const units = ['kg', 'pcs', 'ltr', 'box', 'pack', 'bag', 'ton', 'm', 'sqft', 'load'];
    const form = `
        <form id="p2Form">
            <div class="grid-2">
                <div class="form-group">
                    <label>Material Name *</label>
                    <input type="text" name="materialName" class="form-control" placeholder="e.g. Cement, Steel, Sand" required>
                </div>
                <div class="form-group">
                    <label>Direction</label>
                    <input type="text" class="form-control" value="${direction.toUpperCase()}" readonly>
                    <input type="hidden" name="direction" value="${direction}">
                </div>
                <div class="form-group">
                    <label>Quantity *</label>
                    <input type="number" name="quantity" class="form-control" step="0.01" required>
                </div>
                <div class="form-group">
                    <label>Unit</label>
                    <select name="unit" class="form-control">
                        ${units.map(u => '<option value="' + u + '" ' + (u === 'kg' ? 'selected' : '') + '>' + u + '</option>').join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Vehicle Number *</label>
                    <input type="text" name="vehicleNo" class="form-control" placeholder="e.g. KA-01-1234" required>
                </div>
                <div class="form-group">
                    <label>Driver Name</label>
                    <input type="text" name="driverName" class="form-control">
                </div>
                <div class="form-group">
                    <label>Driver Phone</label>
                    <input type="text" name="driverPhone" class="form-control">
                </div>
                <div class="form-group">
                    <label>Supplier / Vendor</label>
                    <input type="text" name="supplier" class="form-control" placeholder="e.g. ABC Traders">
                </div>
                <div class="form-group">
                    <label>Date & Time</label>
                    <input type="datetime-local" name="dateTime" class="form-control" value="${new Date().toISOString().slice(0,16)}">
                </div>
                <div class="form-group">
                    <label>Entered By</label>
                    <input type="text" name="enteredBy" class="form-control" value="${user.fullName}" readonly style="background:var(--bg);">
                </div>
            </div>
            <div class="form-group">
                <label>Notes / Remarks</label>
                <textarea name="notes" class="form-control" rows="2" placeholder="Any additional details about the material..."></textarea>
            </div>
        </form>
    `;
    openFormModal('Material ' + (direction === 'in' ? 'Inward' : 'Outward'), form, 'saveP2Entry()', true);
}

function saveP2Entry() {
    const data = getFormData('p2Form');
    if (!data.materialName || !data.quantity || !data.vehicleNo) {
        APP.notify('Material name, quantity, and vehicle are required', 'error'); return;
    }
    if (!data.dateTime) data.dateTime = new Date().toISOString();
    DB.add('phase2', data);
    APP.notify('Material entry recorded', 'success');
    renderP2List();
}

function viewP2Entry(id) {
    const e = DB.getById('phase2', id);
    if (!e) return;
    showModal(`
        <div class="modal-header"><h3>Material Entry Details</h3><button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button></div>
        <div class="grid-2">
            <div><strong>Material:</strong> ${e.materialName}</div>
            <div><strong>Direction:</strong> <span class="badge ${e.direction === 'in' ? 'badge-success' : 'badge-danger'}">${e.direction.toUpperCase()}</span></div>
            <div><strong>Quantity:</strong> ${e.quantity} ${e.unit || 'pcs'}</div>
            <div><strong>Vehicle:</strong> ${e.vehicleNo || '-'}</div>
            <div><strong>Driver:</strong> ${e.driverName || '-'} ${e.driverPhone ? '('+e.driverPhone+')' : ''}</div>
            <div><strong>Supplier:</strong> ${e.supplier || '-'}</div>
            <div><strong>Entered By:</strong> ${e.enteredBy || '-'}</div>
            <div><strong>Date/Time:</strong> ${APP.formatDateTime(e.dateTime || e.createdAt)}</div>
        </div>
        <div class="mt-2"><strong>Notes:</strong><br>${e.notes || '-'}</div>
    `);
}

function deleteP2Entry(id) {
    confirmAction('Delete this entry?', () => {
        DB.delete('phase2', id);
        APP.notify('Entry deleted', 'success');
        renderP2List();
    });
}

/* ═══════════════════════════════════════════
   TAB 2: Tasks & Gantt
   ═══════════════════════════════════════════ */

const P2_CATEGORIES = ['structural', 'electrical', 'plumbing', 'finishing', 'road', 'landscaping', 'other'];
const P2_PRIORITIES = ['high', 'medium', 'low'];
const P2_STATUSES = ['not-started', 'in-progress', 'completed', 'delayed'];
const P2_STATUS_COLORS = { 'not-started': '#6c757d', 'in-progress': '#007bff', 'completed': '#28a745', 'delayed': '#dc3545' };

function renderP2TasksTab() {
    const tasks = DB.get('phase2Tasks') || [];
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const delayed = tasks.filter(t => t.status === 'delayed').length;

    return `
        <div class="flex-between mb-4">
            <div>
                <h3 style="margin:0;">📋 Phase 2 Tasks & Gantt</h3>
                <span style="font-size:13px;color:var(--gray);">Plan, track, and visualize project tasks</span>
            </div>
            <div style="display:flex;gap:6px;">
                <button class="btn btn-primary" onclick="showP2TaskForm()">+ New Task</button>
                <button class="btn btn-outline" onclick="switchP2TaskView('list')">📋 List</button>
                <button class="btn btn-outline" onclick="switchP2TaskView('gantt')">📊 Gantt</button>
            </div>
        </div>
        <div class="grid-4 mb-4">
            <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Total Tasks</div></div>
            <div class="stat-card" style="border-left-color:var(--success);"><div class="stat-value">${completed}</div><div class="stat-label">Completed</div></div>
            <div class="stat-card" style="border-left-color:var(--info);"><div class="stat-value">${inProgress}</div><div class="stat-label">In Progress</div></div>
            <div class="stat-card" style="border-left-color:var(--danger);"><div class="stat-value">${delayed}</div><div class="stat-label">Delayed</div></div>
        </div>
        <div id="p2TaskView"></div>
    `;
    // renderP2TaskList() called by setTimeout in switchP2MainTab
}

let p2TaskView = 'list';

function switchP2TaskView(view) {
    p2TaskView = view;
    renderP2TaskList();
}

function renderP2TaskList() {
    const tasks = DB.get('phase2Tasks') || [];
    const view = document.getElementById('p2TaskView');
    if (!view) return;
    if (p2TaskView === 'list') {
        view.innerHTML = renderP2TaskListView(tasks);
    } else {
        view.innerHTML = renderP2GanttView(tasks);
    }
}

/* ─── Task List View ─── */

function renderP2TaskListView(tasks) {
    if (tasks.length === 0) return '<div class="card"><div class="empty-state">No tasks yet. Click "+ New Task" to add one.</div></div>';
    return `
        <div class="card">
            <div class="table-responsive">
                <table>
                    <thead><tr>
                        <th>Task</th><th>Category</th><th>Priority</th><th>Start</th><th>End</th>
                        <th>Progress</th><th>Status</th><th>Assigned To</th><th>Actions</th>
                    </tr></thead>
                    <tbody>${tasks.slice().reverse().map(t => {
                        const overdue = t.status !== 'completed' && t.endDate && APP.daysBetween(new Date().toISOString(), t.endDate) < 0;
                        return `<tr>
                            <td><strong>${t.title}</strong>${t.description ? '<br><span style="font-size:11px;color:var(--gray);">' + t.description + '</span>' : ''}</td>
                            <td><span class="badge badge-info">${t.category || 'other'}</span></td>
                            <td><span class="badge ${t.priority === 'high' ? 'badge-danger' : t.priority === 'medium' ? 'badge-warning' : 'badge-info'}">${t.priority || 'medium'}</span></td>
                            <td style="font-size:12px;">${t.startDate ? APP.formatDate(t.startDate) : '-'}</td>
                            <td style="font-size:12px;">${t.endDate ? APP.formatDate(t.endDate) : '-'}${overdue ? ' ⚠️' : ''}</td>
                            <td>
                                <div class="progress-bar" style="width:80px;display:inline-block;">
                                    <div class="progress-fill ${t.progress === 100 ? 'green' : t.progress > 50 ? 'yellow' : 'red'}" style="width:${t.progress || 0}%"></div>
                                </div>
                                <span style="font-size:11px;margin-left:4px;">${t.progress || 0}%</span>
                            </td>
                            <td><span class="badge" style="background:${P2_STATUS_COLORS[t.status] || '#6c757d'};color:white;">${t.status}</span></td>
                            <td style="font-size:12px;">${t.assignedTo || '-'}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="editP2Task('${t.id}')">Edit</button>
                                <button class="btn btn-sm btn-danger" onclick="deleteP2Task('${t.id}')">Del</button>
                            </td>
                        </tr>`;
                    }).join('')}</tbody>
                </table>
            </div>
        </div>
    `;
}

/* ─── Gantt Chart View ─── */

function renderP2GanttView(tasks) {
    if (tasks.length === 0) return '<div class="card"><div class="empty-state">No tasks to display on Gantt chart.</div></div>';

    const dates = tasks.filter(t => t.startDate && t.endDate);
    if (dates.length === 0) return '<div class="card"><div class="empty-state">Add start/end dates to tasks to see the Gantt chart.</div></div>';

    const today = new Date();
    const minDate = new Date(Math.min(...dates.map(t => new Date(t.startDate).getTime())));
    const maxDate = new Date(Math.max(...dates.map(t => new Date(t.endDate).getTime()), today.getTime()));
    const totalDays = Math.max(APP.daysBetween(minDate.toISOString(), maxDate.toISOString()), 1);
    const weeks = Math.ceil(totalDays / 7);

    // Build header with week columns
    let headerHtml = '<div style="display:flex;border-bottom:2px solid #333;font-size:11px;font-weight:600;">';
    headerHtml += '<div style="width:220px;min-width:220px;padding:6px 8px;">Task</div>';
    for (let w = 0; w < weeks; w++) {
        const weekStart = new Date(minDate);
        weekStart.setDate(weekStart.getDate() + w * 7);
        const label = weekStart.toLocaleDateString('en', { month: 'short', day: 'numeric' });
        headerHtml += `<div style="flex:1;text-align:center;padding:6px 0;border-left:1px solid #ddd;">${label}</div>`;
    }
    headerHtml += '</div>';

    const dayWidth = 100 / totalDays;

    const rowsHtml = dates.map(t => {
        const start = new Date(t.startDate);
        const end = new Date(t.endDate);
        const startOffset = APP.daysBetween(minDate.toISOString(), t.startDate);
        const duration = Math.max(APP.daysBetween(t.startDate, t.endDate), 1);
        const leftPct = (startOffset / totalDays) * 100;
        const widthPct = (duration / totalDays) * 100;
        const color = P2_STATUS_COLORS[t.status] || '#6c757d';
        const barHtml = t.status === 'completed'
            ? `<div style="height:20px;background:${color};border-radius:4px;width:100%;"></div>`
            : `<div style="height:20px;background:${color};border-radius:4px;width:100%;position:relative;overflow:hidden;">
                <div style="position:absolute;top:0;left:0;height:100%;width:${t.progress || 0}%;background:rgba(255,255,255,0.3);"></div>
               </div>`;

        return `<div style="display:flex;align-items:center;border-bottom:1px solid #eee;font-size:13px;">
            <div style="width:220px;min-width:220px;padding:6px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${t.title}">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px;"></span>
                ${t.title}
            </div>
            <div style="flex:1;position:relative;height:32px;padding:6px 0;">
                <div style="position:absolute;left:${leftPct}%;width:${widthPct}%;top:6px;">
                    ${barHtml}
                </div>
            </div>
        </div>`;
    }).join('');

    // Prediction summary
    const prediction = calcP2Prediction(tasks);

    return `
        <div class="card" style="margin-bottom:16px;">
            <div class="flex-between" style="margin-bottom:12px;">
                <div class="card-header" style="border:none;padding:0;"><h3>📊 Gantt Chart</h3></div>
                <div style="display:flex;gap:12px;align-items:center;font-size:12px;">
                    <span><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:#28a745;margin-right:4px;"></span>Completed</span>
                    <span><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:#007bff;margin-right:4px;"></span>In Progress</span>
                    <span><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:#dc3545;margin-right:4px;"></span>Delayed</span>
                    <span><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:#6c757d;margin-right:4px;"></span>Not Started</span>
                </div>
            </div>
            <div style="overflow-x:auto;">
                ${headerHtml}
                ${rowsHtml}
            </div>
        </div>
        <div class="grid-2">
            <div class="card">
                <div class="card-header"><h3>🔮 Completion Prediction</h3></div>
                <div style="font-size:14px;">${prediction.html}</div>
            </div>
            <div class="card">
                <div class="card-header"><h3>⚡ Quick Actions</h3></div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <button class="btn btn-primary" onclick="showP2TaskForm()">+ New Task</button>
                    <button class="btn btn-success" onclick="exportP2Excel()">📥 Download Excel Report</button>
                    <button class="btn btn-info" onclick="switchP2TaskView('list')">📋 Switch to List View</button>
                </div>
            </div>
        </div>
    `;
}

/* ─── Task CRUD ─── */

function showP2TaskForm(task) {
    const users = DB.get('users').filter(u => !u.isSuperAdmin);
    const tasks = DB.get('phase2Tasks') || [];
    const isEdit = !!task;
    const form = `
        <form id="p2TaskForm">
            <input type="hidden" name="id" value="${task?.id || ''}">
            <div class="grid-2">
                <div class="form-group">
                    <label>Task Title *</label>
                    <input type="text" name="title" class="form-control" value="${task?.title || ''}" required placeholder="e.g. Foundation pouring">
                </div>
                <div class="form-group">
                    <label>Category</label>
                    <select name="category" class="form-control">
                        ${P2_CATEGORIES.map(c => '<option value="' + c + '" ' + (task?.category === c ? 'selected' : '') + '>' + c + '</option>').join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Priority</label>
                    <select name="priority" class="form-control">
                        ${P2_PRIORITIES.map(p => '<option value="' + p + '" ' + (task?.priority === p ? 'selected' : '') + '>' + p + '</option>').join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select name="status" class="form-control">
                        ${P2_STATUSES.map(s => '<option value="' + s + '" ' + (task?.status === s ? 'selected' : '') + '>' + s + '</option>').join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Start Date *</label>
                    <input type="date" name="startDate" class="form-control" value="${task?.startDate || ''}" required>
                </div>
                <div class="form-group">
                    <label>End Date *</label>
                    <input type="date" name="endDate" class="form-control" value="${task?.endDate || ''}" required>
                </div>
                <div class="form-group">
                    <label>Progress %</label>
                    <input type="number" name="progress" class="form-control" min="0" max="100" value="${task?.progress || 0}">
                </div>
                <div class="form-group">
                    <label>Assigned To</label>
                    <select name="assignedTo" class="form-control">
                        <option value="">Unassigned</option>
                        ${users.map(u => '<option value="' + u.fullName + '" ' + (task?.assignedTo === u.fullName ? 'selected' : '') + '>' + u.fullName + '</option>').join('')}
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Dependencies</label>
                <select name="dependencies" class="form-control" multiple style="height:80px;">
                    ${tasks.filter(t => t.id !== task?.id).map(t => '<option value="' + t.id + '" ' + ((task?.dependencies || []).includes(t.id) ? 'selected' : '') + '>' + t.title + '</option>').join('')}
                </select>
                <span style="font-size:11px;color:var(--gray);">Hold Ctrl/Cmd to select multiple</span>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea name="description" class="form-control" rows="2">${task?.description || ''}</textarea>
            </div>
        </form>
    `;
    openFormModal(isEdit ? 'Edit Task' : 'New Task', form, 'saveP2Task()', true);
}

function saveP2Task() {
    const form = document.getElementById('p2TaskForm');
    const id = form.querySelector('[name="id"]')?.value;
    const data = getFormData('p2TaskForm');
    if (!data.title || !data.startDate || !data.endDate) {
        APP.notify('Title, start date, and end date are required', 'error'); return;
    }
    data.progress = parseInt(data.progress) || 0;
    // Handle multi-select for dependencies
    const depsSelect = form.querySelector('[name="dependencies"]');
    data.dependencies = depsSelect ? Array.from(depsSelect.selectedOptions).map(o => o.value) : [];
    delete data.id;

    if (data.progress >= 100) data.status = 'completed';
    if (id) {
        DB.update('phase2Tasks', id, data);
        APP.notify('Task updated', 'success');
    } else {
        DB.add('phase2Tasks', data);
        APP.notify('Task created', 'success');
    }
    renderP2TaskList();
}

function editP2Task(id) {
    const task = DB.getById('phase2Tasks', id);
    if (task) showP2TaskForm(task);
}

function deleteP2Task(id) {
    confirmAction('Delete this task?', () => {
        DB.delete('phase2Tasks', id);
        APP.notify('Task deleted', 'success');
        renderP2TaskList();
    });
}

/* ─── Completion Prediction ─── */

function calcP2Prediction(tasks) {
    const total = tasks.length;
    if (total === 0) return { html: '<div class="empty-state">No tasks to predict from.</div>' };

    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress');
    const notStarted = tasks.filter(t => t.status === 'not-started');
    const delayed = tasks.filter(t => t.status === 'delayed');

    // Weighted progress: completed=100%, in-progress=half their progress, delayed=same as in-progress but flagged
    let weightedProgress = 0;
    tasks.forEach(t => {
        if (t.status === 'completed') weightedProgress += 100;
        else if (t.status === 'in-progress' || t.status === 'delayed') weightedProgress += (t.progress || 0);
        // not-started contributes 0
    });
    const overallPct = total > 0 ? Math.round(weightedProgress / total) : 0;

    // Dates
    const datedTasks = tasks.filter(t => t.startDate && t.endDate);
    let minStart = null, maxEnd = null;
    datedTasks.forEach(t => {
        const s = new Date(t.startDate);
        const e = new Date(t.endDate);
        if (!minStart || s < minStart) minStart = s;
        if (!maxEnd || e > maxEnd) maxEnd = e;
    });

    let predictedCompletion = 'N/A';
    let velocityHtml = '';
    let riskHtml = '';

    if (minStart && maxEnd) {
        const today = new Date();
        const plannedDuration = APP.daysBetween(minStart.toISOString(), maxEnd.toISOString());
        const elapsed = Math.max(APP.daysBetween(minStart.toISOString(), today.toISOString()), 0);
        const remainingDays = plannedDuration - elapsed;

        if (overallPct > 0 && elapsed > 0) {
            // Rate of completion: % per day
            const ratePerDay = overallPct / elapsed;
            const remainingPct = 100 - overallPct;
            const estDaysLeft = ratePerDay > 0 ? Math.round(remainingPct / ratePerDay) : remainingDays;
            const estCompletion = new Date(today);
            estCompletion.setDate(estCompletion.getDate() + estDaysLeft);
            predictedCompletion = estCompletion.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });

            const originalEnd = maxEnd.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
            const isBehind = estCompletion > maxEnd;
            velocityHtml = `<p style="margin:4px 0;"><strong>Planned End:</strong> ${originalEnd}</p>
                <p style="margin:4px 0;"><strong>Predicted Completion:</strong> <span style="color:${isBehind ? 'var(--danger)' : 'var(--success)'};font-weight:600;">${predictedCompletion}</span></p>
                <p style="margin:4px 0;"><strong>Velocity:</strong> ${ratePerDay.toFixed(1)}% / day</p>`;
        } else if (overallPct === 0 && elapsed > 0) {
            velocityHtml = `<p style="margin:4px 0;color:var(--danger);"><strong>⚠️ No progress yet after ${elapsed} day(s)</strong></p>`;
        } else {
            velocityHtml = `<p style="margin:4px 0;color:var(--gray);"><strong>Not enough data to predict.</strong> Start tracking progress.</p>`;
        }

        // Risk assessment
        const delayCount = delayed.length;
        const atRisk = inProgress.filter(t => {
            if (!t.endDate) return false;
            return APP.daysBetween(new Date().toISOString(), t.endDate) < 0;
        }).length;
        if (delayCount > 0 || atRisk > 0) {
            riskHtml = `<p style="margin:4px 0;color:var(--danger);"><strong>⚠️ Risks:</strong> ${delayCount} delayed, ${atRisk} at-risk tasks</p>`;
        } else if (overallPct > 50) {
            riskHtml = `<p style="margin:4px 0;color:var(--success);"><strong>✅ On track</strong></p>`;
        } else {
            riskHtml = `<p style="margin:4px 0;color:var(--warning);"><strong>📊 Monitor progress</strong></p>`;
        }
    }

    const barColor = overallPct > 70 ? 'green' : overallPct > 40 ? 'yellow' : 'red';

    return {
        pct: overallPct,
        html: `
            <div style="margin-bottom:8px;">
                <div class="flex-between"><span style="font-size:13px;">Overall Progress</span><span style="font-size:13px;font-weight:600;">${overallPct}%</span></div>
                <div class="progress-bar"><div class="progress-fill ${barColor}" style="width:${overallPct}%"></div></div>
            </div>
            <div style="font-size:13px;">
                <p style="margin:4px 0;"><strong>Tasks:</strong> ${completed}/${total} completed</p>
                ${velocityHtml}
                ${riskHtml}
            </div>
        `
    };
}

/* ═══════════════════════════════════════════
   TAB 3: Reports & Excel
   ═══════════════════════════════════════════ */

function renderP2ReportsTab() {
    return `
        <div class="flex-between mb-4">
            <div>
                <h3 style="margin:0;">📊 Reports & Excel Export</h3>
                <span style="font-size:13px;color:var(--gray);">Generate and download Phase 2 reports</span>
            </div>
            <div style="display:flex;gap:6px;">
                <button class="btn btn-success" onclick="exportP2Excel()">📥 Download Excel Report</button>
                <button class="btn btn-primary" onclick="exportP2TasksCSV()">📄 Download Tasks CSV</button>
            </div>
        </div>
        <div id="p2ReportContent">
            <div style="text-align:center;padding:20px;"><div class="spinner"></div></div>
        </div>
    `;
}

function renderP2ReportData() {
    const el = document.getElementById('p2ReportContent');
    if (!el) return;

    const tasks = DB.get('phase2Tasks') || [];
    const materials = DB.get('phase2') || [];
    const prediction = calcP2Prediction(tasks);
    const totalMaterialIn = materials.filter(m => m.direction === 'in').reduce((s, m) => s + (parseFloat(m.quantity) || 0), 0);
    const totalMaterialOut = materials.filter(m => m.direction === 'out').reduce((s, m) => s + (parseFloat(m.quantity) || 0), 0);

    el.innerHTML = `
        <div class="grid-2">
            <div class="card">
                <div class="card-header"><h3>🏗️ Project Overview</h3></div>
                <table class="info-table">
                    <tr><td><strong>Total Tasks</strong></td><td>${tasks.length}</td></tr>
                    <tr><td><strong>Completed</strong></td><td>${tasks.filter(t => t.status === 'completed').length}</td></tr>
                    <tr><td><strong>In Progress</strong></td><td>${tasks.filter(t => t.status === 'in-progress').length}</td></tr>
                    <tr><td><strong>Not Started</strong></td><td>${tasks.filter(t => t.status === 'not-started').length}</td></tr>
                    <tr><td><strong>Delayed</strong></td><td>${tasks.filter(t => t.status === 'delayed').length}</td></tr>
                    <tr><td><strong>Overall Progress</strong></td><td>${prediction.pct || 0}%</td></tr>
                </table>
            </div>
            <div class="card">
                <div class="card-header"><h3>📦 Material Summary</h3></div>
                <table class="info-table">
                    <tr><td><strong>Total Entries</strong></td><td>${materials.length}</td></tr>
                    <tr><td><strong>Total Inward</strong></td><td>${totalMaterialIn.toFixed(1)} units</td></tr>
                    <tr><td><strong>Total Outward</strong></td><td>${totalMaterialOut.toFixed(1)} units</td></tr>
                    <tr><td><strong>Unique Vehicles</strong></td><td>${new Set(materials.map(m => m.vehicleNo).filter(Boolean)).size}</td></tr>
                    <tr><td><strong>Top Supplier</strong></td><td>${getTopItem(materials, 'supplier') || 'N/A'}</td></tr>
                    <tr><td><strong>Top Material</strong></td><td>${getTopItem(materials, 'materialName') || 'N/A'}</td></tr>
                </table>
            </div>
        </div>

        <div class="card" style="margin-top:16px;">
            <div class="card-header"><h3>🔮 Completion Prediction</h3></div>
            ${prediction.html}
        </div>

        <div class="card" style="margin-top:16px;">
            <div class="card-header"><h3>📋 All Tasks</h3></div>
            <div class="table-responsive">
                <table>
                    <thead><tr><th>Task</th><th>Category</th><th>Status</th><th>Progress</th><th>Start</th><th>End</th><th>Assigned</th></tr></thead>
                    <tbody>${tasks.length === 0 ? '<tr><td colspan="7" class="empty-state">No tasks</td></tr>' :
                        tasks.map(t => `<tr>
                            <td>${t.title}</td>
                            <td>${t.category || 'other'}</td>
                            <td><span class="badge" style="background:${P2_STATUS_COLORS[t.status]};color:white;">${t.status}</span></td>
                            <td>${t.progress || 0}%</td>
                            <td>${t.startDate ? APP.formatDate(t.startDate) : '-'}</td>
                            <td>${t.endDate ? APP.formatDate(t.endDate) : '-'}</td>
                            <td>${t.assignedTo || '-'}</td>
                        </tr>`).join('')}</tbody>
                </table>
            </div>
        </div>

        <div class="card" style="margin-top:16px;">
            <div class="card-header"><h3>📦 Recent Material Entries</h3></div>
            <div class="table-responsive">
                <table>
                    <thead><tr><th>Date</th><th>Material</th><th>Direction</th><th>Qty</th><th>Vehicle</th><th>Supplier</th></tr></thead>
                    <tbody>${materials.length === 0 ? '<tr><td colspan="6" class="empty-state">No entries</td></tr>' :
                        materials.slice(-10).reverse().map(m => `<tr>
                            <td>${APP.formatDateTime(m.dateTime || m.createdAt)}</td>
                            <td>${m.materialName}</td>
                            <td><span class="badge ${m.direction === 'in' ? 'badge-success' : 'badge-danger'}">${m.direction.toUpperCase()}</span></td>
                            <td>${m.quantity} ${m.unit || 'pcs'}</td>
                            <td>${m.vehicleNo || '-'}</td>
                            <td>${m.supplier || '-'}</td>
                        </tr>`).join('')}</tbody>
                </table>
            </div>
        </div>
    `;
}

function getTopItem(arr, field) {
    const counts = {};
    arr.forEach(item => {
        const val = item[field];
        if (val) counts[val] = (counts[val] || 0) + 1;
    });
    const entries = Object.entries(counts);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
}

/* ═══════════════════════════════════════════
   Excel / CSV Export
   ═══════════════════════════════════════════ */

function exportP2Excel() {
    const tasks = DB.get('phase2Tasks') || [];
    const materials = DB.get('phase2') || [];
    const prediction = calcP2Prediction(tasks);

    const totalMaterialIn = materials.filter(m => m.direction === 'in').reduce((s, m) => s + (parseFloat(m.quantity) || 0), 0);
    const totalMaterialOut = materials.filter(m => m.direction === 'out').reduce((s, m) => s + (parseFloat(m.quantity) || 0), 0);

    let html = `<html><head><meta charset="UTF-8"><style>
        table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        th { background: #4472C4; color: white; font-weight: bold; }
        .section-title { font-size: 16px; font-weight: bold; margin: 20px 0 10px 0; color: #333; }
        .sub-title { font-size: 13px; color: #666; margin: 4px 0 12px 0; }
    </style></head><body>
    <h2>Phase 2 Infra & Development Report</h2>
    <p>Generated: ${new Date().toLocaleString()}</p>
    <hr>`;

    // Overview
    html += `<div class="section-title">Project Overview</div>
    <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Total Tasks</td><td>${tasks.length}</td></tr>
        <tr><td>Completed</td><td>${tasks.filter(t => t.status === 'completed').length}</td></tr>
        <tr><td>In Progress</td><td>${tasks.filter(t => t.status === 'in-progress').length}</td></tr>
        <tr><td>Not Started</td><td>${tasks.filter(t => t.status === 'not-started').length}</td></tr>
        <tr><td>Delayed</td><td>${tasks.filter(t => t.status === 'delayed').length}</td></tr>
        <tr><td>Overall Progress</td><td>${prediction.pct || 0}%</td></tr>
        <tr><td>Predicted Completion</td><td>${prediction.html ? 'See report' : 'N/A'}</td></tr>
    </table>`;

    // Material Summary
    html += `<div class="section-title">Material Summary</div>
    <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Total Entries</td><td>${materials.length}</td></tr>
        <tr><td>Total Inward</td><td>${totalMaterialIn.toFixed(1)} units</td></tr>
        <tr><td>Total Outward</td><td>${totalMaterialOut.toFixed(1)} units</td></tr>
        <tr><td>Unique Vehicles</td><td>${new Set(materials.map(m => m.vehicleNo).filter(Boolean)).size}</td></tr>
    </table>`;

    // Tasks table
    html += `<div class="section-title">Task Details</div>
    <table>
        <tr><th>Task</th><th>Category</th><th>Priority</th><th>Status</th><th>Progress</th><th>Start Date</th><th>End Date</th><th>Assigned To</th></tr>`;
    if (tasks.length === 0) {
        html += '<tr><td colspan="8">No tasks</td></tr>';
    } else {
        tasks.forEach(t => {
            html += `<tr>
                <td>${t.title || ''}</td>
                <td>${t.category || 'other'}</td>
                <td>${t.priority || 'medium'}</td>
                <td>${t.status || 'not-started'}</td>
                <td>${t.progress || 0}%</td>
                <td>${t.startDate || '-'}</td>
                <td>${t.endDate || '-'}</td>
                <td>${t.assignedTo || '-'}</td>
            </tr>`;
        });
    }
    html += `</table>`;

    // Materials table
    html += `<div class="section-title">Material Entries</div>
    <table>
        <tr><th>Date</th><th>Material</th><th>Direction</th><th>Qty</th><th>Unit</th><th>Vehicle</th><th>Driver</th><th>Supplier</th><th>Entered By</th></tr>`;
    if (materials.length === 0) {
        html += '<tr><td colspan="9">No entries</td></tr>';
    } else {
        materials.slice().reverse().forEach(m => {
            html += `<tr>
                <td>${APP.formatDateTime(m.dateTime || m.createdAt)}</td>
                <td>${m.materialName || ''}</td>
                <td>${(m.direction || '').toUpperCase()}</td>
                <td>${m.quantity || 0}</td>
                <td>${m.unit || 'pcs'}</td>
                <td>${m.vehicleNo || '-'}</td>
                <td>${m.driverName || '-'}</td>
                <td>${m.supplier || '-'}</td>
                <td>${m.enteredBy || '-'}</td>
            </tr>`;
        });
    }
    html += `</table>`;

    html += `</body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Phase2_Report_' + new Date().toISOString().slice(0, 10) + '.xls';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    APP.notify('Excel report downloaded', 'success');
}

function exportP2TasksCSV() {
    const tasks = DB.get('phase2Tasks') || [];
    let csv = 'Title,Category,Priority,Status,Progress,Start Date,End Date,Assigned To,Dependencies\n';
    tasks.forEach(t => {
        const deps = (t.dependencies || []).map(d => {
            const dep = tasks.find(x => x.id === d);
            return dep ? dep.title : d;
        }).join('; ');
        csv += `"${t.title || ''}","${t.category || 'other'}","${t.priority || 'medium'}","${t.status || 'not-started'}",${t.progress || 0},"${t.startDate || ''}","${t.endDate || ''}","${t.assignedTo || ''}","${deps}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Phase2_Tasks_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    APP.notify('CSV downloaded', 'success');
}
