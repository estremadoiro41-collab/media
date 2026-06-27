/**
 * PromptStation SPA Frontend Logic
 * Version 1.0.0
 */

// --- Configuration ---
// PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE
const API_URL = 'https://script.google.com/macros/s/AKfycbyLcZFvMcnz3Atmwu_9g3aNgXRDGf4tIYXRKvyzWwUT5mqVP3RYNcQViPWXkJ-Q6Ek/exec';

// --- Application State ---
let promptsState = [];
let activeCategory = 'all';
let searchQuery = '';
let isEditing = false;
let editingId = null;
let deletingId = null;

// --- DOM Element References ---
const themeToggleBtn = document.getElementById('themeToggleBtn');
const openCreateDrawerBtn = document.getElementById('openCreateDrawerBtn');
const setupAlert = document.getElementById('setupAlert');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const categoryPills = document.getElementById('categoryPills');
const loadingIndicator = document.getElementById('loadingIndicator');
const promptsGrid = document.getElementById('promptsGrid');
const emptyState = document.getElementById('emptyState');
const emptyStateBtn = document.getElementById('emptyStateBtn');
const drawerOverlay = document.getElementById('drawerOverlay');
const formDrawer = document.getElementById('formDrawer');
const drawerTitle = document.getElementById('drawerTitle');
const closeDrawerBtn = document.getElementById('closeDrawerBtn');
const cancelFormBtn = document.getElementById('cancelFormBtn');
const promptForm = document.getElementById('promptForm');
const savePromptBtn = document.getElementById('savePromptBtn');
const categoriesList = document.getElementById('categoriesList');

// Form inputs
const promptIdInput = document.getElementById('promptId');
const promptCategoryInput = document.getElementById('promptCategory');
const promptNameInput = document.getElementById('promptName');
const promptTextInput = document.getElementById('promptText');
const promptExamplesInput = document.getElementById('promptExamples');

// Confirmation Modal
const confirmModal = document.getElementById('confirmModal');
const deletePromptName = document.getElementById('deletePromptName');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const toastContainer = document.getElementById('toastContainer');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    checkApiUrl();
    setupEventListeners();
    fetchPrompts();
});

// --- Theme Management (Dark/Light) ---
function initTheme() {
    // Check localStorage or system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
        // Default to dark mode as requested by default
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    showToast(`Modo ${newTheme === 'dark' ? 'oscuro' : 'claro'} activado`, 'info');
}

// --- Setup Alert ---
function checkApiUrl() {
    if (!API_URL || API_URL.trim() === '') {
        setupAlert.classList.remove('hidden');
    } else {
        setupAlert.classList.add('hidden');
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    // Theme Toggle
    themeToggleBtn.addEventListener('click', toggleTheme);

    // Search input interactions
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        if (searchQuery.length > 0) {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
        }
        renderPrompts();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.classList.add('hidden');
        renderPrompts();
        searchInput.focus();
    });

    // Drawer openers/closers
    openCreateDrawerBtn.addEventListener('click', () => openDrawer());
    emptyStateBtn.addEventListener('click', () => openDrawer());
    closeDrawerBtn.addEventListener('click', closeDrawer);
    cancelFormBtn.addEventListener('click', closeDrawer);
    drawerOverlay.addEventListener('click', closeDrawer);

    // Form submission
    promptForm.addEventListener('submit', handleFormSubmit);

    // Modal delete confirmation
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    closeModalBtn.addEventListener('click', closeDeleteModal);
    confirmDeleteBtn.addEventListener('click', handleDeleteConfirm);

    // Pill category selection (Event delegation)
    categoryPills.addEventListener('click', (e) => {
        const pill = e.target.closest('.pill');
        if (!pill) return;

        // Toggle active status
        document.querySelectorAll('.category-pills .pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        activeCategory = pill.dataset.category;
        renderPrompts();
    });
}

// --- API Interactions (CRUD) ---

