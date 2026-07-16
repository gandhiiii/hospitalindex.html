var _empClFilter = 'daily';

function renderEmployeeDashboard(container) {
    var user = AUTH.currentUser();
    if (!user) { container.innerHTML = '<div class="empty-state">Not logged in</div>'; return; }
    var dept = user.department || 'Maintenance';

    var tasks = DB.get('tasks') || [];
    var problems = DB.get('problems') || [];
    var requests = DB.get('material_requests') || [];
    var checklists = DB.get('checklists') || [];
    var inventory = DB.get('inventory') || [];
    var projects = DB.get('projects') || [];
    var reports = DB.get('reports') || [];

    var u = user.fullName || user.username;
    var myTasks = tasks.filter(function(t) { return t.assignedTo === u || t.assignedTo === user.username; });
    var myProblems = problems.filter(function(p) { return p.createdBy === user.username; });
    var myRequests = requests.filter(function(r) { return r.createdBy === user.username; });
    var myChecklists = checklists.filter(function(cl) { return cl.assignedTo === u || cl.assignedTo === user.username || cl.assignedTo === 'common'; });
    var myProjects = projects.filter(function(p) { return p.assignedTo === u || p.assignedTo === user.username; });
    var deptInventory = inventory.filter(function(i) { return i.department === dept; });

    var tasksPending = myTasks.filter(function(t) { return t.status !== 'completed'; }).length;
    var tasksDone = myTasks.filter(function(t) { return t.status === 'completed'; }).length;
    var problemsOpen = myProblems.filter(function(p) { return p.status !== 'resolved'; }).length;
    var problemsSolved = myProblems.filter(function(p) { return p.status === 'resolved'; }).length;
    var requestsPending = myRequests.filter(function(r) { return r.status === 'pending'; }).length;
    var requestsApproved = myRequests.filter(function(r) { return r.status === 'approved'; }).length;
    var checklistsPending = myChecklists.filter(function(cl) { return cl.status !== 'completed'; }).length;
    var checklistsDone = myChecklists.filter(function(cl) { return cl.status === 'completed'; }).length;
    var taskRate = myTasks.length > 0 ? Math.round((tasksDone / myTasks.length) * 100) : 0;
    var probRate = myProblems.length > 0 ? Math.round((problemsSolved / myProblems.length) * 100) : 0;

    container.innerHTML = ''
        + '<div class="flex-between mb-3" style="align-items:center;">'
        + '<h3 style="font-size:20px;font-weight:600;">Welcome, ' + user.fullName + '</h3>'
        + '<span class="badge badge-info">' + dept + '</span></div>'

        + '<div class="grid-5 mb-4" style="gap:10px;">'
        + '<div class="stat-card"><div style="font-size:24px;font-weight:700;color:var(--warning);">' + tasksPending + '</div><div style="font-size:11px;color:var(--gray);">Pending Tasks</div></div>'
        + '<div class="stat-card"><div style="font-size:24px;font-weight:700;color:var(--success);">' + tasksDone + '</div><div style="font-size:11px;color:var(--gray);">Tasks Done</div></div>'
        + '<div class="stat-card"><div style="font-size:24px;font-weight:700;color:var(--danger);">' + problemsOpen + '</div><div style="font-size:11px;color:var(--gray);">Open Problems</div></div>'
        + '<div class="stat-card"><div style="font-size:24px;font-weight:700;color:var(--success);">' + problemsSolved + '</div><div style="font-size:11px;color:var(--gray);">Problems Solved</div></div>'
        + '<div class="stat-card"><div style="font-size:24px;font-weight:700;color:var(--warning);">' + requestsPending + '</div><div style="font-size:11px;color:var(--gray);">Pending Requests</div></div>'
        + '</div>'

        + '<div class="grid-4 mb-4" style="gap:10px;">'
        + '<div class="stat-card"><div style="font-size:24px;font-weight:700;color:var(--info);">' + checklistsPending + '</div><div style="font-size:11px;color:var(--gray);">Checklists Due</div></div>'
        + '<div class="stat-card"><div style="font-size:24px;font-weight:700;color:var(--success);">' + checklistsDone + '</div><div style="font-size:11px;color:var(--gray);">Checklists Done</div></div>'
        + '<div class="stat-card"><div style="font-size:24px;font-weight:700;color:var(--success);">' + requestsApproved + '</div><div style="font-size:11px;color:var(--gray);">Approved Requests</div></div>'
        + '<div class="stat-card"><div style="font-size:24px;font-weight:700;color:var(--primary);">' + myProjects.length + '</div><div style="font-size:11px;color:var(--gray);">My Projects</div></div>'
        + '</div>'

        + '<div class="card mb-4" style="padding:12px 16px;background:#f8f9ff;">'
        + '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">'
        + '<span style="font-weight:600;font-size:14px;">⚡ Quick Actions</span>'
        + '<button class="btn btn-sm btn-primary" onclick="Router.navigate(\'problems\')">🔧 Report Problem</button>'
        + '<button class="btn btn-sm btn-info" style="background:var(--info);color:#fff;" onclick="Router.navigate(\'material-requests\')">📦 New Request</button>'
        + '<button class="btn btn-sm btn-secondary" onclick="showReportForm()">📋 Submit Report</button>'
        + '<button class="btn btn-sm btn-success" onclick="Router.navigate(\'checklists\')">✅ Checklists</button>'
        + '<button class="btn btn-sm btn-warning" style="color:#fff;" onclick="Router.navigate(\'tasks\')">📝 My Tasks</button>'
        + '<button class="btn btn-sm btn-primary" onclick="Router.navigate(\'projects\')">📋 Projects</button>'
        + '</div></div>'

        + '<div class="grid-2 mb-4" style="gap:16px;">'
        + '<div class="card"><div class="card-header"><h3>📝 My Tasks</h3></div><div id="empDashTasks" style="padding:12px;"></div></div>'
        + '<div class="card"><div class="card-header"><h3>🔧 My Problems</h3></div><div id="empDashProblems" style="padding:12px;"></div></div>'
        + '</div>'

        + '<div class="grid-2 mb-4" style="gap:16px;">'
        + '<div class="card"><div class="card-header"><h3>📦 Material Requests</h3></div><div id="empDashRequests" style="padding:12px;"></div></div>'
        + '<div class="card"><div class="card-header" style="flex-wrap:wrap;"><h3>✅ Checklists</h3><div style="display:flex;gap:4px;font-size:12px;">'
        + '<button class="tab-btn active" onclick="filterEmpCl(\'daily\',this)">Daily</button>'
        + '<button class="tab-btn" onclick="filterEmpCl(\'weekly\',this)">Weekly</button>'
        + '<button class="tab-btn" onclick="filterEmpCl(\'monthly\',this)">Monthly</button>'
        + '<button class="tab-btn" onclick="filterEmpCl(\'all\',this)">All</button>'
        + '</div></div><div id="empDashChecklists" style="padding:12px;"></div></div>'
        + '</div>'

        + '<div class="card mb-4"><div class="card-header"><h3>🔋 Maintenance Product Lifecycle</h3></div><div id="empDashLifecycle" style="padding:12px;"></div></div>'

        + '<div class="grid-2 mb-4" style="gap:16px;">'
        + '<div class="card"><div class="card-header"><h3>📋 My Projects</h3></div><div id="empDashProjects" style="padding:12px;"></div></div>'
        + '<div class="card"><div class="card-header" style="justify-content:space-between;"><h3>📋 My Reports</h3><button class="btn btn-sm btn-primary" onclick="showReportForm()">+ New Report</button></div><div id="empDashReports" style="padding:12px;"></div></div>'
        + '</div>'

        + '<div class="card mb-4"><div class="card-header"><h3>📊 My Performance</h3></div><div id="empDashKPI" style="padding:16px;"></div></div>';

    renderEmpDashTasks(myTasks);
    renderEmpDashProblems(myProblems);
    renderEmpDashRequests(myRequests);
    _empClFilter = 'daily';
    window._empChecklists = myChecklists;
    renderEmpDashChecklists(myChecklists);
    renderEmpDashLifecycle(deptInventory);
    renderEmpDashProjects(myProjects);
    renderEmpDashReports(reports.filter(function(r) { return r.createdBy === user.username; }));
    renderEmpDashKPI(taskRate, probRate, tasksDone, myTasks.length, problemsSolved, myProblems.length, requestsApproved, myRequests.length, checklistsDone, myChecklists.length);
}

