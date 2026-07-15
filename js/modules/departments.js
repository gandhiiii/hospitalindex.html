const ALL_FEATURES = [
    'dashboard', 'users', 'departments', 'inventory', 'gate-security',
    'projects', 'ambulance', 'problems', 'tasks', 'complaints',
    'room-checklist', 'admissions', 'lost-found', 'checklists', 'admin-checklists'
];

function renderDepartments(container) {
    container.innerHTML = `
        <div class="flex-between mb-4">
            <div class="search-box">
                <input type="text" class="form-control" id="deptSearch" placeholder="Search departments..." oninput="renderDeptList()">
            </div>
            <button class="btn btn-primary" id="addDeptBtn">+ Add Department</button>
        </div>
        <div class="card">
            <div class="table-responsive">
                <table>
                    <thead><tr><th>Code</th><th>Name</th><th>Head</th><th>Feature Rights</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody id="deptTableBody"></tbody>
                </table>
            </div>
        </div>
    `;
    document.getElementById('addDeptBtn').onclick = () => showDeptForm();
    container.onclick = function(e) {
        const btn = e.target.closest('button[data-action]');
        if (!btn || btn.disabled) return;
        const tr = btn.closest('tr[data-dept-id]');
        if (!tr) return;
        const id = tr.dataset.deptId;
        const action = btn.dataset.action;
        if (action === 'edit') editDept(id);
        else if (action === 'toggle') toggleDept(id);
        else if (action === 'delete') deleteDept(id);
    };
    renderDeptList();
}

function renderDeptList() {
    let depts = DB.get('departments');
    let changed = false;
    const valid = depts.filter(d => d && d.name);
    if (valid.length !== depts.length) { depts = valid; changed = true; }
    depts.forEach((d, i) => {
        if (!d.id) { d.id = 'dept_' + (100 + i); changed = true; }
        if (!d.code) { d.code = (d.name || '').toUpperCase().replace(/\s+/g, '_').substring(0, 20); changed = true; }
    });
    if (changed) DB.set('departments', depts);
    const search = (document.getElementById('deptSearch')?.value || '').toLowerCase();
    const filtered = depts.filter(d => (d.name || '').toLowerCase().includes(search) || (d.code || '').toLowerCase().includes(search));
    const tbody = document.getElementById('deptTableBody');
    if (!tbody) return;
    tbody.innerHTML = filtered.map(d => {
        const features = d.features || [];
        const count = features.length;
        const allEnabled = count === ALL_FEATURES.length;
        return `<tr data-dept-id="${d.id}">
            <td><strong>${d.code}</strong></td>
            <td>${d.name}</td>
            <td>${d.head || '-'}</td>
            <td>
                <span class="badge ${allEnabled ? 'badge-success' : count > 0 ? 'badge-info' : 'badge-danger'}">${count}/${ALL_FEATURES.length}</span>
                ${count > 0 ? `<span style="font-size:11px;color:var(--gray);display:block;">${features.map(f => f.replace('-',' ')).join(', ')}</span>` : ''}
            </td>
            <td><span class="badge ${d.active ? 'badge-success' : 'badge-danger'}">${d.active ? 'Active' : 'Inactive'}</span></td>
            <td class="dept-actions">
                <button class="btn btn-sm btn-primary" data-action="edit">Edit</button>
                <button class="btn btn-sm ${d.active ? 'btn-warning' : 'btn-success'}" data-action="toggle">${d.active ? 'Deactivate' : 'Activate'}</button>
                <button class="btn btn-sm btn-danger" data-action="delete" ${d.system ? 'disabled title="Pre-generated department cannot be deleted"' : ''}>Delete</button>
            </td>
        </tr>`;
    }).join('') || '<tr><td colspan="6" class="empty-state">No departments</td></tr>';
}