// READ: Fetch Prompts
async function fetchPrompts() {
    if (!API_URL) {
        showEmptyState(true, 'Configuración requerida', 'Por favor, configura la URL de la API en app.js para poder cargar y administrar tus prompts.');
        loadingIndicator.classList.add('hidden');
        return;
    }

    showLoading(true);

    try {
        const response = await fetch(API_URL);
        const result = await response.json();

        if (result.success) {
            promptsState = result.data || [];
            renderCategoryFilters();
            renderPrompts();
        } else {
            showToast('Error al cargar datos del Sheet: ' + result.error, 'error');
            showEmptyState(true, 'Error de Carga', result.error);
        }
    } catch (error) {
        console.error('Error fetching prompts:', error);
        showToast('Error de conexión con Google Sheets. Verifica la URL de tu API.', 'error');
        showEmptyState(true, 'Error de Conexión', 'No se pudo conectar a Google Sheets. Asegúrate de haber publicado el Script como Aplicación Web y que la URL sea correcta.');
    } finally {
        showLoading(false);
    }
}

// CREATE & UPDATE: Save Prompt
async function handleFormSubmit(e) {
    e.preventDefault();

    if (!validateForm()) return;

    const categoria = promptCategoryInput.value.trim();
    const nombrePrompt = promptNameInput.value.trim();
    const prompt = promptTextInput.value.trim();
    const ejemplos = promptExamplesInput.value.trim();

    // Prepare payload
    const payload = {
        action: isEditing ? 'update' : 'create',
        categoria,
        nombrePrompt,
        prompt,
        ejemplos
    };

    if (isEditing) {
        payload.id = editingId;
    }

    setFormLoading(true);

    try {
        // We use text/plain to bypass CORS preflight checks on Google Apps Script Web App
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            showToast(isEditing ? 'Prompt modificado correctamente' : 'Prompt guardado correctamente', 'success');
            closeDrawer();
            await fetchPrompts(); // Refresh in-memory list and row IDs
        } else {
            showToast('Error al guardar: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error saving prompt:', error);
        showToast('Error al enviar los datos. Revisa la consola.', 'error');
    } finally {
        setFormLoading(false);
    }
}

// DELETE: Confirm delete action
async function handleDeleteConfirm() {
    if (!deletingId) return;

    setDeleteLoading(true);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify({
                action: 'delete',
                id: deletingId
            })
        });

        const result = await response.json();

        if (result.success) {
            showToast('Prompt eliminado correctamente', 'success');
            closeDeleteModal();
            await fetchPrompts(); // Refresh IDs
        } else {
            showToast('Error al eliminar: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting prompt:', error);
        showToast('Error de red al eliminar el prompt.', 'error');
    } finally {
        setDeleteLoading(false);
    }
}

// --- UI Rendering ---

// Render all prompts based on active filter and search query
function renderPrompts() {
    promptsGrid.innerHTML = '';

    // Filtering logic
    const filteredPrompts = promptsState.filter(item => {
        const matchesCategory = activeCategory === 'all' ||
            item.categoria.toLowerCase() === activeCategory.toLowerCase();

        const matchesSearch = !searchQuery ||
            item.nombrePrompt.toLowerCase().includes(searchQuery) ||
            item.categoria.toLowerCase().includes(searchQuery) ||
            item.prompt.toLowerCase().includes(searchQuery) ||
            item.ejemplos.toLowerCase().includes(searchQuery);

        return matchesCategory && matchesSearch;
    });

    if (filteredPrompts.length === 0) {
        if (searchQuery || activeCategory !== 'all') {
            showEmptyState(true, 'No hay coincidencias', 'Intenta modificando tu búsqueda o seleccionando otra categoría.');
        } else {
            showEmptyState(true, 'No hay prompts registrados', 'Empieza agregando tu primer prompt haciendo clic en el botón superior.');
        }
        promptsGrid.classList.add('hidden');
    } else {
        showEmptyState(false);
        promptsGrid.classList.remove('hidden');

        filteredPrompts.forEach(item => {
            const card = document.createElement('div');
            card.className = 'prompt-card';
            card.dataset.id = item.id;

            // Short preview of body
            const bodyPreview = escapeHtml(item.prompt);
            const categoryBadge = item.categoria ? `<span class="prompt-badge">${escapeHtml(item.categoria)}</span>` : '<span class="prompt-badge" style="opacity: 0.5;">Sin Categoría</span>';

            // Build examples HTML if they exist
            let examplesHtml = '';
            if (item.ejemplos && item.ejemplos.trim() !== '') {
                examplesHtml = `
                    <div class="prompt-examples-section">
                        <button class="examples-toggle" onclick="toggleExamples(this)">
                            <span><i class="fa-solid fa-lightbulb"></i> Ver Ejemplos</span>
                            <i class="fa-solid fa-chevron-down"></i>
                        </button>
                        <div class="examples-content">
                            <p>${escapeHtml(item.ejemplos)}</p>
                        </div>
                    </div>
                `;
            }

            card.innerHTML = `
                <div>
                    <div class="prompt-card-header">
                        ${categoryBadge}
                        <div class="prompt-card-actions">
                            <button class="action-btn edit-btn" title="Editar Prompt" onclick="openEditDrawer(${item.id})">
                                <i class="fa-regular fa-pen-to-square"></i>
                            </button>
                            <button class="action-btn delete-btn" title="Eliminar Prompt" onclick="openDeleteModal(${item.id})">
                                <i class="fa-regular fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                    <h3 class="prompt-title">${escapeHtml(item.nombrePrompt)}</h3>
                </div>
                
                <div class="prompt-body-preview">${bodyPreview}</div>
                
                ${examplesHtml}
                
                <div class="prompt-card-footer">
                    <button class="copy-btn" onclick="copyPromptText(this, ${item.id})">
                        <i class="fa-regular fa-copy"></i> <span>Copiar Prompt</span>
                    </button>
                </div>
            `;

            promptsGrid.appendChild(card);
        });
    }
}

