//=========================
//START
//=========================

let rowCount = 0;
let tableData = [];
let entriesPerPage = 6;
let currentPage = 1;
let translationCache = new Map();
const translatableColumns = ['toWhom', 'copySentTo', 'mainAddress', 'place', 'subject', 'sentBy'];


let originalData = new Map();
let changedRows = new Set();
let newRows = new Set();

let columnFilters = {};
let originalTableOrder = []; // for neutral sort

//======================================
//UTILITY FUNCTIONS FOR DATA HANDLING
//======================================

// Create a hash of row data for comparison
function createRowHash(rowData) {
    const relevantData = {
        letterDate: rowData.letterDate || '',
        registrationDate: rowData.registrationDate || '',
        toWhom: rowData.toWhom || '',
        toWhomHindi: rowData.toWhomHindi || '',
        copySentTo: rowData.copySentTo || '',
        copySentToHindi: rowData.copySentToHindi || '',
        mainAddress: rowData.mainAddress || '',
        mainAddressHindi: rowData.mainAddressHindi || '',
        place: rowData.place || '',
        placeHindi: rowData.placeHindi || '',
        subject: rowData.subject || '',
        subjectHindi: rowData.subjectHindi || '',
        sentBy: rowData.sentBy || '',
        sentByHindi: rowData.sentByHindi || '',
        letterNo: rowData.letterNo || '',
        deliveryMethod: rowData.deliveryMethod || '',
        letterLanguage: rowData.letterLanguage || '',
        zone: rowData.zone || ''
    };
    return JSON.stringify(relevantData);
}

// Debounce utility

//========================================
//MOBILE TOOLBAR
//========================================

