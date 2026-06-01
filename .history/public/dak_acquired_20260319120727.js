//=========================
//START
//=========================

let rowCount = 0;
let tableData = [];
let entriesPerPage = 6;
let currentPage = 1;
const translatableColumns = ['officeName', 'subject', 'specificPerson'];
let translationCache = new Map();

let originalData = new Map();
let changedRows = new Set(); 
let newRows = new Set(); 

let columnFilters = {};
let originalTableOrder = []; // for neutral sort

//======================================
//UTILITY FUNCTIONS FOR DATA HANDLING
//======================================

function createRowHash(rowData) {
    const relevantData = {
        letterDate: rowData.letterDate || '',
        acquiredOn: rowData.acquiredOn || '',
        officeName: rowData.officeName || '',
        officeNameHindi: rowData.officeNameHindi || '',
        specificPerson: rowData.specificPerson || '',
        letterNo: rowData.letterNo || '',
        subject: rowData.subject || '',
        subjectHindi: rowData.subjectHindi || '',
        letterLanguage: rowData.letterLanguage || '',
        zone: rowData.zone || '',
        acquisitionMethod: rowData.acquisitionMethod || ''
    };
    return JSON.stringify(relevantData);
}



//========================================
//MOBILE TOOLBAR
//========================================

function switchPage(targetPage) {
    // â­ Sync BEFORE saving
    syncTableDataWithDOM();
    
    sessionStorage.setItem('acquired_preservedTableData', JSON.stringify(tableData));
    sessionStorage.setItem('acquired_preservedRowCount', rowCount.toString());
    
    localStorage.setItem('flipTo', targetPage);
    const flipContainer = document.getElementById('flipContainer');
    flipContainer.classList.add('flip-out');
    setTimeout(() => {
        window.location.href = targetPage === 'despatch' ? 'dak_despatch.html' : 'dak_acquired.html';
    }, 600);
}

// On page load, check if flip-in animation should be applied
window.addEventListener('load', () => {
    const flipTo = localStorage.getItem('flipTo');
    const currentPage = window.location.pathname.includes('dak_despatch.html') ? 'despatch' : 'acquired';
    
    if (flipTo === currentPage) {
        const flipContainer = document.getElementById('flipContainer');
        flipContainer.classList.add('flip-in');
        localStorage.removeItem('flipTo');
    }
});

//==========================================
//DATE FUNCTIONALITY
//==========================================

//=============================
//SORTING COLUMNS
//=============================
function sortColumn(field, order) {
    syncTableDataWithDOM();
    
    if (order === 'neutral') {
        // Restore original load order
        if (originalTableOrder.length > 0) {
            tableData = originalTableOrder.map(row => ({ ...row }));
        }
        rebuildTable();
        applyAllFilters();
        document.querySelectorAll('.sort-dropdown').forEach(d => d.classList.remove('show'));
        return;
    }
    
    const filledRows = [];
    const emptyRows = [];
    
    tableData.forEach((row, index) => {
        const hasData = Object.values(row).some(value => 
            value && value.toString().trim() !== ''
        );
        if (hasData) {
            filledRows.push({ ...row, originalIndex: index });
        } else {
            emptyRows.push({ ...row, originalIndex: index });
        }
    });
    
    filledRows.sort((a, b) => {
        let aValue = a[field] || '';
        let bValue = b[field] || '';
        
        if (field === 'acquiredDate') {
            aValue = parseDate(aValue);
            bValue = parseDate(bValue);
        } else {
            aValue = aValue.toString().toLowerCase();
            bValue = bValue.toString().toLowerCase();
        }
        
        return order === 'asc' ? 
            (aValue > bValue ? 1 : -1) : 
            (aValue < bValue ? 1 : -1);
    });
    
    tableData = [...filledRows, ...emptyRows].map(row => {
        const { originalIndex, ...cleanRow } = row;
        return cleanRow;
    });
    
    rebuildTable();
    applyAllFilters();
    document.querySelectorAll('.sort-dropdown').forEach(d => d.classList.remove('show'));
}
//==========================================
//INITIALIZE TABLE
//==========================================
let isDataLoaded = false;

function initializeTable() {

    if (window.tableInitialized) {
        console.log('¸ Table already initialized, skipping...');
        return;
    }

    const preservedData = sessionStorage.getItem('acquired_preservedTableData');
    const preservedRowCount = sessionStorage.getItem('acquired_preservedRowCount');
    
    if (preservedData && preservedRowCount) {
        console.log('Restoring data from previous page...');
        tableData = JSON.parse(preservedData);
        rowCount = parseInt(preservedRowCount);
        rebuildTable();
        
        // Clear the preserved data
        sessionStorage.removeItem('acquired_preservedTableData');
        sessionStorage.removeItem('acquired_preservedRowCount');
        
        attachAllEventListeners();
        window.tableInitialized = true;
        
        console.log('Data restored from page switch!');
        return; 
    }
    
    const userIsAuthenticated = isAuthenticated();

    if (userIsAuthenticated) {
        console.log('Authenticated user - loading data...');
        loadUserData(); // This will handle BOTH cases: existing data OR new user
    } else {
        console.log('Guest user - initializing with 6 empty rows...');
        for (let i = 0; i < 6; i++) {
            addNewRow();
        }
        rebuildTable();
    }
    
    const addRowBtn = document.querySelector('.add-row-btn');
    if (addRowBtn) addRowBtn.addEventListener('click', addNewRow);
 
    const saveBtn = document.querySelector('.save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveToDatabase);
        console.log(' Save button listener attached');
    } else {
        console.error(' Save button not found!');
    }

    document.querySelectorAll('.hamburger-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopImmediatePropagation();
            const columnHeader = this.closest('.column-header');
            const thElement = columnHeader.closest('th');
            const column = thElement.className.trim().split(/\s+/)[0];

            const columnMap = {
                'letterDate': 'letterDate',
                'acquiredOn': 'acquiredOn',
                'officeName': 'officeName',
                'specificPerson': 'specificPerson',
                'letterNo': 'letterNo',
                'subject': 'subject',
                'letterLanguage': 'letterLanguage',
                'zone': 'zone',
                'acquisitionMethod': 'acquisitionMethod'
            };

            const field = columnMap[column] || column;
            toggleSortMenu(field);
        });
    });

    const boldBtn = document.getElementById('bold');
    const italicBtn = document.getElementById('italics');
    const underlineBtn = document.getElementById('underline');

    if (boldBtn) {
        boldBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const activeElement = document.activeElement;

            if (activeElement && activeElement.contentEditable === 'true' && activeElement.classList.contains('cell')) {
                applyFormattingToContentEditable('bold');
            } else if (activeElement && activeElement.tagName === 'INPUT' && activeElement.classList.contains('cell')) {
                applyFormatting('bold');
            } else {
                alert('Please click on a cell and select text first');
            }
        });
    }

    if (italicBtn) {
        italicBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const activeElement = document.activeElement;

            if (activeElement && activeElement.contentEditable === 'true' && activeElement.classList.contains('cell')) {
                applyFormattingToContentEditable('italic');
            } else if (activeElement && activeElement.tagName === 'INPUT' && activeElement.classList.contains('cell')) {
                applyFormatting('italic');
            } else {
                alert('Please click on a cell and select text first');
            }
        });
    }

    if (underlineBtn) {
        underlineBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const activeElement = document.activeElement;

            if (activeElement && activeElement.contentEditable === 'true' && activeElement.classList.contains('cell')) {
                applyFormattingToContentEditable('underline');
            } else if (activeElement && activeElement.tagName === 'INPUT' && activeElement.classList.contains('cell')) {
                applyFormatting('underline');
            } else {
                alert('Please click on a cell and select text first');
            }
        });
    }

    const undoBtn = document.getElementById('undo');
    const redoBtn = document.getElementById('redo');

    if (undoBtn) {
        undoBtn.addEventListener('click', function(e) {
            e.preventDefault();
            undo();
        });
        console.log(' Undo button listener attached');
    }

    if (redoBtn) {
        redoBtn.addEventListener('click', function(e) {
            e.preventDefault();
            redo();
        });
        console.log(' Redo button listener attached');
    }

    updateUndoRedoButtons();
    window.tableInitialized = true;
}

