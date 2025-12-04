// Úklid schodů - Hlavní aplikace
// ================================

const STORAGE_KEY = 'uklidSchodu';
const MONTHS_CS = [
    'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
    'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

// Výchozí data
const DEFAULT_DATA = {
    year: new Date().getFullYear(),
    neighbors: ['Soused 1', 'Soused 2', 'Soused 3'],
    address: 'Vaše adresa',
    customAssignments: {} // { "2024-5": "Novákovi" } - klíč je "rok-týden"
};

let appData = {};
let editingWeekKey = null;
let editingNeighborIndex = null;

// ================================
// Inicializace
// ================================

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initEventListeners();
    render();
});

function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        appData = { ...DEFAULT_DATA, ...JSON.parse(stored) };
    } else {
        appData = { ...DEFAULT_DATA };
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

// ================================
// Event Listeners
// ================================

function initEventListeners() {
    // Rok
    document.getElementById('yearInput').addEventListener('change', (e) => {
        appData.year = parseInt(e.target.value);
        saveData();
        render();
    });

    document.getElementById('prevYear').addEventListener('click', () => {
        appData.year--;
        saveData();
        render();
    });

    document.getElementById('nextYear').addEventListener('click', () => {
        appData.year++;
        saveData();
        render();
    });

    // Přidat souseda
    document.getElementById('addNeighbor').addEventListener('click', () => {
        const newName = `Soused ${appData.neighbors.length + 1}`;
        appData.neighbors.push(newName);
        saveData();
        render();
    });

    // Modal
    document.getElementById('saveEdit').addEventListener('click', saveEditedName);
    document.getElementById('cancelEdit').addEventListener('click', closeModal);
    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target.id === 'editModal') closeModal();
    });

    document.getElementById('editNameInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveEditedName();
        if (e.key === 'Escape') closeModal();
    });

    // Adresa
    document.getElementById('addressField').addEventListener('blur', (e) => {
        appData.address = e.target.textContent.trim() || 'Vaše adresa';
        saveData();
    });
}

// ================================
// Výpočet týdnů
// ================================

function getWeeksOfYear(year) {
    const weeks = [];

    // Najdi první pondělí roku (nebo poslední pondělí předchozího roku)
    let date = new Date(year, 0, 1);

    // Pokud 1.1. není pondělí, najdi první pondělí
    while (date.getDay() !== 1) {
        date.setDate(date.getDate() + 1);
    }

    // Pokud první pondělí je až po 4.1., vrať se o týden zpět
    if (date.getDate() > 4) {
        date.setDate(date.getDate() - 7);
    }

    const endOfYear = new Date(year, 11, 31);
    let weekNumber = 1;

    while (date <= endOfYear || weekNumber <= 52) {
        const weekStart = new Date(date);
        const weekEnd = new Date(date);
        weekEnd.setDate(weekEnd.getDate() + 6);

        // Kontrola, zda týden patří do tohoto roku
        const thursdayOfWeek = new Date(date);
        thursdayOfWeek.setDate(thursdayOfWeek.getDate() + 3);

        if (thursdayOfWeek.getFullYear() === year) {
            weeks.push({
                weekNumber: weekNumber,
                start: weekStart,
                end: weekEnd,
                month: getMainMonth(weekStart, weekEnd)
            });
        }

        date.setDate(date.getDate() + 7);
        weekNumber++;

        // Bezpečnostní limit
        if (weeks.length > 53) break;
    }

    return weeks;
}

function getMainMonth(start, end) {
    // Vrať měsíc, ve kterém je čtvrtek (ISO standard)
    const thursday = new Date(start);
    thursday.setDate(thursday.getDate() + 3);
    return thursday.getMonth();
}

function getAssignedName(year, weekNumber) {
    const key = `${year}-${weekNumber}`;

    // Nejprve zkontroluj custom přiřazení
    if (appData.customAssignments[key]) {
        return appData.customAssignments[key];
    }

    // Jinak použij rotaci
    if (appData.neighbors.length === 0) return '(není soused)';
    const index = (weekNumber - 1) % appData.neighbors.length;
    return appData.neighbors[index];
}

function isCurrentWeek(start, end) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);
    return today >= startDate && today <= endDate;
}

// ================================
// Renderování
// ================================

function render() {
    renderYear();
    renderNeighbors();
    renderSchedule();
    renderCurrentWeekInfo();
    renderAddress();
}

function renderYear() {
    document.getElementById('yearInput').value = appData.year;
    document.getElementById('yearDisplay').textContent = appData.year;
}