function showDeptForm(dept) {
    const features = dept?.features || [];
    const allChecked = features.length === ALL_FEATURES.length;
    const form = `
        <form id="deptForm">
            <input type="hidden" name="id" value="${dept?.id || ''}">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="form-group">
                    <label>Department Name *</label>
                    <input type="text" name="name" class="form-control" value="${dept?.name || ''}" required>
                </div>
                <div class="form-group">
                    <label>Department Code *</label>
                    <input type="text" name="code" class="form-control" value="${dept?.code || ''}" required>
                </div>
                <div class="form-group">
                    <label>Head of Department</label>
                    <input type="text" name="head" class="form-control" value="${dept?.head || ''}">
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select name="active" class="form-control">
                        <option value="true" ${dept?.active !== false ? 'selected' : ''}>Active</option>
                        <option value="false" ${dept?.active === false ? 'selected' : ''}>Inactive</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea name="description" class="form-control" rows="2">${dept?.description || ''}</textarea>
            </div>

            <div style="border:2px solid var(--primary);border-radius:var(--radius-lg);padding:16px;background:#f0f6ff;margin-top:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <label style="font-size:15px;font-weight:700;color:var(--primary-dark);">🔐 Feature Rights (Module Access)</label>
                    <label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;">
                        <input type="checkbox" onchange="document.querySelectorAll('[name=features]').forEach(c=>c.checked=this.checked)" ${allChecked ? 'checked' : ''}>
                        Select All
                    </label>
                </div>
                <p style="font-size:12px;color:var(--gray);margin-bottom:10px;">
                    Users assigned to this department will <strong>inherit</strong> these module rights. Check which modules this department can use.
                </p>
                <div class="permission-grid" id="deptFeaturesGrid">
                    ${ALL_FEATURES.map(f => `
                        <label class="permission-item" style="background:white;border:1px solid #d0d7e0;">
                            <input type="checkbox" name="features" value="${f}" ${features.includes(f) ? 'checked' : ''}>
                            <span>${f.replace('-', ' ')}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        </form>
    `;
    openFormModal(dept ? 'Edit Department' : 'Add Department', form, `saveDept()`, true);
}

function saveDept() {
    const form = document.getElementById('deptForm');
    const data = {};
    form.querySelectorAll('[name]').forEach(el => {
        if (el.name !== 'features') data[el.name] = el.value;
    });
    data.features = Array.from(form.querySelectorAll('[name="features"]:checked')).map(cb => cb.value);
    data.active = data.active === 'true';

    if (!data.name || !data.code) { APP.notify('Name and Code are required', 'error'); return; }

    if (data.id) {
        DB.update('departments', data.id, data);
        APP.notify('Department updated with ' + data.features.length + ' feature rights', 'success');
    } else {
        DB.add('departments', data);
        APP.notify('Department added with ' + data.features.length + ' feature rights', 'success');
    }
    renderDeptList();
}

function editDept(id) {
    let dept = DB.getById('departments', id);
    if (!dept) {
        const all = DB.get('departments');
        APP.notify('Department not found. Searched ID: "' + id + '", Available: ' + JSON.stringify(all.map(d => ({ id: d.id, name: d.name }))), 'error');
        return;
    }
    showDeptForm(dept);
}

function toggleDept(id) {
    const dept = DB.getById('departments', id);
    if (dept) {
        DB.update('departments', id, { active: !dept.active });
        renderDeptList();
    }
}

function deleteDept(id) {
    const dept = DB.getById('departments', id);
    if (!dept) return;
    if (dept.system) { APP.notify('Pre-generated departments cannot be deleted', 'error'); return; }
    const users = DB.get('users').filter(u => u.department === dept.name);
    const items = DB.get('inventory').filter(i => i.department === dept.name);
    let msg = `Delete department "${dept.name}"?`;
    if (users.length > 0) msg += `\n⚠️ ${users.length} user(s) assigned to this dept will be unlinked.`;
    if (items.length > 0) msg += `\n⚠️ ${items.length} inventory item(s) linked to this dept.`;
    confirmAction(msg, () => {
        users.forEach(u => DB.update('users', u.id, { department: '' }));
        DB.delete('departments', id);
        APP.notify(`Department "${dept.name}" deleted`, 'success');
        renderDeptList();
    });
}

function getDepartmentFeatures(deptName) {
    const depts = DB.get('departments');
    const dept = depts.find(d => d.name === deptName);
    return dept?.features || [];
}