function renderEmpDashTasks(tasks) {
    var el = document.getElementById('empDashTasks');
    if (!el) return;
    if (tasks.length === 0) { el.innerHTML = '<div style="color:var(--gray);font-size:13px;">No tasks assigned</div>'; return; }
    var html = '';
    for (var i = 0; i < Math.min(tasks.length, 5); i++) {
        var t = tasks[i];
        var badge = APP.getStatusBadge(t.status);
        var overdue = t.deadline && new Date(t.deadline) < new Date() && t.status !== 'completed' ? ' <span style="color:var(--danger);font-size:11px;">⚠️ Overdue</span>' : '';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--light-gray);font-size:13px;">'
            + '<div><span>' + (t.title || '') + '</span>' + overdue + '<br><span style="font-size:11px;color:var(--gray);">' + (t.priority ? '<span class="badge badge-' + (t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'info') + '" style="font-size:10px;">' + t.priority + '</span> ' : '') + (t.deadline ? APP.formatDate(t.deadline) : '') + '</span></div>'
            + '<span><span class="badge ' + badge + '" style="font-size:11px;">' + (t.status || 'pending') + '</span></span>'
            + '</div>';
    }
    if (tasks.length > 5) html += '<div style="text-align:center;padding:4px;font-size:12px;color:var(--gray);">+' + (tasks.length - 5) + ' more</div>';
    el.innerHTML = html;
}

