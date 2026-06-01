//=========================
//START
//=========================

let rowCount = 0;
let tableData = [];
let entriesPerPage = 6;
let currentPage = 1;
const translatableColumns = ['toWhom', 'place', 'subject', 'sentBy'];
let translationCache = new Map();

let originalData = new Map();
let changedRows = new Set(); 
let newRows = new Set(); 

let columnFilters = {};

//======================================
//UTILITY FUNCTIONS FOR DATA HANDLING
//======================================

function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Create a hash of row data for comparison
function createRowHash(rowData) {
    const relevantData = {
        date: rowData.date || '',
        toWhom: rowData.toWhom || '',
        toWhomHindi: rowData.toWhomHindi || '',
        place: rowData.place || '',
        placeHindi: rowData.placeHindi || '',
        subject: rowData.subject || '',
        subjectHindi: rowData.subjectHindi || '',
        sentBy: rowData.sentBy || '',
        sentByHindi: rowData.sentByHindi || ''
    };
    return JSON.stringify(relevantData);
}

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

//========================================
//MOBILE TOOLBAR
//========================================
function toggleMobileMenu() {
    const toolbar = document.getElementById('toolbar');
    toolbar.classList.toggle('active');
}

function toggleDropdown() {
    const container = document.querySelector('.split-btn-container');
    container.classList.toggle('active');
}

// Close mobile menu when clicking outside
document.addEventListener('click', function(event) {
    const toolbar = document.getElementById('toolbar');
    const toggle = document.querySelector('.mobile-menu-toggle');
    
    // Check if elements exist before accessing their methods
    if (toolbar && toggle && !toolbar.contains(event.target) && !toggle.contains(event.target)) {
        toolbar.classList.remove('active');
    }
});

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const container = document.querySelector('.split-btn-container');
    
    // Check if element exists before accessing its methods
    if (container && !container.contains(event.target)) {
        container.classList.remove('active');
    }
});

// Function to switch to the other page with flip effect
function switchPage(targetPage) {
    // SAVE current table data to sessionStorage before switching
    syncTableDataWithDOM(); // Make sure we have latest data
    sessionStorage.setItem('preservedTableData', JSON.stringify(tableData));
    sessionStorage.setItem('preservedRowCount', rowCount.toString());
    
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
//DATE FUNCTIONALITY FOR DATE
//==========================================

function restrictDateInput(input) {
    // Remove any non-numeric characters except slashes
    input.value = input.value.replace(/[^0-9/]/g, '');

    // Ensure the format is dd/mm/yyyy
    let value = input.value;
    
    // Auto-add slashes after day and month
    if (value.length === 2 && !value.includes('/')) {
        input.value = value + '/';
    } else if (value.length === 5 && value.split('/').length === 2) {
        input.value = value + '/';
    }

    // Limit input length to 10 (dd/mm/yyyy)
    if (value.length > 10) {
        input.value = value.slice(0, 10);
    }

    // Validate date format (dd/mm/yyyy)
    if (value.length === 10) {
        const parts = value.split('/');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);

        // Check for valid days in month (basic, without leap year for Feb)
        let isValid = true;
        if (month < 1 || month > 12) isValid = false;
        if (day < 1 || day > 31) isValid = false;
        if ([4,6,9,11].includes(month) && day > 30) isValid = false;
        if (month === 2 && day > 29) isValid = false;
        if (year < 1000 || year > 9999) isValid = false;

        if (!isValid) {
            input.setCustomValidity('Please enter a valid date in dd/mm/yyyy format');
            input.reportValidity();
        } else {
            input.setCustomValidity('');
        }
    } else {
        input.setCustomValidity('');
   }
}

function parseDate(dateStr) {
    if (!dateStr) return new Date('1900-01-01');
    const parts = dateStr.split('/');
    if (parts.length !== 3) return new Date('1900-01-01');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
}
//=============================
//=====SORTING COLUMNS=========
//=============================

//------TOGGLE SORT MENU------//

function toggleSortMenu(columnKey) {
    const dropId = `sort-${columnKey}`;              
    const dropdown = document.getElementById(dropId);
    if (!dropdown) return;                            

    // Close all other dropdowns
    document.querySelectorAll('.sort-dropdown').forEach(d => {
        if (d !== dropdown) {
            d.classList.remove('show');
            d.classList.remove('show-above');
        }
    });

    // Toggle current dropdown
    const wasShown = dropdown.classList.contains('show');
    dropdown.classList.toggle('show');

    // If dropdown is now being shown, position it correctly
    if (!wasShown) {
        positionDropdown(dropdown);
    }

    // Close dropdown when clicking outside
    setTimeout(() => {
        const close = e => {
            if (!dropdown.contains(e.target) &&
                !e.target.closest('.hamburger-btn')) {
                dropdown.classList.remove('show');
                dropdown.classList.remove('show-above');
                document.removeEventListener('click', close);
            }
        };
        document.addEventListener('click', close);
    }, 0);
}
function positionDropdown(dropdown) {
    const parentTh = dropdown.closest('th');
    if (!parentTh) return;

    const thRect = parentTh.getBoundingClientRect();
    const dropdownHeight = dropdown.offsetHeight || 200;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - thRect.bottom;
    const spaceAbove = thRect.top;

    // Position horizontally (right-aligned with the th)
    dropdown.style.right = (window.innerWidth - thRect.right) + 'px';
    dropdown.style.left = 'auto';

    // Position vertically based on available space
    if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
        // Show above
        dropdown.style.top = 'auto';
        dropdown.style.bottom = (viewportHeight - thRect.top + 2) + 'px';
        dropdown.classList.add('show-above');
    } else {
        // Show below
        dropdown.style.top = (thRect.bottom + 2) + 'px';
        dropdown.style.bottom = 'auto';
        dropdown.classList.remove('show-above');
    }
}
//----------------------------------------SORT COLUMN---------------------------------------------//

