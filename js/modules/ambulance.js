let ambMap = null;
let ambMarkers = [];
let ambTrackingInterval = null;
let ambRouteLine = null;

function renderAmbulance(container) {
    container.innerHTML = `
        <div class="flex-between mb-4">
            <div class="search-box">
                <input type="text" class="form-control" id="ambSearch" placeholder="Search vehicles or drivers..." oninput="renderAmbList()">
            </div>
            <button class="btn btn-primary" onclick="showAmbForm()">+ Add Ambulance</button>
        </div>

        <div id="ambStats" class="grid-4 mb-4"></div>

        <div class="tabs">
            <button class="tab-btn active" onclick="switchAmbTab('map',this)">🗺️ Live Map</button>
            <button class="tab-btn" onclick="switchAmbTab('ambulances',this)">🚑 Ambulances</button>
            <button class="tab-btn" onclick="switchAmbTab('trips',this)">📋 Trips</button>
        </div>

        <div id="ambMapTab" class="tab-content active">
            <div class="card">
                <div class="card-header">
                    <h2>Live GPS Tracking</h2>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <span id="ambLastUpdate" style="font-size:12px;color:var(--gray);"></span>
                        <button class="btn btn-sm btn-primary" onclick="simulateAmbulanceMovement()">Simulate Move</button>
                        <button class="btn btn-sm btn-success" onclick="centerMapOnAmbulances()">Center All</button>
                    </div>
                </div>
                <div id="ambMapContainer" style="height:420px;border-radius:8px;border:1px solid var(--light-gray);"></div>
                <div id="ambCoordDisplay" style="font-size:12px;color:var(--gray);margin-top:8px;text-align:center;"></div>
            </div>

            <div class="card">
                <div class="card-header"><h2>📍 Find Destination</h2></div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <input type="text" id="ambDestSearch" class="form-control" placeholder="Search destination (e.g. Jayanagar Hospital, Bangalore)" style="flex:1;min-width:200px;">
                    <button class="btn btn-primary" onclick="searchDestination()">🔍 Search</button>
                    <button class="btn btn-success" onclick="useCurrentLocation()">📍 My Location</button>
                </div>
                <div id="ambDestResults" style="margin-top:8px;"></div>
            </div>
        </div>

        <div id="ambAmbTab" class="tab-content">
            <div class="card">
                <div class="table-responsive">
                    <table>
                        <thead><tr>
                            <th>Vehicle No</th><th>Driver</th><th>Phone</th><th>Status</th>
                            <th>Location</th><th>Speed</th><th>Last Updated</th><th>Actions</th>
                        </tr></thead>
                        <tbody id="ambTableBody"></tbody>
                    </table>
                </div>
            </div>
        </div>

        <div id="ambTripTab" class="tab-content">
            <div class="flex-between mb-4">
                <h3 style="font-size:16px;">Trip History</h3>
                <button class="btn btn-primary" onclick="showTripForm()">+ New Trip</button>
            </div>
            <div class="card">
                <div class="table-responsive">
                    <table>
                        <thead><tr>
                            <th>Date</th><th>Vehicle</th><th>Driver</th><th>Patient</th>
                            <th>Pickup → Drop</th><th>KM</th><th>Status</th><th>Actions</th>
                        </tr></thead>
                        <tbody id="ambTripBody"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    renderAmbList();
    renderTripList();
    setTimeout(() => initAmbulanceMap(), 300);
    startAmbulanceTracking();
}

function switchAmbTab(tab, btn) {
    document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('#ambMapTab,#ambAmbTab,#ambTripTab').forEach(t => t.classList.remove('active'));
    document.getElementById('ambMapTab').classList.toggle('active', tab === 'map');
    document.getElementById('ambAmbTab').classList.toggle('active', tab === 'ambulances');
    document.getElementById('ambTripTab').classList.toggle('active', tab === 'trips');
    if (tab === 'map') {
        if (!ambMap) setTimeout(() => initAmbulanceMap(), 300);
        else setTimeout(() => ambMap.invalidateSize(), 200);
    }
}

function initAmbulanceMap() {
    const el = document.getElementById('ambMapContainer');
    if (!el) return;
    if (ambMap) { ambMap.remove(); ambMap = null; }
    if (typeof L === 'undefined') {
        el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;color:var(--gray);background:#f8f9fa;border-radius:8px;"><div style="font-size:40px;">🗺️</div><div style="font-size:16px;font-weight:600;margin:8px 0;">Map Load Failed</div><div style="font-size:13px;">Leaflet library not loaded. Check internet connection and refresh.</div><button class="btn btn-primary mt-4" onclick="initAmbulanceMap()">Retry</button></div>';
        return;
    }
    ambMap = L.map('ambMapContainer').setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(ambMap);
    ambMarkers = [];
    updateMapMarkers();
}

function updateMapMarkers() {
    if (!ambMap) return;
    ambMarkers.forEach(m => ambMap.removeLayer(m));
    ambMarkers = [];
    const ambulances = DB.get('ambulance');
    const active = ambulances.filter(a => a.latitude && a.longitude);
    active.forEach(a => {
        const color = a.status === 'on-duty' ? 'red' : a.status === 'available' ? 'green' : 'orange';
        const icon = L.divIcon({
            html: `<div style="background:${color};color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">🚑</div>`,
            className: '',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
        const marker = L.marker([a.latitude, a.longitude], { icon }).addTo(ambMap);
        marker.bindPopup(`
            <b>${a.vehicleNo}</b><br>
            Driver: ${a.driverName || 'N/A'}<br>
            Status: ${a.status}<br>
            Speed: ${a.speed || 0} km/h<br>
            Phone: ${a.driverPhone || '-'}
        `);
        ambMarkers.push(marker);
    });
    if (active.length > 0 && !ambRouteLine) centerMapOnAmbulances();
}

function centerMapOnAmbulances() {
    if (!ambMap || ambMarkers.length === 0) return;
    const group = L.featureGroup(ambMarkers);
    ambMap.fitBounds(group.getBounds().pad(0.2));
}

function searchDestination() {
    const q = document.getElementById('ambDestSearch')?.value.trim();
    const resultsEl = document.getElementById('ambDestResults');
    if (!q) { resultsEl.innerHTML = '<span style="color:var(--danger);font-size:13px;">Enter a destination name</span>'; return; }
    resultsEl.innerHTML = '<span style="font-size:13px;color:var(--gray);">Searching...</span>';
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=in`)
        .then(r => r.json())
        .then(data => {
            if (!data || data.length === 0) {
                resultsEl.innerHTML = '<span style="color:var(--danger);font-size:13px;">No results found</span>';
                return;
            }
            resultsEl.innerHTML = data.map((r, i) => `
                <div style="padding:8px 12px;border:1px solid var(--light-gray);border-radius:6px;margin-bottom:4px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:white;"
                     onmouseover="this.style.background='var(--primary-light)'" onmouseout="this.style.background='white'"
                     onclick="selectDestination(${r.lat},${r.lon},'${r.display_name.replace(/'/g,"\\'")}')">
                    <span style="font-size:13px;">${r.display_name}</span>
                    <button class="btn btn-sm btn-primary">Select</button>
                </div>
            `).join('');
        })
        .catch(() => { resultsEl.innerHTML = '<span style="color:var(--danger);font-size:13px;">Search failed. Check internet connection.</span>'; });
}