//==========================================
// HELPER: ATTACH ALL EVENT LISTENERS
//==========================================

function attachAllEventListeners() {
    // Add event listeners with null checks
    const addRowBtn = document.querySelector('.add-row-btn');
    if (addRowBtn) addRowBtn.addEventListener('click', addNewRow);
 
    // Save button listener
    const saveBtn = document.querySelector('.save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveToDatabase);
        console.log(' Save button listener attached');
    } else {
        console.error(' Save button not found!');
    }
    
    //============================
    //SORTING LISTENERS
    //============================

    document.querySelectorAll('.hamburger-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopImmediatePropagation();
            const columnHeader = this.closest('.column-header');
            const thElement = columnHeader.closest('th');
            const column = thElement.className.trim().split(/\s+/)[0];

            const columnMap = {
                'letterDate': 'letterDate',
                'acquiredOn': 'acquiredOn',
                'officeName': 'officeName',
                'specificPerson': 'specificPerson',
                'letterNo': 'letterNo',
                'subject': 'subject',
                'letterLanguage': 'letterLanguage',
                'zone': 'zone',
                'acquisitionMethod': 'acquisitionMethod'
            };

            const field = columnMap[column] || column;
            toggleSortMenu(field);
        });
    });

    //============================
    // FORMATTING BUTTON LISTENERS
    //============================

    const boldBtn = document.getElementById('boldBtn');
    const italicBtn = document.getElementById('italicsBtn');
    const underlineBtn = document.getElementById('underlineBtn');

    if (boldBtn) {
        boldBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const activeElement = document.activeElement;

            if (activeElement && activeElement.contentEditable === 'true' && activeElement.classList.contains('cell')) {
                applyFormattingToContentEditable('bold');
            } else if (activeElement && activeElement.tagName === 'INPUT' && activeElement.classList.contains('cell')) {
                applyFormatting('bold');
            } else {
                alert('Please click on a cell and select text first');
            }
        });
    }

    if (italicBtn) {
        italicBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const activeElement = document.activeElement;

            if (activeElement && activeElement.contentEditable === 'true' && activeElement.classList.contains('cell')) {
                applyFormattingToContentEditable('italic');
            } else if (activeElement && activeElement.tagName === 'INPUT' && activeElement.classList.contains('cell')) {
                applyFormatting('italic');
            } else {
                alert('Please click on a cell and select text first');
            }
        });
    }

    if (underlineBtn) {
        underlineBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const activeElement = document.activeElement;

            if (activeElement && activeElement.contentEditable === 'true' && activeElement.classList.contains('cell')) {
                applyFormattingToContentEditable('underline');
            } else if (activeElement && activeElement.tagName === 'INPUT' && activeElement.classList.contains('cell')) {
                applyFormatting('underline');
            } else {
                alert('Please click on a cell and select text first');
            }
        });
    }

    //============================
    // UNDO/REDO BUTTON LISTENERS
    //============================

    const undoBtn = document.getElementById('undo');
    const redoBtn = document.getElementById('redo');

    if (undoBtn) {
        undoBtn.addEventListener('click', function(e) {
            e.preventDefault();
            undo();
        });
        console.log(' Undo button listener attached');
    }

    if (redoBtn) {
        redoBtn.addEventListener('click', function(e) {
            e.preventDefault();
            redo();
        });
        console.log(' Redo button listener attached');
    }

    updateUndoRedoButtons();
}

//=========================
//FONT STYLE AND SIZE
//=========================

let activeCell = null;

document.getElementById('tableBody').addEventListener('click', (event) => {
    const cell = event.target.closest('.cell');
    if (cell && cell.isContentEditable) {
        activeCell = cell;
        cell.focus();
    }
});
let currentEditingCell = null;
//============================================
// TEXT FORMATTING FUNCTIONS
//============================================
document.addEventListener('keydown', function(e) {
    const activeElement = document.activeElement;
    
    // Check if we're in a cell (textarea, input, or contentEditable)
    const isInCell = activeElement && (
        (activeElement.tagName === 'TEXTAREA' && activeElement.classList.contains('cell')) ||
        (activeElement.tagName === 'INPUT' && activeElement.classList.contains('cell')) ||
        (activeElement.contentEditable === 'true' && activeElement.classList.contains('cell'))
    );
    
    // Ctrl+Z for Undo (works globally)
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
    }
    
    // Ctrl+Y for Redo (works globally)
    if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
        return;
    }
    
    // Formatting shortcuts only work when in a cell
    if (!isInCell) return;
    
    // Ctrl+B for Bold
    if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        
        if (activeElement.contentEditable === 'true') {
            applyFormattingToContentEditable('bold');
        } else if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
            applyFormatting('bold');
        }
    }
    
    // Ctrl+I for Italic
    if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();
        
        if (activeElement.contentEditable === 'true') {
            applyFormattingToContentEditable('italic');
        } else if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
            applyFormatting('italic');
        }
    }
    
    // Ctrl+U for Underline
    if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        
        if (activeElement.contentEditable === 'true') {
            applyFormattingToContentEditable('underline');
        } else if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
            applyFormatting('underline');
        }
    }
});

//============================
// FORMATTING BUTTON LISTENERS
//============================
//============================================
// UNDO/REDO FUNCTIONALITY
//============================================


document.addEventListener('DOMContentLoaded', initializeTable);

//==================================================
//FIND AND REPLACE
//==================================================

const findInput = document.querySelector('.find-box');
const replaceInput = document.querySelector('.replace-box');
const replaceBtn = document.querySelector('.replace-btn');
const matchCounter = document.querySelector('.match-counter span');
const tableBody = document.getElementById('tableBody');

function getCells() {
    return tableBody.querySelectorAll('.cell');
}

findInput.addEventListener('input', () => {
    const searchTerm = findInput.value.trim().toLowerCase();
    const cells = getCells();
    
    if (!searchTerm) {
        cells.forEach(cell => cell.classList.remove('highlight'));
        matchCounter.textContent = '0';
        return;
    }
    
    let matchCount = 0;
    cells.forEach(cell => {
        const text = cell.value.toLowerCase();
        if (text.includes(searchTerm)) {
            cell.classList.add('highlight');
            matchCount++;
        } else {
            cell.classList.remove('highlight');
        }
    });
    matchCounter.textContent = matchCount;
});

replaceBtn.addEventListener('click', () => {
    const searchTerm = findInput.value.trim();
    const replaceTerm = replaceInput.value;
    if (!searchTerm) return;
    
    const cells = getCells();
    cells.forEach(cell => {
        if (cell.classList.contains('highlight')) {
            const regex = new RegExp(searchTerm, 'gi');
            cell.value = cell.value.replace(regex, replaceTerm);
            cell.classList.remove('highlight');
        }
    });
    matchCounter.textContent = '0';
});

//====================================================
//TABLE OPTIONS
//====================================================