function renderEmpDashProblems(problems) {
    var el = document.getElementById('empDashProblems');
    if (!el) return;
    if (problems.length === 0) { el.innerHTML = '<div style="color:var(--gray);font-size:13px;">No problems reported</div>'; return; }
    var html = '';
    for (var i = 0; i < Math.min(problems.length, 5); i++) {
        var p = problems[i];
        var badge = APP.getStatusBadge(p.status);
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--light-gray);font-size:13px;">'
            + '<span>' + (p.title || '') + '</span>'
            + '<span><span class="badge ' + badge + '" style="font-size:11px;">' + (p.status || 'open') + '</span></span>'
            + '</div>';
    }
    if (problems.length > 5) html += '<div style="text-align:center;padding:4px;font-size:12px;color:var(--gray);">+' + (problems.length - 5) + ' more</div>';
    el.innerHTML = html;
}

function renderEmpDashRequests(requests) {
    var el = document.getElementById('empDashRequests');
    if (!el) return;
    if (requests.length === 0) { el.innerHTML = '<div style="color:var(--gray);font-size:13px;">No material requests</div>'; return; }
    var html = '';
    for (var i = 0; i < Math.min(requests.length, 5); i++) {
        var r = requests[i];
        var badge = r.status === 'approved' ? 'badge-success' : r.status === 'rejected' ? 'badge-danger' : 'badge-warning';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--light-gray);font-size:13px;">'
            + '<span>' + (r.title || 'Request') + '</span>'
            + '<span><span class="badge ' + badge + '" style="font-size:11px;">' + (r.status || 'pending') + '</span></span>'
            + '</div>';
    }
    if (requests.length > 5) html += '<div style="text-align:center;padding:4px;font-size:12px;color:var(--gray);">+' + (requests.length - 5) + ' more</div>';
    el.innerHTML = html;
}

function filterEmpCl(filter, btn) {
    _empClFilter = filter;
    var parent = btn.parentNode;
    if (parent) {
        var btns = parent.querySelectorAll('.tab-btn');
        for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    }
    btn.classList.add('active');
    renderEmpDashChecklists(window._empChecklists || []);
}