function sortColumn(field, order) {
    syncTableDataWithDOM();
    
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

function searchColumn(column) {
    const input = document.querySelector(`input[data-column="${column}"]`);
    if (!input) {
        console.error(`Input not found for column: ${column}`);
        return;
    }
    
    const searchTerm = input.value.toLowerCase().trim();
    
    if (searchTerm === '') {
        clearColumnSearch(column);
        return;
    }
    
    columnFilters[column] = searchTerm;
    applyAllFilters();
    
    // Reposition dropdown after filtering
    const dropdown = document.getElementById(`sort-${column}`);
    if (dropdown && dropdown.classList.contains('show')) {
        setTimeout(() => {
            positionDropdown(dropdown);
        }, 100);
    }
}

window.addEventListener('resize', () => {
    document.querySelectorAll('.sort-dropdown.show').forEach(dropdown => {
        positionDropdown(dropdown);
    });
});

// Add scroll handler to reposition open dropdowns
window.addEventListener('scroll', () => {
    document.querySelectorAll('.sort-dropdown.show').forEach(dropdown => {
        positionDropdown(dropdown);
    });
}, true); 

//--------------------------------------CLEAR COLUMN SEARCH-----------------------------------------//

function clearColumnSearch(column) {
    const input = document.querySelector(`input[data-column="${column}"]`);
    if (input) {
        input.value = '';
    }
    delete columnFilters[column];
    applyAllFilters();
}
//-------------------------------------APPLY ALL ACTIVE FILTERS--------------------------------------//

function applyAllFilters() {
    const tbody = document.getElementById('tableBody');
    const rows = tbody.querySelectorAll('tr');
    let visibleCount = 0;
    
    rows.forEach((row, index) => {
        let showRow = true;
        
        for (const [column, searchTerm] of Object.entries(columnFilters)) {
            const cellValue = getCellValueByColumn(row, column).toLowerCase();
            
            if (!cellValue.includes(searchTerm)) {
                showRow = false;
                break;
            }
        }
        
        if (showRow) {
            row.style.display = '';
            row.classList.add('filtered-row');
            visibleCount++;
        } else {
            row.style.display = 'none';
            row.classList.remove('filtered-row');
        }
    });
    
    showNoResultsMessage(visibleCount === 0);
}

//==========================================
//INITIALIZE TABLE
//==========================================
function initializeTable() {

    if (window.tableInitialized) {
        console.log('⏭️ Table already initialized, skipping...');
        return;
    }
    const preservedData = sessionStorage.getItem('preservedTableData');
    const preservedRowCount = sessionStorage.getItem('preservedRowCount');
    
    if (preservedData && preservedRowCount) {
        console.log('🔄 Restoring data from previous page...');
        tableData = JSON.parse(preservedData);
        rowCount = parseInt(preservedRowCount);
        rebuildTable();
        
        // Clear the preserved data
        sessionStorage.removeItem('preservedTableData');
        sessionStorage.removeItem('preservedRowCount');
        
        setupRowInsertion();
        attachAllEventListeners();
        window.tableInitialized = true;
        
        console.log('✅ Data restored from page switch!');
        return; 
    }

    const userIsAuthenticated = isAuthenticated();

    if (userIsAuthenticated) {
        console.log('🔄 Authenticated user - loading data...');
        loadUserData(); // This will handle BOTH cases: existing data OR new user
    } else {
        console.log('📝 Guest user - initializing with 6 empty rows...');
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
        console.log('✅ Save button listener attached');
    } else {
        console.error('❌ Save button not found!');
    }
    //=================
    //LOAD DATA
    //=================
    /*const loadBtn = document.getElementById('loadBtn');

    if (loadBtn) {
        loadBtn.addEventListener('click', loadUserData);
        console.log('✅ Load button listener attached');
    } 
    else {
        console.error('❌ Load button not found!');
    }*/
    
    //============================
    //SORTING LISTENERS
    //============================

    document.querySelectorAll('.hamburger-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent event bubbling
            const columnHeader = this.closest('.column-header');
            const thElement = columnHeader.closest('th');
            const column = thElement.className; // Gets the class name like 'date', 'whomSent', etc.

            // Map class names to field names
            const columnMap = {
                'date': 'date',
                'whomSent': 'toWhom',
                'place': 'place',
                'subject': 'subject',
                'sentBy': 'sentBy'
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
        console.log('✅ Undo button listener attached');
    }

    if (redoBtn) {
        redoBtn.addEventListener('click', function(e) {
            e.preventDefault();
            redo();
        });
        console.log('✅ Redo button listener attached');
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
        console.log('✅ Save button listener attached');
    } else {
        console.error('❌ Save button not found!');
    }
    
    //============================
    //SORTING LISTENERS
    //============================

    document.querySelectorAll('.hamburger-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const columnHeader = this.closest('.column-header');
            const thElement = columnHeader.closest('th');
            const column = thElement.className;

            const columnMap = {
                'date': 'date',
                'whomSent': 'toWhom',
                'place': 'place',
                'subject': 'subject',
                'sentBy': 'sentBy'
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
        console.log('✅ Undo button listener attached');
    }

    if (redoBtn) {
        redoBtn.addEventListener('click', function(e) {
            e.preventDefault();
            redo();
        });
        console.log('✅ Redo button listener attached');
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

function changeFontStyle(selectElement) {
    const selectedFont = selectElement.value;
    const table = document.getElementById("excelTable");
    if (table) {
        table.style.fontFamily = selectedFont;
    }
}

function changeFontSize(selectElement) {
  const size = selectElement.value;
  const table = document.getElementById("excelTable");
  const tdata = document.getElementById("tableBody");
  table.style.fontSize = size;
  tdata.style.fontSize = size;

  // Optional: apply to each <td> and <th>
  const cells = table.querySelectorAll("td, th");
  cells.forEach(cell => cell.style.fontSize = size);
}

let currentEditingCell = null;
let redoStack = [];

// Initialize the formatting system
function initializeTextFormatting() {
    console.log('Initializing text formatting...');
    
    
    makeTableCellsEditable();
    
    setupFormattingButtons();
    
    setupKeyboardShortcuts();

}

// MAKE TABLE CELLS EDITABLE
function makeTableCellsEditable() {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) {
        console.error('Table body not found');
        return;
    }

    // MAKE EXISTING TABLES EDITABLE 
    const cells = tableBody.querySelectorAll('td');
    cells.forEach(cell => {
        setupCellEditing(cell);
    });

    //HANDLE DYNAMICALLY ADDED ROWS
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1 && node.tagName === 'TR') {
                    const cells = node.querySelectorAll('td');
                    cells.forEach(cell => {
                        setupCellEditing(cell);
                    });
                }
            });
        });
    });

    observer.observe(tableBody, { childList: true, subtree: true });
}