function addNewRow() {
    rowCount++;
    const tbody = document.getElementById('tableBody');
    const row = document.createElement('tr');
    
    const rowData = {
        letterDate: '',
        acquiredOn: '',
        officeName: '',
        officeNameHindi: '',
        specificPerson: '',
        specificPersonHindi: '',
        letterNo: '',
        subject: '',
        subjectHindi: '',
        letterLanguage: '',
        zone: '',
        acquisitionMethod: ''
    };
    tableData.push(rowData);
    
    row.innerHTML = `
        <td class="row-number">${rowCount}</td>
        <td><input type="text" class="cell english-cell" required data-row="${rowCount-1}" data-field="letterDate" placeholder="DD/MM/YYYY" style="height: 53px;"></td>
        <td><input type="text" class="cell english-cell" data-row="${rowCount-1}" data-field="acquiredOn" placeholder="DD/MM/YYYY" style="height: 53px;"></td>
        <td>
            <textarea class="cell english-cell" required data-row="${rowCount-1}" data-field="officeName" placeholder="Office / Dept name..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${rowCount-1}" data-field="officeNameHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <input type="text" class="cell english-cell" data-row="${rowCount-1}" data-field="specificPerson" placeholder="Person name..." style="height: 53px;">
            <textarea class="cell hindi-cell" data-row="${rowCount-1}" data-field="specificPersonHindi" placeholder="Hindi translation..." disabled style="resize: vertical; min-height:30px;"></textarea>
        </td>
        <td>
            <div class="radio-cell" data-row="${rowCount-1}" data-field="letterLanguage">
                <label class="radio-label"><input type="radio" name="acq_letterLanguage_${rowCount-1}" value="Hindi" onchange="saveRadioValue(this)"> Hindi</label>
                <label class="radio-label"><input type="radio" name="acq_letterLanguage_${rowCount-1}" value="English" onchange="saveRadioValue(this)"> English</label>
                <label class="radio-label"><input type="radio" name="acq_letterLanguage_${rowCount-1}" value="Bilingual" onchange="saveRadioValue(this)"> Bilingual</label>
            </div>
        </td>
        <td>
            <div class="radio-cell" data-row="${rowCount-1}" data-field="zone">
                <label class="radio-label"><input type="radio" name="acq_zone_${rowCount-1}" value="Zone 1" onchange="saveRadioValue(this)"> Zone 1</label>
                <label class="radio-label"><input type="radio" name="acq_zone_${rowCount-1}" value="Zone 2" onchange="saveRadioValue(this)"> Zone 2</label>
                <label class="radio-label"><input type="radio" name="acq_zone_${rowCount-1}" value="Zone 3" onchange="saveRadioValue(this)"> Zone 3</label>
            </div>
        </td>
        <td><input type="text" class="cell english-cell" required data-row="${rowCount-1}" data-field="letterNo" placeholder="e.g. NIC/2025/001" style="height: 53px;"></td>
        <td>
            <textarea class="cell english-cell" required data-row="${rowCount-1}" data-field="subject" placeholder="Enter subject..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${rowCount-1}" data-field="subjectHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <div class="radio-cell" data-row="${rowCount-1}" data-field="acquisitionMethod">
                <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${rowCount-1}" value="Speed Post" onchange="saveRadioValue(this)"> Speed Post</label>
                <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${rowCount-1}" value="Registered Post" onchange="saveRadioValue(this)"> Registered Post</label>
                <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${rowCount-1}" value="Hand Delivery" onchange="saveRadioValue(this)"> Hand Delivery</label>
                <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${rowCount-1}" value="Email" onchange="saveRadioValue(this)"> Email</label>
                <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${rowCount-1}" value="E-file" onchange="saveRadioValue(this)"> E-file</label>
            </div>
        </td>
    `;

    tbody.appendChild(row);
    
    const cells = row.querySelectorAll('.cell');
    cells.forEach(cell => {
        addCellEventListeners(cell);
    });

}
function syncTableDataWithDOM() {
    const tbody = document.getElementById('tableBody');
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach((row) => {
        const firstCell = row.querySelector('[data-row]');
        if (!firstCell) return;
        const dataIndex = parseInt(firstCell.getAttribute('data-row'));
        if (isNaN(dataIndex)) return;

        if (!tableData[dataIndex]) {
            tableData[dataIndex] = {
                letterDate: '',
                acquiredOn: '',
                officeName: '',
                officeNameHindi: '',
                specificPerson: '',
                specificPersonHindi: '',
                letterNo: '',
                subject: '',
                subjectHindi: '',
                letterLanguage: '',
                zone: '',
                acquisitionMethod: ''
            };
        }

        const getCellValue = (cell) => {
            if (!cell) return '';
            if (cell.tagName === 'INPUT') return cell.value;
            if (cell.tagName === 'TEXTAREA') return cell.value;
            if (cell.contentEditable === 'true') return cell.innerHTML;
            return '';
        };

        const allInputs = row.querySelectorAll('input.cell, textarea.cell, [contenteditable="true"].cell');
        allInputs.forEach(input => {
            const field = input.getAttribute('data-field');
            if (field) tableData[dataIndex][field] = getCellValue(input);
        });

        const radioCells = row.querySelectorAll('.radio-cell');
        radioCells.forEach(radioCell => {
            const field = radioCell.getAttribute('data-field');
            const checkedRadio = radioCell.querySelector('input[type="radio"]:checked');
            if (field && tableData[dataIndex]) {
                if (checkedRadio) tableData[dataIndex][field] = checkedRadio.value;
            }
        });
    });
}

function getCellValueByColumn(row, column) {
    // For radio fields, use radio-cell DOM lookup
    const radioFields = ['letterLanguage', 'zone', 'acquisitionMethod'];
    if (radioFields.includes(column)) {
        const radioCell = row.querySelector(`.radio-cell[data-field="${column}"]`);
        if (radioCell) {
            const checked = radioCell.querySelector('input[type="radio"]:checked');
            return checked ? checked.value : '';
        }
        return '';
    }
    // For input/textarea fields, use data-field attribute
    const el = row.querySelector(`[data-field="${column}"]`);
    if (!el) return '';
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el.value;
    if (el.contentEditable === 'true') return el.textContent;
    return '';
}
//============================================
// LOAD USER DATA ON LOGIN
//============================================

async function loadUserData() {
    if (window.isLoadingData) {
        console.log('Already loading data, skipping duplicate call...');
        return;
    }

    if (!isAuthenticated()) {
        console.log('User not authenticated, skipping data load');
        return;
    }

    window.isLoadingData = true;

    try {
        console.log('Loading user data...');
        
        const response = await fetch('/api/acquired/load', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            removeAuthToken();
            alert('Session expired. Please login again.');
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success && result.data && result.data.length > 0) {
            console.log(`Loaded ${result.data.length} existing records`);
            
            originalData.clear();
            changedRows.clear();
            newRows.clear();
            
            tableData = result.data.map((row, index) => {
                originalData.set(row.id, createRowHash(row));
                
                return {
                    id: row.id,
                    serialNo: row.serialNo || index + 1,
                    letterDate: row.letterDate || row.acquiredDate || '',
                    acquiredOn: row.acquiredOn || '',
                    officeName: row.officeName || row.receivedFrom || '',
                    officeNameHindi: row.officeNameHindi || row.receivedFromHindi || '',
                    specificPerson: row.specificPerson || '',
                    specificPersonHindi: row.specificPersonHindi || '',
                    letterNo: row.letterNo || row.letterNumber || '',
                    subject: row.subject || '',
                    subjectHindi: row.subjectHindi || '',
                    letterLanguage: row.letterLanguage || '',
                    zone: row.zone || '',
                    acquisitionMethod: row.acquisitionMethod || '',
                    isFromDatabase: true,
                    hasChanges: false
                };
            });

            rowCount = tableData.length;
            // Snapshot original order for neutral sort
            originalTableOrder = tableData.map(row => ({ ...row }));
            rebuildTable();
            
            console.log(' User data loaded and displayed');
            showNotification(`Loaded ${result.data.length} existing records`, 'success');
            
        } else {
            // NEW USER - NO DATA FOUND
            console.log('ðŸ“­ No existing data found for user, creating 6 empty rows...');
            
            // Clear any existing data
            tableData = [];
            rowCount = 0;
            
            // Initialize with 6 empty rows for NEW users
            for (let i = 0; i < 6; i++) {
                addNewRow();
            }
            rebuildTable();
            
            showNotification('Welcome! Start entering your data', 'info');
        }
        
    } catch (error) {
        console.error(' Error loading user data:', error);
        showNotification('Error loading data. Starting fresh.', 'error');
        
        // Fallback: Create 6 empty rows
        tableData = [];
        rowCount = 0;
        for (let i = 0; i < 6; i++) {
            addNewRow();
        }
        rebuildTable();
    } finally {
        window.isLoadingData = false;
    }
}