function renderEmpDashChecklists(checklists) {
    var el = document.getElementById('empDashChecklists');
    if (!el) return;
    var filtered = [];
    for (var i = 0; i < checklists.length; i++) {
        var cl = checklists[i];
        var title = (cl.title || '').toLowerCase();
        if (_empClFilter === 'daily' && title.indexOf('daily') === -1) continue;
        if (_empClFilter === 'weekly' && title.indexOf('weekly') === -1) continue;
        if (_empClFilter === 'monthly' && title.indexOf('monthly') === -1) continue;
        filtered.push(cl);
    }
    if (filtered.length === 0) { el.innerHTML = '<div style="color:var(--gray);font-size:13px;">No ' + _empClFilter + ' checklists</div>'; return; }
    var html = '';
    for (var i = 0; i < Math.min(filtered.length, 5); i++) {
        var cl = filtered[i];
        var total = cl.items ? cl.items.length : 0;
        var done = cl.items ? cl.items.filter(function(it) { return it.status === 'ok'; }).length : 0;
        var pct = total > 0 ? Math.round((done / total) * 100) : 0;
        html += '<div style="padding:6px 0;border-bottom:1px solid var(--light-gray);font-size:13px;">'
            + '<div style="display:flex;justify-content:space-between;">'
            + '<span>' + (cl.title || '') + '</span>'
            + '<span class="badge ' + (cl.status === 'completed' ? 'badge-success' : 'badge-info') + '" style="font-size:11px;">' + (cl.status || 'active') + '</span>'
            + '</div>'
            + '<div style="display:flex;align-items:center;gap:8px;margin-top:4px;">'
            + '<div style="flex:1;height:6px;background:var(--light-gray);border-radius:3px;"><div style="height:100%;width:' + pct + '%;background:var(--success);border-radius:3px;transition:width 0.3s;"></div></div>'
            + '<span style="font-size:11px;color:var(--gray);">' + done + '/' + total + '</span>'
            + '</div></div>';
    }
    if (filtered.length > 5) html += '<div style="text-align:center;padding:4px;font-size:12px;color:var(--gray);">+' + (filtered.length - 5) + ' more</div>';
    el.innerHTML = html;
}

function renderEmpDashLifecycle(items) {
    var el = document.getElementById('empDashLifecycle');
    if (!el) return;
    if (items.length === 0) { el.innerHTML = '<div style="color:var(--gray);font-size:13px;">No inventory items in your department</div>'; return; }
    var now = new Date();
    var html = '<div class="table-responsive"><table class="table"><thead><tr><th>Item</th><th>Category</th><th>Expiry</th><th>Warranty</th><th>Lifecycle</th></tr></thead><tbody>';
    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var expPct = null;
        var warPct = null;
        var expColor = '';
        var warColor = '';
        if (it.expiryDate) {
            var exp = new Date(it.expiryDate);
            var total = exp.getTime() - now.getTime();
            var daysLeft = Math.ceil(total / (1000 * 60 * 60 * 24));
            if (daysLeft > 365) { expPct = 100; expColor = 'var(--success)'; }
            else if (daysLeft > 90) { expPct = Math.round((daysLeft / 365) * 100); expColor = 'var(--success)'; }
            else if (daysLeft > 30) { expPct = Math.round((daysLeft / 365) * 100); expColor = 'var(--warning)'; }
            else if (daysLeft > 0) { expPct = Math.round((daysLeft / 365) * 100); expColor = 'var(--danger)'; }
            else { expPct = 0; expColor = 'var(--danger)'; }
            if (expPct !== null) { expPct = Math.max(0, Math.min(100, expPct)); }
        }
        if (it.warrantyDate) {
            var war = new Date(it.warrantyDate);
            var wTotal = war.getTime() - now.getTime();
            var wDays = Math.ceil(wTotal / (1000 * 60 * 60 * 24));
            if (wDays > 365) { warPct = 100; warColor = 'var(--success)'; }
            else if (wDays > 90) { warPct = Math.round((wDays / 365) * 100); warColor = 'var(--success)'; }
            else if (wDays > 30) { warPct = Math.round((wDays / 365) * 100); warColor = 'var(--warning)'; }
            else if (wDays > 0) { warPct = Math.round((wDays / 365) * 100); warColor = 'var(--danger)'; }
            else { warPct = 0; warColor = 'var(--danger)'; }
            if (warPct !== null) { warPct = Math.max(0, Math.min(100, warPct)); }
        }
        html += '<tr><td><strong>' + (it.name || '') + '</strong></td>'
            + '<td style="font-size:12px;">' + (it.category || '-') + '</td>'
            + '<td style="font-size:12px;">' + (it.expiryDate ? '<span style="color:' + expColor + ';">' + APP.formatDate(it.expiryDate) + '</span>' : '-') + '</td>'
            + '<td style="font-size:12px;">' + (it.warrantyDate ? '<span style="color:' + warColor + ';">' + APP.formatDate(it.warrantyDate) + '</span>' : '-') + '</td>'
            + '<td style="min-width:120px;">'
            + (it.expiryDate ? '<div style="display:flex;align-items:center;gap:4px;font-size:11px;margin-bottom:2px;"><span style="width:40px;">Exp</span><div style="flex:1;height:6px;background:var(--light-gray);border-radius:3px;"><div style="height:100%;width:' + expPct + '%;background:' + expColor + ';border-radius:3px;"></div></div></div>' : '')
            + (it.warrantyDate ? '<div style="display:flex;align-items:center;gap:4px;font-size:11px;"><span style="width:40px;">War</span><div style="flex:1;height:6px;background:var(--light-gray);border-radius:3px;"><div style="height:100%;width:' + warPct + '%;background:' + warColor + ';border-radius:3px;"></div></div></div>' : '')
            + '</td></tr>';
    }
    html += '</tbody></table></div>';
    el.innerHTML = html;
}

