// Materials Management JavaScript for Admin Settings
// Handles materials tab with stock, suppliers, locations, and transactions

let materialsData = [];
let suppliersData = [];
let locationsData = [];
let materialTypesData = [];
let transactionsData = [];

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initMaterialsTab() {
    await Promise.all([
        loadMaterialsStats(),
        loadMaterialTypes(),
        loadSuppliersData(),
        loadStorageLocationsData()
    ]);
    await loadMaterialsData();
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        const container = document.getElementById('material-type-container');
        if (container && !container.contains(e.target)) {
            hideMaterialTypeDropdown();
        }
    });
}

// ============================================================================
// MATERIALS SUBTAB NAVIGATION
// ============================================================================

function switchMaterialsSubtab(subtab) {
    // Update buttons
    document.querySelectorAll('.materials-subtab').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Update content
    document.querySelectorAll('.materials-subtab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`materials-subtab-${subtab}`).classList.add('active');

    // Load data for the subtab
    switch(subtab) {
        case 'stock':
            loadMaterialsData();
            break;
        case 'types':
            loadMaterialTypesTable();
            break;
        case 'suppliers':
            renderSuppliersTable();
            break;
        case 'locations':
            renderLocationsGrid();
            break;
        case 'transactions':
            loadTransactionsData();
            break;
    }
}

// ============================================================================
// LOAD DATA
// ============================================================================

async function loadMaterialsStats() {
    try {
        const response = await api.get('/materials/stats');
        if (response.success) {
            const stats = response.stats;
            document.getElementById('stat-total-items').textContent = stats.total_items || 0;
            document.getElementById('stat-material-types').textContent = stats.material_types || 0;
            document.getElementById('stat-suppliers').textContent = stats.active_suppliers || 0;
            document.getElementById('stat-total-value').textContent = '€' + (parseFloat(stats.total_value) || 0).toLocaleString();
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadMaterialTypes() {
    try {
        console.log('loadMaterialTypes called');
        const response = await api.get('/materials/types');
        console.log('loadMaterialTypes response:', response);
        if (response.success) {
            materialTypesData = response.types || [];
            console.log('materialTypesData loaded:', materialTypesData.length, 'items');
            populateMaterialTypeSelect();
        }
    } catch (error) {
        console.error('Error loading material types:', error);
        // Fallback to basic types
        materialTypesData = [
            { name: 'Aluminum 6061', category: 'metal' },
            { name: 'Aluminum 7075', category: 'metal' },
            { name: 'Steel 1018', category: 'metal' },
            { name: 'Steel 4140', category: 'metal' },
            { name: 'Stainless Steel 304', category: 'metal' },
            { name: 'Stainless Steel 316', category: 'metal' },
            { name: 'Brass C360', category: 'metal' },
            { name: 'Copper C101', category: 'metal' },
            { name: 'POM (Delrin)', category: 'plastic' },
            { name: 'PEEK', category: 'plastic' },
            { name: 'Nylon 6', category: 'plastic' },
            { name: 'PTFE (Teflon)', category: 'plastic' }
        ];
        populateMaterialTypeSelect();
    }
}

function populateMaterialTypeSelect() {
    const filterSelect = document.getElementById('filter-material-type');
    
    // Populate the searchable dropdown
    renderMaterialTypeDropdown();
    
    // Populate filter dropdown
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">All Types</option>';
        const uniqueTypes = [...new Set(materialTypesData.map(t => t.name))];
        uniqueTypes.forEach(type => {
            filterSelect.innerHTML += `<option value="${type}">${type}</option>`;
        });
    }
}

function renderMaterialTypeDropdown(filter = '') {
    const dropdown = document.getElementById('material-type-dropdown');
    if (!dropdown) return;
    
    const searchTerm = filter.toLowerCase();
    const filtered = materialTypesData.filter(type => {
        // Search by name
        if (type.name.toLowerCase().includes(searchTerm)) return true;
        // Search by category
        if (type.category && type.category.toLowerCase().includes(searchTerm)) return true;
        // Search by aliases
        if (type.aliases) {
            const aliasArray = Array.isArray(type.aliases) ? type.aliases : (type.aliases || '').split(',');
            return aliasArray.some(alias => alias.trim().toLowerCase().includes(searchTerm));
        }
        return false;
    });
    
    let html = '';
    
    // Group by category
    const metals = filtered.filter(t => t.category === 'metal');
    const plastics = filtered.filter(t => t.category === 'plastic');
    const others = filtered.filter(t => t.category !== 'metal' && t.category !== 'plastic');
    
    if (metals.length > 0) {
        metals.forEach(type => {
            html += `<div class="dropdown-item" onclick="selectMaterialType('${type.name}')">
                <span class="item-name">${type.name}</span>
                <span class="item-category">Metal</span>
            </div>`;
        });
    }
    
    if (plastics.length > 0) {
        plastics.forEach(type => {
            html += `<div class="dropdown-item" onclick="selectMaterialType('${type.name}')">
                <span class="item-name">${type.name}</span>
                <span class="item-category">Plastic</span>
            </div>`;
        });
    }
    
    if (others.length > 0) {
        others.forEach(type => {
            html += `<div class="dropdown-item" onclick="selectMaterialType('${type.name}')">
                <span class="item-name">${type.name}</span>
                <span class="item-category">${type.category || 'Other'}</span>
            </div>`;
        });
    }
    
    // Add option to create new type if search doesn't match exactly
    const exactMatch = materialTypesData.some(t => t.name.toLowerCase() === searchTerm);
    if (searchTerm && !exactMatch) {
        html += `<div class="dropdown-item add-new" onclick="addNewMaterialType('${filter}')">
            ➕ Add new type: "${filter}"
        </div>`;
    }
    
    if (!html && !searchTerm) {
        html = '<div class="dropdown-item" style="color: #666; cursor: default;">Start typing to search...</div>';
    } else if (!html) {
        html = `<div class="dropdown-item add-new" onclick="addNewMaterialType('${filter}')">
            ➕ Add new type: "${filter}"
        </div>`;
    }
    
    dropdown.innerHTML = html;
}

function showMaterialTypeDropdown() {
    const dropdown = document.getElementById('material-type-dropdown');
    if (dropdown) {
        dropdown.style.display = 'block';
        renderMaterialTypeDropdown(document.getElementById('new-material-type-search').value);
    }
}

function hideMaterialTypeDropdown() {
    const dropdown = document.getElementById('material-type-dropdown');
    if (dropdown) {
        setTimeout(() => { dropdown.style.display = 'none'; }, 200);
    }
}

function filterMaterialTypes() {
    const searchValue = document.getElementById('new-material-type-search').value;
    console.log('filterMaterialTypes called, searchValue:', searchValue);
    console.log('materialTypesData:', materialTypesData);
    // Also update the hidden field as user types
    document.getElementById('new-material-type').value = searchValue;
    renderMaterialTypeDropdown(searchValue);
    showMaterialTypeDropdown();
}

function selectMaterialType(typeName) {
    document.getElementById('new-material-type-search').value = typeName;
    document.getElementById('new-material-type').value = typeName;
    hideMaterialTypeDropdown();
}

async function addNewMaterialType(typeName) {
    const category = prompt(`Enter category for "${typeName}" (metal, plastic, composite):`, 'metal');
    if (!category) return;
    
    try {
        const response = await api.post('/materials/types', {
            name: typeName,
            category: category.toLowerCase()
        });
        
        if (response.success) {
            // Add to local data
            materialTypesData.push({ name: typeName, category: category.toLowerCase() });
            selectMaterialType(typeName);
            alert(`Material type "${typeName}" added successfully!`);
        } else {
            alert(response.message || 'Error adding material type');
        }
    } catch (error) {
        console.error('Error adding material type:', error);
        // Even if API fails, allow using the custom type for this session
        selectMaterialType(typeName);
    }
}

async function loadMaterialsData() {
    try {
        const response = await api.get('/materials');
        if (response.success) {
            materialsData = response.materials || [];
            renderMaterialsTable();
            populateMaterialSelects();
        }
    } catch (error) {
        console.error('Error loading materials:', error);
        document.getElementById('materialsTableBody').innerHTML = 
            '<tr><td colspan="8" style="text-align: center; color: #dc3545;">Error loading materials</td></tr>';
    }
}

async function loadSuppliersData() {
    try {
        const response = await api.get('/suppliers');
        if (response.success) {
            suppliersData = response.suppliers || [];
            populateSupplierSelect();
        }
    } catch (error) {
        console.error('Error loading suppliers:', error);
    }
}

async function loadStorageLocationsData() {
    try {
        const response = await api.get('/storage-locations');
        if (response.success) {
            locationsData = response.locations || [];
            populateLocationSelect();
        }
    } catch (error) {
        console.error('Error loading locations:', error);
    }
}

async function loadTransactionsData() {
    try {
        const response = await api.get('/materials/transactions');
        if (response.success) {
            transactionsData = response.transactions || [];
            renderTransactionsTable();
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

// ============================================================================
// RENDER FUNCTIONS
// ============================================================================

function renderMaterialsTable() {
    const tbody = document.getElementById('materialsTableBody');
    
    if (!materialsData.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 40px;">No materials found. Add your first material!</td></tr>';
        return;
    }

    tbody.innerHTML = materialsData.map(material => {
        const stockPercent = material.reorder_level > 0 
            ? Math.min(100, (material.current_stock / (material.reorder_level * 2)) * 100) 
            : 100;
        const stockClass = stockPercent > 60 ? 'stock-high' : stockPercent > 30 ? 'stock-medium' : 'stock-low';
        const status = material.current_stock <= 0 ? 'out_of_stock' 
            : material.current_stock <= material.reorder_level ? 'low_stock' 
            : 'available';
        const dimensions = formatMaterialDimensions(material);
        const shapeName = formatShapeName(material.shape_type);

        return `
            <tr>
                <td>
                    <strong>${material.material_name || material.material_type}</strong>
                    ${material.notes ? `<br><small style="color: #666;">${material.notes.substring(0, 50)}${material.notes.length > 50 ? '...' : ''}</small>` : ''}
                </td>
                <td><span class="shape-badge">${shapeName}</span></td>
                <td>${dimensions}</td>
                <td>
                    <div class="stock-level">
                        <strong>${material.current_stock || 0}</strong>
                        <div class="stock-bar">
                            <div class="stock-fill ${stockClass}" style="width: ${stockPercent}%"></div>
                        </div>
                    </div>
                </td>
                <td>${material.location_code || '-'}</td>
                <td>${material.supplier_name || '-'}</td>
                <td><span class="status-${status}">${status.replace(/_/g, ' ').toUpperCase()}</span></td>
                <td>
                    <button class="btn btn-small" onclick="editMaterialItem(${material.id})" title="Edit">✏️</button>
                    <button class="btn btn-small" onclick="quickStockIn(${material.id})" title="Stock In" style="background: #4CAF50;">📥</button>
                    <button class="btn btn-small" onclick="quickStockOut(${material.id})" title="Stock Out" style="background: #2196F3;">📤</button>
                    <button class="btn btn-small btn-danger" onclick="deleteMaterialItem(${material.id})" title="Delete">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderSuppliersTable() {
    const tbody = document.getElementById('suppliersTableBody');
    
    if (!suppliersData.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 40px;">No suppliers found.</td></tr>';
        return;
    }

    tbody.innerHTML = suppliersData.map(supplier => `
        <tr>
            <td>
                <strong>${supplier.name}</strong>
                ${supplier.address ? `<br><small style="color: #666;">${supplier.address}, ${supplier.city || ''}</small>` : ''}
            </td>
            <td>
                ${supplier.contact_person || '-'}<br>
                <small style="color: #666;">${supplier.phone || ''}</small>
            </td>
            <td>${supplier.materials_count || 0} materials</td>
            <td>${supplier.lead_time_days || '-'} days</td>
            <td><span class="status-available">${supplier.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
                <button class="btn btn-small" onclick="editSupplierItem(${supplier.id})" title="Edit">✏️</button>
                <button class="btn btn-small btn-danger" onclick="deleteSupplierItem(${supplier.id})" title="Delete">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function renderLocationsGrid() {
    const grid = document.getElementById('locationsGrid');
    
    if (!locationsData.length) {
        grid.innerHTML = '<p style="text-align: center; color: #64748b; padding: 40px; grid-column: 1/-1;">No storage locations found.</p>';
        return;
    }

    grid.innerHTML = locationsData.map(location => `
        <div class="location-card">
            <h4>📍 ${location.code}</h4>
            <div class="location-info">
                ${location.zone ? `<div>Zone: ${location.zone}</div>` : ''}
                ${location.shelf ? `<div>Shelf: ${location.shelf}</div>` : ''}
                ${location.description ? `<div>${location.description}</div>` : ''}
            </div>
            <div class="location-count">
                ${location.materials_count || 0} materials · ${location.total_items || 0} items
            </div>
            <div style="margin-top: 10px;">
                <button class="btn btn-small" onclick="editLocationItem(${location.id})">✏️ Edit</button>
                <button class="btn btn-small btn-danger" onclick="deleteLocationItem(${location.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

function renderTransactionsTable() {
    const tbody = document.getElementById('transactionsTableBody');
    
    if (!transactionsData.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 40px;">No transactions found.</td></tr>';
        return;
    }

    tbody.innerHTML = transactionsData.map(tx => {
        const date = new Date(tx.created_at).toLocaleString();
        const typeClass = `transaction-${tx.transaction_type}`;
        const typeName = tx.transaction_type.replace(/_/g, ' ').toUpperCase();
        const quantity = tx.transaction_type === 'stock_in' ? `+${tx.quantity}` : 
                        tx.transaction_type === 'stock_out' ? `-${tx.quantity}` : tx.quantity;

        return `
            <tr>
                <td>${date}</td>
                <td>${tx.material_name}</td>
                <td><span class="transaction-type ${typeClass}">${typeName}</span></td>
                <td><strong>${quantity}</strong></td>
                <td>${tx.reference_number || '-'}</td>
                <td>${tx.performed_by_name || '-'}</td>
            </tr>
        `;
    }).join('');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatMaterialDimensions(material) {
    if (!material.shape_type) return '-';
    
    switch(material.shape_type) {
        case 'bar_round':
            return `⌀${material.diameter || 0}mm × ${material.length || 0}mm L`;
        case 'tube':
            return `⌀${material.diameter || 0}mm × ${material.thickness || 0}mm wall × ${material.length || 0}mm L`;
        case 'bar_square':
            return `${material.width || 0}×${material.width || 0}mm × ${material.length || 0}mm L`;
        case 'bar_hex':
            return `⬡${material.width || 0}mm × ${material.length || 0}mm L`;
        case 'plate':
        case 'sheet':
            return `${material.width || 0}×${material.length || 0}mm × ${material.thickness || 0}mm thick`;
        default:
            return `${material.length || 0}mm`;
    }
}

function formatShapeName(shapeType) {
    const names = {
        'bar_round': 'Round Bar',
        'bar_square': 'Square Bar',
        'bar_hex': 'Hex Bar',
        'plate': 'Plate',
        'tube': 'Tube',
        'sheet': 'Sheet'
    };
    return names[shapeType] || shapeType || 'N/A';
}

function updateDimensionFields() {
    const shapeType = document.getElementById('new-shape-type').value;
    
    // Hide all dimension fields
    document.querySelectorAll('.dimension-field').forEach(el => el.style.display = 'none');
    
    // Show relevant fields based on shape
    switch(shapeType) {
        case 'bar_round':
            document.getElementById('diameter-field').style.display = 'block';
            document.getElementById('length-field').style.display = 'block';
            break;
        case 'bar_square':
        case 'bar_hex':
            document.getElementById('width-field').style.display = 'block';
            document.getElementById('length-field').style.display = 'block';
            break;
        case 'plate':
        case 'sheet':
            document.getElementById('width-field').style.display = 'block';
            document.getElementById('length-field').style.display = 'block';
            document.getElementById('thickness-field').style.display = 'block';
            break;
        case 'tube':
            document.getElementById('diameter-field').style.display = 'block';
            document.getElementById('thickness-field').style.display = 'block';
            document.getElementById('length-field').style.display = 'block';
            break;
    }
}

function populateSupplierSelect() {
    const select = document.getElementById('new-supplier');
    if (select) {
        select.innerHTML = '<option value="">Select supplier...</option>';
        suppliersData.forEach(s => {
            select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
    }
}

function populateLocationSelect() {
    const select = document.getElementById('new-location');
    const filterSelect = document.getElementById('filter-location');
    
    if (select) {
        select.innerHTML = '<option value="">Select location...</option>';
        locationsData.forEach(l => {
            select.innerHTML += `<option value="${l.id}">${l.code} - ${l.zone || ''} ${l.shelf || ''}</option>`;
        });
    }
    
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">All Locations</option>';
        locationsData.forEach(l => {
            filterSelect.innerHTML += `<option value="${l.id}">${l.code}</option>`;
        });
    }
}

function populateMaterialSelects() {
    const stockInSelect = document.getElementById('stockin-material');
    const stockOutSelect = document.getElementById('stockout-material');
    
    const options = '<option value="">Select material...</option>' + 
        materialsData.map(m => `<option value="${m.id}">${m.material_name || m.material_type} (${m.current_stock || 0} in stock)</option>`).join('');
    
    if (stockInSelect) stockInSelect.innerHTML = options;
    if (stockOutSelect) stockOutSelect.innerHTML = options;
}

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================

function openAddMaterialModal() {
    document.getElementById('addMaterialForm').reset();
    document.getElementById('new-material-type-search').value = '';
    document.getElementById('new-material-type').value = '';
    document.querySelectorAll('.dimension-field').forEach(el => el.style.display = 'none');
    document.getElementById('add-material-modal').classList.add('active');
    populateSupplierSelect();
    populateLocationSelect();
}

function closeAddMaterialModal() {
    document.getElementById('add-material-modal').classList.remove('active');
}

function openAddSupplierModal() {
    document.getElementById('addSupplierForm').reset();
    document.getElementById('add-supplier-modal').classList.add('active');
}

function closeAddSupplierModal() {
    document.getElementById('add-supplier-modal').classList.remove('active');
}

function openAddLocationModal() {
    document.getElementById('addLocationForm').reset();
    document.getElementById('add-location-modal').classList.add('active');
}

function closeAddLocationModal() {
    document.getElementById('add-location-modal').classList.remove('active');
}

function openStockInModal() {
    document.getElementById('stockInForm').reset();
    document.getElementById('stock-in-modal').classList.add('active');
}

function closeStockInModal() {
    document.getElementById('stock-in-modal').classList.remove('active');
}

function openStockOutModal() {
    document.getElementById('stockOutForm').reset();
    document.getElementById('stock-out-modal').classList.add('active');
}

function closeStockOutModal() {
    document.getElementById('stock-out-modal').classList.remove('active');
}

// ============================================================================
// SAVE FUNCTIONS
// ============================================================================

async function saveNewMaterial(event) {
    event.preventDefault();
    
    console.log('saveNewMaterial called');
    
    // Validate required fields
    const materialType = document.getElementById('new-material-type').value;
    const shapeType = document.getElementById('new-shape-type').value;
    
    console.log('Material Type:', materialType);
    console.log('Shape Type:', shapeType);
    
    if (!materialType || !materialType.trim()) {
        alert('Please select or enter a material type');
        document.getElementById('new-material-type-search').focus();
        return;
    }
    
    if (!shapeType) {
        alert('Please select a shape type');
        document.getElementById('new-shape-type').focus();
        return;
    }
    
    // Helper to convert empty string to null for numeric fields
    const toNumberOrNull = (value) => value === '' || value === null || value === undefined ? null : parseFloat(value);
    const toIntOrNull = (value) => value === '' || value === null || value === undefined ? null : parseInt(value, 10);
    
    const materialData = {
        material_type: materialType.trim(),
        material_name: materialType.trim(),
        shape_type: shapeType,
        diameter: toNumberOrNull(document.getElementById('new-diameter').value),
        width: toNumberOrNull(document.getElementById('new-width').value),
        height: toNumberOrNull(document.getElementById('new-height').value),
        thickness: toNumberOrNull(document.getElementById('new-thickness').value),
        length: toNumberOrNull(document.getElementById('new-length').value),
        current_stock: toIntOrNull(document.getElementById('new-quantity').value) || 1,
        location_id: toIntOrNull(document.getElementById('new-location').value),
        supplier_id: toIntOrNull(document.getElementById('new-supplier').value),
        cost_per_unit: toNumberOrNull(document.getElementById('new-cost').value) || 0,
        reorder_level: toIntOrNull(document.getElementById('new-reorder').value) || 5,
        notes: document.getElementById('new-material-notes').value || null
    };

    console.log('Saving material data:', materialData);

    try {
        const response = await api.post('/materials', materialData);
        if (response.success) {
            closeAddMaterialModal();
            loadMaterialsData();
            loadMaterialsStats();
            alert('Material added successfully!');
        } else {
            alert(response.message || 'Error adding material');
        }
    } catch (error) {
        console.error('Error saving material:', error);
        alert('Error adding material: ' + (error.message || 'Unknown error'));
    }
}

async function saveNewSupplier(event) {
    event.preventDefault();
    
    const supplierData = {
        name: document.getElementById('supplier-name').value,
        contact_person: document.getElementById('supplier-contact').value,
        email: document.getElementById('supplier-email').value,
        phone: document.getElementById('supplier-phone').value,
        address: document.getElementById('supplier-address').value,
        city: document.getElementById('supplier-city').value,
        lead_time_days: document.getElementById('supplier-lead-time').value || 7,
        notes: document.getElementById('supplier-notes').value
    };

    try {
        const response = await api.post('/suppliers', supplierData);
        if (response.success) {
            closeAddSupplierModal();
            await loadSuppliersData();
            renderSuppliersTable();
            loadMaterialsStats();
            alert('Supplier added successfully!');
        } else {
            alert(response.message || 'Error adding supplier');
        }
    } catch (error) {
        console.error('Error saving supplier:', error);
        alert('Error adding supplier');
    }
}

async function saveNewLocation(event) {
    event.preventDefault();
    
    const locationData = {
        code: document.getElementById('location-code').value,
        zone: document.getElementById('location-zone').value,
        shelf: document.getElementById('location-shelf').value,
        capacity: document.getElementById('location-capacity').value || null,
        description: document.getElementById('location-description').value
    };

    try {
        const response = await api.post('/storage-locations', locationData);
        if (response.success) {
            closeAddLocationModal();
            await loadStorageLocationsData();
            renderLocationsGrid();
            alert('Location added successfully!');
        } else {
            alert(response.message || 'Error adding location');
        }
    } catch (error) {
        console.error('Error saving location:', error);
        alert('Error adding location');
    }
}

async function handleStockIn(event) {
    event.preventDefault();
    
    const materialId = document.getElementById('stockin-material').value;
    const data = {
        quantity: parseFloat(document.getElementById('stockin-quantity').value),
        reference_number: document.getElementById('stockin-reference').value,
        notes: document.getElementById('stockin-notes').value
    };

    try {
        const response = await api.post(`/materials/${materialId}/stock-in`, data);
        if (response.success) {
            closeStockInModal();
            loadMaterialsData();
            loadMaterialsStats();
            alert('Stock added successfully!');
        } else {
            alert(response.message || 'Error adding stock');
        }
    } catch (error) {
        console.error('Error in stock in:', error);
        alert('Error adding stock');
    }
}

async function handleStockOut(event) {
    event.preventDefault();
    
    const materialId = document.getElementById('stockout-material').value;
    const data = {
        quantity: parseFloat(document.getElementById('stockout-quantity').value),
        reference_number: document.getElementById('stockout-reference').value,
        notes: document.getElementById('stockout-notes').value
    };

    try {
        const response = await api.post(`/materials/${materialId}/stock-out`, data);
        if (response.success) {
            closeStockOutModal();
            loadMaterialsData();
            loadMaterialsStats();
            alert('Stock removed successfully!');
        } else {
            alert(response.message || 'Error removing stock');
        }
    } catch (error) {
        console.error('Error in stock out:', error);
        alert('Error removing stock');
    }
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================

function quickStockIn(materialId) {
    document.getElementById('stockin-material').value = materialId;
    openStockInModal();
}

function quickStockOut(materialId) {
    document.getElementById('stockout-material').value = materialId;
    openStockOutModal();
}

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================

async function deleteMaterialItem(id) {
    if (!confirm('Are you sure you want to delete this material?')) return;
    
    try {
        const response = await api.delete(`/materials/${id}`);
        if (response.success) {
            loadMaterialsData();
            loadMaterialsStats();
            alert('Material deleted');
        } else {
            alert(response.message || 'Error deleting material');
        }
    } catch (error) {
        console.error('Error deleting material:', error);
        alert('Error deleting material');
    }
}

async function deleteSupplierItem(id) {
    if (!confirm('Are you sure you want to deactivate this supplier?')) return;
    
    try {
        const response = await api.delete(`/suppliers/${id}`);
        if (response.success) {
            await loadSuppliersData();
            renderSuppliersTable();
            alert('Supplier deactivated');
        } else {
            alert(response.message || 'Error deactivating supplier');
        }
    } catch (error) {
        console.error('Error deleting supplier:', error);
        alert('Error deactivating supplier');
    }
}

async function deleteLocationItem(id) {
    if (!confirm('Are you sure you want to delete this location?')) return;
    
    try {
        const response = await api.delete(`/storage-locations/${id}`);
        if (response.success) {
            await loadStorageLocationsData();
            renderLocationsGrid();
            alert('Location deleted');
        } else {
            alert(response.message || 'Error deleting location');
        }
    } catch (error) {
        console.error('Error deleting location:', error);
        alert('Error deleting location');
    }
}

// ============================================================================
// SEARCH & FILTER
// ============================================================================

function searchMaterials(searchTerm) {
    if (!searchTerm) {
        renderMaterialsTable();
        return;
    }
    
    const filtered = materialsData.filter(m => 
        (m.material_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.material_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.notes || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const tbody = document.getElementById('materialsTableBody');
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #64748b;">No matching materials found.</td></tr>';
        return;
    }
    
    // Temporarily swap data for rendering
    const original = materialsData;
    materialsData = filtered;
    renderMaterialsTable();
    materialsData = original;
}

function filterMaterialsByType() {
    const type = document.getElementById('filter-material-type').value;
    if (!type) {
        renderMaterialsTable();
        return;
    }
    
    const filtered = materialsData.filter(m => m.material_type === type);
    const original = materialsData;
    materialsData = filtered;
    renderMaterialsTable();
    materialsData = original;
}

function filterMaterialsByLocation() {
    const locationId = document.getElementById('filter-location').value;
    if (!locationId) {
        renderMaterialsTable();
        return;
    }
    
    const filtered = materialsData.filter(m => m.location_id == locationId);
    const original = materialsData;
    materialsData = filtered;
    renderMaterialsTable();
    materialsData = original;
}

// ============================================================================
// MATERIAL TYPES MANAGEMENT
// ============================================================================

async function loadMaterialTypesTable() {
    try {
        const response = await api.get('/materials/types');
        if (response.success) {
            materialTypesData = response.types || [];
            renderMaterialTypesTable();
        }
    } catch (error) {
        console.error('Error loading material types:', error);
        document.getElementById('materialTypesTableBody').innerHTML = 
            '<tr><td colspan="5" style="text-align: center; color: #dc3545;">Error loading material types</td></tr>';
    }
}

function renderMaterialTypesTable() {
    const tbody = document.getElementById('materialTypesTableBody');
    if (!tbody) return;
    
    if (!materialTypesData || materialTypesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b;">No material types defined. Click "Add Type" to create one.</td></tr>';
        return;
    }
    
    tbody.innerHTML = materialTypesData.map(type => {
        const aliases = type.aliases ? (Array.isArray(type.aliases) ? type.aliases.join(', ') : type.aliases) : '-';
        const density = type.density ? type.density + ' kg/dm³' : '-';
        const categoryBadge = getCategoryBadge(type.category);
        
        return `
            <tr>
                <td><strong>${type.name}</strong></td>
                <td>${categoryBadge}</td>
                <td style="max-width: 300px; white-space: normal;">${aliases}</td>
                <td>${density}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="editMaterialType(${type.id})" title="Edit">✏️</button>
                        <button class="btn-icon delete" onclick="deleteMaterialType(${type.id})" title="Delete">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getCategoryBadge(category) {
    const badges = {
        'metal': '<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em;">Metal</span>',
        'plastic': '<span style="background: #22c55e; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em;">Plastic</span>',
        'composite': '<span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em;">Composite</span>',
        'wood': '<span style="background: #a16207; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em;">Wood</span>',
        'ceramic': '<span style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em;">Ceramic</span>',
        'rubber': '<span style="background: #1f2937; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em;">Rubber</span>'
    };
    
    if (badges[category]) {
        return badges[category];
    }
    
    // For custom categories, show them with a purple badge
    if (category) {
        const displayName = category.charAt(0).toUpperCase() + category.slice(1);
        return `<span style="background: #8b5cf6; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em;">${displayName}</span>`;
    }
    
    return '<span style="background: #64748b; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em;">Other</span>';
}

function openAddMaterialTypeModal() {
    console.log('openAddMaterialTypeModal called');
    try {
        document.getElementById('materialTypeForm').reset();
        document.getElementById('material-type-id').value = '';
        document.getElementById('material-type-modal-title').textContent = 'Add Material Type';
        const modal = document.getElementById('material-type-modal');
        modal.classList.add('active');
        modal.style.display = 'flex';  // Force display
        console.log('Modal should be open now');
    } catch (error) {
        console.error('Error opening modal:', error);
        alert('Error opening modal: ' + error.message);
    }
}

function closeMaterialTypeModal() {
    const modal = document.getElementById('material-type-modal');
    modal.classList.remove('active');
    modal.style.display = 'none';  // Force hide
}

async function editMaterialType(id) {
    console.log('editMaterialType called with id:', id);
    try {
        const response = await api.get(`/materials/types/${id}`);
        if (response.success && response.type) {
            const type = response.type;
            document.getElementById('material-type-id').value = type.id;
            document.getElementById('material-type-name').value = type.name || '';
            
            // Handle category - add if not in list
            const categorySelect = document.getElementById('material-type-category');
            const categoryValue = type.category || '';
            if (categoryValue && !categorySelect.querySelector(`option[value="${categoryValue}"]`)) {
                // Add custom category option
                const newOption = document.createElement('option');
                newOption.value = categoryValue;
                newOption.textContent = categoryValue.charAt(0).toUpperCase() + categoryValue.slice(1);
                const addNewOption = categorySelect.querySelector('option[value="__add_new__"]');
                categorySelect.insertBefore(newOption, addNewOption);
            }
            categorySelect.value = categoryValue;
            
            document.getElementById('material-type-density').value = type.density || '';
            document.getElementById('material-type-aliases').value = type.aliases ? (Array.isArray(type.aliases) ? type.aliases.join(', ') : type.aliases) : '';
            document.getElementById('material-type-description').value = type.description || '';
            document.getElementById('material-type-modal-title').textContent = 'Edit Material Type';
            const modal = document.getElementById('material-type-modal');
            modal.classList.add('active');
            modal.style.display = 'flex';  // Force display
        }
    } catch (error) {
        console.error('Error loading material type:', error);
        alert('Error loading material type');
    }
}

// Handle "Add new category" option in dropdown
function handleCategoryChange(select) {
    if (select.value === '__add_new__') {
        const newCategory = prompt('Enter new category name:');
        if (newCategory && newCategory.trim()) {
            const categoryValue = newCategory.trim().toLowerCase().replace(/\s+/g, '_');
            const categoryLabel = newCategory.trim();
            
            // Add new option before the "Add new" option
            const newOption = document.createElement('option');
            newOption.value = categoryValue;
            newOption.textContent = categoryLabel;
            
            const addNewOption = select.querySelector('option[value="__add_new__"]');
            select.insertBefore(newOption, addNewOption);
            
            // Select the new option
            select.value = categoryValue;
        } else {
            // Reset to empty if cancelled
            select.value = '';
        }
    }
}

async function saveMaterialType(event) {
    event.preventDefault();
    
    const id = document.getElementById('material-type-id').value;
    const data = {
        name: document.getElementById('material-type-name').value,
        category: document.getElementById('material-type-category').value,
        density: document.getElementById('material-type-density').value || null,
        aliases: document.getElementById('material-type-aliases').value,
        description: document.getElementById('material-type-description').value || null
    };
    
    try {
        let response;
        if (id) {
            response = await api.put(`/materials/types/${id}`, data);
        } else {
            response = await api.post('/materials/types', data);
        }
        
        if (response.success) {
            closeMaterialTypeModal();
            loadMaterialTypesTable();
            loadMaterialTypes(); // Refresh the dropdown data too
            alert(id ? 'Material type updated successfully!' : 'Material type added successfully!');
        } else {
            alert(response.message || 'Error saving material type');
        }
    } catch (error) {
        console.error('Error saving material type:', error);
        alert('Error saving material type: ' + (error.message || 'Unknown error'));
    }
}

async function deleteMaterialType(id) {
    if (!confirm('Are you sure you want to delete this material type?')) return;
    
    try {
        const response = await api.delete(`/materials/types/${id}`);
        if (response.success) {
            loadMaterialTypesTable();
            loadMaterialTypes(); // Refresh the dropdown data too
            alert('Material type deleted successfully!');
        } else {
            alert(response.message || 'Error deleting material type');
        }
    } catch (error) {
        console.error('Error deleting material type:', error);
        alert('Error deleting material type');
    }
}

// ============================================================================
// EDIT FUNCTIONS (Placeholders)
// ============================================================================

function editMaterialItem(id) {
    alert('Edit material feature coming soon');
}

function editSupplierItem(id) {
    alert('Edit supplier feature coming soon');
}

function editLocationItem(id) {
    alert('Edit location feature coming soon');
}