//======================================================
//SMALL FEATURES
//=====================================================

function insertRowAfter(targetRow) {
    const tbody = document.getElementById('tableBody');
    const targetIndex = Array.from(tbody.children).indexOf(targetRow);
    
    rowCount++;
    const newRow = document.createElement('tr');
    
    const rowData = {
        letterDate: '',
        acquiredOn: '',
        officeName: '',
        officeNameHindi: '',
        specificPerson: '',
        letterNo: '',
        subject: '',
        subjectHindi: '',
        letterLanguage: '',
        zone: '',
        acquisitionMethod: ''
    };
    tableData.splice(targetIndex + 1, 0, rowData);
    
    newRow.innerHTML = `
        <td class="row-number">${rowCount}</td>
        <td><input type="text" class="cell english-cell" required data-row="${targetIndex + 1}" data-field="letterDate" placeholder="DD/MM/YYYY" style="height: 53px;"></td>
        <td><input type="text" class="cell english-cell" data-row="${targetIndex + 1}" data-field="acquiredOn" placeholder="DD/MM/YYYY" style="height: 53px;"></td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex + 1}" data-field="officeName" placeholder="Office / Dept name..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="officeNameHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td><input type="text" class="cell english-cell" data-row="${targetIndex + 1}" data-field="specificPerson" placeholder="Person name..." style="height: 53px;"></td>
        <td>
            <div class="radio-cell" data-row="${targetIndex + 1}" data-field="letterLanguage">
                <label class="radio-label"><input type="radio" name="acq_letterLanguage_${targetIndex + 1}" value="Hindi" onchange="saveRadioValue(this)"> Hindi</label>
                <label class="radio-label"><input type="radio" name="acq_letterLanguage_${targetIndex + 1}" value="English" onchange="saveRadioValue(this)"> English</label>
                <label class="radio-label"><input type="radio" name="acq_letterLanguage_${targetIndex + 1}" value="Bilingual" onchange="saveRadioValue(this)"> Bilingual</label>
            </div>
        </td>
        <td>
            <div class="radio-cell" data-row="${targetIndex + 1}" data-field="zone">
                <label class="radio-label"><input type="radio" name="acq_zone_${targetIndex + 1}" value="Zone 1" onchange="saveRadioValue(this)"> Zone 1</label>
                <label class="radio-label"><input type="radio" name="acq_zone_${targetIndex + 1}" value="Zone 2" onchange="saveRadioValue(this)"> Zone 2</label>
                <label class="radio-label"><input type="radio" name="acq_zone_${targetIndex + 1}" value="Zone 3" onchange="saveRadioValue(this)"> Zone 3</label>
            </div>
        </td>
        <td><input type="text" class="cell english-cell" required data-row="${targetIndex + 1}" data-field="letterNo" placeholder="e.g. NIC/2025/001" style="height: 53px;"></td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex + 1}" data-field="subject" placeholder="Enter subject..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="subjectHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <div class="radio-cell" data-row="${targetIndex + 1}" data-field="acquisitionMethod">
                <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${targetIndex + 1}" value="Speed Post" onchange="saveRadioValue(this)"> Speed Post</label>
                <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${targetIndex + 1}" value="Registered Post" onchange="saveRadioValue(this)"> Registered Post</label>
                <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${targetIndex + 1}" value="Hand Delivery" onchange="saveRadioValue(this)"> Hand Delivery</label>
                <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${targetIndex + 1}" value="Email" onchange="saveRadioValue(this)"> Email</label>
                <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${targetIndex + 1}" value="E-file" onchange="saveRadioValue(this)"> E-file</label>
            </div>
        </td>
    `;
    
    targetRow.parentNode.insertBefore(newRow, targetRow.nextSibling);
    
    const cells = newRow.querySelectorAll('.cell');
    cells.forEach(cell => {
        addCellEventListeners(cell);
    });
    
    updateRowNumbers();
    cells[0].focus();
}
function insertRowBefore(targetRow) {
    const tbody = document.getElementById('tableBody');
    const targetIndex = Array.from(tbody.children).indexOf(targetRow);
    
    rowCount++;
    const newRow = document.createElement('tr');
    
    const rowData = {
        letterDate: '',
        acquiredOn: '',
        officeName: '',
        officeNameHindi: '',
        specificPerson: '',
        letterNo: '',
        subject: '',
        subjectHindi: '',
        letterLanguage: '',
        zone: '',
        acquisitionMethod: ''
    };
    tableData.splice(targetIndex, 0, rowData);
    
    newRow.innerHTML = `
        <td class="row-number">${rowCount}</td>
        <td><input type="text" class="cell english-cell" required data-row="${targetIndex}" data-field="letterDate" placeholder="DD/MM/YYYY" style="height: 53px;"></td>
        <td><input type="text" class="cell english-cell" data-row="${targetIndex}" data-field="acquiredOn" placeholder="DD/MM/YYYY" style="height: 53px;"></td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex}" data-field="officeName" placeholder="Office / Dept name..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex}" data-field="officeNameHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td><input type="text" class="cell english-cell" data-row="${targetIndex}" data-field="specificPerson" placeholder="Person name..." style="height: 53px;"></td>
        <td>
            <div class="radio-cell" data-row="${targetIndex}" data-field="letterLanguage">
                <label class="radio-label"><input type="radio" name="acq_letterLanguage_${targetIndex}" value="Hindi" onchange="saveRadioValue(this)"> Hindi</label>
                <label class="radio-label"><input type="radio" name="acq_letterLanguage_${targetIndex}" value="English" onchange="saveRadioValue(this)"> English</label>
                <label class="radio-label"><input type="radio" name="acq_letterLanguage_${targetIndex}" value="Bilingual" onchange="saveRadioValue(this)"> Bilingual</label>
            </div>
        </td>
        <td>
            <div class="radio-cell" data-row="${targetIndex}" data-field="zone">
                <label class="radio-label"><input type="radio" name="acq_zone_${targetIndex}" value="Zone 1" onchange="saveRadioValue(this)"> Zone 1</label>
                <label class="radio-label"><input type="radio" name="acq_zone_${targetIndex}" value="Zone 2" onchange="saveRadioValue(this)"> Zone 2</label>
                <label class="radio-label"><input type="radio" name="acq_zone_${targetIndex}" value="Zone 3" onchange="saveRadioValue(this)"> Zone 3</label>
            </div>
        </td>
        <td><input type="text" class="cell english-cell" required data-row="${targetIndex}" data-field="letterNo" placeholder="e.g. NIC/2025/001" style="height: 53px;"></td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex}" data-field="subject" placeholder="Enter subject..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex}" data-field="subjectHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <div class="radio-cell" data-row="${targetIndex}" data-field="acquisitionMethod">
                <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${targetIndex}" value="Speed Post" onchange="saveRadioValue(this)"> Speed Post</label>
                <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${targetIndex}" value="Registered Post" onchange="saveRadioValue(this)"> Registered Post</label>
                <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${targetIndex}" value="Hand Delivery" onchange="saveRadioValue(this)"> Hand Delivery</label>
                <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${targetIndex}" value="Email" onchange="saveRadioValue(this)"> Email</label>
                <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${targetIndex}" value="E-file" onchange="saveRadioValue(this)"> E-file</label>
            </div>
        </td>
    `;
    
    targetRow.parentNode.insertBefore(newRow, targetRow);
    
    const cells = newRow.querySelectorAll('.cell');
    cells.forEach(cell => {
        addCellEventListeners(cell);
    });
    
    updateRowNumbers();
    cells[0].focus();
}

function deleteRow(row, index) {
    const tbody = document.getElementById('tableBody');
    if (tbody.children.length <= 1) {
        alert('Cannot delete the last row!');
        return;
    }
    
    tableData.splice(index, 1);
    row.remove();
    updateRowNumbers();
    rowCount--;
}

