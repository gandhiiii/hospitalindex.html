// Room definitions
const FLOOR_ROOMS = {
    4: { label: '4th Floor', rooms: Array.from({length: 16}, (_, i) => String(402 + i)) },
    5: { label: '5th Floor', rooms: Array.from({length: 16}, (_, i) => String(502 + i)) },
    6: { label: '6th Floor', rooms: Array.from({length: 16}, (_, i) => String(602 + i)) }
};

function getRoomStatus(roomNo) {
    const overrides = DB.get('roomStatus') || [];
    const override = overrides.find(r => r.roomNo === roomNo);
    const admission = DB.get('admissions').find(a => a.roomNo === roomNo && a.status === 'admitted');
    if (admission) return { status: 'occupied', admission };
    if (override) return { status: override.status, data: override };
    return { status: 'available', admission: null };
}

function getRoomDetails(roomNo) {
    const result = { roomNo, status: 'available', patient: null, checklists: [], complaints: [], problems: [], maintenance: null };
    const admissions = DB.get('admissions');
    result.patient = admissions.find(a => a.roomNo === roomNo && a.status === 'admitted') || null;
    result.status = result.patient ? 'occupied' : 'available';
    const overrides = DB.get('roomStatus') || [];
    const ov = overrides.find(r => r.roomNo === roomNo);
    if (ov) result.status = ov.status;
    result.checklists = (DB.get('roomchecklists') || []).filter(r => r.roomNo === roomNo).slice().reverse();
    result.complaints = (DB.get('complaints') || []).filter(c => c.roomNo === roomNo).slice().reverse();
    result.problems = (DB.get('problems') || []).filter(p => p.roomNo === roomNo).slice().reverse();
    if (ov && ov.status === 'maintenance') result.maintenance = ov;
    return result;
}

function renderAdmissions(container) {
    container.innerHTML = `
        <div class="flex-between mb-4" id="admTopBar">
            <div class="search-box" id="admSearchBox">
                <input type="text" class="form-control" id="admSearch" placeholder="Search patients..." oninput="renderAdmList()">
            </div>
            <button class="btn btn-primary" onclick="showAdmForm()">+ New Admission</button>
        </div>

        <div id="admStats" class="grid-4 mb-4"></div>

        <div class="tabs" style="margin-bottom:16px;">
            <button class="tab-btn ${admFilter === 'all' ? 'active' : ''}" onclick="switchAdmFilter('all',this)">All</button>
            <button class="tab-btn ${admFilter === 'admitted' ? 'active' : ''}" onclick="switchAdmFilter('admitted',this)">Admitted</button>
            <button class="tab-btn ${admFilter === 'discharged' ? 'active' : ''}" onclick="switchAdmFilter('discharged',this)">Discharged</button>
            <button class="tab-btn ${admFilter === 'rooms' ? 'active' : ''}" onclick="switchAdmFilter('rooms',this)">🏥 Rooms</button>
        </div>

        <div id="admContent"></div>
    `;
    renderAdmContent();
}

function renderAdmContent() {
    const topBar = document.getElementById('admTopBar');
    const searchBox = document.getElementById('admSearchBox');
    const stats = document.getElementById('admStats');
    const content = document.getElementById('admContent');
    if (!content) return;
    if (admFilter === 'rooms') {
        if (topBar) topBar.style.justifyContent = 'flex-end';
        if (searchBox) searchBox.style.display = 'none';
        if (stats) stats.style.display = 'none';
        content.innerHTML = '<div id="roomViewContainer"></div>';
        renderRoomView();
    } else {
        if (topBar) topBar.style.justifyContent = '';
        if (searchBox) searchBox.style.display = '';
        if (stats) stats.style.display = '';
        content.innerHTML = renderAdmListView();
        renderAdmList();
    }
}

let admFilter = 'all';

function switchAdmFilter(filter, btn) {
    admFilter = filter;
    document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderAdmContent();
}