function selectDestination(lat, lon, name) {
    if (!ambMap) return;
    if (ambRouteLine) ambMap.removeLayer(ambRouteLine);
    const marker = L.marker([lat, lon]).addTo(ambMap);
    marker.bindPopup(`<b>Destination</b><br>${name.substring(0, 60)}...`).openPopup();
    ambMap.setView([lat, lon], 14);
    ambMarkers.push(marker);
    document.getElementById('ambDestResults').innerHTML = `<div style="padding:8px 12px;background:#e6f4ea;border-radius:6px;font-size:13px;color:var(--secondary);">✅ Selected: ${name.substring(0, 80)}</div>`;
    document.getElementById('ambDestSearch').value = name.substring(0, 60);
}

function useCurrentLocation() {
    if (!navigator.geolocation) { APP.notify('Geolocation not supported', 'error'); return; }
    navigator.geolocation.getCurrentPosition(
        pos => {
            if (!ambMap) return;
            ambMap.setView([pos.coords.latitude, pos.coords.longitude], 15);
            L.marker([pos.coords.latitude, pos.coords.longitude]).addTo(ambMap)
                .bindPopup('<b>Your Location</b>').openPopup();
        },
        () => APP.notify('Could not get location. Check permissions.', 'error')
    );
}

function renderAmbList() {
    const ambulances = DB.get('ambulance');
    const search = (document.getElementById('ambSearch')?.value || '').toLowerCase();
    const filtered = ambulances.filter(a =>
        a.vehicleNo.toLowerCase().includes(search) ||
        a.driverName.toLowerCase().includes(search)
    );

    const total = ambulances.length;
    const available = ambulances.filter(a => a.status === 'available').length;
    const onDuty = ambulances.filter(a => a.status === 'on-duty').length;
    const maintenance = ambulances.filter(a => a.status === 'maintenance').length;
    const statsEl = document.getElementById('ambStats');
    if (statsEl) {
        statsEl.innerHTML = `
            <div class="stat-card" style="border-left-color:var(--primary)"><div class="stat-value">${total}</div><div class="stat-label">Total Ambulances</div></div>
            <div class="stat-card" style="border-left-color:var(--secondary)"><div class="stat-value">${available}</div><div class="stat-label">Available</div></div>
            <div class="stat-card" style="border-left-color:var(--info)"><div class="stat-value">${onDuty}</div><div class="stat-label">On Duty</div></div>
            <div class="stat-card" style="border-left-color:var(--warning)"><div class="stat-value">${maintenance}</div><div class="stat-label">Maintenance</div></div>
        `;
    }

    const tbody = document.getElementById('ambTableBody');
    if (!tbody) return;
    tbody.innerHTML = filtered.map(a => `
        <tr>
            <td><strong>${a.vehicleNo}</strong></td>
            <td>${a.driverName || '-'}</td>
            <td>${a.driverPhone || '-'}</td>
            <td><span class="badge ${a.status === 'available' ? 'badge-success' : a.status === 'on-duty' ? 'badge-info' : 'badge-warning'}">${a.status}</span></td>
            <td>${a.latitude && a.longitude ? `${a.latitude.toFixed(4)}, ${a.longitude.toFixed(4)}` : 'Not tracked'}</td>
            <td>${a.speed || 0} km/h</td>
            <td>${a.lastUpdated ? APP.formatDateTime(a.lastUpdated) : '-'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editAmb('${a.id}')">Edit</button>
                <button class="btn btn-sm btn-success" onclick="updateAmbStatus('${a.id}')">Status</button>
                <button class="btn btn-sm btn-info" onclick="startTripFromAmb('${a.id}')">Trip</button>
                <button class="btn btn-sm btn-danger" onclick="deleteAmb('${a.id}')">Del</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="8" class="empty-state">No ambulances</td></tr>';
}

function showAmbForm(amb) {
    const depts = DB.get('departments');
    const form = `
        <form id="ambForm">
            <input type="hidden" name="id" value="${amb?.id || ''}">
            <div class="grid-2">
                <div class="form-group">
                    <label>Vehicle Number *</label>
                    <input type="text" name="vehicleNo" class="form-control" value="${amb?.vehicleNo || ''}" required>
                </div>
                <div class="form-group">
                    <label>Driver Name</label>
                    <input type="text" name="driverName" class="form-control" value="${amb?.driverName || ''}">
                </div>
                <div class="form-group">
                    <label>Driver Phone</label>
                    <input type="text" name="driverPhone" class="form-control" value="${amb?.driverPhone || ''}">
                </div>
                <div class="form-group">
                    <label>Department</label>
                    <select name="department" class="form-control">
                        <option value="Transportation">Transportation</option>
                        <option value="Emergency" ${amb?.department === 'Emergency' ? 'selected' : ''}>Emergency</option>
                        ${depts.filter(d => d.active !== false).map(d => `<option value="${d.name}" ${amb?.department === d.name ? 'selected' : ''}>${d.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select name="status" class="form-control">
                        <option value="available" ${amb?.status === 'available' ? 'selected' : ''}>Available</option>
                        <option value="on-duty" ${amb?.status === 'on-duty' ? 'selected' : ''}>On Duty</option>
                        <option value="maintenance" ${amb?.status === 'maintenance' ? 'selected' : ''}>Maintenance</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Ambulance Type</label>
                    <select name="ambType" class="form-control">
                        <option value="basic" ${amb?.ambType === 'basic' ? 'selected' : ''}>Basic Life Support</option>
                        <option value="advanced" ${amb?.ambType === 'advanced' ? 'selected' : ''}>Advanced Life Support</option>
                        <option value="mobile" ${amb?.ambType === 'mobile' ? 'selected' : ''}>Mobile ICU</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Latitude</label>
                    <input type="number" name="latitude" step="0.0001" class="form-control" value="${amb?.latitude || 12.9716}">
                </div>
                <div class="form-group">
                    <label>Longitude</label>
                    <input type="number" name="longitude" step="0.0001" class="form-control" value="${amb?.longitude || 77.5946}">
                </div>
            </div>
            <div class="form-group">
                <label>Equipment / Notes</label>
                <textarea name="equipment" class="form-control">${amb?.equipment || ''}</textarea>
            </div>
        </form>
    `;
    openFormModal(amb ? 'Edit Ambulance' : 'Add Ambulance', form, `saveAmb()`, true);
}

function saveAmb() {
    const data = getFormData('ambForm');
    if (!data.vehicleNo) { APP.notify('Vehicle number required', 'error'); return; }
    data.speed = 0;
    data.lastUpdated = new Date().toISOString();
    if (data.latitude) data.latitude = parseFloat(data.latitude);
    if (data.longitude) data.longitude = parseFloat(data.longitude);
    if (data.id) {
        DB.update('ambulance', data.id, data);
        APP.notify('Ambulance updated', 'success');
    } else {
        DB.add('ambulance', data);
        APP.notify('Ambulance added', 'success');
    }
    renderAmbList();
    updateMapMarkers();
}

function editAmb(id) {
    const amb = DB.getById('ambulance', id);
    if (amb) showAmbForm(amb);
}

function deleteAmb(id) {
    confirmAction('Delete this ambulance?', () => {
        DB.delete('ambulance', id);
        APP.notify('Ambulance deleted', 'success');
        renderAmbList();
        updateMapMarkers();
    });
}

function updateAmbStatus(id) {
    const amb = DB.getById('ambulance', id);
    if (!amb) return;
    const statuses = ['available', 'on-duty', 'maintenance'];
    const nextIdx = (statuses.indexOf(amb.status) + 1) % statuses.length;
    DB.update('ambulance', id, { status: statuses[nextIdx], lastUpdated: new Date().toISOString() });
    APP.notify(`Status changed to ${statuses[nextIdx]}`, 'info');
    renderAmbList();
    updateMapMarkers();
}

function startAmbulanceTracking() {
    if (ambTrackingInterval) clearInterval(ambTrackingInterval);
    const updateDisplay = () => {
        const ambulances = DB.get('ambulance');
        const onDuty = ambulances.filter(a => a.status === 'on-duty');
        const coordsEl = document.getElementById('ambCoordDisplay');
        const updateEl = document.getElementById('ambLastUpdate');
        if (coordsEl) {
            if (onDuty.length > 0) {
                coordsEl.innerHTML = onDuty.map(a =>
                    `🚑 ${a.vehicleNo}: ${a.latitude?.toFixed(4) || 'N/A'}, ${a.longitude?.toFixed(4) || 'N/A'} | Speed: ${a.speed || 0} km/h`
                ).join(' &nbsp;|&nbsp; ');
            } else {
                coordsEl.innerHTML = 'No ambulances on duty. Add one and set status to "On Duty" to see live tracking.';
            }
        }
        if (updateEl) updateEl.textContent = 'Updated: ' + new Date().toLocaleTimeString();
        updateMapMarkers();
    };
    updateDisplay();
    ambTrackingInterval = setInterval(updateDisplay, 4000);
}

function simulateAmbulanceMovement() {
    const ambulances = DB.get('ambulance');
    const onDuty = ambulances.filter(a => a.status === 'on-duty');
    if (onDuty.length === 0) {
        APP.notify('No on-duty ambulances. Set one to On Duty first.', 'warning');
        return;
    }
    onDuty.forEach(a => {
        const lat = (a.latitude || 12.9716) + (Math.random() - 0.5) * 0.008;
        const lng = (a.longitude || 77.5946) + (Math.random() - 0.5) * 0.008;
        const speed = Math.round(15 + Math.random() * 65);
        DB.update('ambulance', a.id, {
            latitude: parseFloat(lat.toFixed(6)),
            longitude: parseFloat(lng.toFixed(6)),
            speed,
            lastUpdated: new Date().toISOString()
        });
    });
    APP.notify(`Updated ${onDuty.length} ambulance(s) position`, 'success');
    renderAmbList();
    updateMapMarkers();
}

function startTripFromAmb(ambId) {
    const amb = DB.getById('ambulance', ambId);
    if (!amb) return;
    showTripForm(amb);
}

function showTripForm(prefillAmb) {
    const ambulances = DB.get('ambulance').filter(a => a.status !== 'maintenance');
    const form = `
        <form id="tripForm">
            <div class="grid-2">
                <div class="form-group">
                    <label>Ambulance *</label>
                    <select name="ambulanceId" class="form-control" required>
                        <option value="">Select Ambulance</option>
                        ${ambulances.map(a => `<option value="${a.id}" ${prefillAmb?.id === a.id ? 'selected' : ''}>${a.vehicleNo} - ${a.driverName || 'No driver'}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Driver Name</label>
                    <input type="text" name="driverName" class="form-control" value="${prefillAmb?.driverName || ''}">
                </div>
                <div class="form-group">
                    <label>Patient Name *</label>
                    <input type="text" name="patientName" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Patient Age</label>
                    <input type="number" name="patientAge" class="form-control">
                </div>
                <div class="form-group">
                    <label>Pickup Location *</label>
                    <input type="text" name="pickupLocation" class="form-control" placeholder="Address or landmark" required>
                </div>
                <div class="form-group">
                    <label>Drop Location *</label>
                    <input type="text" name="dropLocation" class="form-control" placeholder="Hospital or destination" required>
                </div>
                <div class="form-group">
                    <label>Total Kilometers *</label>
                    <input type="number" name="kilometers" class="form-control" step="0.1" min="0" placeholder="e.g. 12.5" required>
                </div>
                <div class="form-group">
                    <label>Trip Type</label>
                    <select name="tripType" class="form-control">
                        <option value="emergency">Emergency</option>
                        <option value="transfer">Patient Transfer</option>
                        <option value="discharge">Discharge Drop</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Fare Amount (₹)</label>
                    <input type="number" name="fare" class="form-control" min="0" value="0">
                </div>
                <div class="form-group">
                    <label>Payment Mode</label>
                    <select name="paymentMode" class="form-control">
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="online">Online</option>
                        <option value="free">Free/Charity</option>
                        <option value="pending">Pending</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Notes / Observations</label>
                <textarea name="notes" class="form-control" rows="2"></textarea>
            </div>
        </form>
    `;
    openFormModal('Record Ambulance Trip', form, `saveTrip()`, true);
}

function saveTrip() {
    const data = getFormData('tripForm');
    if (!data.ambulanceId || !data.patientName || !data.pickupLocation || !data.dropLocation || !data.kilometers) {
        APP.notify('Please fill required fields', 'error'); return;
    }
    const amb = DB.getById('ambulance', data.ambulanceId);
    if (amb) {
        data.vehicleNo = amb.vehicleNo;
        if (!data.driverName) data.driverName = amb.driverName || '';
        DB.update('ambulance', data.ambulanceId, { status: 'on-duty', lastUpdated: new Date().toISOString() });
    }
    data.status = 'completed';
    DB.add('ambulance_trips', data);
    APP.notify('Trip recorded successfully', 'success');
    renderTripList();
    renderAmbList();
    updateMapMarkers();
}

function renderTripList() {
    const trips = DB.get('ambulance_trips');
    const tbody = document.getElementById('ambTripBody');
    if (!tbody) return;
    tbody.innerHTML = trips.slice().reverse().map(t => `
        <tr>
            <td>${APP.formatDateTime(t.createdAt)}</td>
            <td>${t.vehicleNo || '-'}</td>
            <td>${t.driverName || '-'}</td>
            <td><strong>${t.patientName}</strong>${t.patientAge ? ' ('+t.patientAge+')' : ''}</td>
            <td style="font-size:12px;">${t.pickupLocation} → ${t.dropLocation}</td>
            <td>${t.kilometers} km</td>
            <td><span class="badge ${t.status === 'completed' ? 'badge-success' : 'badge-warning'}">${t.status}</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewTrip('${t.id}')">View</button>
                <button class="btn btn-sm btn-danger" onclick="deleteTrip('${t.id}')">Del</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="8" class="empty-state">No trips recorded</td></tr>';
}

function viewTrip(id) {
    const t = DB.getById('ambulance_trips', id);
    if (!t) return;
    showModal(`
        <div class="modal-header">
            <h3>Trip - ${t.patientName}</h3>
            <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="grid-2">
            <div><strong>Vehicle:</strong> ${t.vehicleNo || '-'}</div>
            <div><strong>Driver:</strong> ${t.driverName || '-'}</div>
            <div><strong>Patient:</strong> ${t.patientName} ${t.patientAge ? '('+t.patientAge+')' : ''}</div>
            <div><strong>Date:</strong> ${APP.formatDateTime(t.createdAt)}</div>
            <div><strong>Pickup:</strong> ${t.pickupLocation}</div>
            <div><strong>Drop:</strong> ${t.dropLocation}</div>
            <div><strong>Kilometers:</strong> ${t.kilometers} km</div>
            <div><strong>Type:</strong> ${t.tripType || 'emergency'}</div>
            <div><strong>Fare:</strong> ₹${t.fare || 0}</div>
            <div><strong>Payment:</strong> ${t.paymentMode || 'cash'}</div>
        </div>
        ${t.notes ? `<div class="mt-4"><strong>Notes:</strong><br>${t.notes}</div>` : ''}
        <div class="modal-footer"><button class="btn btn-primary" onclick="this.closest('.modal').remove()">Close</button></div>
    `);
}

function deleteTrip(id) {
    confirmAction('Delete this trip?', () => {
        DB.delete('ambulance_trips', id);
        APP.notify('Trip deleted', 'success');
        renderTripList();
    });
}