// Save radio button value to tableData
function saveRadioValue(radioInput) {
    const radioCell = radioInput.closest('.radio-cell');
    if (!radioCell) return;
    const row = parseInt(radioCell.getAttribute('data-row'));
    const field = radioCell.getAttribute('data-field');
    const value = radioInput.value;
    
    if (tableData[row]) {
        tableData[row][field] = value;
        
        if (tableData[row].isFromDatabase) {
            const currentHash = createRowHash(tableData[row]);
            const originalHash = originalData.get(tableData[row].id);
            if (currentHash !== originalHash) {
                changedRows.add(row);
                tableData[row].hasChanges = true;
            }
        } else {
            newRows.add(row);
        }
        updateRowVisualStatus(row);
    }
}

function addCellEventListeners(cell) {
    const field = cell.getAttribute('data-field');
    if (field === 'letterDate' || field === 'acquiredOn') {
        cell.placeholder = 'DD/MM/YYYY';
        cell.addEventListener('input', () => restrictDateInput(cell));
        cell.addEventListener('blur', () => restrictDateInput(cell));
    }

    cell.addEventListener('focus', function() {
        this.classList.add('editing');
        if (this.tagName === 'INPUT') {
            this.select();
        }
    });

    cell.addEventListener('blur', async function() {
        this.classList.remove('editing');
        await saveData(this);
    });

    cell.addEventListener('keydown', async function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.blur();
            moveToNextCell(this);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            this.blur();
            moveToNextCell(this);
        }
    });

    cell.addEventListener('input', debounce(async function() {
        await saveData(this);
    }, 300));
}

//==============================================
// DATABASE INTEGRATION FUNCTIONS
//==============================================

function validateRowData(rowData, rowIndex) {
    const requiredFields = ['letterDate', 'officeName', 'letterNo', 'subject', 'letterLanguage'];
    const missingFields = [];
    
    for (const field of requiredFields) {
        if (!rowData[field] || rowData[field].trim() === '') {
            missingFields.push(field);
        }
    }
    
    if (missingFields.length > 0) {
        return {
            isValid: false, 
            error: `Row ${rowIndex + 1}: Missing required fields - ${missingFields.join(', ')}`
        };
    }
    
    return { isValid: true };
}

function getFilledRows() {
    const filledRows = [];
    const validationErrors = [];
    let foundFirstEmpty = false; 
    
    for (let index = 0; index < tableData.length; index++) {
        const rowData = tableData[index];
        const hasData = Object.values(rowData).some(value =>
            value && value.toString().trim() !== '' && value !== index + 1
        );
    
        if (hasData) {
            if (foundFirstEmpty) {
                validationErrors.push(
                    `Row ${index}: Has empty fields. Please fill all required fields before Saving.`
                );
            }
            const validation = validateRowData(rowData, index);
            if (validation.isValid) {
                filledRows.push({
                    ...rowData,
                    serialNo: index + 1
                });
            } else {
                validationErrors.push(validation.error);
            }
        }
        else{
            foundFirstEmpty = true;
        }
    }
    return { filledRows, validationErrors };
}

//=============================
//SAVE TO DATABASE
//=============================

async function saveToDatabase() {
    if (!isAuthenticated()) {
        alert('Please login first to save data.');
        window.location.href = 'login.html';
        return;
    }

    syncTableDataWithDOM();

    // Validate: no empty middle rows
    if (!validateNoMiddleEmptyRows()) return;

    const changedRowsData = [];
    const newRowsData = [];

    tableData.forEach((rowData, rowIndex) => {
        if (rowData.isFromDatabase) {
            const currentHash = createRowHash(rowData);
            const originalHash = originalData.get(rowIndex);
            if (originalHash !== undefined && currentHash !== originalHash) {
                changedRows.add(rowIndex);
                rowData.hasChanges = true;
            }
        } else {
            const hasAnyData = Object.entries(rowData).some(([k, v]) =>
                k !== 'isFromDatabase' && k !== 'hasChanges' && k !== 'id' &&
                v && v.toString().trim() !== ''
            );
            if (hasAnyData) newRows.add(rowIndex);
        }
    });
    
    changedRows.forEach(rowIndex => {
        if (tableData[rowIndex]) {
            const rowData = tableData[rowIndex];
            if (hasRequiredFields(rowData)) {
                changedRowsData.push({
                    ...rowData,
                    serialNo: rowIndex + 1,
                    operation: 'update'
                });
            }
        }
    });
    
    newRows.forEach(rowIndex => {
        if (tableData[rowIndex]) {
            const rowData = tableData[rowIndex];
            if (hasRequiredFields(rowData)) {
                newRowsData.push({
                    ...rowData,
                    serialNo: rowIndex + 1,
                    operation: 'insert'
                });
            }
        }
    });

    const totalChanges = changedRowsData.length + newRowsData.length;
    
    if (totalChanges === 0) {
        alert('No changes to save.');
        return;
    }

    const confirmMessage = `Save ${totalChanges} changes?\n\n` +
        ` ${newRowsData.length} new rows\n` +
        ` ${changedRowsData.length} modified rows`;
        
    if (!confirm(confirmMessage)) {
        return;
    }

    console.log(`„ Saving ${totalChanges} changed rows...`);
    
    try {
        const saveBtn = document.querySelector('.save-btn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = ' Saving Changes...';
        saveBtn.disabled = true;

        const response = await fetch('/api/acquired/save-changes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                changedRows: changedRowsData,
                newRows: newRowsData
            })
        });

        if (response.status === 401 || response.status === 403) {
            removeAuthToken();
            alert('Session expired. Please login again.');
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const result = await response.json();
        
        if (result.success) {
            changedRows.forEach(rowIndex => {
                if (tableData[rowIndex]) {
                    originalData.set(rowIndex, createRowHash(tableData[rowIndex]));
                    tableData[rowIndex].hasChanges = false;
                }
            });
            
            newRows.forEach(rowIndex => {
                if (tableData[rowIndex] && result.newRowIds && result.newRowIds[rowIndex]) {
                    tableData[rowIndex].id = result.newRowIds[rowIndex];
                    tableData[rowIndex].isFromDatabase = true;
                    originalData.set(rowIndex, createRowHash(tableData[rowIndex]));
                }
            });
            
            changedRows.clear();
            newRows.clear();
            
            document.querySelectorAll('.row-changed, .row-new').forEach(row => {
                row.classList.remove('row-changed', 'row-new');
            });
            
            saveBtn.textContent = ' Changes Saved!';
            setTimeout(() => {
                saveBtn.textContent = originalText;
            }, 3000);
            
            showNotification(`Successfully saved ${totalChanges} changes`, 'success');
            
        } else {
            throw new Error(result.error || 'Failed to save changes');
        }
        
    } catch (error) {
        console.error(' Save error:', error);
        alert(' Error saving changes: ' + error.message);
    } finally {
        const saveBtn = document.querySelector('.save-btn');
        if (!saveBtn.textContent.includes('')) {
            saveBtn.textContent = 'Save Changes';
        }
        saveBtn.disabled = false;
    }
}

//============================================
//TRANSLATION
//============================================
/*
async function translateText(text) {
    if (translationCache.has(text)) {
        return translationCache.get(text);
    }
    
    try {
        const response = await fetch("https://d-jaden02-pys-deep-transalator.hf.space/translate", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                max_length: 512
            })
        });
        
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.translated_text) {
            const translated = data.translated_text;
            translationCache.set(text, translated);
            return translated;
        } else {
            throw new Error(data.error || 'Invalid response from translation API');
        }
    } catch (error) {
        console.warn('Translation API unavailable, skipping translation:', error.message);
        return text;
    }
}

async function translateTextBatch(texts) {
    try {
        const response = await fetch("https://d-jaden02-pys-deep-transalator.hf.space/batch_translate", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                texts: texts,
                max_length: 512
            })
        });
        
        if (!response.ok) {
            throw new Error(`Batch API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.results) {
            const translations = {};
            data.results.forEach((result, index) => {
                if (!result.error && result.translated_text) {
                    translations[texts[index]] = result.translated_text;
                    translationCache.set(texts[index], result.translated_text);
                } else {
                    translations[texts[index]] = texts[index];
                }
            });
            return translations;
        } else {
            throw new Error('Invalid batch response from translation API');
        }
    } catch (error) {
        console.error('Batch translation error:', error);
        const fallback = {};
        texts.forEach(text => fallback[text] = text);
        return fallback;
    }
}
*/
//============================================
//TRANSLATION
//============================================

