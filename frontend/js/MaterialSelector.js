// Material Selector Component
// Provides smart material suggestions when creating orders/parts

class MaterialSelector {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('MaterialSelector: Container not found:', containerId);
            return;
        }
        
        this.options = {
            onMaterialSelected: options.onMaterialSelected || null,
            showQuantity: options.showQuantity !== false,
            defaultQuantity: options.defaultQuantity || 1,
            maxSuggestions: options.maxSuggestions || 5,
            prefill: options.prefill || null
        };
        
        this.selectedMaterial = null;
        this.selectedMaterialStock = null;
        this.suggestions = [];
        this.materialTypes = [];
        
        this.init();
    }

    init() {
        this.render();
        this.attachEventListeners();
        this.applyPrefill();
    }

    applyPrefill() {
        if (!this.options.prefill) return;
        
        const prefill = this.options.prefill;
        
        // Pre-fill material type
        if (prefill.materialType) {
            const input = this.container.querySelector('#materialTypeInput');
            if (input) input.value = prefill.materialType;
        }
        
        // Pre-fill shape type
        if (prefill.shapeType) {
            const select = this.container.querySelector('#materialShapeType');
            if (select) {
                select.value = prefill.shapeType;
                this.updateDimensionFields(prefill.shapeType);
            }
        }
        
        // Pre-fill dimensions
        if (prefill.dimensions) {
            const dims = prefill.dimensions;
            if (dims.width) {
                const el = this.container.querySelector('#materialWidth');
                if (el) el.value = dims.width;
            }
            if (dims.height) {
                const el = this.container.querySelector('#materialHeight');
                if (el) el.value = dims.height;
            }
            if (dims.length) {
                const el = this.container.querySelector('#materialThickness');
                if (el) el.value = dims.length;
            }
            if (dims.diameter) {
                const el = this.container.querySelector('#materialDiameter');
                if (el) el.value = dims.diameter;
            }
        }
        
        // Auto-search if we have data
        if (prefill.materialType && prefill.shapeType) {
            setTimeout(() => this.handleGetSuggestions(), 300);
        }
    }

    updateDimensionFields(shapeType) {
        const widthGroup = this.container.querySelector('#widthGroup');
        const heightGroup = this.container.querySelector('#heightGroup');
        const thicknessGroup = this.container.querySelector('#thicknessGroup');
        const diameterGroup = this.container.querySelector('#diameterGroup');
        
        // Reset all
        [widthGroup, heightGroup, thicknessGroup].forEach(g => { if (g) g.style.display = 'block'; });
        if (diameterGroup) diameterGroup.style.display = 'none';
        
        if (shapeType === 'bar_round' || shapeType === 'bar_hex' || shapeType === 'tube') {
            [widthGroup, heightGroup].forEach(g => { if (g) g.style.display = 'none'; });
            if (diameterGroup) diameterGroup.style.display = 'block';
            // Use thickness as length
            const thicknessLabel = thicknessGroup?.querySelector('label');
            if (thicknessLabel) thicknessLabel.textContent = 'Length';
        } else {
            const thicknessLabel = thicknessGroup?.querySelector('label');
            if (thicknessLabel) thicknessLabel.textContent = 'Thickness/Length';
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="material-selector">
                <div class="material-input-section">
                    <h4>📦 Material Selection</h4>
                    
                    <!-- Material Type Input -->
                    <div class="form-group">
                        <label>Material Type</label>
                        <div class="material-type-input-group">
                            <input type="text" id="materialTypeInput" class="form-control" 
                                   placeholder="Search material type (e.g., Aluminum 6061, 1.2027)..." 
                                   autocomplete="off">
                            <button type="button" class="btn btn-secondary btn-search-materials">
                                🔍
                            </button>
                        </div>
                        <div id="materialTypeDropdown" class="dropdown-list"></div>
                        <div id="selectedMaterialType" class="selected-badge" style="display: none;"></div>
                    </div>
                    
                    <!-- Shape Type Selection -->
                    <div class="form-group">
                        <label>Shape Type</label>
                        <select id="materialShapeType" class="form-control">
                            <option value="">Select shape...</option>
                            <option value="plate">Plate / Sheet</option>
                            <option value="bar_round">Round Bar</option>
                            <option value="bar_square">Square Bar</option>
                            <option value="bar_hex">Hex Bar</option>
                            <option value="tube">Tube</option>
                        </select>
                    </div>
                    
                    <!-- Dimensions -->
                    <div class="dimensions-section">
                        <label>Dimensions (mm)</label>
                        <div class="dimensions-grid">
                            <div class="form-group dimension-field" id="widthGroup">
                                <label>Width</label>
                                <input type="number" id="materialWidth" class="form-control" 
                                       step="0.01" min="0" placeholder="Width">
                            </div>
                            <div class="form-group dimension-field" id="heightGroup">
                                <label>Height</label>
                                <input type="number" id="materialHeight" class="form-control" 
                                       step="0.01" min="0" placeholder="Height">
                            </div>
                            <div class="form-group dimension-field" id="thicknessGroup">
                                <label>Thickness</label>
                                <input type="number" id="materialThickness" class="form-control" 
                                       step="0.01" min="0" placeholder="Thickness">
                            </div>
                            <div class="form-group dimension-field" id="diameterGroup" style="display: none;">
                                <label>Diameter</label>
                                <input type="number" id="materialDiameter" class="form-control" 
                                       step="0.01" min="0" placeholder="Diameter">
                            </div>
                        </div>
                    </div>
                    
                    ${this.options.showQuantity ? `
                    <!-- Quantity -->
                    <div class="form-group">
                        <label>Required Quantity</label>
                        <input type="number" id="materialQuantity" class="form-control" 
                               min="1" value="${this.options.defaultQuantity}" placeholder="Quantity">
                    </div>
                    ` : ''}
                    
                    <!-- Get Suggestions Button -->
                    <button type="button" class="btn btn-primary btn-get-suggestions">
                        🔍 Find Available Materials
                    </button>
                </div>
                
                <!-- Suggestions Section -->
                <div class="suggestions-section" id="suggestionsSection" style="display: none;">
                    <h4>📋 Available Materials</h4>
                    <div id="suggestionsContainer" class="suggestions-container"></div>
                </div>
                
                <!-- Selected Material Section -->
                <div class="selected-material-section" id="selectedMaterialSection" style="display: none;">
                    <h4>✅ Selected Material</h4>
                    <div id="selectedMaterialInfo"></div>
                    <button type="button" class="btn btn-secondary btn-change-material">
                        Change Material
                    </button>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        const materialTypeInput = this.container.querySelector('#materialTypeInput');
        const shapeSelect = this.container.querySelector('#materialShapeType');
        const searchBtn = this.container.querySelector('.btn-search-materials');
        const suggestionsBtn = this.container.querySelector('.btn-get-suggestions');
        const changeBtn = this.container.querySelector('.btn-change-material');

        // Material type search with debounce
        let debounceTimer;
        materialTypeInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => this.searchMaterialTypes(e.target.value), 300);
        });

        materialTypeInput.addEventListener('focus', () => {
            if (materialTypeInput.value.length >= 2) {
                this.searchMaterialTypes(materialTypeInput.value);
            }
        });

        // Click outside to close dropdown
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.hideDropdown();
            }
        });

        searchBtn.addEventListener('click', () => {
            this.searchMaterialTypes(materialTypeInput.value);
        });

        // Shape type change - update dimension fields
        shapeSelect.addEventListener('change', () => this.updateDimensionFields());

        // Get suggestions
        suggestionsBtn.addEventListener('click', () => this.handleGetSuggestions());

        // Change material
        if (changeBtn) {
            changeBtn.addEventListener('click', () => this.resetSelection());
        }
    }

    updateDimensionFields() {
        const shapeType = this.container.querySelector('#materialShapeType').value;
        const widthGroup = this.container.querySelector('#widthGroup');
        const heightGroup = this.container.querySelector('#heightGroup');
        const thicknessGroup = this.container.querySelector('#thicknessGroup');
        const diameterGroup = this.container.querySelector('#diameterGroup');

        // Reset all
        [widthGroup, heightGroup, thicknessGroup, diameterGroup].forEach(g => {
            if (g) g.style.display = 'none';
        });

        switch (shapeType) {
            case 'plate':
            case 'sheet':
                widthGroup.style.display = 'block';
                heightGroup.style.display = 'block';
                thicknessGroup.style.display = 'block';
                break;
            case 'bar_round':
            case 'tube':
                diameterGroup.style.display = 'block';
                if (shapeType === 'tube') {
                    thicknessGroup.style.display = 'block';
                }
                break;
            case 'bar_square':
            case 'bar_hex':
                widthGroup.style.display = 'block';
                break;
            default:
                // Show all for unknown
                widthGroup.style.display = 'block';
                heightGroup.style.display = 'block';
                thicknessGroup.style.display = 'block';
        }
    }

    async searchMaterialTypes(searchTerm) {
        if (!searchTerm || searchTerm.length < 2) {
            this.hideDropdown();
            return;
        }

        try {
            const response = await api.get(`/materials/types/search/${encodeURIComponent(searchTerm)}`);
            if (response.success && response.types) {
                this.displayMaterialTypeDropdown(response.types);
            }
        } catch (error) {
            console.error('Error searching materials:', error);
        }
    }

    displayMaterialTypeDropdown(materials) {
        const dropdown = this.container.querySelector('#materialTypeDropdown');
        
        if (!materials || materials.length === 0) {
            dropdown.innerHTML = '<div class="dropdown-item no-results">No materials found</div>';
            dropdown.style.display = 'block';
            return;
        }

        dropdown.innerHTML = materials.map(mat => `
            <div class="dropdown-item" data-material-id="${mat.id}" data-material-name="${mat.name}">
                <strong>${mat.name}</strong>
                ${mat.specification_code ? `<span class="spec-code">(${mat.specification_code})</span>` : ''}
                <br>
                <small class="text-muted">
                    ${mat.category || ''}
                    ${mat.aliases && mat.aliases.length ? ` • Aliases: ${mat.aliases.slice(0, 3).join(', ')}` : ''}
                </small>
            </div>
        `).join('');

        dropdown.style.display = 'block';

        // Attach click handlers
        dropdown.querySelectorAll('.dropdown-item:not(.no-results)').forEach(item => {
            item.addEventListener('click', () => {
                const materialId = item.dataset.materialId;
                const materialName = item.dataset.materialName;
                this.selectMaterialType(materialId, materialName);
            });
        });
    }

    selectMaterialType(id, name) {
        this.selectedMaterial = { id, name };
        
        const input = this.container.querySelector('#materialTypeInput');
        const badge = this.container.querySelector('#selectedMaterialType');
        
        input.value = name;
        badge.innerHTML = `<span class="badge badge-primary">${name}</span>`;
        badge.style.display = 'block';
        
        this.hideDropdown();
    }

    hideDropdown() {
        const dropdown = this.container.querySelector('#materialTypeDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }

    async handleGetSuggestions() {
        const materialType = this.container.querySelector('#materialTypeInput').value;
        if (!materialType) {
            alert('Please enter a material type');
            return;
        }

        const shapeType = this.container.querySelector('#materialShapeType').value;
        const width = parseFloat(this.container.querySelector('#materialWidth').value) || null;
        const height = parseFloat(this.container.querySelector('#materialHeight').value) || null;
        const thickness = parseFloat(this.container.querySelector('#materialThickness').value) || null;
        const diameter = parseFloat(this.container.querySelector('#materialDiameter').value) || null;
        const quantity = this.options.showQuantity 
            ? parseInt(this.container.querySelector('#materialQuantity').value) || 1 
            : 1;

        try {
            const response = await api.post('/materials/suggestions', {
                material_type: materialType,
                dimensions: { width, height, thickness, diameter, shape_type: shapeType },
                quantity: quantity,
                max_suggestions: this.options.maxSuggestions
            });

            if (response.success) {
                this.suggestions = response.suggestions || [];
                this.displaySuggestions(response);
            } else {
                alert(response.message || 'Error fetching suggestions');
            }
        } catch (error) {
            console.error('Error getting suggestions:', error);
            alert('Error getting material suggestions');
        }
    }

    displaySuggestions(response) {
        const section = this.container.querySelector('#suggestionsSection');
        const container = this.container.querySelector('#suggestionsContainer');
        const materialType = this.container.querySelector('#materialTypeInput').value;

        if (!response.suggestions || response.suggestions.length === 0) {
            container.innerHTML = `
                <div class="no-suggestions">
                    <div style="text-align: center; padding: 2rem;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">📦❌</div>
                        <h4 style="color: #dc3545; margin-bottom: 0.5rem;">No Stock Available</h4>
                        <p style="color: #666;">No matching materials found for <strong>${materialType}</strong> with specified dimensions.</p>
                        <hr style="margin: 1.5rem 0;">
                        <p style="color: #0d6efd; font-weight: 500;">📋 Material needs to be ordered</p>
                        <button type="button" class="btn btn-warning btn-needs-order" style="margin-top: 1rem; padding: 0.75rem 2rem;">
                            ⚠️ Mark as "Needs Order"
                        </button>
                    </div>
                </div>
            `;
            section.style.display = 'block';
            
            // Add click handler for "Needs Order" button
            container.querySelector('.btn-needs-order')?.addEventListener('click', () => {
                if (this.options.onMaterialSelected) {
                    this.options.onMaterialSelected({
                        material_name: materialType,
                        stock_id: null,
                        needs_order: true,
                        dimensions: {
                            width: this.container.querySelector('#materialWidth')?.value,
                            height: this.container.querySelector('#materialHeight')?.value,
                            thickness: this.container.querySelector('#materialThickness')?.value,
                            diameter: this.container.querySelector('#materialDiameter')?.value
                        }
                    });
                }
            });
            return;
        }

        container.innerHTML = response.suggestions.map((suggestion, idx) => `
            <div class="suggestion-card ${suggestion.category}" data-stock-id="${suggestion.stock_id}" data-index="${idx}">
                <div class="suggestion-header">
                    <h5>${suggestion.material_name}</h5>
                    <span class="badge badge-${this.getCategoryBadgeClass(suggestion.category)}">
                        ${suggestion.category.replace('_', ' ').toUpperCase()}
                    </span>
                    <span class="score-badge">${Math.round(suggestion.scores.total)}%</span>
                </div>
                
                <div class="suggestion-details">
                    <div class="detail-row">
                        <span class="label">Type:</span>
                        <span>${suggestion.material_type || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Shape:</span>
                        <span>${suggestion.shape_type || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Dimensions:</span>
                        <span>${this.formatDimensions(suggestion.dimensions)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Available:</span>
                        <span class="available-qty">${suggestion.available_qty} units</span>
                    </div>
                    ${suggestion.location ? `
                    <div class="detail-row">
                        <span class="label">Location:</span>
                        <span>${suggestion.location}</span>
                    </div>
                    ` : ''}
                    ${suggestion.cost_per_unit ? `
                    <div class="detail-row">
                        <span class="label">Cost:</span>
                        <span>€${parseFloat(suggestion.cost_per_unit).toFixed(2)}/unit</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="score-breakdown">
                    <span title="Size Match">📐 Size: ${Math.round(suggestion.scores.size)}</span>
                    <span title="Availability">📦 Stock: ${Math.round(suggestion.scores.availability)}</span>
                    <span title="Freshness">🕐 Fresh: ${Math.round(suggestion.scores.freshness)}</span>
                    <span title="Cost">💰 Cost: ${Math.round(suggestion.scores.cost)}</span>
                </div>
                
                <div class="suggestion-reason">
                    <small>${suggestion.match_reason}</small>
                </div>
                
                <div class="suggestion-actions">
                    <button type="button" class="btn btn-primary btn-select-material">
                        Select This Material
                    </button>
                </div>
            </div>
        `).join('');

        // Attach select handlers
        container.querySelectorAll('.btn-select-material').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.suggestion-card');
                const stockId = card.dataset.stockId;
                const idx = parseInt(card.dataset.index);
                this.selectMaterialStock(stockId, idx);
            });
        });

        section.style.display = 'block';
    }

    getCategoryBadgeClass(category) {
        switch (category) {
            case 'exact_match': return 'success';
            case 'close_fit': return 'info';
            case 'acceptable': return 'warning';
            case 'last_resort': return 'secondary';
            default: return 'secondary';
        }
    }

    formatDimensions(dims) {
        if (!dims) return 'N/A';
        const parts = [];
        if (dims.width) parts.push(`W: ${dims.width}mm`);
        if (dims.height) parts.push(`H: ${dims.height}mm`);
        if (dims.thickness) parts.push(`T: ${dims.thickness}mm`);
        if (dims.diameter) parts.push(`Ø: ${dims.diameter}mm`);
        if (dims.length) parts.push(`L: ${dims.length}mm`);
        return parts.length ? parts.join(' × ') : 'N/A';
    }

    selectMaterialStock(stockId, suggestionIdx) {
        const suggestion = this.suggestions[suggestionIdx];
        this.selectedMaterialStock = {
            stock_id: stockId,
            ...suggestion
        };

        // Update UI
        this.container.querySelector('#suggestionsSection').style.display = 'none';
        this.container.querySelector('.material-input-section').style.display = 'none';
        this.displaySelectedMaterial();

        // Callback
        if (this.options.onMaterialSelected) {
            this.options.onMaterialSelected(this.selectedMaterialStock);
        }
    }

    displaySelectedMaterial() {
        const section = this.container.querySelector('#selectedMaterialSection');
        const info = this.container.querySelector('#selectedMaterialInfo');
        const material = this.selectedMaterialStock;

        info.innerHTML = `
            <div class="selected-material-details">
                <p><strong>${material.material_name}</strong></p>
                <p>Type: ${material.material_type || 'N/A'}</p>
                <p>Dimensions: ${this.formatDimensions(material.dimensions)}</p>
                <p>Available: ${material.available_qty} units</p>
                ${material.location ? `<p>Location: ${material.location}</p>` : ''}
                <p><span class="badge badge-${this.getCategoryBadgeClass(material.category)}">
                    Match Score: ${Math.round(material.scores.total)}%
                </span></p>
            </div>
        `;

        section.style.display = 'block';
    }

    resetSelection() {
        this.selectedMaterialStock = null;
        this.suggestions = [];
        
        this.container.querySelector('#selectedMaterialSection').style.display = 'none';
        this.container.querySelector('.material-input-section').style.display = 'block';
        this.container.querySelector('#suggestionsSection').style.display = 'none';
        this.container.querySelector('#suggestionsContainer').innerHTML = '';
    }

    getSelectedMaterial() {
        return this.selectedMaterialStock;
    }

    getMaterialData() {
        if (this.selectedMaterialStock) {
            return {
                material_id: this.selectedMaterialStock.stock_id,
                material_type: this.selectedMaterialStock.material_type,
                material_name: this.selectedMaterialStock.material_name,
                dimensions: this.selectedMaterialStock.dimensions
            };
        }
        
        // Return manual input if no suggestion selected
        return {
            material_type: this.container.querySelector('#materialTypeInput').value,
            shape_type: this.container.querySelector('#materialShapeType').value,
            width: parseFloat(this.container.querySelector('#materialWidth').value) || null,
            height: parseFloat(this.container.querySelector('#materialHeight').value) || null,
            thickness: parseFloat(this.container.querySelector('#materialThickness').value) || null,
            diameter: parseFloat(this.container.querySelector('#materialDiameter').value) || null,
            quantity: this.options.showQuantity 
                ? parseInt(this.container.querySelector('#materialQuantity').value) || 1 
                : 1
        };
    }

    reset() {
        this.selectedMaterial = null;
        this.selectedMaterialStock = null;
        this.suggestions = [];
        this.render();
        this.attachEventListeners();
    }
}

// Export for global use
window.MaterialSelector = MaterialSelector;