//============================================
// TEXT FORMATTING FUNCTIONS
//============================================

function applyFormatting(command) {
    const activeElement = document.activeElement;
    
    // Check if we're in a textarea or input field
    if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') && activeElement.classList.contains('cell')) {
        const start = activeElement.selectionStart;
        const end = activeElement.selectionEnd;
        
        if (start === end) {
            alert('Please select text first by dragging your mouse over it');
            return;
        }
        
        convertTextareaToContentEditable(activeElement, command);
    } else {
        alert('Please click on a cell and select text first');
    }
}

function convertTextareaToContentEditable(textarea, command) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    if (start === end) {
        alert('Please select text first by dragging your mouse over it');
        return;
    }
    
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const beforeText = text.substring(0, start);
    const afterText = text.substring(end);
    
    // Create formatted text with proper HTML escaping for existing content
    const escapedBefore = escapeHtml(beforeText);
    const escapedAfter = escapeHtml(afterText);
    const escapedSelected = escapeHtml(selectedText);
    
    let formattedText = '';
    switch(command) {
        case 'bold':
            formattedText = `${escapedBefore}<strong>${escapedSelected}</strong>${escapedAfter}`;
            break;
        case 'italic':
            formattedText = `${escapedBefore}<em>${escapedSelected}</em>${escapedAfter}`;
            break;
        case 'underline':
            formattedText = `${escapedBefore}<u>${escapedSelected}</u>${escapedAfter}`;
            break;
    }
    
    // Create a contentEditable div to replace the textarea
    const div = document.createElement('div');
    div.contentEditable = true;
    div.className = textarea.className;
    div.innerHTML = formattedText;
    
    // Copy all styles from textarea
    const computedStyle = window.getComputedStyle(textarea);
    div.style.cssText = `
        width: 100%;
        min-height: ${textarea.offsetHeight}px;
        padding: 12px;
        border: none;
        outline: none;
        background: transparent;
        cursor: text;
        font-family: ${computedStyle.fontFamily};
        font-size: ${computedStyle.fontSize};
        color: ${computedStyle.color};
        resize: vertical;
        overflow-wrap: break-word;
        word-wrap: break-word;
        white-space: pre-wrap;
        line-height: 1.4;
    `;
    
    // Copy data attributes
    div.setAttribute('data-row', textarea.getAttribute('data-row'));
    div.setAttribute('data-field', textarea.getAttribute('data-field'));
    if (textarea.getAttribute('required')) {
        div.setAttribute('required', 'true');
    }
    
    // Replace textarea with div
    const parent = textarea.parentNode;
    parent.replaceChild(div, textarea);
    
    // Add event listeners to the new div
    addContentEditableListeners(div);
    
    // Focus the div and place cursor after the formatted text
    div.focus();
    
    // Set cursor position after the formatted text
    setTimeout(() => {
        const range = document.createRange();
        const sel = window.getSelection();
        
        // Find the formatted tag
        const formattedTag = div.querySelector('strong, em, u');
        if (formattedTag && formattedTag.nextSibling) {
            range.setStart(formattedTag.nextSibling, 0);
        } else {
            range.selectNodeContents(div);
            range.collapse(false);
        }
        
        sel.removeAllRanges();
        sel.addRange(range);
    }, 10);
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Function to apply formatting to contentEditable divs
function applyFormattingToContentEditable(command) {
    const selection = window.getSelection();
    
    if (!selection.rangeCount || selection.isCollapsed) {
        alert('Please select text first by dragging your mouse over it');
        return;
    }
    
    // Check if we're in a contentEditable element
    let element = selection.anchorNode;
    if (element.nodeType === Node.TEXT_NODE) {
        element = element.parentElement;
    }
    
    const contentEditableDiv = element.closest('[contenteditable="true"]');
    if (!contentEditableDiv || !contentEditableDiv.classList.contains('cell')) {
        alert('Please select text in a cell first');
        return;
    }
    
    // Save state for undo
    saveState();
    
    // Apply the formatting
    document.execCommand(command, false, null);
    
    // Trigger save
    const row = parseInt(contentEditableDiv.getAttribute('data-row'));
    const field = contentEditableDiv.getAttribute('data-field');
    if (tableData[row]) {
        tableData[row][field] = contentEditableDiv.innerHTML;
        
        // Mark as changed
        if (tableData[row].isFromDatabase) {
            changedRows.add(row);
            tableData[row].hasChanges = true;
        } else {
            newRows.add(row);
        }
        updateRowVisualStatus(row);
    }
    
    contentEditableDiv.focus();
}