let gradioClient = null;

async function getClient() {
    if (!gradioClient) {
        const { Client } = await import("https://esm.sh/@gradio/client");
        gradioClient = await Client.connect("D-Jaden02/Krutrim_English_Hi_Translation");
    }
    return gradioClient;
}

async function translateText(text) {
    if (!text?.trim()) return text;
    if (translationCache.has(text)) return translationCache.get(text);

    try {
        const client = await getClient();
        const result = await client.predict("/translate", { text: text });
        const translated = result.data[0];
        translationCache.set(text, translated);
        return translated;
    } catch (error) {
        console.error('Translation error:', error);
        return text;
    }
}

async function translateTextBatch(texts) {
    const client = await getClient(); // connect once
    const results = await Promise.all(
        texts.map(async (text) => {
            if (translationCache.has(text)) return translationCache.get(text);
            try {
                const result = await client.predict("/translate", { text });
                const translated = result.data[0];
                translationCache.set(text, translated);
                return translated;
            } catch {
                return text;
            }
        })
    );
    const map = {};
    texts.forEach((t, i) => map[t] = results[i]);
    return map;
}

async function translateText(text) {
    console.log('Translation requested for:', text);

    if (translationCache.has(text)) {
        console.log('Using cached translation');
        return translationCache.get(text);
    }

    try {
        const { Client } = await import("https://esm.sh/@gradio/client");
        const client = await Client.connect("D-Jaden02/Krutrim_English_Hi_Translation");
        const result = await client.predict("/translate", { text: text });

        const translated = result.data[0];
        translationCache.set(text, translated);
        console.log('Translation successful:', translated);
        return translated;

    } catch (error) {
        console.error('Translation error:', error);
        return text; // fallback to original
    }
}

async function translateTextBatch(texts) {
    const results = await Promise.all(texts.map(t => translateText(t)));
    const map = {};
    texts.forEach((t, i) => map[t] = results[i]);
    return map;
}

async function saveData(cell) {
    const row = parseInt(cell.getAttribute('data-row'));
    const field = cell.getAttribute('data-field');
    const value = cell.contentEditable === 'true' ? cell.innerHTML : cell.value;

    if (tableData[row]) {
        const oldValue = tableData[row][field];
        tableData[row][field] = value;

        // Track changes (skip signature field as it's not required)
        if (field !== 'signature' && tableData[row].isFromDatabase) {
            const currentHash = createRowHash(tableData[row]);
            const originalHash = originalData.get(tableData[row].id);
            
            if (currentHash !== originalHash) {
                changedRows.add(row);
                tableData[row].hasChanges = true;
                console.log(`ðŸ“ Row ${row + 1} marked as changed`);
            } else {
                changedRows.delete(row);
                tableData[row].hasChanges = false;
            }
        } else if (field !== 'signature') {
            newRows.add(row);
        }

        // Handle automatic translation for translatable columns
        // translatableColumns = ['receivedFrom', 'subject']
        if (translatableColumns.includes(field) && !field.endsWith('Hindi') && value) {
            const hindiField = `${field}Hindi`;
            
            // IMPORTANT: Look for TEXTAREA (not input) for Hindi fields
            const hindiInput = document.querySelector(`textarea[data-row="${row}"][data-field="${hindiField}"]`);
            
            if (hindiInput) {
                // Strip HTML tags for translation
                const textToTranslate = value.replace(/<[^>]*>/g, '');
                
                const translatedText = await translateText(textToTranslate);

                // Update the Hindi textarea
                hindiInput.value = translatedText;
                hindiInput.disabled = false;
                tableData[row][hindiField] = translatedText;
                
                // Mark as changed if needed
                if (tableData[row].isFromDatabase) {
                    const currentHash = createRowHash(tableData[row]);
                    const originalHash = originalData.get(tableData[row].id);
                    
                    if (currentHash !== originalHash) {
                        changedRows.add(row);
                        tableData[row].hasChanges = true;
                    }
                }
            } else {
                console.warn(` Hindi textarea not found for field: ${hindiField}`);
                console.warn(`   Looking for: textarea[data-row="${row}"][data-field="${hindiField}"]`);
            }
        }
        
        updateRowVisualStatus(row);
    }
}

//============================================
// VISUAL INDICATORS FOR CHANGED ROWS
//============================================

function updateRowVisualStatus(rowIndex) {
    const tbody = document.getElementById('tableBody');
    const rows = tbody.querySelectorAll('tr');
    const startIdx = (currentPage - 1) * entriesPerPage;
    const tableRowIndex = rowIndex - startIdx;
    
    if (rows[tableRowIndex]) {
        const row = rows[tableRowIndex];
        
        if (changedRows.has(rowIndex)) {
            row.classList.add('row-changed');
            row.title = 'This row has been modified';
        } else if (newRows.has(rowIndex)) {
            row.classList.add('row-new');
            row.title = 'This is a new row';
        } else {
            row.classList.remove('row-changed', 'row-new');
            row.title = '';
        }
    }
}

//================================
// CONFIRM LOGOUT
//================================

document.addEventListener('DOMContentLoaded', function() {
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (confirm('Are you sure you want to logout? Remember To Save')) {
                window.location.href = 'login.html';
            }
        });
    }
});