// Render dynamic categories pills and autocomplete datalist
function renderCategoryFilters() {
    // Find unique categories (excluding empty ones)
    const categoriesSet = new Set();
    promptsState.forEach(p => {
        if (p.categoria && p.categoria.trim() !== '') {
            categoriesSet.add(p.categoria.trim());
        }
    });

    const uniqueCategories = Array.from(categoriesSet).sort();

    // Render Pills
    categoryPills.innerHTML = `<button class="pill ${activeCategory === 'all' ? 'active' : ''}" data-category="all">Todos</button>`;
    uniqueCategories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `pill ${activeCategory.toLowerCase() === cat.toLowerCase() ? 'active' : ''}`;
        btn.dataset.category = cat;
        btn.textContent = cat;
        categoryPills.appendChild(btn);
    });

    // Render Autocomplete list in form drawer
    categoriesList.innerHTML = '';
    uniqueCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        categoriesList.appendChild(option);
    });
}

// --- Side Drawer Controlling ---
function openDrawer(editId = null) {
    clearFormValidation();

    if (editId) {
        isEditing = true;
        editingId = editId;
        drawerTitle.textContent = 'Editar Prompt';

        const item = promptsState.find(p => p.id === editId);
        if (item) {
            promptIdInput.value = item.id;
            promptCategoryInput.value = item.categoria;
            promptNameInput.value = item.nombrePrompt;
            promptTextInput.value = item.prompt;
            promptExamplesInput.value = item.ejemplos;
        }
    } else {
        isEditing = false;
        editingId = null;
        drawerTitle.textContent = 'Nuevo Prompt';
        promptForm.reset();
        promptIdInput.value = '';
    }

    drawerOverlay.classList.add('open');
    formDrawer.classList.add('open');
    document.body.style.overflow = 'hidden'; // Lock body scrolling

    // Focus first input
    setTimeout(() => promptCategoryInput.focus(), 150);
}

function closeDrawer() {
    drawerOverlay.classList.remove('open');
    formDrawer.classList.remove('open');
    document.body.style.overflow = ''; // Release scroll lock
}

// --- Confirmation Modal Controlling ---
function openDeleteModal(id) {
    const item = promptsState.find(p => p.id === id);
    if (!item) return;

    deletingId = id;
    deletePromptName.textContent = `"${item.nombrePrompt}"`;
    confirmModal.classList.add('open');
}

function closeDeleteModal() {
    confirmModal.classList.remove('open');
    deletingId = null;
}

// External call wrapper for HTML onclicks
window.openEditDrawer = function (id) {
    openDrawer(id);
};

