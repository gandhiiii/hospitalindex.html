let invView = 'items';

function renderInventory(container) {
    container.innerHTML = `
        <div class="tabs" style="margin-bottom:16px;">
            <button class="tab-btn active" onclick="switchInvView('items',this)">📦 All Items</button>
            <button class="tab-btn" onclick="switchInvView('dept',this)">🏢 By Department</button>
        </div>
        <div id="invContent">
            ${renderInvItemsTab()}
        </div>
    `;
    setTimeout(() => renderInvList(), 50);
}

function switchInvView(view, btn) {
    invView = view;
    document.querySelectorAll('#pageContent .tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const content = document.getElementById('invContent');
    if (!content) return;
    if (view === 'items') {
        content.innerHTML = renderInvItemsTab();
        setTimeout(() => renderInvList(), 50);
    } else if (view === 'dept') {
        content.innerHTML = renderInvDeptTab();
        setTimeout(() => renderInvDeptView(), 50);
    }
}

function renderInvItemsTab() {
    return `
        <div class="flex-between mb-4" style="flex-wrap:wrap;gap:8px;">
            <div style="display:flex;gap:8px;flex:2;min-width:200px;align-items:center;flex-wrap:wrap;">
                <input type="text" class="form-control" id="invSearch" placeholder="Search name, category or barcode..." oninput="renderInvList()" style="flex:1;min-width:140px;max-width:300px;">
                <div style="display:flex;align-items:center;gap:4px;">
                    <span style="font-size:13px;font-weight:600;white-space:nowrap;">🏢 Dept:</span>
                    <span style="width:160px;">${deptDropdown('invDeptDropdown', invDeptFilter)}</span>
                </div>
                <button class="btn btn-sm btn-outline" onclick="setInvDeptFilter('')" style="${!invDeptFilter ? 'display:none;' : ''}">✕ Clear</button>
            </div>
            <button class="btn btn-primary btn-sm" onclick="showInvForm()">+ Add Item</button>
        </div>

        <div class="card" style="padding:12px 16px;margin-bottom:16px;background:#f0f6ff;border:1px solid #c2d7f8;">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                <span style="font-weight:600;font-size:14px;">📷 Scan Barcode</span>
                <input type="text" id="barcodeScanInput" class="form-control" placeholder="Scan or type barcode..." style="flex:1;min-width:180px;"
                    onkeydown="if(event.key==='Enter')handleBarcodeScan()">
                <button class="btn btn-primary btn-sm" onclick="handleBarcodeScan()">Find</button>
                <span id="barcodeScanResult" style="font-size:13px;color:var(--gray);"></span>
            </div>
        </div>

        <div class="flex-between mb-2" style="align-items:center;">
            <div id="invDeptFilters" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
        </div>

        <div class="grid-4 mb-4" id="invStats"></div>

        <div class="card">
            <div class="table-responsive">
                <table>
                    <thead><tr>
                        <th>Barcode</th><th>Item Name</th><th>Category</th><th>Department</th><th>Qty</th>
                        <th>Unit Price</th><th>Value</th><th>Expiry</th><th>Lifecycle</th><th>Status</th><th>Actions</th>
                    </tr></thead>
                    <tbody id="invTableBody"></tbody>
                </table>
            </div>
        </div>
    `;
}

let invDeptFilter = '';

function renderInvDeptFilters() {
    const items = DB.get('inventory');
    const depts = [...new Set(items.map(i => i.department).filter(Boolean))];
    const el = document.getElementById('invDeptFilters');
    if (!el) return;
    let html = `<button class="btn btn-sm ${!invDeptFilter ? 'btn-primary' : 'btn-outline'}" onclick="setInvDeptFilter('')">All</button>`;
    depts.forEach(d => {
        html += `<button class="btn btn-sm ${invDeptFilter === d ? 'btn-primary' : 'btn-outline'}" onclick="setInvDeptFilter('${d}')">${d}</button>`;
    });
    el.innerHTML = html;
}

function setInvDeptFilter(dept) {
    invDeptFilter = dept;
    renderInvDeptFilters();
    renderInvList();
}

function renderInvList() {
    const items = DB.get('inventory');
    const search = (document.getElementById('invSearch')?.value || '').toLowerCase();

    // Sync dropdown value with current filter
    const deptDropdown = document.querySelector('[name="invDeptDropdown"]');
    if (deptDropdown) {
        if (!deptDropdown._listener) {
            deptDropdown.addEventListener('change', function() {
                setInvDeptFilter(this.value);
            });
            deptDropdown._listener = true;
        }
        if (deptDropdown.value !== invDeptFilter) {
            deptDropdown.value = invDeptFilter || '';
        }
    }

    let filtered = items.filter(i =>
        i.name.toLowerCase().includes(search) ||
        i.category.toLowerCase().includes(search) ||
        (i.barcode || '').toLowerCase().includes(search)
    );
    if (invDeptFilter) {
        filtered = filtered.filter(i => i.department === invDeptFilter);
    }

    renderInvDeptFilters();

    const total = items.length;
    const lowStock = items.filter(i => parseInt(i.quantity) < 10).length;
    const expiring = items.filter(i => {
        if (!i.expiryDate) return false;
        const days = APP.daysBetween(new Date().toISOString(), i.expiryDate);
        return days >= 0 && days <= 30;
    }).length;
    const outOfStock = items.filter(i => parseInt(i.quantity) === 0).length;

    const statsEl = document.getElementById('invStats');
    if (statsEl) {
        statsEl.innerHTML = `
            <div class="stat-card" style="border-left-color:var(--primary)"><div class="stat-value">${total}</div><div class="stat-label">Total Items</div></div>
            <div class="stat-card" style="border-left-color:var(--warning)"><div class="stat-value">${lowStock}</div><div class="stat-label">Low Stock (<10)</div></div>
            <div class="stat-card" style="border-left-color:var(--danger)"><div class="stat-value">${expiring}</div><div class="stat-label">Expiring in 30d</div></div>
            <div class="stat-card" style="border-left-color:var(--gray)"><div class="stat-value">${outOfStock}</div><div class="stat-label">Out of Stock</div></div>
        `;
    }

    const tbody = document.getElementById('invTableBody');
    if (!tbody) return;

    tbody.innerHTML = filtered.map(i => {
        const qty = parseInt(i.quantity);
        const lifecyclePct = (i.purchaseDate && i.expiryDate) ? APP.lifecyclePercent(i.purchaseDate, i.expiryDate) : 0;
        const lifecycleColor = APP.lifecycleColor(lifecyclePct);
        const status = qty === 0 ? 'out-of-stock' : (qty < 10 ? 'low-stock' : 'in-stock');
        const barcode = i.barcode || i.id.slice(-10);

        return `<tr>
            <td>
                <div class="barcode-cell" style="cursor:pointer;" onclick="printBarcode('${i.id}')" title="Click to print barcode">
                    <svg class="barcode-svg" id="barcode_${i.id}" style="width:100px;height:28px;"></svg>
                    <div style="font-size:9px;color:var(--gray);text-align:center;">${barcode}</div>
                </div>
            </td>
            <td><strong>${i.name}</strong></td>
            <td>${i.category}</td>
            <td><span class="badge badge-info">${i.department || 'All'}</span></td>
            <td>${qty} ${i.unit || 'pcs'}</td>
            <td style="font-size:12px;">${i.price ? '₹' + parseFloat(i.price).toFixed(2) : '-'}</td>
            <td style="font-size:12px;font-weight:600;">${i.price ? '₹' + (qty * parseFloat(i.price)).toFixed(2) : '-'}</td>
            <td style="font-size:12px;">${i.expiryDate ? APP.formatDate(i.expiryDate) : '-'}
                ${i.expiryDate && APP.daysBetween(new Date().toISOString(), i.expiryDate) <= 30 && APP.daysBetween(new Date().toISOString(), i.expiryDate) >= 0 ? ' ⚠️' : ''}
                ${i.expiryDate && APP.daysBetween(new Date().toISOString(), i.expiryDate) < 0 ? ' ❌' : ''}
            </td>
            <td>
                <div class="progress-bar">
                    <div class="progress-fill ${lifecycleColor}" style="width:${lifecyclePct}%"></div>
                </div>
                <div class="progress-label">${lifecyclePct}% used</div>
            </td>
            <td><span class="badge ${status === 'in-stock' ? 'badge-success' : status === 'low-stock' ? 'badge-warning' : 'badge-danger'}">${status.replace('-', ' ')}</span></td>
            <td>
                <button class="btn btn-sm btn-success" onclick="receiveInvStock('${i.id}')">Receive</button>
                <button class="btn btn-sm btn-primary" onclick="editInv('${i.id}')">Edit</button>
                <button class="btn btn-sm btn-info" onclick="printBarcode('${i.id}')">🏷️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteInv('${i.id}')">Del</button>
            </td>
        </tr>`;
    }).join('') || '<tr><td colspan="11" class="empty-state">No inventory items</td></tr>';

    setTimeout(generateBarcodeSvgs, 100);
}

/* ─── Department Inventory View ─── */

function renderInvDeptTab() {
    return `
        <div class="flex-between mb-4">
            <div>
                <h3 style="margin:0;">🏢 Department-wise Inventory</h3>
                <span style="font-size:13px;color:var(--gray);">View inventory items grouped by department</span>
            </div>
            <div style="display:flex;gap:6px;align-items:center;">
                <span style="font-size:13px;font-weight:600;white-space:nowrap;">🔍 Jump to:</span>
                <span style="width:180px;">${deptDropdown('invDeptJump', '')}</span>
            </div>
        </div>
        <div id="invDeptView"></div>
    `;
}

function renderInvDeptView() {
    const items = DB.get('inventory');

    // Jump-to-department dropdown
    const jumpDropdown = document.querySelector('[name="invDeptJump"]');
    if (jumpDropdown && !jumpDropdown._listener) {
        jumpDropdown.addEventListener('change', function() {
            if (this.value) {
                const deptSection = document.getElementById('deptSection_' + this.value.replace(/\s+/g, '_'));
                if (deptSection) deptSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        jumpDropdown._listener = true;
    }

    const deptMap = {};
    items.forEach(i => {
        const d = i.department || 'Unassigned';
        if (!deptMap[d]) deptMap[d] = [];
        deptMap[d].push(i);
    });

    const depts = Object.keys(deptMap).sort();
    const el = document.getElementById('invDeptView');
    if (!el) return;
    if (depts.length === 0) {
        el.innerHTML = '<div class="card"><div class="empty-state">No inventory assigned to departments yet. Edit an item to assign a department.</div></div>';
        return;
    }
    el.innerHTML = depts.map(d => {
        const data = deptMap[d];
        const totalItems = data.length;
        const totalQty = data.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0);
        const totalValue = data.reduce((s, i) => s + ((parseInt(i.quantity) || 0) * (parseFloat(i.price) || 0)), 0);
        return `<div class="card" style="margin-bottom:12px;" id="deptSection_${d.replace(/\s+/g, '_')}">
            <div class="card-header">
                <div class="flex-between">
                    <h3>🏢 ${d}</h3>
                    <span style="font-size:13px;color:var(--gray);">${totalItems} items | ${totalQty} qty | ₹${totalValue.toFixed(2)} value</span>
                </div>
            </div>
            ${totalItems === 0 ? '<div class="empty-state">No items assigned</div>' :
            `<div class="table-responsive">
                <table>
                    <thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Unit Price</th><th>Value</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>${data.map(i => {
                        const qty = parseInt(i.quantity);
                        const price = parseFloat(i.price) || 0;
                        const value = qty * price;
                        const status = qty === 0 ? 'out-of-stock' : (qty < 10 ? 'low-stock' : 'in-stock');
                        return `<tr>
                            <td><strong>${i.name}</strong></td>
                            <td>${i.category}</td>
                            <td>${qty} ${i.unit || 'pcs'}</td>
                            <td>${price ? '₹' + price.toFixed(2) : '-'}</td>
                            <td style="font-weight:600;">${value ? '₹' + value.toFixed(2) : '-'}</td>
                            <td><span class="badge ${status === 'in-stock' ? 'badge-success' : status === 'low-stock' ? 'badge-warning' : 'badge-danger'}">${status.replace('-', ' ')}</span></td>
                            <td><button class="btn btn-sm btn-success" onclick="receiveInvStock('${i.id}')">Receive</button> <button class="btn btn-sm btn-primary" onclick="editInv('${i.id}')">Edit</button></td>
                        </tr>`;
                    }).join('')}</tbody>
                </table>
            </div>`}
        </div>`;
    }).join('');
}

function receiveInvStock(id) {
    const item = DB.getById('inventory', id);
    if (!item) return;
    const modal = showModal(`
        <div class="modal-header">
            <h3>📥 Receive Stock — ${item.name}</h3>
            <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div style="display:flex;gap:16px;margin-bottom:16px;padding:12px;background:var(--bg);border-radius:8px;">
            <div>
                <div style="font-size:13px;color:var(--gray);">Current Stock: <strong>${item.quantity} ${item.unit || 'pcs'}</strong></div>
                <div style="font-size:13px;color:var(--gray);">Current Price: ${item.price ? '₹' + parseFloat(item.price).toFixed(2) : 'Not set'}</div>
            </div>
        </div>
        <div class="grid-2">
            <div class="form-group">
                <label>Quantity Received *</label>
                <input type="number" id="recQty" class="form-control" min="1" value="1">
            </div>
            <div class="form-group">
                <label>Unit Price (₹) *</label>
                <input type="number" id="recPrice" class="form-control" step="0.01" min="0" value="${item.price || ''}" placeholder="Cost per unit">
            </div>
        </div>
        <div class="form-group">
            <label>Supplier / Source</label>
            <input type="text" id="recSource" class="form-control" placeholder="e.g. Vendor name (optional)">
        </div>
        <button class="btn btn-success btn-lg" style="width:100%;margin-top:8px;" onclick="saveReceiveStock('${id}')">✅ Record Stock Receipt</button>
    `, false);
}

function saveReceiveStock(id) {
    const item = DB.getById('inventory', id);
    if (!item) return;
    const qty = parseInt(document.getElementById('recQty').value);
    const price = parseFloat(document.getElementById('recPrice').value);
    const source = document.getElementById('recSource').value || '';

    if (!qty || qty < 1) { APP.notify('Enter valid quantity', 'error'); return; }
    if (!price || price < 0) { APP.notify('Enter a valid unit price', 'error'); return; }

    const oldQty = parseInt(item.quantity) || 0;
    const oldPrice = parseFloat(item.price) || 0;
    const newQty = oldQty + qty;
    // Weighted average price
    const totalValue = (oldQty * oldPrice) + (qty * price);
    const avgPrice = newQty > 0 ? totalValue / newQty : price;

    DB.update('inventory', id, { quantity: newQty, price: avgPrice.toFixed(2) });

    // Record inbound transaction for reference
    DB.add('inventory_receipts', {
        itemId: id, itemName: item.name, quantity: qty, unitPrice: price, total: qty * price, source,
        department: item.department || ''
    });

    APP.notify(`Received ${qty} ${item.unit || 'pcs'} of ${item.name} (₹${(qty * price).toFixed(2)})`, 'success');
    renderInvList();
    document.querySelector('.modal.active')?.remove();
}

function generateBarcodeSvgs() {
    if (typeof JsBarcode === 'undefined') return;
    document.querySelectorAll('.barcode-svg').forEach(el => {
        const id = el.id.replace('barcode_', '');
        const item = DB.getById('inventory', id);
        if (item) {
            const code = item.barcode || item.id.slice(-10);
            try {
                JsBarcode(el, code, {
                    format: 'CODE128', width: 1.2, height: 24,
                    displayValue: false, background: 'transparent', margin: 0
                });
            } catch(e) {}
        }
    });
}

function handleBarcodeScan() {
    const input = document.getElementById('barcodeScanInput');
    const result = document.getElementById('barcodeScanResult');
    const code = (input?.value || '').trim();
    if (!code) { result.textContent = 'Enter or scan a barcode'; return; }

    const items = DB.get('inventory');
    const item = items.find(i => (i.barcode || i.id.slice(-10)) === code);
    if (item) {
        result.innerHTML = `✅ Found: <strong>${item.name}</strong> (Qty: ${item.quantity}) <button class="btn btn-sm btn-primary" onclick="editInv('${item.id}');document.getElementById('barcodeScanResult').textContent=''">Edit</button>`;
        input.value = '';
    } else {
        result.innerHTML = `❌ No item found with barcode "${code}"`;
    }
}

function showInvForm(item) {
    const depts = DB.get('departments');
    const categories = ['Medical Equipment', 'Medicine', 'Surgical', 'Laboratory', 'Office Supplies', 'Cleaning', 'Bedding', 'Food', 'Other'];
    const barcode = item?.barcode || item?.id?.slice(-10) || '';
    const isNew = !item;

    const form = `
        <form id="invForm">
            <input type="hidden" name="id" value="${item?.id || ''}">
            <div class="grid-2">
                <div class="form-group">
                    <label>Item Name *</label>
                    <input type="text" name="name" class="form-control" value="${item?.name || ''}" required>
                </div>
                <div class="form-group">
                    <label>Category *</label>
                    <select name="category" class="form-control" required>
                        <option value="">Select</option>
                        ${categories.map(c => `<option value="${c}" ${item?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Barcode / SKU</label>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <input type="text" name="barcode" class="form-control" value="${barcode}" placeholder="Auto-generated" style="font-family:monospace;">
                        <button type="button" class="btn btn-sm btn-primary" onclick="generateBarcodeInput()">Generate</button>
                    </div>
                    <div id="barcodePreview" style="margin-top:4px;"></div>
                </div>
                <div class="form-group">
                    <label>Quantity *</label>
                    <input type="number" name="quantity" class="form-control" value="${item?.quantity || 0}" min="0" required>
                </div>
                <div class="form-group">
                    <label>Unit</label>
                    <select name="unit" class="form-control">
                        <option value="pcs" ${item?.unit === 'pcs' ? 'selected' : ''}>Pieces</option>
                        <option value="box" ${item?.unit === 'box' ? 'selected' : ''}>Box</option>
                        <option value="kg" ${item?.unit === 'kg' ? 'selected' : ''}>Kg</option>
                        <option value="ltr" ${item?.unit === 'ltr' ? 'selected' : ''}>Litre</option>
                        <option value="pack" ${item?.unit === 'pack' ? 'selected' : ''}>Pack</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Unit Price (₹)</label>
                    <input type="number" name="price" class="form-control" step="0.01" min="0" value="${item?.price || ''}" placeholder="Cost per unit">
                </div>
                <div class="form-group">
                    <label>Purchase Date</label>
                    <input type="date" name="purchaseDate" class="form-control" value="${item?.purchaseDate ? item.purchaseDate.split('T')[0] : ''}">
                </div>
                <div class="form-group">
                    <label>Expiry Date</label>
                    <input type="date" name="expiryDate" class="form-control" value="${item?.expiryDate ? item.expiryDate.split('T')[0] : ''}">
                </div>
                <div class="form-group">
                    <label>Warranty Until</label>
                    <input type="date" name="warrantyDate" class="form-control" value="${item?.warrantyDate ? item.warrantyDate.split('T')[0] : ''}">
                </div>
                <div class="form-group">
                    <label>Supplier</label>
                    <input type="text" name="supplier" class="form-control" value="${item?.supplier || ''}">
                </div>
                <div class="form-group">
                    <label>Department</label>
                    <select name="department" class="form-control">
                        <option value="">All</option>
                        ${depts.map(d => `<option value="${d.name}" ${item?.department === d.name ? 'selected' : ''}>${d.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Location / Rack</label>
                    <input type="text" name="location" class="form-control" value="${item?.location || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea name="notes" class="form-control">${item?.notes || ''}</textarea>
            </div>
        </form>
    `;
    openFormModal(item ? 'Edit Inventory Item' : 'Add Inventory Item', form, `saveInv()`, true);
    setTimeout(() => {
        const bcInput = document.querySelector('[name="barcode"]');
        if (bcInput) { bcInput.oninput = () => previewBarcode(); previewBarcode(); }
    }, 200);
}

function generateBarcodeInput() {
    const input = document.querySelector('[name="barcode"]');
    if (!input) return;
    const code = 'HMS' + Date.now().toString(36).slice(-6).toUpperCase();
    input.value = code;
    previewBarcode();
}

function previewBarcode() {
    const input = document.querySelector('[name="barcode"]');
    const preview = document.getElementById('barcodePreview');
    if (!input || !preview) return;
    const code = input.value.trim();
    preview.innerHTML = '';
    if (code && typeof JsBarcode !== 'undefined') {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.width = '160px'; svg.style.height = '36px';
        preview.appendChild(svg);
        try { JsBarcode(svg, code, { format: 'CODE128', width: 1.5, height: 30, displayValue: false, margin: 0 }); }
        catch(e) {}
        preview.innerHTML += `<div style="font-size:10px;color:var(--gray);font-family:monospace;text-align:center;">${code}</div>`;
    }
}

function saveInv() {
    const form = document.getElementById('invForm');
    const data = {};
    form.querySelectorAll('[name]').forEach(el => { data[el.name] = el.value; });
    if (!data.name || !data.category) { APP.notify('Name and Category required', 'error'); return; }

    if (!data.barcode) {
        data.barcode = 'HMS' + Date.now().toString(36).slice(-6).toUpperCase();
    }

    if (data.id) {
        DB.update('inventory', data.id, data);
        APP.notify('Item updated with barcode: ' + data.barcode, 'success');
    } else {
        DB.add('inventory', data);
        APP.notify('Item added! Barcode: ' + data.barcode, 'success');
    }
    renderInvList();
}

function editInv(id) {
    const item = DB.getById('inventory', id);
    if (item) showInvForm(item);
}

function deleteInv(id) {
    confirmAction('Delete this item?', () => {
        DB.delete('inventory', id);
        APP.notify('Item deleted', 'success');
        renderInvList();
    });
}

function printBarcode(id) {
    const item = DB.getById('inventory', id);
    if (!item) return;
    const code = item.barcode || item.id.slice(-10);

    const win = window.open('', '_blank', 'width=300,height=200');
    win.document.write(`
        <html><head>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
        <style>body{text-align:center;padding:20px;font-family:Arial;margin:0;}
        .label{border:1px dashed #999;padding:12px;display:inline-block;margin:10px;}
        .name{font-size:13px;margin-bottom:4px;font-weight:600;}
        .code{font-size:10px;color:#666;font-family:monospace;margin-top:2px;}
        @media print{body{padding:0;}.label{border:none;}}
        <\/style></head><body>
        <div class="label">
            <div class="name">${item.name}</div>
            <svg id="bcPrint" style="width:200px;height:40px;"></svg>
            <div class="code">${code}</div>
            <div style="font-size:10px;color:#999;">${item.category} | ${item.location || ''}</div>
        </div>
        <script>
            try { JsBarcode(document.getElementById('bcPrint'), '${code}', {format:'CODE128',width:1.8,height:35,displayValue:false,margin:0}); } catch(e){}
            setTimeout(() => { window.print(); window.close(); }, 500);
        <\/script>
        </body></html>
    `);
    win.document.close();
}