//============================================
// PDF EXPORT FUNCTIONALITY
//============================================
function exportToPDF() {
    syncTableDataWithDOM();

    const original = document.getElementById('excelTable');
    if (!original) {
        showNotification('Error: Table not found', 'error');
        return;
    }

    const clone = original.cloneNode(true);
    clone.style.cssText = [
        'position:static',
        'bottom:auto',
        'left:auto',
        'margin:0',
        'width:100%',
        'border-radius:0',
        'box-shadow:none'
    ].join(' !important;') + ' !important;';

    clone.querySelectorAll('.hamburger-menu, .sort-dropdown').forEach(el => el.remove());
    clone.querySelectorAll('.row-changed, .row-new').forEach(r => {
        r.classList.remove('row-changed', 'row-new');
        r.style.borderLeft = 'none';
    });

    clone.querySelectorAll('thead th').forEach(th => {
        const span = th.querySelector('.column-header span');
        if (span) th.textContent = span.textContent;
    });

    clone.querySelectorAll('tbody tr').forEach(row => {
        row.querySelectorAll('td').forEach((cell, index) => {
            if (index === 0) {
                const rn = cell.querySelector('.row-number');
                if (rn) cell.textContent = rn.textContent;
                return;
            }

            const radioCell = cell.querySelector('.radio-cell');
            if (radioCell) {
                const checked = radioCell.querySelector('input[type="radio"]:checked');
                cell.innerHTML = '';
                const span = document.createElement('span');
                span.textContent = checked ? checked.value : '—';
                span.style.cssText = 'font-size:11px; font-weight:600; color:#1a5276;';
                cell.appendChild(span);
                return;
            }

            const inputs = cell.querySelectorAll('input.cell');
            const ces = cell.querySelectorAll('[contenteditable="true"].cell');

            if (ces.length > 0) {
                function wrapText(text, wordsPerLine) {
                    const words = text.trim().split(/\s+/).filter(Boolean);
                    const chunks = [];
                    for (let j = 0; j < words.length; j += wordsPerLine) {
                        chunks.push(words.slice(j, j + wordsPerLine).join(' '));
                    }
                    return chunks.join('<br>');
                }

                const container = document.createElement('div');
                container.style.cssText = 'white-space:normal;word-wrap:break-word;overflow-wrap:break-word;overflow:visible;max-width:100%;text-align:left;';
                
                ces.forEach((ce, i) => {
                    const rawText = ce.textContent.trim();
                    if (!rawText) return;
                    
                    const d = document.createElement('div');
                    d.innerHTML = wrapText(rawText, 6);
                    
                    if (i === 1) { // Hindi
                        d.style.cssText = 'font-family:"Noto Sans Devanagari",sans-serif;font-size:0.95em;color:#555;'
                            + 'margin-top:4px;padding-top:3px;border-top:1px solid #ddd;'
                            + 'white-space:normal;word-wrap:break-word;overflow-wrap:break-word;overflow:visible;height:auto;line-height:1.6;';
                    } else { // English
                        d.style.cssText = 'margin-bottom:2px;white-space:normal;word-wrap:break-word;overflow-wrap:break-word;overflow:visible;height:auto;line-height:1.5;';
                    }
                    container.appendChild(d);
                });
                cell.innerHTML = '';
                cell.appendChild(container);
                return;
            }

            if (!inputs.length) return;

            if (inputs.length === 1) {
                cell.textContent = inputs[0].value || '';
            } else {
                const eng = cell.querySelector('.english-cell');
                const hin = cell.querySelector('.hindi-cell');
                const container = document.createElement('div');
                if (eng && eng.value.trim()) {
                    const d = document.createElement('div');
                    d.textContent = eng.value.trim();
                    d.style.marginBottom = '2px';
                    container.appendChild(d);
                }
                if (hin && hin.value.trim()) {
                    const d = document.createElement('div');
                    d.textContent = hin.value.trim();
                    d.style.cssText = 'font-family:"Noto Sans Devanagari",sans-serif;font-size:0.95em;color:#555;';
                    container.appendChild(d);
                }
                cell.innerHTML = '';
                cell.appendChild(container);
            }
        });
    });

    // ── Force-apply inline column widths and wrap styles ─────────────────────
    const acquiredColWidths = ['5%','10%','18%','12%','25%','13%','17%'];
    clone.querySelectorAll('thead tr th').forEach((th, i) => {
        if (acquiredColWidths[i]) {
            th.style.width    = acquiredColWidths[i];
            th.style.maxWidth = acquiredColWidths[i];
        }
    });

    clone.querySelectorAll('tbody tr').forEach(row => {
        row.querySelectorAll('td').forEach((cell, idx) => {
            if (acquiredColWidths[idx]) {
                cell.style.width    = acquiredColWidths[idx];
                cell.style.maxWidth = acquiredColWidths[idx];
            }
            cell.style.whiteSpace    = 'normal';
            cell.style.wordWrap      = 'break-word';
            cell.style.overflowWrap  = 'break-word';
            cell.style.overflow      = 'hidden';
            cell.style.verticalAlign = 'middle';
            cell.style.padding       = '7px 5px';
            cell.style.fontSize      = '11px';
            cell.style.lineHeight    = '1.4';
            cell.style.boxSizing     = 'border-box';

            // Subject column (0-indexed 4): ensure native CSS word-wrap renders fully
            if (idx === 4) {
                cell.style.textAlign = 'left';
                cell.style.overflow  = 'visible';
                cell.style.height    = 'auto';

                // Fallback: If it's pure text (no divs appended by ces.forEach), apply fallback wrap
                if (!cell.querySelector('div')) {
                    const text = cell.textContent.trim();
                    if (text) {
                        const words = text.split(/\s+/).filter(Boolean);
                        const chunks = [];
                        for (let j = 0; j < words.length; j += 6) {
                            chunks.push(words.slice(j, j + 6).join(' '));
                        }
                        cell.innerHTML = chunks.join('<br>');
                        cell.style.whiteSpace = 'normal';
                    }
                }
            }
        });
    });

    const style = document.createElement('style');
    style.textContent = `
        * { box-sizing: border-box !important; }

        table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-family: Arial, "Segoe UI", sans-serif !important;
            font-size: 11px !important;
            table-layout: fixed !important;
            position: static !important;
            bottom: auto !important;
            left: auto !important;
            margin: 0 !important;
        }

        thead { display: table-header-group !important; }
        tbody { display: table-row-group !important; }
        tr { page-break-inside: avoid !important; break-inside: avoid !important; }

        th {
            background-color: #34495e !important;
            color: white !important;
            padding: 8px 5px !important;
            text-align: center !important;
            font-weight: 700 !important;
            border: 1px solid #2c3e50 !important;
            font-size: 11px !important;
            word-wrap: break-word !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        td {
            border: 1px solid #ccc !important;
            padding: 7px 5px !important;
            vertical-align: middle !important;
            text-align: center !important;
            font-size: 11px !important;
            line-height: 1.4 !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            overflow: visible !important;
            text-overflow: clip !important;
            white-space: normal !important;
        }

        tbody tr:nth-child(even) td {
            background-color: #f5f5f5 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        td:first-child {
            background-color: #ecf0f1 !important;
            font-weight: 700 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        /* 7 columns — A3 landscape ~420mm usable width */
        th:nth-child(1), td:nth-child(1) { width: 5%  !important; }
        th:nth-child(2), td:nth-child(2) { width: 10% !important; }
        th:nth-child(3), td:nth-child(3) { width: 18% !important; }
        th:nth-child(4), td:nth-child(4) { width: 12% !important; }

        /* Subject column — wraps text */
        th:nth-child(5), td:nth-child(5) {
            width: 25% !important;
            white-space: normal !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            text-align: left !important;
        }

        th:nth-child(6), td:nth-child(6) { width: 13% !important; }
        th:nth-child(7), td:nth-child(7) { width: 17% !important; }
    `;
    // Inject PDF styles into <head> so html2canvas can pick them up correctly
    style.setAttribute('data-pdf-style', 'acquired');
    document.head.appendChild(style);

    const stage = document.createElement('div');
    stage.style.cssText = 'position:fixed;top:0;left:0;width:297mm;z-index:-99999;background:white;overflow:visible;pointer-events:none;';
    stage.appendChild(clone);
    document.body.appendChild(stage);

    const opt = {
        margin: [5, 5, 5, 5],
        filename: `DAK_Acquired_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0
        },
        jsPDF: {
            unit: 'mm',
            format: 'a3',
            orientation: 'landscape',
            compress: true
        },
        pagebreak: {
            mode: ['avoid-all', 'css', 'legacy'],
            avoid: 'tr'
        }
    };

    html2pdf()
        .set(opt)
        .from(clone)
        .save()
        .then(() => {
            document.body.removeChild(stage);
            document.querySelector('style[data-pdf-style="acquired"]')?.remove();
            showNotification('PDF exported successfully!', 'success');
        })
        .catch(err => {
            document.body.removeChild(stage);
            document.querySelector('style[data-pdf-style="acquired"]')?.remove();
            console.error('PDF error:', err);
            showNotification('Error generating PDF: ' + err.message, 'error');
        });
}


//=====================================
// REBUILD DATA FOR NO OF ENTRIES
//===================================== 

function rebuildTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    const requiredRows = entriesPerPage * currentPage;
    while (tableData.length < requiredRows) {
        tableData.push({
            letterDate: '', acquiredOn: '',
            officeName: '', officeNameHindi: '',
            specificPerson: '', specificPersonHindi: '',
            letterNo: '',
            subject: '', subjectHindi: '',
            letterLanguage: '', zone: '', acquisitionMethod: ''
        });
    }

    const startIdx = (currentPage - 1) * entriesPerPage;
    const endIdx = Math.min(startIdx + entriesPerPage, tableData.length);
    const pageRows = tableData.slice(startIdx, endIdx);

    pageRows.forEach((rowData, index) => {
        const serialNumber = startIdx + index + 1;
        const row = document.createElement('tr');
        
        const hasHTMLFormatting = (text) => {
            return text && (text.includes('<strong>') || text.includes('<em>') || text.includes('<u>'));
        };
        
        const createCellContent = (field, value, isEnglish = true, isDate = false, isShort = false) => {
            const className = isEnglish ? 'cell english-cell' : 'cell hindi-cell';
            const isHindi = !isEnglish;
            const placeholder = isDate ? 'DD/MM/YYYY' : (isShort ? 'Enter ...' : (isEnglish ? 'Enter Information...' : 'Hindi translation...'));
            const required = isEnglish && !isHindi ? 'required' : '';
            const disabled = isHindi && !value ? 'disabled' : '';
            
            if (hasHTMLFormatting(value)) {
                return `<div contenteditable="true" class="${className}" data-row="${startIdx + index}" data-field="${field}" style="width:100%;min-height:53px;height:auto;padding:12px;border:none;outline:none;resize:none;">${value || ''}</div>`;
            } else if (isDate || isShort) {
                return `<input type="text" class="${className}" ${required} data-row="${startIdx + index}" data-field="${field}" placeholder="${placeholder}" value="${value || ''}" style="height:53px;resize:none;">`;
            } else {
                return `<textarea class="${className}" ${required} data-row="${startIdx + index}" data-field="${field}" placeholder="${placeholder}" ${disabled} rows="2" style="resize:vertical;min-height:53px;height:auto;">${value || ''}</textarea>`;
            }
        };

        const r = startIdx + index;
        const chk = (field, val) => rowData[field] === val ? 'checked' : '';
        
        row.innerHTML = `
            <td class="row-number">${serialNumber}</td>
            <td>${createCellContent('letterDate',   rowData.letterDate,   true, true)}</td>
            <td>${createCellContent('acquiredOn',   rowData.acquiredOn,   true, true)}</td>
            <td>
                ${createCellContent('officeName',      rowData.officeName,      true)}
                ${createCellContent('officeNameHindi', rowData.officeNameHindi, false)}
            </td>
            <td>
                ${createCellContent('specificPerson',      rowData.specificPerson,      true, false, true)}
                ${createCellContent('specificPersonHindi', rowData.specificPersonHindi, false)}
            </td>
            <td>
                <div class="radio-cell" data-row="${r}" data-field="letterLanguage">
                    <label class="radio-label"><input type="radio" name="acq_letterLanguage_${r}" value="Hindi"     ${chk('letterLanguage','Hindi')}     onchange="saveRadioValue(this)"> Hindi</label>
                    <label class="radio-label"><input type="radio" name="acq_letterLanguage_${r}" value="English"  ${chk('letterLanguage','English')}  onchange="saveRadioValue(this)"> English</label>
                    <label class="radio-label"><input type="radio" name="acq_letterLanguage_${r}" value="Bilingual" ${chk('letterLanguage','Bilingual')} onchange="saveRadioValue(this)"> Bilingual</label>
                </div>
            </td>
            <td>
                <div class="radio-cell" data-row="${r}" data-field="zone">
                    <label class="radio-label"><input type="radio" name="acq_zone_${r}" value="Zone 1" ${chk('zone','Zone 1')} onchange="saveRadioValue(this)"> Zone 1</label>
                    <label class="radio-label"><input type="radio" name="acq_zone_${r}" value="Zone 2" ${chk('zone','Zone 2')} onchange="saveRadioValue(this)"> Zone 2</label>
                    <label class="radio-label"><input type="radio" name="acq_zone_${r}" value="Zone 3" ${chk('zone','Zone 3')} onchange="saveRadioValue(this)"> Zone 3</label>
                </div>
            </td>
            <td>${createCellContent('letterNo', rowData.letterNo, true, false, true)}</td>
            <td>
                ${createCellContent('subject',      rowData.subject,      true)}
                ${createCellContent('subjectHindi', rowData.subjectHindi, false)}
            </td>
            <td>
                <div class="radio-cell" data-row="${r}" data-field="acquisitionMethod">
                    <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${r}" value="Speed Post"      ${chk('acquisitionMethod','Speed Post')}      onchange="saveRadioValue(this)"> Speed Post</label>
                    <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${r}" value="Registered Post" ${chk('acquisitionMethod','Registered Post')} onchange="saveRadioValue(this)"> Registered Post</label>
                    <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${r}" value="Hand Delivery"   ${chk('acquisitionMethod','Hand Delivery')}   onchange="saveRadioValue(this)"> Hand Delivery</label>
                    <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${r}" value="Email"          ${chk('acquisitionMethod','Email')}          onchange="saveRadioValue(this)"> Email</label>
                    <label class="radio-label"><input type="radio" name="acq_acquisitionMethod_${r}" value="E-file"         ${chk('acquisitionMethod','E-file')}         onchange="saveRadioValue(this)"> E-file</label>
                </div>
            </td>
        `;
        tbody.appendChild(row);

        const cells = row.querySelectorAll('.cell, [contenteditable="true"]');
        cells.forEach(cell => {
            if (cell.tagName === 'INPUT' || cell.tagName === 'TEXTAREA') {
                addCellEventListeners(cell);
            } else if (cell.contentEditable === 'true') {
                addContentEditableListeners(cell);
            }
        });
    });

    renderPaginationControls();
}

//============================================
// HELPER FUNCTIONS
//============================================

function hasRequiredFields(rowData) {
    const requiredFields = ['letterDate', 'officeName', 'letterNo', 'subject', 'letterLanguage', 'zone', 'acquisitionMethod'];
    const missing = requiredFields.filter(field => 
        !rowData[field] || rowData[field].toString().trim() === ''
    );
    return missing.length === 0;
}

function isRowEmpty(rowData) {
    const meaningfulFields = ['letterDate', 'acquiredOn', 'officeName', 'specificPerson', 'letterNo', 'subject', 'letterLanguage', 'zone', 'acquisitionMethod'];
    return meaningfulFields.every(field => !rowData[field] || rowData[field].toString().trim() === '');
}

function validateNoMiddleEmptyRows() {
    syncTableDataWithDOM();
    let lastFilledIndex = -1;
    
    // Find the last row with any data
    for (let i = tableData.length - 1; i >= 0; i--) {
        if (!isRowEmpty(tableData[i])) {
            lastFilledIndex = i;
            break;
        }
    }
    
    if (lastFilledIndex === -1) return true; // all empty, nothing to validate
    
    // Check every row from 0 to lastFilledIndex — none can be empty
    for (let i = 0; i <= lastFilledIndex; i++) {
        if (isRowEmpty(tableData[i])) {
            alert(`Row ${i + 1} is empty but row ${lastFilledIndex + 1} has data.\nPlease fill rows sequentially from top to bottom.\nRow ${i + 1} must be completed before saving.`);
            return false;
        }
    }
    
    return true;
}

function showNotification(message, type = 'info') {
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(notification);
    }
    
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        info: '#2196F3'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    notification.textContent = message;
    notification.style.opacity = '1';
    
    setTimeout(() => {
        notification.style.opacity = '0';
    }, 3000);
}

//==========================================================
// PAGINATION CONTROLS FOR GOING FROM ONE PAGE TO ANOTHER
//==========================================================

function renderPaginationControls() {
    let pagination = document.getElementById('pagination-controls');
    if (!pagination) {
        pagination = document.createElement('div');
        pagination.id = 'pagination-controls';
        pagination.style.margin = '10px 0';
        pagination.style.textAlign = 'center';
        document.getElementById('excelTable').after(pagination);
    }

    const totalPages = Math.ceil(tableData.length / entriesPerPage);
    pagination.innerHTML = `
        <button ${currentPage === 1 ? 'disabled' : ''} id="prevPageBtn">Previous</button>
        <span> Page ${currentPage} of ${totalPages} </span>
        <button ${currentPage === totalPages ? 'disabled' : ''} id="nextPageBtn">Next</button>
    `;

    document.getElementById('prevPageBtn').onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            rebuildTable();
        }
    };
    document.getElementById('nextPageBtn').onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            rebuildTable();
        }
    };
}

// Add PDF button event listener
document.addEventListener('DOMContentLoaded', function() {
    const pdfBtn = document.getElementById('pdfView');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', exportToPDF);
        console.log(' PDF button listener attached');
    }
});