function renderEmpDashProjects(projects) {
    var el = document.getElementById('empDashProjects');
    if (!el) return;
    if (projects.length === 0) { el.innerHTML = '<div style="color:var(--gray);font-size:13px;">No projects assigned</div>'; return; }
    var html = '<div class="table-responsive"><table class="table"><thead><tr><th>Project</th><th>Status</th><th>Budget</th><th>Spent</th><th>Progress</th></tr></thead><tbody>';
    for (var i = 0; i < projects.length; i++) {
        var p = projects[i];
        var pct = p.budget > 0 ? Math.round((p.spent / p.budget) * 100) : 0;
        html += '<tr><td><strong>' + (p.name || '') + '</strong></td>'
            + '<td><span class="badge ' + APP.getStatusBadge(p.status) + '" style="font-size:11px;">' + (p.status || 'planning') + '</span></td>'
            + '<td style="font-size:12px;">₹' + (p.budget || 0).toLocaleString() + '</td>'
            + '<td style="font-size:12px;">₹' + (p.spent || 0).toLocaleString() + '</td>'
            + '<td style="min-width:100px;"><div style="display:flex;align-items:center;gap:4px;"><div style="flex:1;height:6px;background:var(--light-gray);border-radius:3px;"><div style="height:100%;width:' + pct + '%;background:' + (pct > 80 ? 'var(--danger)' : pct > 50 ? 'var(--warning)' : 'var(--success)') + ';border-radius:3px;"></div></div><span style="font-size:11px;color:var(--gray);">' + pct + '%</span></div></td>'
            + '</tr>';
    }
    html += '</tbody></table></div>';
    el.innerHTML = html;
}

function renderEmpDashReports(reports) {
    var el = document.getElementById('empDashReports');
    if (!el) return;
    if (reports.length === 0) { el.innerHTML = '<div style="color:var(--gray);font-size:13px;">No reports submitted yet</div>'; return; }
    var html = '<div class="table-responsive"><table class="table"><thead><tr><th>Title</th><th>Category</th><th>Sent To</th><th>Date</th><th>Status</th></tr></thead><tbody>';
    for (var i = reports.length - 1; i >= 0 && i > reports.length - 11; i--) {
        var r = reports[i];
        html += '<tr><td>' + (r.title || '') + '</td>'
            + '<td style="font-size:12px;">' + (r.category || '-') + '</td>'
            + '<td style="font-size:12px;">' + (r.sentTo || '-') + '</td>'
            + '<td style="font-size:12px;">' + APP.formatDate(r.createdAt) + '</td>'
            + '<td><span class="badge ' + (r.status === 'sent' ? 'badge-success' : 'badge-warning') + '" style="font-size:11px;">' + (r.status || 'draft') + '</span></td>'
            + '</tr>';
    }
    html += '</tbody></table></div>';
    el.innerHTML = html;
}

