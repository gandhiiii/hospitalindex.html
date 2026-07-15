function renderProjects(container) {
    container.innerHTML = `
        <div class="flex-between mb-4">
            <div class="search-box">
                <input type="text" class="form-control" id="projSearch" placeholder="Search projects..." oninput="renderProjList()">
            </div>
            <button class="btn btn-primary" onclick="showProjForm()">+ New Project</button>
        </div>

        <div id="projStats" class="grid-4 mb-4"></div>

        <div class="card">
            <div class="table-responsive">
                <table>
                    <thead><tr>
                        <th>Project Name</th><th>Category</th><th>Budget</th><th>Spent</th>
                        <th>Start Date</th><th>End Date</th><th>Status</th><th>Progress</th><th>Actions</th>
                    </tr></thead>
                    <tbody id="projTableBody"></tbody>
                </table>
            </div>
        </div>
    `;
    renderProjList();
}

function renderProjList() {
    const projects = DB.get('projects');
    const search = (document.getElementById('projSearch')?.value || '').toLowerCase();
    const filtered = projects.filter(p => p.name.toLowerCase().includes(search) || p.category.toLowerCase().includes(search));

    const total = projects.length;
    const active = projects.filter(p => p.status === 'in-progress').length;
    const completed = projects.filter(p => p.status === 'completed').length;
    const totalBudget = projects.reduce((sum, p) => sum + (parseFloat(p.budget) || 0), 0);

    const statsEl = document.getElementById('projStats');
    if (statsEl) {
        statsEl.innerHTML = `
            <div class="stat-card" style="border-left-color:var(--primary)"><div class="stat-value">${total}</div><div class="stat-label">Total Projects</div></div>
            <div class="stat-card" style="border-left-color:var(--info)"><div class="stat-value">${active}</div><div class="stat-label">In Progress</div></div>
            <div class="stat-card" style="border-left-color:var(--success)"><div class="stat-value">${completed}</div><div class="stat-label">Completed</div></div>
            <div class="stat-card" style="border-left-color:var(--warning)"><div class="stat-value">₹${totalBudget.toLocaleString()}</div><div class="stat-label">Total Budget</div></div>
        `;
    }

    const tbody = document.getElementById('projTableBody');
    if (!tbody) return;
    tbody.innerHTML = filtered.map(p => {
        const budget = parseFloat(p.budget) || 0;
        const spent = parseFloat(p.spent) || 0;
        const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
        return `<tr>
            <td><strong>${p.name}</strong></td>
            <td>${p.category || '-'}</td>
            <td>₹${budget.toLocaleString()}</td>
            <td>₹${spent.toLocaleString()}</td>
            <td>${APP.formatDate(p.startDate)}</td>
            <td>${APP.formatDate(p.endDate)}</td>
            <td><span class="badge ${APP.getStatusBadge(p.status)}">${p.status}</span></td>
            <td>
                <div class="progress-bar">
                    <div class="progress-fill ${pct > 80 ? 'green' : pct > 50 ? 'yellow' : 'red'}" style="width:${Math.min(100, pct)}%"></div>
                </div>
                <div class="progress-label">${pct}% spent (₹${spent.toLocaleString()})</div>
            </td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editProj('${p.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteProj('${p.id}')">Del</button>
            </td>
        </tr>`;
    }).join('') || '<tr><td colspan="9" class="empty-state">No projects yet</td></tr>';
}

function showProjForm(proj) {
    const form = `
        <form id="projForm">
            <input type="hidden" name="id" value="${proj?.id || ''}">
            <div class="grid-2">
                <div class="form-group">
                    <label>Project Name *</label>
                    <input type="text" name="name" class="form-control" value="${proj?.name || ''}" required>
                </div>
                <div class="form-group">
                    <label>Category</label>
                    <select name="category" class="form-control">
                        <option value="Infrastructure" ${proj?.category === 'Infrastructure' ? 'selected' : ''}>Infrastructure</option>
                        <option value="Medical Equipment" ${proj?.category === 'Medical Equipment' ? 'selected' : ''}>Medical Equipment</option>
                        <option value="IT Systems" ${proj?.category === 'IT Systems' ? 'selected' : ''}>IT Systems</option>
                        <option value="Renovation" ${proj?.category === 'Renovation' ? 'selected' : ''}>Renovation</option>
                        <option value="Expansion" ${proj?.category === 'Expansion' ? 'selected' : ''}>Expansion</option>
                        <option value="Other" ${proj?.category === 'Other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Budget (₹) *</label>
                    <input type="number" name="budget" class="form-control" value="${proj?.budget || 0}" required>
                </div>
                <div class="form-group">
                    <label>Amount Spent (₹)</label>
                    <input type="number" name="spent" class="form-control" value="${proj?.spent || 0}">
                </div>
                <div class="form-group">
                    <label>Start Date *</label>
                    <input type="date" name="startDate" class="form-control" value="${proj?.startDate ? proj.startDate.split('T')[0] : ''}" required>
                </div>
                <div class="form-group">
                    <label>Expected End Date *</label>
                    <input type="date" name="endDate" class="form-control" value="${proj?.endDate ? proj.endDate.split('T')[0] : ''}" required>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select name="status" class="form-control">
                        <option value="planning" ${proj?.status === 'planning' ? 'selected' : ''}>Planning</option>
                        <option value="in-progress" ${proj?.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                        <option value="completed" ${proj?.status === 'completed' ? 'selected' : ''}>Completed</option>
                        <option value="on-hold" ${proj?.status === 'on-hold' ? 'selected' : ''}>On Hold</option>
                        <option value="cancelled" ${proj?.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Assigned To</label>
                    <input type="text" name="assignedTo" class="form-control" value="${proj?.assignedTo || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>Description / Plan Details</label>
                <textarea name="description" class="form-control" rows="3">${proj?.description || ''}</textarea>
            </div>
        </form>
    `;
    openFormModal(proj ? 'Edit Project' : 'New Project', form, `saveProj()`);
}

function saveProj() {
    const data = getFormData('projForm');
    if (!data.name || !data.budget || !data.startDate || !data.endDate) {
        APP.notify('Please fill required fields', 'error'); return;
    }
    if (data.id) {
        DB.update('projects', data.id, data);
        APP.notify('Project updated', 'success');
    } else {
        DB.add('projects', data);
        APP.notify('Project created', 'success');
    }
    renderProjList();
}

function editProj(id) {
    const proj = DB.getById('projects', id);
    if (proj) showProjForm(proj);
}

function deleteProj(id) {
    confirmAction('Delete this project?', () => {
        DB.delete('projects', id);
        APP.notify('Project deleted', 'success');
        renderProjList();
    });
}