function addContentEditableListeners(div) {
    div.addEventListener('focus', function() {
        this.classList.add('editing');
    });
    
    div.addEventListener('blur', async function() {
        this.classList.remove('editing');
        const row = parseInt(this.getAttribute('data-row'));
        const field = this.getAttribute('data-field');
        if (tableData[row]) {
            tableData[row][field] = this.innerHTML;
            
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
    });
    
    div.addEventListener('keydown', function(e) {
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
    
    div.addEventListener('input', debounce(async function() {
        const row = parseInt(this.getAttribute('data-row'));
        const field = this.getAttribute('data-field');
        
        if (tableData[row]) {
            tableData[row][field] = this.innerHTML;
            
            if (tableData[row].isFromDatabase) {
                changedRows.add(row);
                tableData[row].hasChanges = true;
            } else {
                newRows.add(row);
            }
            updateRowVisualStatus(row);
        }
    }, 300));
}

//====================================
// KEYBOARD SHORTCUTS FOR FORMATTING
//====================================

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

function attachFormattingListeners() {
    const boldBtn = document.getElementById('boldBtn');
    const italicBtn = document.getElementById('italicsBtn');
    const underlineBtn = document.getElementById('underlineBtn');

    if (boldBtn) {
        boldBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const activeElement = document.activeElement;

            if (activeElement && activeElement.contentEditable === 'true' && activeElement.classList.contains('cell')) {
                applyFormattingToContentEditable('bold');
            } else if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') && activeElement.classList.contains('cell')) {
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
            } else if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') && activeElement.classList.contains('cell')) {
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
            } else if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') && activeElement.classList.contains('cell')) {
                applyFormatting('underline');
            } else {
                alert('Please click on a cell and select text first');
            }
        });
    }
}

//============================================
// UNDO/REDO FUNCTIONALITY
//============================================

let undoStack = [];
let redoStacks = [];
const MAX_HISTORY = 50;

// Save state to undo stack
function saveState() {
    const currentState = {
        data: deepClone(tableData),
        timestamp: Date.now()
    };
    
    undoStack.push(currentState);
    
    // Limit stack size
    if (undoStack.length > MAX_HISTORY) {
        undoStack.shift();
    }
    
    // Clear redo stack when new action is performed
    redoStacks = [];
    
    updateUndoRedoButtons();
}

// Undo function
function undo() {
    if (undoStack.length === 0) {
        alert('Nothing to undo');
        return;
    }
    
    // Save current state to redo stack
    const currentState = {
        data: deepClone(tableData),
        timestamp: Date.now()
    };
    redoStacks.push(currentState);

    // Get previous state
    const previousState = undoStack.pop();
    tableData = deepClone(previousState.data);
    
    // Rebuild table with previous state
    rebuildTable();
    
    updateUndoRedoButtons();
    showNotification('Undo successful', 'info');
}

// Redo function
function redo() {
    if (redoStacks.length === 0) {
        alert('Nothing to redo');
        return;
    }
    
    // Save current state to undo stack
    const currentState = {
        data: deepClone(tableData),
        timestamp: Date.now()
    };
    undoStack.push(currentState);
    
    // Get next state
    const nextState = redoStacks.pop();
    tableData = deepClone(nextState.data);
    
    // Rebuild table with next state
    rebuildTable();
    
    updateUndoRedoButtons();
    showNotification('Redo successful', 'info');
}

// Update button states
function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo');
    const redoBtn = document.getElementById('redo');
    
    if (undoBtn) {
        undoBtn.disabled = undoStack.length === 0;
        undoBtn.style.opacity = undoStack.length === 0 ? '0.5' : '1';
        undoBtn.style.cursor = undoStack.length === 0 ? 'not-allowed' : 'pointer';
    }
    
    if (redoBtn) {
        redoBtn.disabled = redoStacks.length === 0;
        redoBtn.style.opacity = redoStacks.length === 0 ? '0.5' : '1';
        redoBtn.style.cursor = redoStacks.length === 0 ? 'not-allowed' : 'pointer';
    }
}

// Debounced save state for input events
const debouncedSaveState = debounce(saveState, 1000);

//===========================
//NO OF ENTRIES
//===========================

document.addEventListener('DOMContentLoaded', () => {
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const splitBtnContainer = document.querySelector('.split-btn-container');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    const entriesBtn = document.querySelector('.entries-btn');
    const dropdownItems = document.querySelectorAll('.dropdown-menu li a');

    // Toggle dropdown on clicking the toggle button
    dropdownToggle.addEventListener('click', () => {
        splitBtnContainer.classList.toggle('active');
        dropdownToggle.setAttribute(
            'aria-expanded',
            splitBtnContainer.classList.contains('active')
        );
    });
    entriesBtn.addEventListener('click', () => {
        splitBtnContainer.classList.toggle('active');
        dropdownToggle.setAttribute(
            'aria-expanded',
            splitBtnContainer.classList.contains('active')
        );
    });

    document.addEventListener('click', (e) => {
        if (!splitBtnContainer.contains(e.target)) {
            splitBtnContainer.classList.remove('active');
            dropdownToggle.setAttribute('aria-expanded', 'false');
        }
    });

    dropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault(); 
            const selectedValue = parseInt(item.textContent); 
            entriesBtn.textContent = selectedValue; 
            entriesPerPage = selectedValue;
            currentPage = 1;
            rebuildTable();
            splitBtnContainer.classList.remove('active');
            dropdownToggle.setAttribute('aria-expanded', 'false');
            console.log(`Selected number of entries: ${selectedValue} entries`);
        });
    });
});
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

function applyFormattingToContentEditable(command) {
    const selection = window.getSelection();
    
    if (!selection.rangeCount || selection.isCollapsed) {
        alert('Please select text first by dragging your mouse over it');
        return;
    }
    
    let element = selection.anchorNode;
    if (element.nodeType === Node.TEXT_NODE) {
        element = element.parentElement;
    }
    
    const contentEditableDiv = element.closest('[contenteditable="true"]');
    if (!contentEditableDiv || !contentEditableDiv.classList.contains('cell')) {
        alert('Please select text in a cell first');
        return;
    }
    
    document.execCommand(command, false, null);
    
    const row = parseInt(contentEditableDiv.getAttribute('data-row'));
    const field = contentEditableDiv.getAttribute('data-field');
    if (tableData[row]) {
        tableData[row][field] = contentEditableDiv.innerHTML;
        
        if (tableData[row].isFromDatabase) {
            changedRows.add(row);
            tableData[row].hasChanges = true;
        } else {
            newRows.add(row);
        }
        updateRowVisualStatus(row);
    }
    
    contentEditableDiv.focus();
}