function renderEmpDashKPI(taskRate, probRate, tasksDone, tasksTotal, problemsSolved, problemsTotal, requestsApproved, requestsTotal, checklistsDone, checklistsTotal) {
    var el = document.getElementById('empDashKPI');
    if (!el) return;
    el.innerHTML = '<div class="grid-3" style="gap:20px;">'
        + '<div><div class="flex-between" style="font-size:13px;margin-bottom:4px;"><span>Task Completion</span><span>' + tasksDone + '/' + tasksTotal + '</span></div><div class="progress-bar"><div class="progress-fill" style="width:' + taskRate + '%;background:var(--success);"></div></div><span style="font-size:11px;color:var(--gray);">' + taskRate + '%</span></div>'
        + '<div><div class="flex-between" style="font-size:13px;margin-bottom:4px;"><span>Problem Resolution</span><span>' + problemsSolved + '/' + problemsTotal + '</span></div><div class="progress-bar"><div class="progress-fill" style="width:' + probRate + '%;background:var(--info);"></div></div><span style="font-size:11px;color:var(--gray);">' + probRate + '%</span></div>'
        + '<div><div class="flex-between" style="font-size:13px;margin-bottom:4px;"><span>Request Approval</span><span>' + requestsApproved + '/' + requestsTotal + '</span></div><div class="progress-bar"><div class="progress-fill" style="width:' + (requestsTotal > 0 ? Math.round((requestsApproved / requestsTotal) * 100) : 0) + '%;background:var(--warning);"></div></div><span style="font-size:11px;color:var(--gray);">' + (requestsTotal > 0 ? Math.round((requestsApproved / requestsTotal) * 100) : 0) + '%</span></div>'
        + '<div><div class="flex-between" style="font-size:13px;margin-bottom:4px;"><span>Checklist Completion</span><span>' + checklistsDone + '/' + checklistsTotal + '</span></div><div class="progress-bar"><div class="progress-fill" style="width:' + (checklistsTotal > 0 ? Math.round((checklistsDone / checklistsTotal) * 100) : 0) + '%;background:var(--primary);"></div></div><span style="font-size:11px;color:var(--gray);">' + (checklistsTotal > 0 ? Math.round((checklistsDone / checklistsTotal) * 100) : 0) + '%</span></div>'
        + '</div>';
}

function showReportForm() {
    var user = AUTH.currentUser();
    if (!user) return;
    var html = '<form id="reportForm">'
        + '<div class="form-group"><label>Report Title</label><input type="text" name="title" class="form-control" required></div>'
        + '<div class="form-group"><label>Category</label><select name="category" class="form-control"><option value="daily">Daily Report</option><option value="weekly">Weekly Report</option><option value="monthly">Monthly Report</option><option value="custom">Custom Report</option></select></div>'
        + '<div class="form-group"><label>Send To</label><select name="sentTo" class="form-control"><option value="hod">HOD</option><option value="admin">Admin</option><option value="both">Both HOD & Admin</option></select></div>'
        + '<div class="form-group"><label>Description</label><textarea name="description" class="form-control" rows="5" required></textarea></div>'
        + '</form>';
    openFormModal('Submit Report', html, 'saveReport()', false);
}

function saveReport() {
    var user = AUTH.currentUser();
    if (!user) return false;
    var data = getFormData('reportForm');
    if (!data.title || !data.description) { APP.notify('Title and description required', 'error'); return false; }
    data.createdBy = user.username;
    data.createdByName = user.fullName;
    data.status = 'sent';
    DB.add('reports', data);
    APP.notify('Report submitted successfully', 'success');
    Router.navigate('employee-dashboard');
}