window.openDeleteModal = function (id) {
    openDeleteModal(id);
};

// --- Copy to Clipboard Utility ---
window.copyPromptText = async function (buttonElement, id) {
    const item = promptsState.find(p => p.id === id);
    if (!item) return;

    try {
        await navigator.clipboard.writeText(item.prompt);

        // Success micro-animation state
        buttonElement.classList.add('copied');
        const icon = buttonElement.querySelector('i');
        const text = buttonElement.querySelector('span');

        icon.className = 'fa-solid fa-check';
        text.textContent = '¡Copiado!';

        showToast('Prompt copiado al portapapeles', 'success');

        // Restore original state
        setTimeout(() => {
            buttonElement.classList.remove('copied');
            icon.className = 'fa-regular fa-copy';
            text.textContent = 'Copiar Prompt';
        }, 1500);

    } catch (err) {
        console.error('Failed to copy text: ', err);
        showToast('Error al copiar el texto', 'error');
    }
};

// --- Collapsible Examples Utility ---
window.toggleExamples = function (btn) {
    btn.classList.toggle('active');
    const content = btn.nextElementSibling;
    content.classList.toggle('open');
};

// --- Loading Indicators & Feedback States ---
function showLoading(show) {
    if (show) {
        loadingIndicator.classList.remove('hidden');
        promptsGrid.classList.add('hidden');
        emptyState.classList.add('hidden');
    } else {
        loadingIndicator.classList.add('hidden');
    }
}

function setFormLoading(isLoading) {
    if (isLoading) {
        savePromptBtn.disabled = true;
        savePromptBtn.querySelector('.btn-text').classList.add('hidden');
        savePromptBtn.querySelector('.btn-spinner').classList.remove('hidden');
    } else {
        savePromptBtn.disabled = false;
        savePromptBtn.querySelector('.btn-text').classList.remove('hidden');
        savePromptBtn.querySelector('.btn-spinner').classList.add('hidden');
    }
}

function setDeleteLoading(isLoading) {
    if (isLoading) {
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.querySelector('.btn-text').classList.add('hidden');
        confirmDeleteBtn.querySelector('.btn-spinner').classList.remove('hidden');
    } else {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.querySelector('.btn-text').classList.remove('hidden');
        confirmDeleteBtn.querySelector('.btn-spinner').classList.add('hidden');
    }
}

function showEmptyState(show, title = '', message = '') {
    if (show) {
        document.getElementById('emptyTitle').textContent = title;
        document.getElementById('emptyMessage').textContent = message;
        emptyState.classList.remove('hidden');

        // If it's a configuration notice, hide the empty state CTA button
        if (title === 'Configuración requerida') {
            emptyStateBtn.classList.add('hidden');
        } else {
            emptyStateBtn.classList.remove('hidden');
        }
    } else {
        emptyState.classList.add('hidden');
    }
}

// --- Custom Form Validation ---
function validateForm() {
    let isValid = true;

    // Clear previous errors
    clearFormValidation();

    const category = promptCategoryInput.value.trim();
    const name = promptNameInput.value.trim();
    const text = promptTextInput.value.trim();

    if (!category) {
        promptCategoryInput.closest('.form-group').classList.add('has-error');
        isValid = false;
    }

    if (!name) {
        promptNameInput.closest('.form-group').classList.add('has-error');
        isValid = false;
    }

    if (!text) {
        promptTextInput.closest('.form-group').classList.add('has-error');
        isValid = false;
    }

    return isValid;
}

function clearFormValidation() {
    document.querySelectorAll('.form-group').forEach(group => {
        group.classList.remove('has-error');
    });
}

// --- Toast System UI ---
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconClass = 'fa-solid fa-circle-check';
    if (type === 'error') iconClass = 'fa-solid fa-circle-xmark';
    if (type === 'info') iconClass = 'fa-solid fa-circle-info';

    toast.innerHTML = `
        <i class="${iconClass}"></i>
        <span>${message}</span>
    `;

    toastContainer.appendChild(toast);

    // Slide in
    setTimeout(() => {
        toast.classList.add('show');
    }, 50);

    // Fade and slide out, then remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3500);
}

// --- Helpers ---
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