function renderNeighbors() {
    const container = document.getElementById('neighborsList');
    container.innerHTML = '';

    appData.neighbors.forEach((name, index) => {
        const tag = document.createElement('div');
        tag.className = 'neighbor-tag';
        tag.innerHTML = `
            <span class="order">${index + 1}</span>
            <span class="name">${escapeHtml(name)}</span>
            <span class="remove" title="Odebrat">×</span>
        `;

        // Klik na jméno - editace
        tag.querySelector('.name').addEventListener('click', (e) => {
            e.stopPropagation();
            openNeighborEdit(index);
        });

        // Klik na X - smazání
        tag.querySelector('.remove').addEventListener('click', (e) => {
            e.stopPropagation();
            if (appData.neighbors.length > 1) {
                appData.neighbors.splice(index, 1);
                saveData();
                render();
            } else {
                alert('Musí zůstat alespoň jeden soused!');
            }
        });

        container.appendChild(tag);
    });
}

function renderSchedule() {
    const weeks = getWeeksOfYear(appData.year);
    const tbody = document.getElementById('scheduleBody');
    tbody.innerHTML = '';

    // Seskupit týdny podle měsíců
    const monthGroups = {};
    weeks.forEach(week => {
        if (!monthGroups[week.month]) {
            monthGroups[week.month] = [];
        }
        monthGroups[week.month].push(week);
    });

    // Render každého měsíce
    Object.keys(monthGroups).sort((a, b) => a - b).forEach(monthIndex => {
        const monthWeeks = monthGroups[monthIndex];
        const tr = document.createElement('tr');

        // Buňka měsíce
        const monthTd = document.createElement('td');
        monthTd.className = 'month-cell';
        monthTd.rowSpan = 1;
        monthTd.textContent = MONTHS_CS[monthIndex];
        tr.appendChild(monthTd);

        // Buňky týdnů
        monthWeeks.forEach(week => {
            const td = document.createElement('td');
            td.className = 'week-cell';

            if (isCurrentWeek(week.start, week.end)) {
                td.classList.add('current-week');
            }

            const name = getAssignedName(appData.year, week.weekNumber);
            const weekKey = `${appData.year}-${week.weekNumber}`;

            td.innerHTML = `
                <div class="name" data-week-key="${weekKey}">${escapeHtml(name)}</div>
                <div class="dates">${formatDate(week.start)} - ${formatDate(week.end)}</div>
                <div class="week-number">Týden ${week.weekNumber}</div>
            `;

            // Klik na jméno - editace
            td.querySelector('.name').addEventListener('click', () => {
                openWeekEdit(weekKey, name);
            });

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

function renderCurrentWeekInfo() {
    const weeks = getWeeksOfYear(appData.year);
    const currentWeek = weeks.find(w => isCurrentWeek(w.start, w.end));
    const infoEl = document.getElementById('currentWeekInfo');

    if (currentWeek) {
        const name = getAssignedName(appData.year, currentWeek.weekNumber);
        infoEl.innerHTML = `🧹 Tento týden uklízí: <strong>${escapeHtml(name)}</strong> (${formatDate(currentWeek.start)} - ${formatDate(currentWeek.end)})`;
        infoEl.classList.add('visible');
    } else {
        infoEl.classList.remove('visible');
    }
}

function renderAddress() {
    document.getElementById('addressField').textContent = appData.address;
}

// ================================
// Editace
// ================================

function openWeekEdit(weekKey, currentName) {
    editingWeekKey = weekKey;
    editingNeighborIndex = null;

    document.getElementById('editNameInput').value = currentName;
    document.querySelector('.modal-content h3').textContent = 'Upravit jméno pro tento týden';
    document.getElementById('editModal').classList.add('visible');
    document.getElementById('editNameInput').focus();
    document.getElementById('editNameInput').select();
}

function openNeighborEdit(index) {
    editingWeekKey = null;
    editingNeighborIndex = index;

    document.getElementById('editNameInput').value = appData.neighbors[index];
    document.querySelector('.modal-content h3').textContent = 'Upravit jméno souseda';
    document.getElementById('editModal').classList.add('visible');
    document.getElementById('editNameInput').focus();
    document.getElementById('editNameInput').select();
}

function saveEditedName() {
    const newName = document.getElementById('editNameInput').value.trim();

    if (!newName) {
        alert('Jméno nemůže být prázdné!');
        return;
    }

    if (editingWeekKey !== null) {
        // Editace konkrétního týdne
        appData.customAssignments[editingWeekKey] = newName;
    } else if (editingNeighborIndex !== null) {
        // Editace souseda v seznamu
        appData.neighbors[editingNeighborIndex] = newName;
    }

    saveData();
    closeModal();
    render();
}

function closeModal() {
    document.getElementById('editModal').classList.remove('visible');
    editingWeekKey = null;
    editingNeighborIndex = null;
}

// ================================
// Pomocné funkce
// ================================

function formatDate(date) {
    const d = new Date(date);
    return `${d.getDate()}.${d.getMonth() + 1}.`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