// Function to switch to the other page with flip effect
function switchPage(targetPage) {
    // SAVE current table data to sessionStorage before switching
    syncTableDataWithDOM(); // Make sure we have latest data
    sessionStorage.setItem('despatch_preservedTableData', JSON.stringify(tableData));
    sessionStorage.setItem('despatch_preservedRowCount', rowCount.toString());

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

//=============================
//=====SORTING COLUMNS=========
//=============================

//------TOGGLE SORT MENU------//
//----------------------------------------SORT COLUMN---------------------------------------------//

function sortColumn(field, order) {
    syncTableDataWithDOM();

    if (order === 'neutral') {
        if (originalTableOrder.length > 0) {
            tableData = originalTableOrder.map(row => ({ ...row }));
        }
        rebuildTable();
        applyAllFilters();
        document.querySelectorAll('.sort-dropdown').forEach(d => d.classList.remove('show'));
        return;
    }

    // Separate empty and filled rows
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

    // Sort only filled rows
    filledRows.sort((a, b) => {
        let aValue = a[field] || '';
        let bValue = b[field] || '';

        if (field === 'date') {
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

    // Rebuild tableData with filled rows first, then empty rows
    tableData = [...filledRows, ...emptyRows].map(row => {
        const { originalIndex, ...cleanRow } = row;
        return cleanRow;
    });

    rebuildTable();
    applyAllFilters();
    document.querySelectorAll('.sort-dropdown').forEach(d => d.classList.remove('show'));
}

//-------------------------------------SEARCH SPECIFIC COLUMN-----------------------------------------//
//==========================================
//INITIALIZE TABLE
//==========================================
function initializeTable() {

    if (window.tableInitialized) {
        return;
    }
    const preservedData = sessionStorage.getItem('despatch_preservedTableData');
    const preservedRowCount = sessionStorage.getItem('despatch_preservedRowCount');

    if (preservedData && preservedRowCount) {
        tableData = JSON.parse(preservedData);
        rowCount = parseInt(preservedRowCount);
        rebuildTable();

        // Clear the preserved data
        sessionStorage.removeItem('despatch_preservedTableData');
        sessionStorage.removeItem('despatch_preservedRowCount');

        setupRowInsertion();
        attachAllEventListeners();
        window.tableInitialized = true;

        return;
    }

    const userIsAuthenticated = isAuthenticated();

    if (userIsAuthenticated) {
        loadUserData(); // This will handle BOTH cases: existing data OR new user
    } else {
        for (let i = 0; i < 6; i++) {
            addNewRow();
        }
        rebuildTable();
    }

    setupRowInsertion();

    // Add event listeners with null checks
    const addRowBtn = document.querySelector('.add-row-btn');
    if (addRowBtn) addRowBtn.addEventListener('click', addNewRow);

    // Save button listener
    const saveBtn = document.querySelector('.save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveToDatabase);
    } else {
        console.error('Save button not found!');
    }
    
    //============================
    //SORTING LISTENERS
    //============================

    document.querySelectorAll('.hamburger-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopImmediatePropagation(); // Prevent event bubbling and duplicate listener execution
            const columnHeader = this.closest('.column-header');
            const thElement = columnHeader.closest('th');
            const column = thElement.className.trim().split(/\s+/)[0]; // Gets the class name like 'date', 'whomSent', etc.

            // Map class names to field names
            const columnMap = {
                'date': 'date',
                'whomSent': 'toWhom',
                'place': 'place',
                'subject': 'subject',
                'sentBy': 'sentBy',
                'letterNo': 'letterNo',
                'deliveryMethod': 'deliveryMethod',
                'letterLanguage': 'letterLanguage',
                'zone': 'zone'
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
        boldBtn.addEventListener('click', function (e) {
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
        italicBtn.addEventListener('click', function (e) {
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
        underlineBtn.addEventListener('click', function (e) {
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
        undoBtn.addEventListener('click', function (e) {
            e.preventDefault();
            undo();
        });
    }

    if (redoBtn) {
        redoBtn.addEventListener('click', function (e) {
            e.preventDefault();
            redo();
        });
    }

    // Initialize button states
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
    } else {
        console.error('❌ Save button not found!');
    }

    //============================
    //SORTING LISTENERS
    //============================

    document.querySelectorAll('.hamburger-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopImmediatePropagation();
            const columnHeader = this.closest('.column-header');
            const thElement = columnHeader.closest('th');
            const column = thElement.className.trim().split(/\s+/)[0];

            const columnMap = {
                'date': 'date',
                'whomSent': 'toWhom',
                'place': 'place',
                'subject': 'subject',
                'sentBy': 'sentBy',
                'letterNo': 'letterNo',
                'deliveryMethod': 'deliveryMethod',
                'letterLanguage': 'letterLanguage',
                'zone': 'zone'
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
        boldBtn.addEventListener('click', function (e) {
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
        italicBtn.addEventListener('click', function (e) {
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
        underlineBtn.addEventListener('click', function (e) {
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
        undoBtn.addEventListener('click', function (e) {
            e.preventDefault();
            undo();
        });
    }

    if (redoBtn) {
        redoBtn.addEventListener('click', function (e) {
            e.preventDefault();
            redo();
        });
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
document.addEventListener('keydown', function (e) {
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
    return tableBody.querySelectorAll('.cell, [contenteditable="true"].cell');
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
        let text = '';
        if (cell.tagName === 'INPUT' || cell.tagName === 'TEXTAREA') {
            text = cell.value.toLowerCase();
        } else if (cell.contentEditable === 'true') {
            text = cell.textContent.toLowerCase();
        }

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

    saveState();

    const cells = getCells();
    let replacedCount = 0;

    cells.forEach(cell => {
        if (cell.classList.contains('highlight')) {
            const regex = new RegExp(searchTerm, 'gi');
            const row = parseInt(cell.getAttribute('data-row'));
            const field = cell.getAttribute('data-field');

            if (cell.tagName === 'INPUT' || cell.tagName === 'TEXTAREA') {
                cell.value = cell.value.replace(regex, replaceTerm);
                if (tableData[row]) {
                    tableData[row][field] = cell.value;
                }
            } else if (cell.contentEditable === 'true') {
                cell.innerHTML = cell.innerHTML.replace(regex, replaceTerm);
                if (tableData[row]) {
                    tableData[row][field] = cell.innerHTML;
                }
            }

            cell.classList.remove('highlight');

            if (tableData[row]) {
                if (tableData[row].isFromDatabase) {
                    changedRows.add(row);
                    tableData[row].hasChanges = true;
                } else {
                    newRows.add(row);
                }
                updateRowVisualStatus(row);
                replacedCount++;
            }
        }
    });

    matchCounter.textContent = '0';
    if (replacedCount > 0) {
        showNotification(`Replaced ${replacedCount} occurrences`, 'success');
    }
});

//============================================
// FORMATTING FUNCTIONS - COMPLETE FIX
//============================================
//====================================================
//TABLE OPTIONS
//====================================================


//-------------------------------ADD NEW ROW--------------------------------------//

function addNewRow() {
    rowCount++;
    const tbody = document.getElementById('tableBody');
    const row = document.createElement('tr');

    const rowData = {
        letterDate: '',
        registrationDate: '',
        toWhom: '',
        toWhomHindi: '',
        copySentTo: '',
        copySentToHindi: '',
        mainAddress: '',
        mainAddressHindi: '',
        place: '',
        placeHindi: '',
        subject: '',
        subjectHindi: '',
        sentBy: '',
        sentByHindi: '',
        letterNo: '',
        deliveryMethod: '',
        letterLanguage: '',
        zone: ''
    };
    tableData.push(rowData);
    row.innerHTML = `
        <td class="row-number">${rowCount}</td>
        <td><input type="text" class="cell english-cell" required data-row="${rowCount - 1}" data-field="letterDate" placeholder="DD/MM/YYYY" style="height: 53px;"></td>
        <td><input type="text" class="cell english-cell" data-row="${rowCount - 1}" data-field="registrationDate" placeholder="DD/MM/YYYY" style="height: 53px;"></td>
        <td>
            <textarea class="cell english-cell" required data-row="${rowCount - 1}" data-field="toWhom" placeholder="Enter Receiver..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${rowCount - 1}" data-field="toWhomHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" data-row="${rowCount - 1}" data-field="copySentTo" placeholder="Enter Copy Sent To..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${rowCount - 1}" data-field="copySentToHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${rowCount - 1}" data-field="mainAddress" placeholder="Enter Main Address..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${rowCount - 1}" data-field="mainAddressHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" data-row="${rowCount - 1}" data-field="place" placeholder="Enter place..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${rowCount - 1}" data-field="placeHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${rowCount - 1}" data-field="subject" placeholder="Enter subject..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${rowCount - 1}" data-field="subjectHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${rowCount - 1}" data-field="sentBy" placeholder="Name of sender..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${rowCount - 1}" data-field="sentByHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <input type="text" class="cell english-cell" required data-row="${rowCount - 1}" data-field="letterNo" placeholder="e.g. NIC/2025/001" style="height: 53px;">
        </td>
        <td>
            <div class="radio-cell" data-row="${rowCount - 1}" data-field="deliveryMethod">
                <label class="radio-label"><input type="radio" name="deliveryMethod_${rowCount - 1}" value="Speed Post" onchange="saveRadioValue(this)"> Speed Post</label>
                <label class="radio-label"><input type="radio" name="deliveryMethod_${rowCount - 1}" value="Registered Post" onchange="saveRadioValue(this)"> Registered Post</label>
                <label class="radio-label"><input type="radio" name="deliveryMethod_${rowCount - 1}" value="Ordinary Post" onchange="saveRadioValue(this)"> Ordinary Post</label>
                <label class="radio-label"><input type="radio" name="deliveryMethod_${rowCount - 1}" value="Hand Delivery" onchange="saveRadioValue(this)"> Hand Delivery</label>
                <label class="radio-label"><input type="radio" name="deliveryMethod_${rowCount - 1}" value="Email" onchange="saveRadioValue(this)"> Email</label>
                <label class="radio-label"><input type="radio" name="deliveryMethod_${rowCount - 1}" value="E-file" onchange="saveRadioValue(this)"> E-file</label>
            </div>
        </td>
        <td>
            <div class="radio-cell" data-row="${rowCount - 1}" data-field="letterLanguage">
                <label class="radio-label"><input type="radio" name="letterLanguage_${rowCount - 1}" value="Hindi" onchange="saveRadioValue(this)"> Hindi</label>
                <label class="radio-label"><input type="radio" name="letterLanguage_${rowCount - 1}" value="English" onchange="saveRadioValue(this)"> English</label>
                <label class="radio-label"><input type="radio" name="letterLanguage_${rowCount - 1}" value="Bilingual" onchange="saveRadioValue(this)"> Bilingual</label>
            </div>
        </td>
        <td>
            <div class="radio-cell" data-row="${rowCount - 1}" data-field="zone">
                <label class="radio-label"><input type="radio" name="zone_${rowCount - 1}" value="Zone A" onchange="saveRadioValue(this)"> Zone A</label>
                <label class="radio-label"><input type="radio" name="zone_${rowCount - 1}" value="Zone B" onchange="saveRadioValue(this)"> Zone B</label>
                <label class="radio-label"><input type="radio" name="zone_${rowCount - 1}" value="Zone C" onchange="saveRadioValue(this)"> Zone C</label>
            </div>
        </td>
    `;

    tbody.appendChild(row);

    const cells = row.querySelectorAll('.cell');
    cells.forEach(cell => {
        addCellEventListeners(cell);
    });

    addRowInsertionListeners(row);
}

//-------------------------------------MOVE TO NEXT CELL---------------------------------------------//
// Sync table data with DOM
function syncTableDataWithDOM() {
    const tbody = document.getElementById('tableBody');
    const rows = tbody.querySelectorAll('tr');

    rows.forEach((row) => {
        // Use data-row from the first cell — DOM index is wrong on page 2+
        // because rebuildTable sets data-row = startIdx+index, so DOM row 0
        // on page 2 with 6 entries/page = tableData[6], not tableData[0].
        const firstCell = row.querySelector('[data-row]');
        if (!firstCell) return;
        const dataIndex = parseInt(firstCell.getAttribute('data-row'));
        if (isNaN(dataIndex) || !tableData[dataIndex]) return;

        const getCellValue = (cell) => {
            if (!cell) return '';
            if (cell.tagName === 'INPUT') return cell.value;
            if (cell.tagName === 'TEXTAREA') return cell.value;
            if (cell.contentEditable === 'true') return cell.innerHTML;
            return '';
        };

        // Use data-field attributes — reliable on every page
        const allInputs = row.querySelectorAll('input.cell, textarea.cell, [contenteditable="true"].cell');
        allInputs.forEach(input => {
            const field = input.getAttribute('data-field');
            if (field) {
                tableData[dataIndex][field] = getCellValue(input);
            }
        });

        // Radio buttons
        const radioCells = row.querySelectorAll('.radio-cell');
        radioCells.forEach(radioCell => {
            const field = radioCell.getAttribute('data-field');
            const checkedRadio = radioCell.querySelector('input[type="radio"]:checked');
            if (field && checkedRadio) {
                tableData[dataIndex][field] = checkedRadio.value;
            }
        });
    });
}

function getCellValueByColumn(row, column) {
    const allCells = row.querySelectorAll('.cell, [contenteditable="true"].cell, input.cell, textarea.cell');

    const getCellValue = (cell) => {
        if (!cell) return '';
        if (cell.tagName === 'INPUT' || cell.tagName === 'TEXTAREA') {
            return cell.value || '';
        }
        if (cell.contentEditable === 'true') {
            return cell.textContent || '';
        }
        return '';
    };

    // Map columns to their cell indices
    const columnMapping = {
        'letterDate': [0],
        'registrationDate': [1],
        'toWhom': [2, 3],
        'copySentTo': [4, 5],
        'mainAddress': [6, 7],
        'place': [8, 9],
        'subject': [10, 11],
        'sentBy': [12, 13],
        'letterNo': [14],
        'deliveryMethod': [15],
        'letterLanguage': [16],
        'zone': [17]
    };

    const indices = columnMapping[column] || [];
    const values = indices.map(i => getCellValue(allCells[i])).filter(Boolean);
    return values.join(' ');
}
//------------------------------------------TOGGLE SORT MENU-------------------------------------------//

function sortColumn(field, order) {
    syncTableDataWithDOM();

    if (order === 'neutral') {
        if (originalTableOrder.length > 0) {
            tableData = originalTableOrder.map(row => ({ ...row }));
        }
        rebuildTable();
        applyAllFilters();
        document.querySelectorAll('.sort-dropdown').forEach(d => d.classList.remove('show'));
        return;
    }

    // Separate empty and filled rows
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

    // Sort only filled rows
    filledRows.sort((a, b) => {
        let aValue = a[field] || '';
        let bValue = b[field] || '';

        if (field === 'date') {
            aValue = parseDate(aValue);
            bValue = parseDate(bValue);
            return order === 'asc' ?
                (aValue > bValue ? 1 : -1) :
                (aValue < bValue ? 1 : -1);
        } else {
            aValue = aValue.toString().toLowerCase();
            bValue = bValue.toString().toLowerCase();

            if (order === 'asc') {
                return aValue.localeCompare(bValue);
            } else {
                return bValue.localeCompare(aValue);
            }
        }
    });

    // Rebuild tableData with filled rows first, then empty rows
    tableData = [...filledRows, ...emptyRows].map(row => {
        const { originalIndex, ...cleanRow } = row;
        return cleanRow;
    });

    rebuildTable();
    applyAllFilters();
    document.querySelectorAll('.sort-dropdown').forEach(d => d.classList.remove('show'));
}

//ROW INSERTION
//============================================
// LOAD USER DATA ON LOGIN
//============================================

async function loadUserData() {
    if (window.isLoadingData) {
        return;
    }

    if (!isAuthenticated()) {
        return;
    }

    window.isLoadingData = true;

    try {

        const response = await fetch('/api/despatch/load', {
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

            // Store original data for comparison
            originalData.clear();
            changedRows.clear();
            newRows.clear();

            // Process loaded data
            tableData = result.data.map((row, index) => {
                originalData.set(index, createRowHash(row));

                return {
                    id: row.id,
                    serialNo: row.serialNo || index + 1,
                    letterDate: row.letterDate || row.date || '',
                    registrationDate: row.registrationDate || '',
                    toWhom: row.toWhom || '',
                    toWhomHindi: row.toWhomHindi || '',
                    copySentTo: row.copySentTo || '',
                    copySentToHindi: row.copySentToHindi || '',
                    mainAddress: row.mainAddress || '',
                    mainAddressHindi: row.mainAddressHindi || '',
                    place: row.place || '',
                    placeHindi: row.placeHindi || '',
                    subject: row.subject || '',
                    subjectHindi: row.subjectHindi || '',
                    sentBy: row.sentBy || '',
                    sentByHindi: row.sentByHindi || '',
                    letterNo: row.letterNo || '',
                    deliveryMethod: row.deliveryMethod || '',
                    letterLanguage: row.letterLanguage || '',
                    zone: row.zone || '',
                    isFromDatabase: true,
                    hasChanges: false
                };
            });

            rowCount = tableData.length;
            // Snapshot original order for neutral sort
            originalTableOrder = tableData.map(row => ({ ...row }));
            rebuildTable();

            showNotification(`Loaded ${result.data.length} existing records`, 'success');

        } else {
            // NEW USER - NO DATA FOUND

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

// INSERT ROW AFTER ANOTHER ROW

function insertRowAfter(targetRow) {
    const tbody = document.getElementById('tableBody');
    const targetIndex = Array.from(tbody.children).indexOf(targetRow);

    rowCount++;
    const newRow = document.createElement('tr');

    const rowData = {
        letterDate: '',
        registrationDate: '',
        toWhom: '',
        toWhomHindi: '',
        copySentTo: '',
        copySentToHindi: '',
        mainAddress: '',
        mainAddressHindi: '',
        place: '',
        placeHindi: '',
        subject: '',
        subjectHindi: '',
        sentBy: '',
        sentByHindi: '',
        letterNo: '',
        deliveryMethod: '',
        letterLanguage: '',
        zone: ''
    };
    tableData.splice(targetIndex + 1, 0, rowData);

    newRow.innerHTML = `
        <td class="row-number">${rowCount}</td>
        <td><input type="text" class="cell english-cell" required data-row="${targetIndex + 1}" data-field="letterDate" placeholder="DD/MM/YYYY" style="height: 53px;"></td>
        <td><input type="text" class="cell english-cell" data-row="${targetIndex + 1}" data-field="registrationDate" placeholder="DD/MM/YYYY" style="height: 53px;"></td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex + 1}" data-field="toWhom" placeholder="Enter Receiver..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="toWhomHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" data-row="${targetIndex + 1}" data-field="copySentTo" placeholder="Enter Copy Sent To..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="copySentToHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex + 1}" data-field="mainAddress" placeholder="Enter Main Address..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="mainAddressHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" data-row="${targetIndex + 1}" data-field="place" placeholder="Enter place..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="placeHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex + 1}" data-field="subject" placeholder="Enter subject..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="subjectHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex + 1}" data-field="sentBy" placeholder="Name of sender..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="sentByHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <input type="text" class="cell english-cell" required data-row="${targetIndex + 1}" data-field="letterNo" placeholder="e.g. NIC/2025/001" style="height: 53px;">
        </td>
        <td>
            <div class="radio-cell" data-row="${targetIndex + 1}" data-field="deliveryMethod">
                <label class="radio-label"><input type="radio" name="deliveryMethod_${targetIndex + 1}" value="Speed Post" onchange="saveRadioValue(this)"> Speed Post</label>
                <label class="radio-label"><input type="radio" name="deliveryMethod_${targetIndex + 1}" value="Registered Post" onchange="saveRadioValue(this)"> Registered Post</label>
                <label class="radio-label"><input type="radio" name="deliveryMethod_${targetIndex + 1}" value="Ordinary Post" onchange="saveRadioValue(this)"> Ordinary Post</label>
                <label class="radio-label"><input type="radio" name="deliveryMethod_${targetIndex + 1}" value="Hand Delivery" onchange="saveRadioValue(this)"> Hand Delivery</label>
                <label class="radio-label"><input type="radio" name="deliveryMethod_${targetIndex + 1}" value="Email" onchange="saveRadioValue(this)"> Email</label>
                <label class="radio-label"><input type="radio" name="deliveryMethod_${targetIndex + 1}" value="E-file" onchange="saveRadioValue(this)"> E-file</label>
            </div>
        </td>
        <td>
            <div class="radio-cell" data-row="${targetIndex + 1}" data-field="letterLanguage">
                <label class="radio-label"><input type="radio" name="letterLanguage_${targetIndex + 1}" value="Hindi" onchange="saveRadioValue(this)"> Hindi</label>
                <label class="radio-label"><input type="radio" name="letterLanguage_${targetIndex + 1}" value="English" onchange="saveRadioValue(this)"> English</label>
                <label class="radio-label"><input type="radio" name="letterLanguage_${targetIndex + 1}" value="Bilingual" onchange="saveRadioValue(this)"> Bilingual</label>
            </div>
        </td>
        <td>
            <div class="radio-cell" data-row="${targetIndex + 1}" data-field="zone">
                <label class="radio-label"><input type="radio" name="zone_${targetIndex + 1}" value="Zone A" onchange="saveRadioValue(this)"> Zone A</label>
                <label class="radio-label"><input type="radio" name="zone_${targetIndex + 1}" value="Zone B" onchange="saveRadioValue(this)"> Zone B</label>
                <label class="radio-label"><input type="radio" name="zone_${targetIndex + 1}" value="Zone C" onchange="saveRadioValue(this)"> Zone C</label>
            </div>
        </td>
    `;

    targetRow.parentNode.insertBefore(newRow, targetRow.nextSibling);

    const cells = newRow.querySelectorAll('.cell');
    cells.forEach(cell => {
        addCellEventListeners(cell);
    });

    addRowInsertionListeners(newRow);
    updateRowNumbers();
    cells[0].focus();
}
// INSERT ROW BEFORE TARGET

function insertRowBefore(targetRow) {
    const tbody = document.getElementById('tableBody');
    const targetIndex = Array.from(tbody.children).indexOf(targetRow);

    rowCount++;
    const newRow = document.createElement('tr');

    const rowData = {
        serialNo: rowCount,
        letterDate: '',
        registrationDate: '',
        toWhom: '',
        toWhomHindi: '',
        copySentTo: '',
        copySentToHindi: '',
        mainAddress: '',
        mainAddressHindi: '',
        place: '',
        placeHindi: '',
        subject: '',
        subjectHindi: '',
        sentBy: '',
        sentByHindi: '',
        letterNo: '',
        deliveryMethod: '',
        letterLanguage: '',
        zone: ''
    };
    tableData.splice(targetIndex, 0, rowData);

    newRow.innerHTML = `
        <td class="row-number">${rowCount}</td>
        <td><input type="text" class="cell english-cell" required data-row="${targetIndex}" data-field="letterDate" placeholder="DD/MM/YYYY" style="height: 53px;"></td>
        <td><input type="text" class="cell english-cell" data-row="${targetIndex}" data-field="registrationDate" placeholder="DD/MM/YYYY" style="height: 53px;"></td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex}" data-field="toWhom" placeholder="Enter Receiver..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex}" data-field="toWhomHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" data-row="${targetIndex}" data-field="copySentTo" placeholder="Enter Copy Sent To..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex}" data-field="copySentToHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex}" data-field="mainAddress" placeholder="Enter Main Address..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex}" data-field="mainAddressHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" data-row="${targetIndex}" data-field="place" placeholder="Enter place..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex}" data-field="placeHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex}" data-field="subject" placeholder="Enter subject..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex}" data-field="subjectHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex}" data-field="sentBy" placeholder="Name of sender..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex}" data-field="sentByHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <input type="text" class="cell english-cell" required data-row="${targetIndex}" data-field="letterNo" placeholder="e.g. NIC/2025/001" style="height: 53px;">
        </td>
        <td>
            <div class="radio-cell" data-row="${targetIndex}" data-field="deliveryMethod">
                <label class="radio-label"><input type="radio" name="deliveryMethod_${targetIndex}" value="Speed Post" onchange="saveRadioValue(this)"> Speed Post</label>
                <label class="radio-label"><input type="radio" name="deliveryMethod_${targetIndex}" value="Registered Post" onchange="saveRadioValue(this)"> Registered Post</label>
                <label class="radio-label"><input type="radio" name="deliveryMethod_${targetIndex}" value="Ordinary Post" onchange="saveRadioValue(this)"> Ordinary Post</label>
                <label class="radio-label"><input type="radio" name="deliveryMethod_${targetIndex}" value="Hand Delivery" onchange="saveRadioValue(this)"> Hand Delivery</label>
                <label class="radio-label"><input type="radio" name="deliveryMethod_${targetIndex}" value="Email" onchange="saveRadioValue(this)"> Email</label>
                <label class="radio-label"><input type="radio" name="deliveryMethod_${targetIndex}" value="E-file" onchange="saveRadioValue(this)"> E-file</label>
            </div>
        </td>
        <td>
            <div class="radio-cell" data-row="${targetIndex}" data-field="letterLanguage">
                <label class="radio-label"><input type="radio" name="letterLanguage_${targetIndex}" value="Hindi" onchange="saveRadioValue(this)"> Hindi</label>
                <label class="radio-label"><input type="radio" name="letterLanguage_${targetIndex}" value="English" onchange="saveRadioValue(this)"> English</label>
                <label class="radio-label"><input type="radio" name="letterLanguage_${targetIndex}" value="Bilingual" onchange="saveRadioValue(this)"> Bilingual</label>
            </div>
        </td>
        <td>
            <div class="radio-cell" data-row="${targetIndex}" data-field="zone">
                <label class="radio-label"><input type="radio" name="zone_${targetIndex}" value="Zone A" onchange="saveRadioValue(this)"> Zone A</label>
                <label class="radio-label"><input type="radio" name="zone_${targetIndex}" value="Zone B" onchange="saveRadioValue(this)"> Zone B</label>
                <label class="radio-label"><input type="radio" name="zone_${targetIndex}" value="Zone C" onchange="saveRadioValue(this)"> Zone C</label>
            </div>
        </td>
    `;

    targetRow.parentNode.insertBefore(newRow, targetRow);

    const cells = newRow.querySelectorAll('.cell');
    cells.forEach(cell => {
        addCellEventListeners(cell);
    });

    addRowInsertionListeners(newRow);
    updateRowNumbers();
    cells[0].focus();
}

//DELETE ROW

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

//ADD CELL EVENT LISTENERS

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
            const originalHash = originalData.get(row);
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

function validateCell(cell) {
    const field = cell.getAttribute('data-field');
    if (!field) return;

    const val = cell.value.trim();
    const requiredFields = ['letterDate', 'toWhom', 'mainAddress', 'subject', 'sentBy', 'letterNo'];
    
    // Remove old warnings in this cell's parent
    const parent = cell.parentElement;
    const existingWarning = parent.querySelector('.char-count-warning, .char-count-error');
    if (existingWarning) existingWarning.remove();

    // Required fields check
    if (requiredFields.includes(field)) {
        if (!val) {
            cell.classList.add('validation-error');
        } else {
            cell.classList.remove('validation-error');
        }
    }
    
    // Subject character limit check (5000 chars)
    if (field === 'subject' || field === 'subjectHindi') {
        const maxLen = 5000;
        if (val.length > maxLen) {
            cell.classList.add('validation-error');
            const span = document.createElement('span');
            span.className = 'char-count-error';
            span.textContent = `${val.length}/${maxLen}`;
            parent.appendChild(span);
        } else if (val.length > maxLen * 0.9) {
            const span = document.createElement('span');
            span.className = 'char-count-warning';
            span.textContent = `${val.length}/${maxLen}`;
            parent.appendChild(span);
        }
    }
}

function addCellEventListeners(cell) {
    if (cell.getAttribute('data-field') === 'letterDate' || cell.getAttribute('data-field') === 'registrationDate') {
        cell.placeholder = 'DD/MM/YYYY';
        cell.addEventListener('input', () => restrictDateInput(cell));
        cell.addEventListener('blur', () => restrictDateInput(cell));
    }

    cell.addEventListener('focus', function () {
        this.classList.add('editing');
        if (this.tagName === 'INPUT') {
            this.select();
        }
    });

    cell.addEventListener('blur', async function () {
        this.classList.remove('editing');
        validateCell(this);
        await saveData(this);
    });

    cell.addEventListener('keydown', async function (e) {
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

    cell.addEventListener('input', debounce(async function () {
        validateCell(this);
        await saveData(this);
    }, 300));
}
//----------------------------------------------SAVE THINGY-------------------------------------------//

//==============================================
// DATABASE INTEGRATION FUNCTIONS
//==============================================

// Validate row data - checks if all required fields are filled
function validateRowData(rowData, rowIndex) {
    const requiredFields = ['letterDate', 'toWhom', 'mainAddress', 'subject', 'sentBy', 'letterNo', 'deliveryMethod', 'letterLanguage'];
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

// Get filled rows from table data
function getFilledRows() {
    const filledRows = [];
    const validationErrors = [];
    let foundFirstEmpty = false;

    for (let index = 0; index < tableData.length; index++) {
        const rowData = tableData[index];
        // Check if at least one field is filled (excluding serialNo)
        const hasData = Object.values(rowData).some(value =>
            value && value.toString().trim() !== '' && value !== index + 1
        );

        if (hasData) {
            if (foundFirstEmpty) {
                validationErrors.push(
                    `Row ${index}: Has empty fields. Please fill all required fields before Saving.` // rows in-between cannot be empty 
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
        else {
            foundFirstEmpty = true; // mark that we found an empty row
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

    // Sync table data with DOM first
    syncTableDataWithDOM();

    // Validate: no empty middle rows
    if (!validateNoMiddleEmptyRows()) return;

    // Get only changed and new rows
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


    try {
        const saveBtn = document.querySelector('.save-btn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = ' Saving Changes...';
        saveBtn.disabled = true;

        const response = await fetch('/api/despatch/save-changes', {
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
            // Update tracking after successful save
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

            // Update visual indicators
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
let debounceTimer = null;
const API_BASE = "https://d-jaden02-pys-deep-transalator.hf.space";

async function translateText(text) {
    if (!text?.trim()) return text;
    if (translationCache.has(text)) return translationCache.get(text);
    
    try {
        const response = await fetch(`${API_BASE}/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        
        const data = await response.json();
        const translated = data.translated_text;
        translationCache.set(text, translated);
        return translated;
    } catch (error) {
        console.error('Translation error:', error);
        return text;
    }
}

async function translateTextBatch(texts) {
    try {
        const response = await fetch(`${API_BASE}/batch_translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts })
        });

        if (!response.ok) throw new Error(`Batch API error: ${response.status}`);

        const data = await response.json();
        const map = {};
        data.results.forEach((result, index) => {
            if (result.translated_text) {
                map[texts[index]] = result.translated_text;
                translationCache.set(texts[index], result.translated_text);
            } else {
                map[texts[index]] = texts[index]; // fallback
            }
        });
        return map;
    } catch (error) {
        console.error('Batch translation error:', error);
        const fallback = {};
        texts.forEach(t => fallback[t] = t);
        return fallback;
    }
}

function triggerTranslationEarly(text) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        if (text?.trim() && !translationCache.has(text)) {
            console.log('⏳ Pre-translating:', text);
            await translateText(text);
            console.log('✓ Pre-translation cached:', text);
        }
    }, 500);
}

function attachTranslationDebounce() {
    document.querySelectorAll('textarea, input[type="text"]').forEach(el => {
        el.addEventListener('input', (e) => triggerTranslationEarly(e.target.value));
    });
}

// Warm up on page load
(async () => {
    try {
        await translateText("hello");
        console.log("✓ Translation API ready");
        attachTranslationDebounce();
    } catch (e) {
        console.warn("Warm-up failed:", e);
    }
})();



//SAVE DATA AND HANDLE TRANSLATION

async function saveData(cell) {
    const row = parseInt(cell.getAttribute('data-row'));
    const field = cell.getAttribute('data-field');
    const value = cell.contentEditable === 'true' ? cell.innerHTML : cell.value;

    if (tableData[row]) {
        const oldValue = tableData[row][field];
        tableData[row][field] = value;

        // Check if this is a change from original data
        if (tableData[row].isFromDatabase) {
            const currentHash = createRowHash(tableData[row]);
            const originalHash = originalData.get(row);

            if (currentHash !== originalHash) {
                changedRows.add(row);
                tableData[row].hasChanges = true;
            } else {
                changedRows.delete(row);
                tableData[row].hasChanges = false;
            }
        } else {
            newRows.add(row);
        }

        // Handle automatic translation
        if (translatableColumns.includes(field) && !field.endsWith('Hindi') && value) {
            const hindiField = `${field}Hindi`;
            // CHANGED: Look for textarea instead of input
            const hindiInput = document.querySelector(`textarea[data-row="${row}"][data-field="${hindiField}"]`);


            if (hindiInput) {
                // Strip HTML tags for translation
                const textToTranslate = value.replace(/<[^>]*>/g, '');

                const translatedText = await translateText(textToTranslate);

                hindiInput.value = translatedText;
                hindiInput.disabled = false;
                tableData[row][hindiField] = translatedText;

                if (tableData[row].isFromDatabase) {
                    const currentHash = createRowHash(tableData[row]);
                    const originalHash = originalData.get(row);

                    if (currentHash !== originalHash) {
                        changedRows.add(row);
                        tableData[row].hasChanges = true;
                    }
                }
            } else {
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

document.addEventListener('DOMContentLoaded', function () {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?Remember To Save')) {
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

    clone.querySelectorAll('.hamburger-menu, .sort-dropdown, .insert-row-btn').forEach(el => el.remove());
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
    // html2canvas doesn't always pick up stylesheet rules on cloned elements,
    // so we set these directly as inline styles which always win.
    const despatchColWidths = ['4%', '7%', '12%', '8%', '18%', '11%', '10%', '11%', '11%', '8%'];
    clone.querySelectorAll('thead tr th').forEach((th, i) => {
        if (despatchColWidths[i]) {
            th.style.width = despatchColWidths[i];
            th.style.maxWidth = despatchColWidths[i];
        }
    });

    clone.querySelectorAll('tbody tr').forEach(row => {
        row.querySelectorAll('td').forEach((cell, idx) => {
            if (despatchColWidths[idx]) {
                cell.style.width = despatchColWidths[idx];
                cell.style.maxWidth = despatchColWidths[idx];
            }
            cell.style.whiteSpace = 'normal';
            cell.style.wordWrap = 'break-word';
            cell.style.overflowWrap = 'break-word';
            cell.style.overflow = 'hidden';
            cell.style.verticalAlign = 'middle';
            cell.style.padding = '7px 5px';
            cell.style.fontSize = '11px';
            cell.style.lineHeight = '1.4';
            cell.style.boxSizing = 'border-box';

            // Subject column (0-indexed 4): ensure native CSS word-wrap renders fully
            if (idx === 4) {
                cell.style.textAlign = 'left';
                cell.style.overflow = 'visible'; // Must be visible so wrapped lines aren't cut off
                cell.style.height = 'auto';

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

        /* 10 columns: Serial(1) Date(2) ToWhom(3) Place(4) Subject(5) SentBy(6) LetterNo(7) Delivery(8) Lang(9) Zone(10) */
        th:nth-child(1),  td:nth-child(1)  { width: 4%  !important; }
        th:nth-child(2),  td:nth-child(2)  { width: 7%  !important; }
        th:nth-child(3),  td:nth-child(3)  { width: 12% !important; }
        th:nth-child(4),  td:nth-child(4)  { width: 8%  !important; }

        /* Subject column — wraps text */
        th:nth-child(5), td:nth-child(5) {
            width: 18% !important;
            white-space: normal !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            overflow: visible !important;
            text-overflow: clip !important;
            text-align: left !important;
        }

        th:nth-child(6),  td:nth-child(6)  { width: 11% !important; }
        th:nth-child(7),  td:nth-child(7)  { width: 10% !important; }
        th:nth-child(8),  td:nth-child(8)  { width: 11% !important; }
        th:nth-child(9),  td:nth-child(9)  { width: 11% !important; }
        th:nth-child(10), td:nth-child(10) { width: 8%  !important; }
    `;
    // Inject PDF styles into <head> so html2canvas can pick them up
    // (appending a <style> inside a <table> is invalid HTML and is ignored)
    style.setAttribute('data-pdf-style', 'despatch');
    document.head.appendChild(style);

    const stage = document.createElement('div');
    stage.style.cssText = 'position:fixed;top:0;left:0;width:297mm;z-index:-99999;background:white;overflow:visible;pointer-events:none;';
    stage.appendChild(clone);
    document.body.appendChild(stage);

    const opt = {
        margin: [5, 5, 5, 5],
        filename: `DAK_Despatch_${new Date().toISOString().split('T')[0]}.pdf`,
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
            document.querySelector('style[data-pdf-style="despatch"]')?.remove();
            showNotification('PDF exported successfully!', 'success');
        })
        .catch(err => {
            document.body.removeChild(stage);
            document.querySelector('style[data-pdf-style="despatch"]')?.remove();
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

    // Ensure enough rows for the current page
    const requiredRows = entriesPerPage * currentPage;
    while (tableData.length < requiredRows) {
        const rowData = {
            letterDate: '',
            registrationDate: '',
            toWhom: '',
            toWhomHindi: '',
            copySentTo: '',
            copySentToHindi: '',
            mainAddress: '',
            mainAddressHindi: '',
            place: '',
            placeHindi: '',
            subject: '',
            subjectHindi: '',
            sentBy: '',
            sentByHindi: '',
            letterNo: '',
            deliveryMethod: '',
            letterLanguage: '',
            zone: ''
        };
        tableData.push(rowData);
    }

    // PAGINATION LOGIC
    const startIdx = (currentPage - 1) * entriesPerPage;
    const endIdx = Math.min(startIdx + entriesPerPage, tableData.length);
    const pageRows = tableData.slice(startIdx, endIdx);

    pageRows.forEach((rowData, index) => {
        const serialNumber = startIdx + index + 1;
        const row = document.createElement('tr');

        // Check if data contains HTML formatting
        const hasHTMLFormatting = (text) => {
            return text && (text.includes('<strong>') || text.includes('<em>') || text.includes('<u>'));
        };

        // Updated: Create cell content - textarea/input for non-formatted, contentEditable for formatted
        const createCellContent = (field, value, isEnglish = true, isDate = false) => {
            const className = isEnglish ? 'cell english-cell' : 'cell hindi-cell';
            const placeholder = isDate ? 'DD/MM/YYYY' : (isEnglish ? 'Enter text...' : 'Hindi translation...');
            // registration date is not strict required to avoid empty submission errors
            const required = isDate && field === 'letterDate' || (isEnglish && !field.endsWith('Hindi') && field !== 'registrationDate' && field !== 'place' && field !== 'copySentTo') ? 'required' : '';
            const disabled = !isEnglish && !value ? 'disabled' : '';

            if (hasHTMLFormatting(value)) {
                // Use contenteditable div for formatted text (supports wrapping via CSS)
                return `<div contenteditable="true" class="${className}" data-row="${startIdx + index}" data-field="${field}" style="width: 100%; min-height: 90px; height: auto; padding: 12px; border: none; outline: none; resize: none;">${value || ''}</div>`;
            } else if (isDate) {
                // Date always uses input (no wrapping needed)
                return `<input type="text" class="${className}" ${required} data-row="${startIdx + index}" data-field="${field}" placeholder="${placeholder}" value="${value || ''}" style="height: 90px; resize: none;">`;
            } else {
                // Use textarea for text fields (enables wrapping)
                const maxLengthAttr = (field === 'subject' || field === 'subjectHindi') ? 'maxlength="5000"' : '';
                return `<textarea class="${className}" ${required} ${maxLengthAttr} data-row="${startIdx + index}" data-field="${field}" placeholder="${placeholder}" ${disabled} rows="2" style="resize: vertical; min-height: 90px; height: auto;">${value || ''}</textarea>`;
            }
        };

        row.innerHTML = `
            <td class="row-number">${serialNumber}</td>
            <td>${createCellContent('letterDate', rowData.letterDate, true, true)}</td>
            <td>${createCellContent('registrationDate', rowData.registrationDate, true, true)}</td>
            <td>
                ${createCellContent('toWhom', rowData.toWhom, true, false)}
                ${createCellContent('toWhomHindi', rowData.toWhomHindi, false, false)}
            </td>
            <td>
                ${createCellContent('copySentTo', rowData.copySentTo, true, false)}
                ${createCellContent('copySentToHindi', rowData.copySentToHindi, false, false)}
            </td>
            <td>
                ${createCellContent('mainAddress', rowData.mainAddress, true, false)}
                ${createCellContent('mainAddressHindi', rowData.mainAddressHindi, false, false)}
            </td>
            <td>
                ${createCellContent('place', rowData.place, true, false)}
                ${createCellContent('placeHindi', rowData.placeHindi, false, false)}
            </td>
            <td>
                ${createCellContent('subject', rowData.subject, true, false)}
                ${createCellContent('subjectHindi', rowData.subjectHindi, false, false)}
            </td>
            <td>
                ${createCellContent('sentBy', rowData.sentBy, true, false)}
                ${createCellContent('sentByHindi', rowData.sentByHindi, false, false)}
            </td>
            <td>
                <input type="text" class="cell english-cell" required data-row="${startIdx + index}" data-field="letterNo" placeholder="e.g. NIC/2025/001" value="${rowData.letterNo || ''}" style="height: 53px;">
            </td>
            <td>
                <div class="radio-cell" data-row="${startIdx + index}" data-field="deliveryMethod">
                    <label class="radio-label"><input type="radio" name="deliveryMethod_${startIdx + index}" value="Speed Post" ${rowData.deliveryMethod === 'Speed Post' ? 'checked' : ''} onchange="saveRadioValue(this)"> Speed Post</label>
                    <label class="radio-label"><input type="radio" name="deliveryMethod_${startIdx + index}" value="Registered Post" ${rowData.deliveryMethod === 'Registered Post' ? 'checked' : ''} onchange="saveRadioValue(this)"> Registered Post</label>
                    <label class="radio-label"><input type="radio" name="deliveryMethod_${startIdx + index}" value="Ordinary Post" ${rowData.deliveryMethod === 'Ordinary Post' ? 'checked' : ''} onchange="saveRadioValue(this)"> Ordinary Post</label>
                    <label class="radio-label"><input type="radio" name="deliveryMethod_${startIdx + index}" value="Hand Delivery" ${rowData.deliveryMethod === 'Hand Delivery' ? 'checked' : ''} onchange="saveRadioValue(this)"> Hand Delivery</label>
                    <label class="radio-label"><input type="radio" name="deliveryMethod_${startIdx + index}" value="Email" ${rowData.deliveryMethod === 'Email' ? 'checked' : ''} onchange="saveRadioValue(this)"> Email</label>
                    <label class="radio-label"><input type="radio" name="deliveryMethod_${startIdx + index}" value="E-file" ${rowData.deliveryMethod === 'E-file' ? 'checked' : ''} onchange="saveRadioValue(this)"> E-file</label>
                </div>
            </td>
            <td>
                <div class="radio-cell" data-row="${startIdx + index}" data-field="letterLanguage">
                    <label class="radio-label"><input type="radio" name="letterLanguage_${startIdx + index}" value="Hindi" ${rowData.letterLanguage === 'Hindi' ? 'checked' : ''} onchange="saveRadioValue(this)"> Hindi</label>
                    <label class="radio-label"><input type="radio" name="letterLanguage_${startIdx + index}" value="English" ${rowData.letterLanguage === 'English' ? 'checked' : ''} onchange="saveRadioValue(this)"> English</label>
                    <label class="radio-label"><input type="radio" name="letterLanguage_${startIdx + index}" value="Bilingual" ${rowData.letterLanguage === 'Bilingual' ? 'checked' : ''} onchange="saveRadioValue(this)"> Bilingual</label>
                </div>
            </td>
            <td>
                <div class="radio-cell" data-row="${startIdx + index}" data-field="zone">
                    <label class="radio-label"><input type="radio" name="zone_${startIdx + index}" value="Zone A" ${rowData.zone === 'Zone A' ? 'checked' : ''} onchange="saveRadioValue(this)"> Zone A</label>
                    <label class="radio-label"><input type="radio" name="zone_${startIdx + index}" value="Zone B" ${rowData.zone === 'Zone B' ? 'checked' : ''} onchange="saveRadioValue(this)"> Zone B</label>
                    <label class="radio-label"><input type="radio" name="zone_${startIdx + index}" value="Zone C" ${rowData.zone === 'Zone C' ? 'checked' : ''} onchange="saveRadioValue(this)"> Zone C</label>
                </div>
            </td>
        `;
        tbody.appendChild(row);

        // Add listeners to all cells (both input/textarea and contentEditable)
        const cells = row.querySelectorAll('.cell, [contenteditable="true"]');
        cells.forEach(cell => {
            if (cell.tagName === 'INPUT' || cell.tagName === 'TEXTAREA') {
                addCellEventListeners(cell); // Handles both inputs and textareas
            } else if (cell.contentEditable === 'true') {
                addContentEditableListeners(cell);
            }
        });

        addRowInsertionListeners(row);
    });

    renderPaginationControls();
}

//============================================
// HELPER FUNCTIONS
//============================================

function hasRequiredFields(rowData) {
    const requiredFields = ['letterDate', 'toWhom', 'mainAddress', 'subject', 'sentBy', 'letterNo', 'deliveryMethod', 'letterLanguage', 'zone'];
    return requiredFields.every(field =>
        rowData[field] && rowData[field].toString().trim() !== ''
    );
}

function isRowEmpty(rowData) {
    const meaningfulFields = ['letterDate', 'registrationDate', 'toWhom', 'copySentTo', 'mainAddress', 'place', 'subject', 'sentBy', 'letterNo', 'deliveryMethod', 'letterLanguage', 'zone'];
    return meaningfulFields.every(field => !rowData[field] || rowData[field].toString().trim() === '');
}

function validateNoMiddleEmptyRows() {
    syncTableDataWithDOM();
    let lastFilledIndex = -1;
    
    for (let i = tableData.length - 1; i >= 0; i--) {
        if (!isRowEmpty(tableData[i])) {
            lastFilledIndex = i;
            break;
        }
    }
    
    if (lastFilledIndex === -1) return true;
    
    for (let i = 0; i <= lastFilledIndex; i++) {
        if (isRowEmpty(tableData[i])) {
            alert(`Row ${i + 1} is empty but row ${lastFilledIndex + 1} has data.\nPlease fill rows sequentially from top to bottom.\nRow ${i + 1} must be completed before saving.`);
            return false;
        }
    }
    
    return true;
}

function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
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

    // Set color based on type
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        info: '#2196F3'
    };

    notification.style.backgroundColor = colors[type] || colors.info;
    notification.textContent = message;
    notification.style.opacity = '1';

    // Hide after 3 seconds
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

document.addEventListener('DOMContentLoaded', () => {
    // Trigger initial stats load
    setTimeout(fetchStatsAndRender, 1000);
});