function addContentEditableListeners(div) {
    div.addEventListener('focus', function() {
        this.classList.add('editing');
    });
    
    div.addEventListener('blur', async function() {
        this.classList.remove('editing');
        const row = parseInt(this.getAttribute('data-row'));
        const field = this.getAttribute('data-field');
        if (tableData[row]) {
            tableData[row][field] = this.innerHTML;
            
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
    });
    
    div.addEventListener('keydown', function(e) {
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
    
    div.addEventListener('input', debounce(async function() {
        const row = parseInt(this.getAttribute('data-row'));
        const field = this.getAttribute('data-field');
        
        if (tableData[row]) {
            tableData[row][field] = this.innerHTML;
            
            if (tableData[row].isFromDatabase) {
                changedRows.add(row);
                tableData[row].hasChanges = true;
            } else {
                newRows.add(row);
            }
            updateRowVisualStatus(row);
        }
    }, 300));
}

//====================================================
//TABLE OPTIONS
//====================================================


//-------------------------------ADD NEW ROW--------------------------------------//

function addNewRow() {
    rowCount++;
    const tbody = document.getElementById('tableBody');
    const row = document.createElement('tr');
    
    const rowData = {
        //serialNo: rowCount,
        date: '',
        toWhom: '',
        toWhomHindi: '',
        place: '',
        placeHindi: '',
        subject: '',
        subjectHindi: '',
        sentBy: '',
        sentByHindi: ''
    };
    tableData.push(rowData);
    row.innerHTML = `
        <td class="row-number">${rowCount}</td>
        <td><input type="text" class="cell" required data-row="${rowCount-1}" data-field="date" placeholder="Enter date..." style="height: 53px;"></td> <!-- Keep as input for date (no wrapping needed) -->
        <td>
            <textarea class="cell english-cell" required data-row="${rowCount-1}" data-field="toWhom" placeholder="Enter recipient..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${rowCount-1}" data-field="toWhomHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${rowCount-1}" data-field="place" placeholder="Enter place..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${rowCount-1}" data-field="placeHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${rowCount-1}" data-field="subject" placeholder="Enter subject..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${rowCount-1}" data-field="subjectHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${rowCount-1}" data-field="sentBy" placeholder="Mode of sending..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${rowCount-1}" data-field="sentByHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
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

function moveToNextCell(currentCell) {
    // Get all cells including both input and contentEditable divs
    const allCells = Array.from(document.querySelectorAll('.cell, [contenteditable="true"].cell'));
    const currentIndex = allCells.indexOf(currentCell);
    
    if (currentIndex < allCells.length - 1) {
        allCells[currentIndex + 1].focus();
    } else {
        addNewRow();
        setTimeout(() => {
            const newCells = Array.from(document.querySelectorAll('.cell, [contenteditable="true"].cell'));
            if (newCells.length > 0) {
                newCells[newCells.length - 10].focus();
            }
        }, 100);
    }
}

// Sync table data with DOM
function syncTableDataWithDOM() {
    const tbody = document.getElementById('tableBody');
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach((row, index) => {
        if (!tableData[index]) {
            console.warn(`⚠️ No tableData for row ${index}`);
            return;
        }
        
        // Get ALL input elements (input, textarea, contentEditable)
        const allInputs = row.querySelectorAll('input.cell, textarea.cell, [contenteditable="true"].cell');
        
        console.log(`Row ${index}: Found ${allInputs.length} input elements`);
        
        // Helper function to get value from any input type
        const getCellValue = (cell) => {
            if (!cell) return '';
            if (cell.tagName === 'INPUT') {
                console.log(`  Input value: "${cell.value}"`);
                return cell.value;
            }
            if (cell.tagName === 'TEXTAREA') {
                console.log(`  Textarea value: "${cell.value}"`);
                return cell.value;
            }
            if (cell.contentEditable === 'true') {
                console.log(`  ContentEditable innerHTML: "${cell.innerHTML}"`);
                return cell.innerHTML;
            }
            return '';
        };
        
        // Map inputs to fields based on data-field attribute
        allInputs.forEach(input => {
            const field = input.getAttribute('data-field');
            if (field) {
                const value = getCellValue(input);
                tableData[index][field] = value;
                console.log(`  ✅ Saved ${field}: "${value}"`);
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
        'date': [0],
        'toWhom': [1, 2],
        'place': [3, 4],
        'subject': [5, 6],
        'sentBy': [7, 8]
    };
    
    const indices = columnMapping[column] || [];
    const values = indices.map(i => getCellValue(allCells[i])).filter(Boolean);
    return values.join(' ');
}

function showNoResultsMessage(show) {
    let message = document.getElementById('no-results-message');
    if (show) {
        if (!message) {
            message = document.createElement('tr');
            message.id = 'no-results-message';
            message.innerHTML = '<td colspan="100%" style="text-align: center; padding: 20px; color: #666; font-style: italic;">No matching results found</td>';
            document.getElementById('tableBody').appendChild(message);
        }
    } else {
        if (message) {
            message.remove();
        }
    }
}

//------------------------------------------TOGGLE SORT MENU-------------------------------------------//

function sortColumn(field, order) {
    syncTableDataWithDOM();
    
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
            // Convert to string and lowercase for text comparison
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

function setupRowInsertion() {
    const tbody = document.getElementById('tableBody');
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
        addRowInsertionListeners(row);
    });
}

// ADD ROW LISTENERS

function addRowInsertionListeners(row) {
    const insertBtn = document.createElement('div');
    insertBtn.className = 'insert-row-btn';
    insertBtn.innerHTML = '+ Insert Row';
    insertBtn.style.display = 'none';
    
    row.style.position = 'relative';
    row.appendChild(insertBtn);
    
    row.addEventListener('mouseenter', function() {
        insertBtn.style.display = 'block';
    });
    
    row.addEventListener('mouseleave', function() {
        insertBtn.style.display = 'none';
    });
    
    insertBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        insertRowAfter(row);
    });
    
    row.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        showContextMenu(e, row);
    });
}

//============================================
// LOAD USER DATA ON LOGIN
//============================================

async function loadUserData() {
    if (window.isLoadingData) {
        console.log('⏭️ Already loading data, skipping duplicate call...');
        return;
    }

    if (!isAuthenticated()) {
        console.log('User not authenticated, skipping data load');
        return;
    }

    window.isLoadingData = true;

    try {
        console.log('📥 Loading user data...');
        
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
            console.log(`📊 Loaded ${result.data.length} existing records`);
            
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
                    date: row.date || '',
                    toWhom: row.toWhom || '',
                    toWhomHindi: row.toWhomHindi || '',
                    place: row.place || '',
                    placeHindi: row.placeHindi || '',
                    subject: row.subject || '',
                    subjectHindi: row.subjectHindi || '',
                    sentBy: row.sentBy || '',
                    sentByHindi: row.sentByHindi || '',
                    isFromDatabase: true,
                    hasChanges: false
                };
            });

            rowCount = tableData.length;
            rebuildTable();
            
            console.log('✅ User data loaded and displayed');
            showNotification(`Loaded ${result.data.length} existing records`, 'success');
            
        } else {
            // NEW USER - NO DATA FOUND
            console.log('📭 No existing data found for user, creating 6 empty rows...');
            
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
        console.error('❌ Error loading user data:', error);
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
        //serialNo: rowCount,
        date: '',
        toWhom: '',
        toWhomHindi: '',
        place: '',
        placeHindi: '',
        subject: '',
        subjectHindi: '',
        sentBy: '',
        sentByHindi: ''
    };
    tableData.splice(targetIndex + 1, 0, rowData);
    
    newRow.innerHTML = `
        <td class="row-number">${rowCount}</td>
        <td><input type="text" class="cell" required data-row="${targetIndex + 1}" data-field="date" placeholder="dd-mm-yyyy" style="height: 53px;"></td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex + 1}" data-field="toWhom" placeholder="Enter recipient..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="toWhomHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex + 1}" data-field="place" placeholder="Enter place..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="placeHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex + 1}" data-field="subject" placeholder="Enter subject..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="subjectHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex + 1}" data-field="sentBy" placeholder="Mode of sending..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="sentByHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
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

//UPDATE ROW NUMBERS
function updateRowNumbers() {
    const tbody = document.getElementById('tableBody');
    const rows = tbody.querySelectorAll('tr');
    const startIdx = (currentPage - 1) * entriesPerPage;
    rows.forEach((row, index) => {
        const rowNumberCell = row.querySelector('.row-number');
        if (rowNumberCell) {
            rowNumberCell.textContent = startIdx + index + 1;
        }
    });
}

//SHOW CONTEXT MENUS

function showContextMenu(event, row) {
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) existingMenu.remove();
    
    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    contextMenu.innerHTML = `
        <div class="context-menu-item" data-action="insert-above">Insert Row Above</div>
        <div class="context-menu-item" data-action="insert-below">Insert Row Below</div>
        <div class="context-menu-item" data-action="delete-row">Delete Row</div>
    `;
    
    contextMenu.style.position = 'absolute';
    contextMenu.style.left = event.pageX + 'px';
    contextMenu.style.top = event.pageY + 'px';
    contextMenu.style.zIndex = '1000';
    
    document.body.appendChild(contextMenu);
    
    contextMenu.addEventListener('click', function(e) {
        const action = e.target.getAttribute('data-action');
        const tbody = document.getElementById('tableBody');
        const targetIndex = Array.from(tbody.children).indexOf(row);
        
        switch(action) {
            case 'insert-above':
                insertRowAt(targetIndex);
                break;
            case 'insert-below':
                insertRowAfter(row);
                break;
            case 'delete-row':
                deleteRow(row, targetIndex);
                break;
        }
        
        contextMenu.remove();
    });
    
    document.addEventListener('click', function removeMenu() {
        contextMenu.remove();
        document.removeEventListener('click', removeMenu);
    });
}

//INSERT ROW AT INDEX

function insertRowAt(index) {
    const tbody = document.getElementById('tableBody');
    const rows = tbody.querySelectorAll('tr');
    if (index === 0) insertRowBefore(rows[0]);
    else insertRowAfter(rows[index - 1]);
}

// INSERT ROW BEFORE TARGET

function insertRowBefore(targetRow) {
    const tbody = document.getElementById('tableBody');
    const targetIndex = Array.from(tbody.children).indexOf(targetRow);
    
    rowCount++;
    const newRow = document.createElement('tr');
    
    const rowData = {
        serialNo: rowCount,
        date: '',
        toWhom: '',
        toWhomHindi: '',
        place: '',
        placeHindi: '',
        subject: '',
        subjectHindi: '',
        sentBy: '',
        sentByHindi: ''
    };
    tableData.splice(targetIndex, 0, rowData);
    
    newRow.innerHTML = `
        <td class="row-number">${rowCount}</td>
        <td><input type="text" class="cell" required data-row="${targetIndex + 1}" data-field="date" placeholder="dd-mm-yyyy" style="height: 53px;"></td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex + 1}" data-field="toWhom" placeholder="Enter recipient..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="toWhomHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex + 1}" data-field="place" placeholder="Enter place..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="placeHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex + 1}" data-field="subject" placeholder="Enter subject..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="subjectHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
        </td>
        <td>
            <textarea class="cell english-cell" required data-row="${targetIndex + 1}" data-field="sentBy" placeholder="Mode of sending..." style="resize: vertical;"></textarea>
            <textarea class="cell hindi-cell" data-row="${targetIndex + 1}" data-field="sentByHindi" placeholder="Hindi translation..." disabled style="resize: vertical;"></textarea>
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

function addCellEventListeners(cell) {
    if (cell.getAttribute('data-field') === 'date') {
        cell.placeholder = 'dd/mm/yyyy';
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
//----------------------------------------------SAVE THINGY-------------------------------------------//

//==============================================
// DATABASE INTEGRATION FUNCTIONS
//==============================================

// Validate row data - checks if all required fields are filled
function validateRowData(rowData, rowIndex) {
    const requiredFields = ['date', 'toWhom', 'place', 'subject', 'sentBy'];
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
            else{
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

    // Get only changed and new rows
    const changedRowsData = [];
    const newRowsData = [];
    
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
        `• ${newRowsData.length} new rows\n` +
        `• ${changedRowsData.length} modified rows`;
        
    if (!confirm(confirmMessage)) {
        return;
    }

    console.log(`🔄 Saving ${totalChanges} changed rows...`);
    
    try {
        const saveBtn = document.querySelector('.save-btn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '⏳ Saving Changes...';
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
            
            saveBtn.textContent = '✅ Changes Saved!';
            setTimeout(() => {
                saveBtn.textContent = originalText;
            }, 3000);
            
            showNotification(`Successfully saved ${totalChanges} changes`, 'success');
            
        } else {
            throw new Error(result.error || 'Failed to save changes');
        }
        
    } catch (error) {
        console.error('❌ Save error:', error);
        alert('❌ Error saving changes: ' + error.message);
    } finally {
        const saveBtn = document.querySelector('.save-btn');
        if (!saveBtn.textContent.includes('✅')) {
            saveBtn.textContent = 'Save Changes';
        }
        saveBtn.disabled = false;
    }
}


//============================================
//TRANSLATION
//============================================

async function translateText(text) {
    console.log('🔄 Translation requested for:', text);
    
    // Check cache first
    if (translationCache.has(text)) {
        console.log('✅ Using cached translation');
        return translationCache.get(text);
    }
    
    try {
        console.log('📡 Calling translation API...');
        const response = await fetch("https://d-jaden02-en-hi-helsinki-model.hf.space/translate", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                max_length: 512
            })
        });
        
        console.log('📥 Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📦 Response data:', data);
        
        if (data && data.translated_text) {
            const translated = data.translated_text;
            translationCache.set(text, translated);
            console.log('✅ Translation successful:', translated);
            return translated;
        } else {
            throw new Error(data.error || 'Invalid response from translation API');
        }
    } catch (error) {
        console.error('❌ Translation error:', error);
        console.warn('Translation API unavailable, using original text');
        return text;
    }
}

//FASTER TRANSLATION ALT

async function translateTextBatch(texts) {
    try {
        const response = await fetch("https://d-jaden02-en-hi-helsinki-model.hf.space/batch_translate", {
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
                    translations[texts[index]] = texts[index]; // Fallback to original
                }
            });
            return translations;
        } else {
            throw new Error('Invalid batch response from translation API');
        }
    } catch (error) {
        console.error('Batch translation error:', error);
        // Return original texts as fallback
        const fallback = {};
        texts.forEach(text => fallback[text] = text);
        return fallback;
    }
}

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
                console.log(`📝 Row ${row + 1} marked as changed`);
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
            
            console.log('🔍 Looking for Hindi field:', hindiField);
            console.log('🔍 Found element:', hindiInput);
            
            if (hindiInput) {
                // Strip HTML tags for translation
                const textToTranslate = value.replace(/<[^>]*>/g, '');
                console.log('🔄 Translating:', textToTranslate);
                
                const translatedText = await translateText(textToTranslate);
                console.log('✅ Translation result:', translatedText);
                
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
                console.warn('⚠️ Hindi textarea not found for field:', hindiField);
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
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
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
        console.error('Table element not found');
        showNotification('Error: Table not found', 'error');
        return;
    }

    // Clone the entire table
    const clone = original.cloneNode(true);

    /* 1. Remove UI elements from headers */
    clone.querySelectorAll('.hamburger-menu, .sort-dropdown, .insert-row-btn').forEach(el => el.remove());
    
    /* 2. Clean up row styling */
    clone.querySelectorAll('.row-changed, .row-new').forEach(r => {
        r.classList.remove('row-changed', 'row-new');
        r.style.borderLeft = 'none';
    });

    /* 3. Clean up header cells - keep only the text */
    clone.querySelectorAll('thead th').forEach(th => {
        const columnHeader = th.querySelector('.column-header');
        if (columnHeader) {
            const span = columnHeader.querySelector('span');
            if (span) {
                th.textContent = span.textContent;
            }
        }
    });

    /* 4. Process all rows in tbody */
    clone.querySelectorAll('tbody tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        
        cells.forEach((cell, index) => {
            if (index === 0) {
                const rowNum = cell.querySelector('.row-number');
                if (rowNum) {
                    cell.textContent = rowNum.textContent;
                }
                return;
            }
            
            const inputs = cell.querySelectorAll('input.cell');
            const contentEditables = cell.querySelectorAll('[contenteditable="true"].cell');
            
            if (contentEditables.length > 0) {
                if (contentEditables.length === 1) {
                    const div = contentEditables[0];
                    const container = document.createElement('div');
                    container.innerHTML = div.innerHTML;
                    cell.innerHTML = '';
                    cell.appendChild(container);
                } else if (contentEditables.length === 2) {
                    const english = contentEditables[0];
                    const hindi = contentEditables[1];
                    
                    const container = document.createElement('div');
                    if (english && english.innerHTML.trim()) {
                        const engDiv = document.createElement('div');
                        engDiv.innerHTML = english.innerHTML;
                        engDiv.style.marginBottom = '2px';
                        container.appendChild(engDiv);
                    }
                    if (hindi && hindi.innerHTML.trim()) {
                        const hinDiv = document.createElement('div');
                        hinDiv.innerHTML = hindi.innerHTML;
                        hinDiv.style.cssText = 'font-family: "Noto Sans Devanagari", sans-serif; font-size: 1.1em; color: #555;';
                        container.appendChild(hinDiv);
                    }
                    cell.innerHTML = '';
                    cell.appendChild(container);
                }
                return;
            }
            
            if (inputs.length === 0) return;
            
            if (inputs.length === 1) {
                const input = inputs[0];
                cell.textContent = input.value || '';
            } else if (inputs.length === 2) {
                const englishInput = cell.querySelector('.english-cell');
                const hindiInput = cell.querySelector('.hindi-cell');
                
                const container = document.createElement('div');
                if (englishInput && englishInput.value.trim()) {
                    const engDiv = document.createElement('div');
                    engDiv.textContent = englishInput.value.trim();
                    engDiv.style.marginBottom = '2px';
                    container.appendChild(engDiv);
                }
                if (hindiInput && hindiInput.value.trim()) {
                    const hinDiv = document.createElement('div');
                    hinDiv.textContent = hindiInput.value.trim();
                    hinDiv.style.cssText = 'font-family: "Noto Sans Devanagari", sans-serif; font-size: 1.1em; color: #555;';
                    container.appendChild(hinDiv);
                }
                cell.innerHTML = '';
                cell.appendChild(container);
            }
        });
    });

    /* 5. Add comprehensive styling */
    const style = document.createElement('style');
    style.textContent = `
        @page {
            size: A3 landscape;
            margin: 2mm; /* Reduced margin */
        }
    
        html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100%;
            height: 100%;
            background: #fff;
        }
    
        .pdf-wrapper {
            width: 100%;
            margin-left: -5mm; /* Shift left by 5mm */
            padding: 0;
            text-align: left;
        }
    
        table {
            width: 100%;
            border-collapse: collapse;
            font-family: Arial, "Segoe UI", sans-serif;
            font-size: 12px; /* Increased font size */
            table-layout: fixed;
            margin-left: 0 !important;
        }
    
        thead {
            display: table-header-group;
            break-inside: avoid;
        }
    
        tbody {
            display: table-row-group;
        }
    
        tr {
            page-break-inside: avoid;
            break-inside: avoid;
        }
    
        th {
            background-color: #34495e !important;
            color: white !important;
            padding: 5px 3px !important;
            text-align: center !important;
            font-weight: 600 !important;
            border: 1px solid #2c3e50 !important;
            font-size: 14px !important; /* Increased header font size */
            word-wrap: break-word !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
    
        td {
            border: 1px solid #ccc !important;
            padding: 5px 3px !important;
            vertical-align: middle !important;
            text-align: center !important;
            font-size: 12px !important; /* Increased cell font size */
            line-height: 1.25 !important;
            word-wrap: break-word !important;
        }
    
        tbody tr:nth-child(even) {
            background-color: #f9f9f9 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
    
        tbody tr:nth-child(odd) {
            background-color: white !important;
        }
    
        td:first-child {
            background-color: #ecf0f1 !important;
            font-weight: 600 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
    
        /* Adjusted column width proportions for full A3 landscape (~404mm) */
        th:nth-child(1), td:nth-child(1) { width: 5% !important; }
        th:nth-child(2), td:nth-child(2) { width: 10% !important; }
        th:nth-child(3), td:nth-child(3) { width: 20% !important; }
        th:nth-child(4), td:nth-child(4) { width: 15% !important; }
        th:nth-child(5), td:nth-child(5) { width: 25% !important; }
        th:nth-child(6), td:nth-child(6) { width: 25% !important; }
    `;
    
    clone.appendChild(style);
    
    /* 6. Wrap table to control alignment */
    const wrapper = document.createElement('div');
    wrapper.classList.add('pdf-wrapper');
    wrapper.appendChild(clone);
    
    /* 7. PDF generation options */
    const opt = {
        margin: [2, 1, 2, 2], // Reduced margins
        filename: `DAK_Despatch_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.99 },
        html2canvas: {
            scale: 1.8, // Reduced scale to fit content on one page
            useCORS: true,
            logging: false,
            letterRendering: true,
            backgroundColor: '#ffffff',
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
    
    /* 8. Generate PDF */
    html2pdf()
        .set(opt)
        .from(wrapper)
        .save()
        .then(() => showNotification('PDF exported successfully!', 'success'))
        .catch(error => {
            console.error('PDF generation error:', error);
            showNotification('Error generating PDF: ' + error.message, 'error');
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
            date: '',
            toWhom: '',
            toWhomHindi: '',
            place: '',
            placeHindi: '',
            subject: '',
            subjectHindi: '',
            sentBy: '',
            sentByHindi: ''
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
            const placeholder = isDate ? 'Enter date...' : (isEnglish ? 'Enter text...' : 'Hindi translation...');
            const required = isDate || (isEnglish && !field.endsWith('Hindi')) ? 'required' : '';
            const disabled = !isEnglish && !value ? 'disabled' : '';
            
            if (hasHTMLFormatting(value)) {
                // Use contenteditable div for formatted text (supports wrapping via CSS)
                return `<div contenteditable="true" class="${className}" data-row="${startIdx + index}" data-field="${field}" style="width: 100%; min-height: 53px; height: auto; padding: 12px; border: none; outline: none; resize: none;">${value || ''}</div>`;
            } else if (isDate) {
                // Date always uses input (no wrapping needed)
                return `<input type="text" class="${className}" ${required} data-row="${startIdx + index}" data-field="${field}" placeholder="${placeholder}" value="${value || ''}" style="height: 53px; resize: none;">`;
            } else {
                // Use textarea for text fields (enables wrapping)
                return `<textarea class="${className}" ${required} data-row="${startIdx + index}" data-field="${field}" placeholder="${placeholder}" ${disabled} rows="2" style="resize: vertical; min-height: 53px; height: auto;">${value || ''}</textarea>`;
            }
        };
        
        row.innerHTML = `
            <td class="row-number">${serialNumber}</td>
            <td>${createCellContent('date', rowData.date, true, true)}</td> <!-- Date: input or contenteditable -->
            <td>
                ${createCellContent('toWhom', rowData.toWhom, true, false)}
                ${createCellContent('toWhomHindi', rowData.toWhomHindi, false, false)}
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
    const requiredFields = ['date', 'toWhom', 'place', 'subject', 'sentBy'];
    return requiredFields.every(field => 
        rowData[field] && rowData[field].toString().trim() !== ''
    );
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