function renderAdmListView() {
    return `<div class="card">
        <div class="table-responsive">
            <table>
                <thead><tr>
                    <th>Patient Name</th><th>ID</th><th>Room/Ward</th><th>Doctor</th>
                    <th>Admitted</th><th>Type</th><th>Status</th><th>Actions</th>
                </tr></thead>
                <tbody id="admTableBody"></tbody>
            </table>
        </div>
    </div>`;
}

function renderAdmList() {
    const admissions = DB.get('admissions');
    const search = (document.getElementById('admSearch')?.value || '').toLowerCase();
    let filtered = admissions.filter(a =>
        a.patientName.toLowerCase().includes(search) ||
        a.patientId?.toLowerCase().includes(search) ||
        a.roomNo.toLowerCase().includes(search) ||
        a.doctorName.toLowerCase().includes(search)
    );
    if (admFilter !== 'all') filtered = filtered.filter(a => a.status === admFilter);

    const total = admissions.length;
    const admitted = admissions.filter(a => a.status === 'admitted').length;
    const discharged = admissions.filter(a => a.status === 'discharged').length;

    const statsEl = document.getElementById('admStats');
    if (statsEl) {
        statsEl.innerHTML = `
            <div class="stat-card" style="border-left-color:var(--primary)"><div class="stat-value">${total}</div><div class="stat-label">Total Patients</div></div>
            <div class="stat-card" style="border-left-color:var(--info)"><div class="stat-value">${admitted}</div><div class="stat-label">Currently Admitted</div></div>
            <div class="stat-card" style="border-left-color:var(--success)"><div class="stat-value">${discharged}</div><div class="stat-label">Discharged</div></div>
            <div class="stat-card" style="border-left-color:var(--warning)"><div class="stat-value">${(admitted > 0 ? (admissions.filter(a => a.status === 'admitted').reduce((s, a) => {
                const days = APP.daysBetween(a.admissionDate, new Date().toISOString());
                return s + days;
            }, 0) / admitted) : 0).toFixed(1)}</div><div class="stat-label">Avg Stay (days)</div></div>
        `;
    }

    const tbody = document.getElementById('admTableBody');
    if (!tbody) return;
    tbody.innerHTML = filtered.slice().reverse().map(a => `
        <tr>
            <td><strong>${a.patientName}</strong></td>
            <td>${a.patientId || '#' + a.id.slice(-6)}</td>
            <td>${a.roomNo}</td>
            <td>${a.doctorName || '-'}</td>
            <td>${APP.formatDate(a.admissionDate)}</td>
            <td><span class="badge ${a.type === 'emergency' ? 'badge-danger' : a.type === 'icu' ? 'badge-warning' : 'badge-info'}">${a.type}</span></td>
            <td><span class="badge ${APP.getStatusBadge(a.status)}">${a.status}</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewAdm('${a.id}')">View</button>
                ${a.status === 'admitted' ? `<button class="btn btn-sm btn-warning" onclick="showDischargeForm('${a.id}')">Discharge</button>` : ''}
                <button class="btn btn-sm btn-danger" onclick="deleteAdm('${a.id}')">Del</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="8" class="empty-state">No admissions</td></tr>';
}

/* ═══════════════════════════════════════
   ROOM VIEW
   ═══════════════════════════════════════ */

function renderRoomViewHtml() {
    return `<div id="roomViewContainer"></div>`;
}

function renderRoomView() {
    const el = document.getElementById('roomViewContainer');
    if (!el) return;
    var overrides = (DB.get('roomStatus') || []).slice();
    var admissions = (DB.get('admissions') || []).slice();
    var rooms = FLOOR_ROOMS;
    var floors = Object.keys(rooms);
    var html = '';

    for (var f = 0; f < floors.length; f++) {
        var floor = floors[f];
        var floorData = rooms[floor];
        var roomList = floorData.rooms;
        html += '<div class="card" style="margin-bottom:16px;">';
        html += '<div class="card-header"><h3>' + floorData.label + ' (Rooms ' + roomList[0] + '-' + roomList[roomList.length-1] + ')</h3></div>';
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;padding:12px;">';

        for (var r = 0; r < roomList.length; r++) {
            var roomNo = roomList[r];
            var ov = null;
            for (var o = 0; o < overrides.length; o++) {
                if (overrides[o].roomNo === roomNo) { ov = overrides[o]; break; }
            }
            var patient = null;
            for (var a = 0; a < admissions.length; a++) {
                if (admissions[a].roomNo === roomNo && admissions[a].status === 'admitted') { patient = admissions[a]; break; }
            }

            var status = 'available';
            var bg = '#e8f5e9';
            var label = 'Available';

            if (patient) { status = 'occupied'; bg = '#fff8e1'; label = 'Occupied'; }
            if (ov && ov.status === 'cleaning') { status = 'cleaning'; bg = '#e3f2fd'; label = 'Cleaning'; }
            if (ov && ov.status === 'maintenance') { status = 'maintenance'; bg = '#ffebee'; label = 'Maintenance'; }

            var borderColor = '#66bb6a';
            if (status === 'occupied') borderColor = '#fdd835';
            else if (status === 'cleaning') borderColor = '#42a5f5';
            else if (status === 'maintenance') borderColor = '#ef5350';

            var textColor = '#2e7d32';
            if (status === 'occupied') textColor = '#f57f17';
            else if (status === 'cleaning') textColor = '#1565c0';
            else if (status === 'maintenance') textColor = '#c62828';

            html += '<div class="room-card" data-room="' + roomNo + '" onclick="showRoomDetail(\'' + roomNo + '\')"';
            html += ' style="background:' + bg + ';border-radius:10px;padding:12px;cursor:pointer;border:2px solid ' + borderColor + ';">';
            html += '<div style="font-size:22px;font-weight:700;margin-bottom:2px;">' + roomNo + '</div>';
            html += '<div style="font-size:12px;font-weight:600;color:' + textColor + ';">' + label + '</div>';
            if (patient) {
                html += '<div style="font-size:11px;color:var(--gray);margin-top:4px;">' + (patient.patientName || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>';
            }
            if (ov && ov.maintenanceReason) {
                html += '<div style="font-size:10px;color:#c62828;margin-top:2px;">' + ov.maintenanceReason.substring(0, 20).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>';
            }
            html += '</div>';
        }

        html += '</div></div>';
    }
    el.innerHTML = html;
}

function showRoomDetail(roomNo) {
    const data = getRoomDetails(roomNo);
    const statusColors = { available: '#66bb6a', occupied: '#fdd835', cleaning: '#42a5f5', maintenance: '#ef5350' };
    const statusBgs = { available: '#e8f5e9', occupied: '#fff8e1', cleaning: '#e3f2fd', maintenance: '#ffebee' };
    const statusIcons = { available: '🟢', occupied: '🟡', cleaning: '🔵', maintenance: '🔴' };
    const statusLabels = { available: 'Available', occupied: 'Occupied', cleaning: 'Under Cleaning', maintenance: 'Under Maintenance' };

    // Get installed inventory items for this room
    const inventoryItems = (DB.get('inventory') || []).filter(i => i.location && i.location.includes(roomNo));

    // Maintenance actions
    const setStatusBtn = (s, label, color) =>
        `<button class="btn btn-sm ${color}" onclick="setRoomStatus('${roomNo}','${s}');document.querySelector('.modal.active')?.remove()">${label}</button>`;

    const modal = showModal(`
        <div class="modal-header">
            <h3>🏥 Room ${roomNo}</h3>
            <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div style="padding:4px 0;">
            <!-- Status Badge -->
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;padding:10px 14px;border-radius:8px;background:${statusBgs[data.status]};border-left:4px solid ${statusColors[data.status]};">
                <span style="font-size:24px;">${statusIcons[data.status]}</span>
                <div>
                    <div style="font-weight:700;font-size:16px;color:${statusColors[data.status]};">${statusLabels[data.status]}</div>
                    <div style="font-size:12px;color:var(--gray);">${data.maintenance?.maintenanceReason || 'No issues reported'}</div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">
                ${data.status !== 'occupied' ? setStatusBtn('occupied', '🟡 Mark Occupied', 'btn-warning') : ''}
                ${data.status !== 'cleaning' ? setStatusBtn('cleaning', '🔵 Set Cleaning', 'btn-info') : ''}
                ${data.status !== 'maintenance' ? `<button class="btn btn-sm btn-danger" onclick="showSetMaintenance('${roomNo}')">🔴 Set Maintenance</button>` : ''}
                ${data.status !== 'available' ? setStatusBtn('available', '🟢 Set Available', 'btn-success') : ''}
            </div>

            ${data.patient ? `
            <!-- Patient Info -->
            <div class="card" style="margin-bottom:12px;padding:12px;background:${statusBgs.occupied};border-left:3px solid ${statusColors.occupied};">
                <h4 style="margin:0 0 8px 0;font-size:14px;">🧑 Patient</h4>
                <div class="grid-2" style="font-size:13px;">
                    <div><strong>Name:</strong> ${data.patient.patientName}</div>
                    <div><strong>IP ID:</strong> ${data.patient.patientId || '#' + data.patient.id.slice(-6)}</div>
                    <div><strong>Doctor:</strong> ${data.patient.doctorName || '-'}</div>
                    <div><strong>Department:</strong> ${data.patient.department || '-'}</div>
                    <div><strong>Admitted:</strong> ${APP.formatDate(data.patient.admissionDate)}</div>
                    <div><strong>Type:</strong> <span class="badge ${data.patient.type === 'emergency' ? 'badge-danger' : data.patient.type === 'icu' ? 'badge-warning' : 'badge-info'}">${data.patient.type}</span></div>
                </div>
                ${data.patient.phone ? '<div style="font-size:13px;margin-top:4px;"><strong>Phone:</strong> '+data.patient.phone+'</div>' : ''}
                ${data.patient.diagnosis ? '<div style="font-size:13px;margin-top:4px;"><strong>Diagnosis:</strong> '+data.patient.diagnosis+'</div>' : ''}
            </div>` : ''}

            <!-- Checklist -->
            <div class="card" style="margin-bottom:12px;padding:12px;">
                <h4 style="margin:0 0 8px 0;font-size:14px;">📋 Recent Checklists (${data.checklists.length})</h4>
                ${data.checklists.length === 0 ? '<div style="font-size:12px;color:var(--gray);">No checklists for this room</div>' :
                data.checklists.slice(0, 3).map(cl => {
                    const items = cl.items || {};
                    const ok = Object.values(items).filter(v => v === true).length;
                    const total = Object.keys(items).length;
                    const pct = total > 0 ? Math.round(ok/total*100) : 0;
                    return `<div style="display:flex;gap:8px;align-items:center;font-size:12px;padding:4px 0;border-bottom:1px solid var(--light-gray);">
                        <span class="badge ${cl.type === 'pre-admission' ? 'badge-info' : 'badge-warning'}">${cl.type}</span>
                        <span>${APP.formatDate(cl.createdAt)}</span>
                        <span style="flex:1;font-size:11px;">by ${cl.checkedBy || '-'}</span>
                        <span style="font-weight:600;">${ok}/${total} (${pct}%)</span>
                    </div>`;
                }).join('')}
                ${data.checklists.length > 3 ? `<div style="font-size:11px;color:var(--primary);margin-top:4px;">+${data.checklists.length-3} more</div>` : ''}
            </div>

            <!-- Complaints -->
            <div class="card" style="margin-bottom:12px;padding:12px;">
                <h4 style="margin:0 0 8px 0;font-size:14px;">⚠️ Complaints (${data.complaints.length})</h4>
                ${data.complaints.length === 0 ? '<div style="font-size:12px;color:var(--gray);">No complaints</div>' :
                data.complaints.map(c => `<div style="display:flex;gap:6px;align-items:center;font-size:12px;padding:3px 0;border-bottom:1px solid var(--light-gray);">
                    <span class="badge ${APP.getStatusBadge(c.status)}">${c.status}</span>
                    <span style="flex:1;">${c.category} - ${c.patientName}</span>
                    <span style="color:var(--gray);font-size:11px;">${APP.formatDate(c.createdAt)}</span>
                </div>`).join('')}
            </div>

            <!-- Problems -->
            <div class="card" style="margin-bottom:12px;padding:12px;">
                <h4 style="margin:0 0 8px 0;font-size:14px;">🔧 Problems / Maintenance (${data.problems.length})</h4>
                ${data.problems.length === 0 ? '<div style="font-size:12px;color:var(--gray);">No problems reported</div>' :
                data.problems.map(p => `<div style="display:flex;gap:6px;align-items:center;font-size:12px;padding:3px 0;border-bottom:1px solid var(--light-gray);">
                    <span class="badge ${APP.getStatusBadge(p.status)}">${p.status}</span>
                    <span style="flex:1;">${p.title || p.description || '-'}</span>
                    <span style="color:var(--gray);font-size:11px;">${APP.formatDate(p.createdAt)}</span>
                </div>`).join('')}
            </div>

            <!-- Installed Items / Inventory -->
            <div class="card" style="padding:12px;">
                <h4 style="margin:0 0 8px 0;font-size:14px;">📦 Installed Equipment (${inventoryItems.length})</h4>
                ${inventoryItems.length === 0 ? '<div style="font-size:12px;color:var(--gray);">No equipment assigned to this room</div>' :
                `<div class="table-responsive"><table><thead><tr><th>Item</th><th>Category</th><th>Lifecycle</th><th>Warranty</th></tr></thead><tbody>${
                    inventoryItems.map(i => {
                        const lc = (i.purchaseDate && i.expiryDate) ? APP.lifecyclePercent(i.purchaseDate, i.expiryDate) : 0;
                        const lcColor = APP.lifecycleColor(lc);
                        const warCol = i.warrantyDate ? (APP.daysBetween(new Date().toISOString(), i.warrantyDate) > 0 ? 'var(--success)' : 'var(--danger)') : 'var(--gray)';
                        return `<tr>
                            <td><strong>${i.name}</strong></td>
                            <td>${i.category}</td>
                            <td><div class="progress-bar" style="width:60px;height:12px;"><div class="progress-fill ${lcColor}" style="width:${lc}%;"></div></div><span style="font-size:10px;">${lc}%</span></td>
                            <td style="color:${warCol};font-size:12px;">${i.warrantyDate ? APP.formatDate(i.warrantyDate) : '-'}</td>
                        </tr>`;
                    }).join('')
                }</tbody></table></div>`}
            </div>
        </div>
    `, true);
}

function setRoomStatus(roomNo, status) {
    const overrides = DB.get('roomStatus') || [];
    const idx = overrides.findIndex(r => r.roomNo === roomNo);
    if (status === 'available' || status === 'occupied') {
        if (idx > -1) overrides.splice(idx, 1);
    } else {
        const data = { roomNo, status, updatedAt: new Date().toISOString() };
        if (idx > -1) { overrides[idx] = { ...overrides[idx], ...data }; }
        else { overrides.push(data); }
    }
    DB.set('roomStatus', overrides);
    renderRoomView();
    APP.notify('Room status updated', 'success');
}

function showSetMaintenance(roomNo) {
    showModal(`
        <div class="modal-header"><h3>🔴 Set Maintenance — Room ${roomNo}</h3><button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button></div>
        <div style="padding:16px;">
            <div class="form-group">
                <label>Maintenance Reason *</label>
                <textarea id="maintReason" class="form-control" rows="3" placeholder="Describe the maintenance issue..."></textarea>
            </div>
            <button class="btn btn-danger btn-lg" style="width:100%;margin-top:8px;" onclick="confirmSetMaintenance('${roomNo}')">🔴 Confirm Maintenance</button>
        </div>
    `);
}

function confirmSetMaintenance(roomNo) {
    const reason = document.getElementById('maintReason')?.value?.trim();
    if (!reason) { APP.notify('Please enter maintenance reason', 'error'); return; }
    const overrides = DB.get('roomStatus') || [];
    const idx = overrides.findIndex(r => r.roomNo === roomNo);
    const data = { roomNo, status: 'maintenance', maintenanceReason: reason, updatedAt: new Date().toISOString() };
    if (idx > -1) overrides[idx] = { ...overrides[idx], ...data };
    else overrides.push(data);
    DB.set('roomStatus', overrides);
    renderRoomView();
    APP.notify('Room marked for maintenance', 'warning');
    document.querySelector('.modal.active')?.remove();
    document.querySelector('.modal.active')?.remove();
}

function showAdmForm() {
    const depts = DB.get('departments');
    const form = `
        <form id="admForm">
            <div class="grid-2">
                <div class="form-group">
                    <label>Patient Name *</label>
                    <input type="text" name="patientName" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Patient ID / Aadhar</label>
                    <input type="text" name="patientId" class="form-control">
                </div>
                <div class="form-group">
                    <label>Age *</label>
                    <input type="number" name="age" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Gender *</label>
                    <select name="gender" class="form-control" required>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Contact Phone *</label>
                    <input type="text" name="phone" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Emergency Contact</label>
                    <input type="text" name="emergencyContact" class="form-control">
                </div>
                <div class="form-group">
                    <label>Room / Ward No *</label>
                    <input type="text" name="roomNo" class="form-control" placeholder="e.g. 101, ICU-3" required>
                </div>

                <div class="form-group">
                    <label>Doctor Name *</label>
                    <input type="text" name="doctorName" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Admission Type *</label>
                    <select name="type" class="form-control" required>
                        <option value="regular">Regular</option>
                        <option value="emergency">Emergency</option>
                        <option value="icu">ICU</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Admission Date *</label>
                    <input type="date" name="admissionDate" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
            </div>
            <div class="form-group">
                <label>Diagnosis / Reason</label>
                <textarea name="diagnosis" class="form-control" rows="2"></textarea>
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea name="notes" class="form-control" rows="2"></textarea>
            </div>
        </form>
    `;
    openFormModal('New Admission', form, `saveAdm()`);
}

function saveAdm() {
    const data = getFormData('admForm');
    if (!data.patientName || !data.age || !data.phone || !data.roomNo || !data.doctorName) {
        APP.notify('Please fill all required fields', 'error'); return;
    }
    // Check if room is already occupied
    const existingAdm = DB.get('admissions').find(a => a.roomNo === data.roomNo && a.status === 'admitted');
    if (existingAdm) {
        APP.notify('Room ' + data.roomNo + ' is already occupied by ' + existingAdm.patientName, 'error');
        return;
    }
    data.status = 'admitted';
    data.dischargeDate = '';
    data.dischargeSummary = '';
    data.billAmount = '';
    data.paymentStatus = 'pending';
    DB.add('admissions', data);
    // Auto-occupy room (remove any override)
    const overrides = DB.get('roomStatus') || [];
    DB.set('roomStatus', overrides.filter(r => r.roomNo !== data.roomNo));
    APP.notify('Patient admitted successfully', 'success');
    renderAdmContent();
}

function viewAdm(id) {
    const a = DB.getById('admissions', id);
    if (!a) return;
    const stayDays = a.status === 'admitted'
        ? APP.daysBetween(a.admissionDate, new Date().toISOString())
        : (a.dischargeDate ? APP.daysBetween(a.admissionDate, a.dischargeDate) : 0);

    showModal(`
        <div class="modal-header">
            <h3>${a.patientName} - ${a.patientId || '#' + a.id.slice(-6)}</h3>
            <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="grid-2">
            <div><strong>Age/Gender:</strong> ${a.age}/${a.gender}</div>
            <div><strong>Phone:</strong> ${a.phone}</div>
            <div><strong>Room:</strong> ${a.roomNo}</div>
            <div><strong>Department:</strong> ${a.department}</div>
            <div><strong>Doctor:</strong> ${a.doctorName}</div>
            <div><strong>Type:</strong> <span class="badge ${a.type === 'emergency' ? 'badge-danger' : a.type === 'icu' ? 'badge-warning' : 'badge-info'}">${a.type.toUpperCase()}</span></div>
            <div><strong>Admitted:</strong> ${APP.formatDate(a.admissionDate)}</div>
            <div><strong>Stay:</strong> ${stayDays} days</div>
            <div><strong>Status:</strong> <span class="badge ${APP.getStatusBadge(a.status)}">${a.status.toUpperCase()}</span></div>
            ${a.emergencyContact ? `<div><strong>Emergency Contact:</strong> ${a.emergencyContact}</div>` : ''}
            ${a.billAmount ? `<div><strong>Bill:</strong> ₹${a.billAmount}</div>` : ''}
            ${a.paymentStatus ? `<div><strong>Payment:</strong> <span class="badge ${a.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}">${a.paymentStatus}</span></div>` : ''}
        </div>
        ${a.diagnosis ? `<div class="mt-4"><strong>Diagnosis:</strong><br>${a.diagnosis}</div>` : ''}
        ${a.notes ? `<div class="mt-2"><strong>Notes:</strong><br>${a.notes}</div>` : ''}
        ${a.dischargeSummary ? `<div class="mt-2"><strong>Discharge Summary:</strong><br>${a.dischargeSummary}</div>` : ''}
        ${a.dischargeDate ? `<div class="mt-2"><strong>Discharged:</strong> ${APP.formatDateTime(a.dischargeDate)}</div>` : ''}
    `);
}

function showDischargeForm(id) {
    const a = DB.getById('admissions', id);
    if (!a) return;
    const stayDays = APP.daysBetween(a.admissionDate, new Date().toISOString());
    const form = `
        <form id="dischargeForm">
            <input type="hidden" name="id" value="${id}">
            <div class="alert alert-info">
                Discharging <strong>${a.patientName}</strong> from Room ${a.roomNo} | Stay: ${stayDays} days
            </div>
            <div class="grid-2">
                <div class="form-group">
                    <label>Discharge Date *</label>
                    <input type="date" name="dischargeDate" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
                <div class="form-group">
                    <label>Bill Amount (₹)</label>
                    <input type="number" name="billAmount" class="form-control" value="${stayDays * 1000}">
                </div>
                <div class="form-group">
                    <label>Payment Status</label>
                    <select name="paymentStatus" class="form-control">
                        <option value="paid">Paid</option>
                        <option value="pending">Pending</option>
                        <option value="partial">Partial</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Discharge Summary *</label>
                <textarea name="dischargeSummary" class="form-control" rows="3" required></textarea>
            </div>
        </form>
    `;
    openFormModal('Discharge Patient', form, `saveDischarge()`);
}

function saveDischarge() {
    const data = getFormData('dischargeForm');
    if (!data.dischargeDate || !data.dischargeSummary) {
        APP.notify('Please fill required fields', 'error'); return;
    }
    const adm = DB.getById('admissions', data.id);
    DB.update('admissions', data.id, {
        status: 'discharged',
        dischargeDate: data.dischargeDate,
        dischargeSummary: data.dischargeSummary,
        billAmount: data.billAmount,
        paymentStatus: data.paymentStatus
    });
    // Auto-set room to cleaning on discharge
    if (adm) {
        const overrides = DB.get('roomStatus') || [];
        const idx = overrides.findIndex(r => r.roomNo === adm.roomNo);
        const roomData = { roomNo: adm.roomNo, status: 'cleaning', updatedAt: new Date().toISOString() };
        if (idx > -1) overrides[idx] = { ...overrides[idx], ...roomData };
        else overrides.push(roomData);
        DB.set('roomStatus', overrides);
    }
    APP.notify('Patient discharged. Room set to cleaning.', 'success');
    renderAdmContent();
    closeModal();
}

function deleteAdm(id) {
    const adm = DB.getById('admissions', id);
    confirmAction('Delete this admission record?', () => {
        if (adm && adm.status === 'admitted') {
            const overrides = DB.get('roomStatus') || [];
            const idx = overrides.findIndex(r => r.roomNo === adm.roomNo);
            const roomData = { roomNo: adm.roomNo, status: 'cleaning', updatedAt: new Date().toISOString() };
            if (idx > -1) overrides[idx] = { ...overrides[idx], ...roomData };
            else overrides.push(roomData);
            DB.set('roomStatus', overrides);
        }
        DB.delete('admissions', id);
        renderAdmContent();
    });
}
