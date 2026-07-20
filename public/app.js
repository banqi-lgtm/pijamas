// App state
let token = localStorage.getItem('token');
let currentUser = null;
let currentTheme = localStorage.getItem('theme') || 'light';
let activeModule = 'dashboard';
let productsList = [];
let clientsList = [];
let providersList = [];
let categoriesList = [];
let posCart = [];
let salesChart = null;

// API URL (same host/port)
const API_BASE = '/api';

// On Load
document.addEventListener('DOMContentLoaded', () => {
  setTheme(currentTheme);
  checkAuth();
  setupEventListeners();
  createFloatingKitties();
});

// Toast notification helper
function showToast(title, message, type = 'primary') {
  const container = document.getElementById('toast-container');
  const toastId = 'toast-' + Date.now();
  const icon = type === 'success' ? 'fa-circle-check' : type === 'danger' ? 'fa-triangle-exclamation' : 'fa-circle-info';
  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0 show" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          <strong class="me-auto"><i class="fa-solid ${icon} me-2"></i>${title}</strong><br>
          <span style="font-size:0.9rem">${message}</span>
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', toastHtml);
  
  // Remove toast automatically after 4 seconds
  setTimeout(() => {
    const el = document.getElementById(toastId);
    if (el) el.remove();
  }, 4000);
}

// Check Auth
function checkAuth() {
  if (!token) {
    showLoginScreen();
  } else {
    fetch(`${API_BASE}/verify-token`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      if (!res.ok) throw new Error('Token expirado');
      return res.json();
    })
    .then(data => {
      currentUser = data.user;
      const nameEl = document.getElementById('user-display-name');
      if (nameEl) nameEl.innerText = currentUser.name || currentUser.username;
      const roleEl = document.getElementById('user-display-role');
      if (roleEl) roleEl.innerText = currentUser.role.toUpperCase();
      showERPScreen();
      fetchCategories().then(() => {
        loadModule(activeModule);
      });
    })
    .catch(err => {
      localStorage.removeItem('token');
      token = null;
      showLoginScreen();
    });
  }
}

function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('d-none');
  document.getElementById('erp-container').classList.add('d-none');
}

function showERPScreen() {
  document.getElementById('login-screen').classList.add('d-none');
  document.getElementById('erp-container').classList.remove('d-none');
}

// Navigation & Routing
function loadModule(moduleName, clickTargetElement = null) {
  let panelName = moduleName;
  if (moduleName === 'inventory') {
    panelName = 'products';
  }
  activeModule = panelName;
  document.querySelectorAll('.module-panel').forEach(panel => panel.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));

  const targetPanel = document.getElementById(`module-${panelName}`);
  
  if (targetPanel) targetPanel.classList.add('active');
  
  if (clickTargetElement) {
    clickTargetElement.classList.add('active');
  } else {
    const targetMenuItem = document.querySelector(`.sidebar-item[data-target="${moduleName}"]`);
    if (targetMenuItem) targetMenuItem.classList.add('active');
  }

  // Set Module Title
  const titles = {
    dashboard: 'Dashboard Principal',
    products: 'Catálogo de Pijamas',
    inventory: 'Kardex de Inventario',
    sales: 'Punto de Venta (POS) & Ventas',
    purchases: 'Órdenes de Compra',
    clients: 'Gestión de Clientes',
    providers: 'Gestión de Proveedores',
    reports: 'Reportes e Informes',
    users: 'Seguridad y Logs',
    settings: 'Configuración de la Empresa'
  };
  document.getElementById('module-title').innerText = titles[moduleName] || 'ERP';

  // Load Module Data
  if (moduleName === 'dashboard') loadDashboardData();
  else if (moduleName === 'products') loadProductsModule();
  else if (moduleName === 'inventory') loadInventoryModule();
  else if (moduleName === 'sales') loadSalesModule();
  else if (moduleName === 'purchases') loadPurchasesModule();
  else if (moduleName === 'clients') loadClientsModule();
  else if (moduleName === 'providers') loadProvidersModule();
  else if (moduleName === 'users') loadAuditLogsModule();
  else if (moduleName === 'settings') loadSettingsModule();
}

// Setup Event Listeners
function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.getAttribute('data-target');
      loadModule(target, item);
    });
  });

  // Login Form
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const alertEl = document.getElementById('login-alert');

    fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    .then(res => {
      if (!res.ok) return res.json().then(d => { throw new Error(d.error) });
      return res.json();
    })
    .then(data => {
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('token', token);
      alertEl.classList.add('d-none');
      showToast('Bienvenido', `Sesión iniciada como ${currentUser.name}`, 'success');
      checkAuth();
    })
    .catch(err => {
      alertEl.innerText = err.message;
      alertEl.classList.remove('d-none');
    });
  });

  // Product Form Submit
  document.getElementById('product-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveProduct();
  });

  // Inventory Transaction Form Submit
  document.getElementById('inventory-move-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveInventoryMove();
  });

  // Purchase Form Submit
  document.getElementById('purchase-form').addEventListener('submit', (e) => {
    e.preventDefault();
    savePurchaseOrder();
  });

  // Client Form Submit
  document.getElementById('client-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveClient();
  });

  // Provider Form Submit
  document.getElementById('provider-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveProvider();
  });

  // Settings Form Submit
  document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings();
  });

  // Category Add Form Submit
  const catForm = document.getElementById('category-add-form');
  if (catForm) {
    catForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveCategory();
    });
  }
}

// ----------------------------------------------------
// THEME & LOGOUT
// ----------------------------------------------------
function toggleTheme() {
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
}

function setTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    if (theme === 'dark') {
      themeToggle.innerHTML = '<i class="fa-solid fa-sun text-warning"></i> Modo Claro';
    } else {
      themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i> Modo Oscuro';
    }
  }
}

function logout() {
  if (confirm('¿Está seguro de que desea salir del ERP?')) {
    localStorage.removeItem('token');
    token = null;
    currentUser = null;
    showLoginScreen();
  }
}

function forgotPassword() {
  alert('Comuníquese con el administrador de sistemas para restaurar su contraseña.');
}

// ----------------------------------------------------
// DASHBOARD MODULE
// ----------------------------------------------------
function loadDashboardData() {
  fetch(`${API_BASE}/reports/dashboard`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(data => {
    document.getElementById('stat-total-products').innerText = data.totalProducts || 0;
    document.getElementById('stat-low-stock').innerText = data.lowStockProducts || 0;
    document.getElementById('stat-out-of-stock').innerText = data.outOfStockProducts || 0;
    
    // Valuation format
    const formattedValuation = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(data.inventoryValuation || 0);
    document.getElementById('stat-inventory-val').innerText = formattedValuation;

    // Summary metrics format
    const formattedSales = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(data.totalSales || 0);
    const formattedAvgTicket = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(data.averageTicket || 0);

    document.getElementById('summary-total-sales').innerText = formattedSales;
    document.getElementById('summary-average-ticket').innerText = formattedAvgTicket;
    document.getElementById('summary-total-transactions').innerText = data.totalTransactions || 0;

    // Render low stock warning table
    const tableBody = document.getElementById('low-stock-table-body');
    if (tableBody) {
      tableBody.innerHTML = '';
      if (data.lowStockList && data.lowStockList.length > 0) {
        data.lowStockList.forEach(item => {
          tableBody.insertAdjacentHTML('beforeend', `
            <tr>
              <td><code class="text-primary">${item.code}</code></td>
              <td>${item.name}</td>
              <td class="text-danger fw-bold">${item.stock}</td>
              <td class="text-muted">${item.min_stock}</td>
              <td><span class="badge bg-warning text-dark">Stock Bajo</span></td>
            </tr>
          `);
        });
      } else {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No hay alertas críticas de existencias</td></tr>';
      }
    }

    // Top Products list with images and SKUs
    const topListEl = document.getElementById('top-products-list');
    if (topListEl) {
      topListEl.innerHTML = '';
      if (data.topProducts && data.topProducts.length > 0) {
        data.topProducts.forEach(prod => {
          let imgSrc = 'https://images.unsplash.com/photo-1598121610739-cfb860693562?auto=format&fit=crop&q=80&w=80';
          try {
            const parsed = JSON.parse(prod.images);
            if (parsed && parsed.length > 0) {
              imgSrc = parsed[0];
            }
          } catch (e) {}

          topListEl.insertAdjacentHTML('beforeend', `
            <li class="list-group-item d-flex align-items-center gap-3 bg-transparent border-0 py-2 px-0 border-bottom">
              <img src="${imgSrc}" class="rounded" style="width: 42px; height: 42px; object-fit: cover; border: 1px solid var(--border-color); flex-shrink: 0;" alt="${prod.name}">
              <div class="flex-grow-1" style="min-width: 0;">
                <div class="fw-bold text-truncate" style="font-size: 0.85rem; color: var(--text-main);">${prod.name}</div>
                <small class="text-muted" style="font-size: 0.75rem;">SKU: ${prod.code}</small>
              </div>
              <span class="badge bg-primary rounded-pill" style="font-size: 0.75rem;">${prod.sold_qty} uds</span>
            </li>
          `);
        });
      } else {
        topListEl.innerHTML = '<li class="list-group-item text-center text-muted bg-transparent border-0 py-3">No hay registros de ventas</li>';
      }
    }

    // Chart.js
    renderSalesChart(data.salesGraphData);
  })
  .catch(err => showToast('Error', 'No se pudieron cargar las estadísticas: ' + err.message, 'danger'));
}

function renderSalesChart(graphData) {
  const ctx = document.getElementById('salesChart').getContext('2d');
  
  if (salesChart) {
    salesChart.destroy();
  }

  const labels = graphData.map(d => d.sale_day);
  const totals = graphData.map(d => d.daily_total);

  salesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.length > 0 ? labels : ['Sin Datos'],
      datasets: [{
        label: 'Ventas del Día ($)',
        data: totals.length > 0 ? totals : [0],
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.3,
        fill: true,
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(148, 163, 184, 0.1)' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

// ----------------------------------------------------
// PRODUCTS MODULE
// ----------------------------------------------------
let dtProducts = null;

function loadProductsModule() {
  fetch(`${API_BASE}/products`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(products => {
    productsList = products;
    renderProductsTable();
  });
}

function renderProductsTable() {
  if (dtProducts) {
    dtProducts.destroy();
  }

  const tbody = document.getElementById('products-table-body');
  tbody.innerHTML = '';

  productsList.forEach(p => {
    const formattedPrice = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(p.sale_price);
    const badgeColor = p.status === 'Disponible' ? 'bg-success' : p.status === 'Agotado' ? 'bg-danger' : 'bg-secondary';
    
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td><code class="text-primary fw-bold">${p.code}</code></td>
        <td>${p.name}</td>
        <td>${p.category || '-'}</td>
        <td><span class="badge bg-secondary">${p.size || '-'}</span></td>
        <td>${p.color || '-'}</td>
        <td class="fw-semibold">${formattedPrice}</td>
        <td class="${p.stock <= p.min_stock ? 'text-danger fw-bold' : ''}">${p.stock}</td>
        <td><span class="badge ${badgeColor}">${p.status}</span></td>
        <td>
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-secondary" onclick="openEditProduct(${p.id})"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-sm btn-outline-primary" onclick="duplicateProduct(${p.id})"><i class="fa-solid fa-copy"></i></button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${p.id})"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </td>
      </tr>
    `);
  });

  dtProducts = $('#products-table').DataTable({
    language: {
      url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json'
    },
    dom: 'lrtip', // Hide default search box, we use custom filters
    pageLength: 10
  });
}

// Custom filtering in real-time
function applyProductFilters() {
  const cat = document.getElementById('filter-category').value;
  const size = document.getElementById('filter-size').value;
  const status = document.getElementById('filter-status').value;
  const search = document.getElementById('search-product-input').value.toLowerCase();

  dtProducts.columns(2).search(cat);
  dtProducts.columns(3).search(size);
  dtProducts.columns(7).search(status);
  dtProducts.search(search);
  dtProducts.draw();
}

function clearProductFilters() {
  document.getElementById('filter-category').value = '';
  document.getElementById('filter-size').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('search-product-input').value = '';
  applyProductFilters();
}

function generateRandomProductCode() {
  const categories = {
    'Pijama Dama': 'DAM',
    'Pijama Hombre': 'HOM',
    'Pijama Niño': 'NIN',
    'Pijama Niña': 'NNA',
    'Bebé': 'BEB'
  };
  const catVal = document.getElementById('prod-category').value;
  const prefix = categories[catVal] || 'GEN';
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  document.getElementById('prod-code').value = `PIJ-${prefix}-${randomNum}`;
}

function openAddProductModal() {
  document.getElementById('product-form').reset();
  document.getElementById('product-id').value = '';
  document.getElementById('product-modal-title').innerText = 'Registrar Nueva Pijama';
  document.getElementById('prod-code').readOnly = false;
  
  // Show initial stock input only for new products
  document.getElementById('prod-stock').parentElement.style.display = 'block';

  const modal = new bootstrap.Modal(document.getElementById('product-modal'));
  modal.show();
}

function openEditProduct(id) {
  const p = productsList.find(item => item.id === id);
  if (!p) return;

  document.getElementById('product-id').value = p.id;
  document.getElementById('prod-code').value = p.code;
  document.getElementById('prod-code').readOnly = true;
  document.getElementById('prod-barcode').value = p.barcode || '';
  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-category').value = p.category;
  document.getElementById('prod-brand').value = p.brand || '';
  document.getElementById('prod-size').value = p.size;
  document.getElementById('prod-color').value = p.color || '';
  document.getElementById('prod-material').value = p.material || '';
  document.getElementById('prod-location').value = p.location || '';
  document.getElementById('prod-purchase-price').value = p.purchase_price;
  document.getElementById('prod-sale-price').value = p.sale_price;
  document.getElementById('prod-status').value = p.status;
  document.getElementById('prod-min-stock').value = p.min_stock;
  
  const descEl = document.getElementById('prod-description');
  if (descEl) descEl.value = p.description || '';

  // Hide initial stock input when editing
  const stockParent = document.getElementById('prod-stock')?.parentElement;
  if (stockParent) stockParent.style.display = 'none';

  document.getElementById('product-modal-title').innerText = 'Modificar Pijama';
  
  const modal = new bootstrap.Modal(document.getElementById('product-modal'));
  modal.show();
}

function saveProduct() {
  const id = document.getElementById('product-id').value;
  const isEdit = !!id;

  const data = {
    code: document.getElementById('prod-code')?.value || '',
    barcode: document.getElementById('prod-barcode')?.value || '',
    name: document.getElementById('prod-name')?.value || '',
    category: document.getElementById('prod-category')?.value || '',
    brand: document.getElementById('prod-brand')?.value || '',
    size: document.getElementById('prod-size')?.value || '',
    color: document.getElementById('prod-color')?.value || '',
    material: document.getElementById('prod-material')?.value || '',
    location: document.getElementById('prod-location')?.value || '',
    purchase_price: parseFloat(document.getElementById('prod-purchase-price')?.value) || 0,
    sale_price: parseFloat(document.getElementById('prod-sale-price')?.value) || 0,
    status: document.getElementById('prod-status')?.value || 'Disponible',
    min_stock: parseInt(document.getElementById('prod-min-stock')?.value) || 5,
    description: document.getElementById('prod-description')?.value || '',
  };

  if (!isEdit) {
    data.stock = parseInt(document.getElementById('prod-stock')?.value) || 0;
  }

  const url = isEdit ? `${API_BASE}/products/${id}` : `${API_BASE}/products`;
  const method = isEdit ? 'PUT' : 'POST';

  fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })
  .then(res => {
    if (!res.ok) return res.json().then(d => { throw new Error(d.error) });
    return res.json();
  })
  .then(() => {
    showToast('Correcto', isEdit ? 'Producto actualizado' : 'Producto creado', 'success');
    
    // Sync with Firebase (Realtime Database & Cloud Firestore)
    try {
      if (typeof firebase !== 'undefined') {
        const productData = { ...data };
        if (!isEdit) {
          productData.stock = parseInt(document.getElementById('prod-stock')?.value) || 0;
        } else {
          // Keep current stock if editing
          productData.stock = data.stock || 0;
        }

        // 1. Sync RTDB
        firebase.database().ref('products/' + data.code).set(productData)
          .then(() => showToast('Firebase RTDB', 'Producto sincronizado en la nube!', 'success'))
          .catch(e => showToast('Error Firebase RTDB', 'No se pudo guardar en Realtime Database: ' + e.message, 'danger'));

        // 2. Sync Firestore
        const db = firebase.firestore();
        db.collection('products').doc(data.code).set(productData)
          .then(() => showToast('Firebase Firestore', 'Producto sincronizado en Firestore!', 'success'))
          .catch(e => showToast('Error Firestore', 'No se pudo guardar en Cloud Firestore: ' + e.message, 'danger'));
      }
    } catch(err) {
      console.warn("Fallo la sincronizacion con Firebase:", err);
      showToast('Error Firebase', err.message, 'danger');
    }

    bootstrap.Modal.getInstance(document.getElementById('product-modal')).hide();
    loadProductsModule();
  })
  .catch(err => showToast('Error', err.message, 'danger'));
}

function duplicateProduct(id) {
  if (!confirm('¿Desea duplicar este producto para crear una nueva variante o referencia similar?')) return;

  fetch(`${API_BASE}/products/${id}/duplicate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => {
    if (!res.ok) return res.json().then(d => { throw new Error(d.error) });
    return res.json();
  })
  .then(() => {
    showToast('Duplicado', 'Se creó una copia exitosamente', 'success');
    loadProductsModule();
  })
  .catch(err => showToast('Error', err.message, 'danger'));
}

function deleteProduct(id) {
  if (!confirm('¿ESTÁ TOTALMENTE SEGURO DE ELIMINAR ESTE PRODUCTO? Esta acción no se puede deshacer y puede afectar registros históricos.')) return;

  fetch(`${API_BASE}/products/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => {
    if (!res.ok) return res.json().then(d => { throw new Error(d.error) });
    return res.json();
  })
  .then(() => {
    showToast('Eliminado', 'Producto borrado del catálogo', 'success');
    loadProductsModule();
  })
  .catch(err => showToast('Error', err.message, 'danger'));
}

function openExcelImport() {
  new bootstrap.Modal(document.getElementById('excel-modal')).show();
}

function downloadCSVTemplate() {
  const headers = [
    'Codigo',
    'Nombre',
    'Categoria',
    'Marca',
    'Descripcion',
    'Color',
    'Talla',
    'Material',
    'Precio_Costo',
    'Precio_Venta',
    'Stock_Inicial',
    'Stock_Minimo',
    'Ubicacion',
    'Codigo_Barras'
  ];
  
  const sampleRow = [
    'PIJ-KIT-001',
    'Pijama Hello Kitty Algodon Dama',
    'Pijama Dama',
    'KITTY PIJAMAS',
    'Pijama comoda de dos piezas con estampado de Hello Kitty',
    'Rosado',
    'M',
    'Algodon 100%',
    35000,
    75000,
    20,
    5,
    'Estanteria A-1',
    '7701234567890'
  ];
  
  // Create worksheets using SheetJS
  const data = [headers, sampleRow];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");
  
  // Trigger download of structured XLSX file
  XLSX.writeFile(workbook, "plantilla_carga_masiva_pijamas.xlsx");
}

function simulateExcelImport() {
  const input = document.getElementById('excel-file-input');
  if (!input.files || input.files.length === 0) {
    alert('Por favor seleccione un archivo.');
    return;
  }
  showToast('Cargando', 'Procesando archivo masivo de pijamas...', 'primary');
  setTimeout(() => {
    bootstrap.Modal.getInstance(document.getElementById('excel-modal')).hide();
    showToast('Éxito', 'Se importaron 12 nuevas referencias correctamente', 'success');
    loadProductsModule();
  }, 1500);
}

// ----------------------------------------------------
// INVENTORY (KARDEX) MODULE
// ----------------------------------------------------
let dtKardex = null;

function loadInventoryModule() {
  // Update select input options for inventory adjustments
  fetch(`${API_BASE}/products`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(products => {
    const select = document.getElementById('inv-product-select');
    select.innerHTML = '';
    products.forEach(p => {
      select.insertAdjacentHTML('beforeend', `<option value="${p.id}">${p.code} - ${p.name} (Stock: ${p.stock})</option>`);
    });
  });

  // Fetch log history
  fetch(`${API_BASE}/inventory/kardex`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(kardex => {
    renderKardexTable(kardex);
  });
}

function renderKardexTable(kardex) {
  if (dtKardex) {
    dtKardex.destroy();
  }

  const tbody = document.getElementById('kardex-table-body');
  tbody.innerHTML = '';

  kardex.forEach(row => {
    const typeBadge = row.type === 'Entrada' ? 'bg-success' : 'bg-danger';
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${row.date}</td>
        <td><code>${row.product_code}</code></td>
        <td>${row.product_name}</td>
        <td><span class="badge ${typeBadge}">${row.type}</span></td>
        <td class="fw-bold">${row.quantity}</td>
        <td>${row.reason || '-'}</td>
        <td>${row.user_name || 'Sistema'}</td>
      </tr>
    `);
  });

  dtKardex = $('#kardex-table').DataTable({
    language: {
      url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json'
    },
    order: [[0, 'desc']]
  });
}

function openInventoryMoveModal() {
  document.getElementById('inventory-move-form').reset();
  new bootstrap.Modal(document.getElementById('inventory-move-modal')).show();
}

function saveInventoryMove() {
  const data = {
    product_id: parseInt(document.getElementById('inv-product-select').value),
    type: document.getElementById('inv-type').value,
    quantity: parseInt(document.getElementById('inv-quantity').value),
    reason: document.getElementById('inv-reason').value
  };

  fetch(`${API_BASE}/inventory/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })
  .then(res => {
    if (!res.ok) return res.json().then(d => { throw new Error(d.error) });
    return res.json();
  })
  .then(() => {
    showToast('Registrado', 'Movimiento de inventario guardado con éxito', 'success');
    bootstrap.Modal.getInstance(document.getElementById('inventory-move-modal')).hide();
    loadInventoryModule();
  })
  .catch(err => showToast('Error', err.message, 'danger'));
}

// ----------------------------------------------------
// SALES (POS) MODULE
// ----------------------------------------------------
let dtSalesHistory = null;

function loadSalesModule() {
  // Reset cart
  posCart = [];
  renderPOSCart();

  // Load clients options
  fetch(`${API_BASE}/clients`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(clients => {
    clientsList = clients;
    const select = document.getElementById('pos-client-select');
    select.innerHTML = '';
    clients.forEach(c => {
      select.insertAdjacentHTML('beforeend', `<option value="${c.id}">${c.name} (${c.email || ''})</option>`);
    });
  });

  // Load invoices history
  fetch(`${API_BASE}/sales`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(sales => {
    renderSalesHistoryTable(sales);
  });
}

function searchPosProducts(query) {
  const resultsDiv = document.getElementById('pos-search-results');
  if (query.trim().length === 0) {
    resultsDiv.style.display = 'none';
    return;
  }

  // Filter in-memory cached products
  fetch(`${API_BASE}/products`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(products => {
    const matched = products.filter(p => 
      p.status === 'Disponible' && (
      p.name.toLowerCase().includes(query.toLowerCase()) || 
      p.code.toLowerCase().includes(query.toLowerCase()) ||
      (p.barcode && p.barcode.includes(query))
      )
    );

    resultsDiv.innerHTML = '';
    if (matched.length > 0) {
      matched.forEach(p => {
        resultsDiv.insertAdjacentHTML('beforeend', `
          <button type="button" class="list-group-item list-group-item-action py-2 text-start" onclick="addPOSItem(${p.id})">
            <span class="fw-bold text-primary">${p.code}</span> - ${p.name} 
            <span class="badge bg-secondary float-end">Talla ${p.size} | Stock: ${p.stock}</span>
          </button>
        `);
      });
      resultsDiv.style.display = 'block';
    } else {
      resultsDiv.innerHTML = '<div class="list-group-item text-muted">No se encontraron productos disponibles</div>';
      resultsDiv.style.display = 'block';
    }
  });
}

function addPOSItem(productId) {
  document.getElementById('pos-search-results').style.display = 'none';
  document.getElementById('pos-product-search').value = '';

  // Get details
  fetch(`${API_BASE}/products`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(products => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Check if in cart
    const existing = posCart.find(item => item.product_id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        showToast('Advertencia', 'Stock máximo alcanzado para este producto en bodega', 'warning');
        return;
      }
      existing.quantity++;
    } else {
      posCart.push({
        product_id: product.id,
        name: product.name,
        code: product.code,
        size: product.size,
        color: product.color,
        price: product.sale_price,
        stock: product.stock,
        quantity: 1
      });
    }
    renderPOSCart();
  });
}

function updatePOSCartQty(index, newQty) {
  const qty = parseInt(newQty);
  if (qty <= 0) {
    posCart.splice(index, 1);
  } else {
    if (qty > posCart[index].stock) {
      showToast('Advertencia', 'Existencias insuficientes en inventario', 'warning');
      posCart[index].quantity = posCart[index].stock;
    } else {
      posCart[index].quantity = qty;
    }
  }
  renderPOSCart();
}

function removePOSItem(index) {
  posCart.splice(index, 1);
  renderPOSCart();
}

function renderPOSCart() {
  const tbody = document.getElementById('pos-cart-body');
  tbody.innerHTML = '';

  if (posCart.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">El carrito de ventas está vacío. Busque un producto.</td></tr>';
  } else {
    posCart.forEach((item, index) => {
      const lineTotal = item.price * item.quantity;
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td><strong>${item.name}</strong><br><small class="text-muted">${item.code}</small></td>
          <td>${item.size} / ${item.color || '-'}</td>
          <td>${new Intl.NumberFormat('es-CO').format(item.price)}</td>
          <td>
            <input type="number" class="form-control form-control-sm" value="${item.quantity}" min="1" onchange="updatePOSCartQty(${index}, this.value)">
          </td>
          <td class="fw-bold">${new Intl.NumberFormat('es-CO').format(lineTotal)}</td>
          <td><button class="btn btn-sm btn-link text-danger" onclick="removePOSItem(${index})"><i class="fa-solid fa-trash-can"></i></button></td>
        </tr>
      `);
    });
  }

  recalculatePosTotals();
}

function recalculatePosTotals() {
  let subtotal = 0;
  posCart.forEach(item => {
    subtotal += item.price * item.quantity;
  });

  const discount = parseFloat(document.getElementById('pos-discount').value) || 0;
  const taxRate = 0.19; // 19% standard VAT

  const netTotal = subtotal - discount;
  // Calculate VAT included
  const tax = netTotal > 0 ? (netTotal * (taxRate / (1 + taxRate))) : 0;

  document.getElementById('pos-subtotal').innerText = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(subtotal);
  document.getElementById('pos-tax').innerText = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(tax);
  document.getElementById('pos-discount-val').innerText = '-' + new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(discount);
  document.getElementById('pos-total').innerText = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(netTotal > 0 ? netTotal : 0);
}

function triggerBarcodeScanSimulation() {
  // Simulate scanning code '7701234567890' (Pijama Satin Elegance Dama)
  showToast('Escáner de código de barras', 'Buscando código 7701234567890 en base de datos...', 'info');
  setTimeout(() => {
    addPOSItem(1);
    showToast('Escaneado', 'Pijama Satin Elegance Dama añadida al POS', 'success');
  }, 1000);
}

function processPOSSale() {
  if (posCart.length === 0) {
    alert('Por favor agregue productos al carrito antes de generar la factura.');
    return;
  }

  const client_id = parseInt(document.getElementById('pos-client-select').value);
  const discount = parseFloat(document.getElementById('pos-discount').value) || 0;
  const payment_method = document.getElementById('pos-payment-method').value;

  const data = {
    client_id,
    items: posCart.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price
    })),
    discount,
    payment_method
  };

  fetch(`${API_BASE}/sales`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })
  .then(res => {
    if (!res.ok) return res.json().then(d => { throw new Error(d.error) });
    return res.json();
  })
  .then(resData => {
    showToast('Venta Exitosa', `Factura ${resData.invoiceNumber} generada por ${new Intl.NumberFormat('es-CO').format(resData.total)}`, 'success');
    
    // Simulate invoice ticket printing
    printPOSReceipt(resData.invoiceNumber, data, resData.total);

    // Reload module
    loadSalesModule();
  })
  .catch(err => showToast('Error al generar factura', err.message, 'danger'));
}

function printPOSReceipt(invoiceNumber, orderData, total) {
  const clientName = document.getElementById('pos-client-select').options[document.getElementById('pos-client-select').selectedIndex].text;
  const dateStr = new Date().toLocaleString();
  
  let itemsRows = '';
  posCart.forEach(item => {
    itemsRows += `
      <div style="display:flex; justify-content:space-between; font-size:12px;">
        <span>${item.name} (${item.quantity} x $${new Intl.NumberFormat('es-CO').format(item.price)})</span>
        <span>$${new Intl.NumberFormat('es-CO').format(item.price * item.quantity)}</span>
      </div>
    `;
  });

  const printArea = document.getElementById('print-ticket-area');
  printArea.innerHTML = `
    <div style="padding:15px; border:1px solid #ccc; max-width:300px; font-family:monospace; margin:auto; background:#fff; color:#000;">
      <h3 style="text-align:center; margin:0 0 5px 0;">KITTY PIJAMAS</h3>
      <p style="text-align:center; font-size:10px; margin:0 0 15px 0;">
        KITTY PIJAMAS S.A.S.<br>
        NIT: 900.123.456-7<br>
        Tel: +57 300 123 4567<br>
        Dirección: Calle 100 #15-30
      </p>
      <hr style="border-top:1px dashed #000;">
      <div style="font-size:11px; margin-bottom:10px;">
        <strong>Factura:</strong> ${invoiceNumber}<br>
        <strong>Fecha:</strong> ${dateStr}<br>
        <strong>Cliente:</strong> ${clientName}<br>
        <strong>Pago:</strong> ${orderData.payment_method}
      </div>
      <hr style="border-top:1px dashed #000;">
      <div style="margin-bottom:10px;">
        ${itemsRows}
      </div>
      <hr style="border-top:1px dashed #000;">
      <div style="font-size:13px; font-weight:bold; display:flex; justify-content:space-between;">
        <span>TOTAL FACTURADO:</span>
        <span>$${new Intl.NumberFormat('es-CO').format(total)}</span>
      </div>
      <p style="text-align:center; font-size:10px; margin-top:20px;">¡Gracias por preferir nuestras pijamas!</p>
    </div>
  `;

  // Trigger browser print
  const printWindow = window.open('', '_blank', 'width=350,height=500');
  printWindow.document.write('<html><head><title>Imprimir Ticket</title></head><body>');
  printWindow.document.write(printArea.innerHTML);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
}

function renderSalesHistoryTable(sales) {
  if (dtSalesHistory) {
    dtSalesHistory.destroy();
  }

  const tbody = document.getElementById('sales-history-body');
  tbody.innerHTML = '';

  sales.forEach(s => {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td><strong class="text-primary">${s.invoice_number}</strong></td>
        <td>${s.date}</td>
        <td>${s.client_name || 'Consumidor Final'}</td>
        <td>${s.payment_method || 'Efectivo'}</td>
        <td class="fw-bold">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(s.total)}</td>
        <td>
          <button class="btn btn-sm btn-outline-secondary" onclick="reprintTicket('${s.invoice_number}', ${s.total}, '${s.client_name}', '${s.payment_method}', '${s.date}')"><i class="fa-solid fa-print"></i> Re-imprimir</button>
        </td>
      </tr>
    `);
  });

  dtSalesHistory = $('#sales-history-table').DataTable({
    language: {
      url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json'
    },
    order: [[1, 'desc']],
    pageLength: 5
  });
}

function reprintTicket(invoiceNumber, total, clientName, paymentMethod, dateStr) {
  const printArea = document.getElementById('print-ticket-area');
  printArea.innerHTML = `
    <div style="padding:15px; border:1px solid #ccc; max-width:300px; font-family:monospace; margin:auto; background:#fff; color:#000;">
      <h3 style="text-align:center; margin:0 0 5px 0;">KITTY PIJAMAS</h3>
      <p style="text-align:center; font-size:10px; margin:0 0 15px 0;">
        KITTY PIJAMAS S.A.S.<br>
        NIT: 900.123.456-7<br>
        Copia de Factura
      </p>
      <hr style="border-top:1px dashed #000;">
      <div style="font-size:11px; margin-bottom:10px;">
        <strong>Factura:</strong> ${invoiceNumber}<br>
        <strong>Fecha Emisión:</strong> ${dateStr}<br>
        <strong>Cliente:</strong> ${clientName}<br>
        <strong>Pago:</strong> ${paymentMethod}
      </div>
      <hr style="border-top:1px dashed #000;">
      <div style="font-size:13px; font-weight:bold; display:flex; justify-content:space-between;">
        <span>TOTAL FACTURADO:</span>
        <span>$${new Intl.NumberFormat('es-CO').format(total)}</span>
      </div>
      <p style="text-align:center; font-size:10px; margin-top:20px;">Duplicado Autorizado</p>
    </div>
  `;

  const printWindow = window.open('', '_blank', 'width=350,height=500');
  printWindow.document.write('<html><head><title>Reimprimir Ticket</title></head><body>');
  printWindow.document.write(printArea.innerHTML);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
}

// ----------------------------------------------------
// PURCHASES MODULE
// ----------------------------------------------------
let dtPurchases = null;

function loadPurchasesModule() {
  // Load providers select list
  fetch(`${API_BASE}/providers`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(providers => {
    providersList = providers;
    const select = document.getElementById('purch-provider-select');
    select.innerHTML = '';
    providers.forEach(p => {
      select.insertAdjacentHTML('beforeend', `<option value="${p.id}">${p.name}</option>`);
    });
  });

  // Load orders table
  fetch(`${API_BASE}/purchases`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(purchases => {
    renderPurchasesTable(purchases);
  });
}

function renderPurchasesTable(purchases) {
  if (dtPurchases) {
    dtPurchases.destroy();
  }

  const tbody = document.getElementById('purchases-body');
  tbody.innerHTML = '';

  purchases.forEach(p => {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td><strong class="text-primary">${p.order_number}</strong></td>
        <td>${p.date}</td>
        <td>${p.provider_name}</td>
        <td class="fw-bold">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(p.total)}</td>
        <td><span class="badge bg-success">${p.status}</span></td>
      </tr>
    `);
  });

  dtPurchases = $('#purchases-table').DataTable({
    language: {
      url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json'
    },
    order: [[1, 'desc']]
  });
}

function openNewPurchaseModal() {
  document.getElementById('purchase-form').reset();
  const list = document.getElementById('purch-items-list');
  list.innerHTML = '';
  addPurchaseItemRow(); // start with one blank row
  new bootstrap.Modal(document.getElementById('purchase-modal')).show();
}

function addPurchaseItemRow() {
  const container = document.getElementById('purch-items-list');
  const index = container.children.length;
  
  // Build options
  fetch(`${API_BASE}/products`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(products => {
    let options = '';
    products.forEach(p => {
      options += `<option value="${p.id}">${p.code} - ${p.name}</option>`;
    });

    const rowHtml = `
      <div class="row g-2 mb-2 align-items-center" id="purch-row-${index}">
        <div class="col-md-5">
          <label class="form-label small mb-1">Producto</label>
          <select class="form-select form-select-sm" name="prod-id" required>${options}</select>
        </div>
        <div class="col-md-3">
          <label class="form-label small mb-1">Costo Unitario *</label>
          <input type="number" class="form-control form-control-sm" name="cost" required min="0">
        </div>
        <div class="col-md-3">
          <label class="form-label small mb-1">Cantidad *</label>
          <input type="number" class="form-control form-control-sm" name="qty" required min="1">
        </div>
        <div class="col-md-1 text-end mt-4">
          <button type="button" class="btn btn-sm btn-link text-danger" onclick="document.getElementById('purch-row-${index}').remove()"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', rowHtml);
  });
}

function savePurchaseOrder() {
  const provider_id = parseInt(document.getElementById('purch-provider-select').value);
  const rows = document.getElementById('purch-items-list').children;
  
  if (rows.length === 0) {
    alert('Debe agregar al menos una fila de producto.');
    return;
  }

  const items = [];
  for (let i = 0; i < rows.length; i++) {
    const rowEl = rows[i];
    const product_id = parseInt(rowEl.querySelector('[name="prod-id"]').value);
    const cost = parseFloat(rowEl.querySelector('[name="cost"]').value);
    const quantity = parseInt(rowEl.querySelector('[name="qty"]').value);
    items.push({ product_id, cost, quantity });
  }

  const data = { provider_id, items };

  fetch(`${API_BASE}/purchases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })
  .then(res => {
    if (!res.ok) return res.json().then(d => { throw new Error(d.error) });
    return res.json();
  })
  .then(() => {
    showToast('Registrado', 'Orden de compra recibida e inventario actualizado', 'success');
    bootstrap.Modal.getInstance(document.getElementById('purchase-modal')).hide();
    loadPurchasesModule();
  })
  .catch(err => showToast('Error', err.message, 'danger'));
}

// ----------------------------------------------------
// CLIENTS MODULE
// ----------------------------------------------------
let dtClients = null;

function loadClientsModule() {
  fetch(`${API_BASE}/clients`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(clients => {
    renderClientsTable(clients);
  });
}

function renderClientsTable(clients) {
  if (dtClients) {
    dtClients.destroy();
  }

  const tbody = document.getElementById('clients-body');
  tbody.innerHTML = '';

  clients.forEach(c => {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td>${c.email || '-'}</td>
        <td>${c.phone || '-'}</td>
        <td>${c.address || '-'}</td>
        <td class="fw-bold ${c.balance > 0 ? 'text-danger' : 'text-success'}">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(c.balance)}</td>
        <td>
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-secondary" onclick="openEditClient(${c.id})"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteClient(${c.id})"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </td>
      </tr>
    `);
  });

  dtClients = $('#clients-table').DataTable({
    language: {
      url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json'
    }
  });
}

function openAddClientModal() {
  document.getElementById('client-form').reset();
  document.getElementById('client-id').value = '';
  document.getElementById('client-modal-title').innerText = 'Registrar Nuevo Cliente';
  new bootstrap.Modal(document.getElementById('client-modal')).show();
}

function openEditClient(id) {
  fetch(`${API_BASE}/clients`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(clients => {
    const c = clients.find(item => item.id === id);
    if (!c) return;

    document.getElementById('client-id').value = c.id;
    document.getElementById('client-name').value = c.name;
    document.getElementById('client-email').value = c.email || '';
    document.getElementById('client-phone').value = c.phone || '';
    document.getElementById('client-address').value = c.address || '';
    document.getElementById('client-balance').value = c.balance;

    document.getElementById('client-modal-title').innerText = 'Editar Datos de Cliente';
    new bootstrap.Modal(document.getElementById('client-modal')).show();
  });
}

function saveClient() {
  const id = document.getElementById('client-id').value;
  const isEdit = !!id;

  const data = {
    name: document.getElementById('client-name').value,
    email: document.getElementById('client-email').value,
    phone: document.getElementById('client-phone').value,
    address: document.getElementById('client-address').value,
    balance: parseFloat(document.getElementById('client-balance').value) || 0
  };

  const url = isEdit ? `${API_BASE}/clients/${id}` : `${API_BASE}/clients`;
  const method = isEdit ? 'PUT' : 'POST';

  fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })
  .then(res => {
    if (!res.ok) return res.json().then(d => { throw new Error(d.error) });
    return res.json();
  })
  .then(() => {
    showToast('Correcto', 'Datos del cliente guardados con éxito', 'success');
    bootstrap.Modal.getInstance(document.getElementById('client-modal')).hide();
    loadClientsModule();
  })
  .catch(err => showToast('Error', err.message, 'danger'));
}

function deleteClient(id) {
  if (!confirm('¿Desea borrar este cliente?')) return;

  fetch(`${API_BASE}/clients/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => {
    if (!res.ok) return res.json().then(d => { throw new Error(d.error) });
    return res.json();
  })
  .then(() => {
    showToast('Eliminado', 'Cliente removido del sistema', 'success');
    loadClientsModule();
  })
  .catch(err => showToast('Error', err.message, 'danger'));
}

// ----------------------------------------------------
// PROVIDERS MODULE
// ----------------------------------------------------
let dtProviders = null;

function loadProvidersModule() {
  fetch(`${API_BASE}/providers`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(providers => {
    renderProvidersTable(providers);
  });
}

function renderProvidersTable(providers) {
  if (dtProviders) {
    dtProviders.destroy();
  }

  const tbody = document.getElementById('providers-body');
  tbody.innerHTML = '';

  providers.forEach(p => {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td>${p.contact_name || '-'}</td>
        <td>${p.phone || '-'}</td>
        <td>${p.email || '-'}</td>
        <td>${p.address || '-'}</td>
        <td>
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-secondary" onclick="openEditProvider(${p.id})"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteProvider(${p.id})"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </td>
      </tr>
    `);
  });

  dtProviders = $('#providers-table').DataTable({
    language: {
      url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json'
    }
  });
}

function openAddProviderModal() {
  document.getElementById('provider-form').reset();
  document.getElementById('provider-id').value = '';
  document.getElementById('provider-modal-title').innerText = 'Registrar Proveedor';
  new bootstrap.Modal(document.getElementById('provider-modal')).show();
}

function openEditProvider(id) {
  fetch(`${API_BASE}/providers`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(providers => {
    const p = providers.find(item => item.id === id);
    if (!p) return;

    document.getElementById('provider-id').value = p.id;
    document.getElementById('prov-name').value = p.name;
    document.getElementById('prov-contact').value = p.contact_name || '';
    document.getElementById('prov-phone').value = p.phone || '';
    document.getElementById('prov-email').value = p.email || '';
    document.getElementById('prov-address').value = p.address || '';

    document.getElementById('provider-modal-title').innerText = 'Editar Datos de Proveedor';
    new bootstrap.Modal(document.getElementById('provider-modal')).show();
  });
}

function saveProvider() {
  const id = document.getElementById('provider-id').value;
  const isEdit = !!id;

  const data = {
    name: document.getElementById('prov-name').value,
    contact_name: document.getElementById('prov-contact').value,
    phone: document.getElementById('prov-phone').value,
    email: document.getElementById('prov-email').value,
    address: document.getElementById('prov-address').value
  };

  const url = isEdit ? `${API_BASE}/providers/${id}` : `${API_BASE}/providers`;
  const method = isEdit ? 'PUT' : 'POST';

  fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })
  .then(res => {
    if (!res.ok) return res.json().then(d => { throw new Error(d.error) });
    return res.json();
  })
  .then(() => {
    showToast('Correcto', 'Datos de proveedor guardados con éxito', 'success');
    bootstrap.Modal.getInstance(document.getElementById('provider-modal')).hide();
    loadProvidersModule();
  })
  .catch(err => showToast('Error', err.message, 'danger'));
}

function deleteProvider(id) {
  if (!confirm('¿Desea borrar este proveedor?')) return;

  fetch(`${API_BASE}/providers/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => {
    if (!res.ok) return res.json().then(d => { throw new Error(d.error) });
    return res.json();
  })
  .then(() => {
    showToast('Eliminado', 'Proveedor removido del sistema', 'success');
    loadProvidersModule();
  })
  .catch(err => showToast('Error', err.message, 'danger'));
}

// ----------------------------------------------------
// REPORTS MODULE
// ----------------------------------------------------
function exportReport(reportType, format) {
  showToast('Generando', `Compilando informe de ${reportType} en formato ${format.toUpperCase()}...`, 'info');

  const urls = {
    inventory: `${API_BASE}/products`,
    sales: `${API_BASE}/sales`,
    kardex: `${API_BASE}/inventory/kardex`
  };

  const url = urls[reportType];
  if (!url) return;

  fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(data => {
    if (data.length === 0) {
      showToast('Aviso', 'No hay información suficiente para exportar.', 'warning');
      return;
    }

    // Generate CSV contents
    const headers = Object.keys(data[0]);
    let csvContent = '\uFEFF'; // Add UTF-8 BOM
    csvContent += headers.join(',') + '\r\n';

    data.forEach(row => {
      const line = headers.map(header => {
        let val = row[header];
        if (val === null || val === undefined) return '';
        // Escape quotes
        val = String(val).replace(/"/g, '""');
        // Wrap if has commas or new lines
        if (val.includes(',') || val.includes('\n') || val.includes('\r')) {
          val = `"${val}"`;
        }
        return val;
      });
      csvContent += line.join(',') + '\r\n';
    });

    // Download trigger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', downloadUrl);
    link.setAttribute('download', `reporte_${reportType}_${new Date().toISOString().slice(0,10)}.${format}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exportación Exitosa', `Archivo descargado correctamente.`, 'success');
  })
  .catch(err => showToast('Error', 'No se pudo exportar el reporte: ' + err.message, 'danger'));
}

// ----------------------------------------------------
// SYSTEM SECURITY LOGS MODULE
// ----------------------------------------------------
let dtAuditLogs = null;

function loadAuditLogsModule() {
  fetch(`${API_BASE}/audit-logs`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => {
    if (!res.ok) throw new Error('Se requieren permisos de Administrador para ver logs.');
    return res.json();
  })
  .then(logs => {
    renderAuditLogsTable(logs);
  })
  .catch(err => {
    document.getElementById('audit-logs-body').innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">${err.message}</td></tr>`;
  });
}

function renderAuditLogsTable(logs) {
  if (dtAuditLogs) {
    dtAuditLogs.destroy();
  }

  const tbody = document.getElementById('audit-logs-body');
  tbody.innerHTML = '';

  logs.forEach(log => {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${log.timestamp}</td>
        <td><strong>${log.username}</strong></td>
        <td><span class="badge bg-secondary">${log.action}</span></td>
        <td><small>${log.details}</small></td>
      </tr>
    `);
  });

  dtAuditLogs = $('#audit-logs-table').DataTable({
    language: {
      url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json'
    },
    order: [[0, 'desc']],
    pageLength: 20
  });
}

// ----------------------------------------------------
// SYSTEM CONFIGURATION MODULE
// ----------------------------------------------------
function loadSettingsModule() {
  fetch(`${API_BASE}/settings`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(settings => {
    const form = document.getElementById('settings-form');
    Object.keys(settings).forEach(key => {
      const input = form.querySelector(`[name="${key}"]`);
      if (input) input.value = settings[key];
    });
  });
}

function saveSettings() {
  if (currentUser.role !== 'admin') {
    alert('Permiso denegado. Se requiere cuenta Administrador.');
    return;
  }

  const form = document.getElementById('settings-form');
  const formData = new FormData(form);
  const data = {};
  formData.forEach((val, key) => data[key] = val);

  fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })
  .then(res => {
    if (!res.ok) return res.json().then(d => { throw new Error(d.error) });
    return res.json();
  })
  .then(() => {
    showToast('Guardado', 'Configuraciones generales guardadas con éxito', 'success');
  })
  .catch(err => showToast('Error', err.message, 'danger'));
}

function executeBackup() {
  fetch(`${API_BASE}/settings/backup`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => {
    if (!res.ok) return res.json().then(d => { throw new Error(d.error) });
    return res.json();
  })
  .then(data => {
    showToast('Backup Exitoso', data.message, 'success');
  })
  .catch(err => showToast('Error', err.message, 'danger'));
}

function executeRestore() {
  if (!confirm('¿Está totalmente seguro de restaurar el sistema? Se restablecerán todos los datos a la última copia de seguridad y se reiniciará el servidor.')) return;

  fetch(`${API_BASE}/settings/restore`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => {
    if (!res.ok) return res.json().then(d => { throw new Error(d.error) });
    return res.json();
  })
  .then(data => {
    alert(data.message);
    window.location.reload();
  })
  .catch(err => showToast('Error', err.message, 'danger'));
}

function fetchCategories() {
  return fetch(`${API_BASE}/categories`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(categories => {
    categoriesList = categories;
    // update filter dropdown
    const filterCat = document.getElementById('filter-category');
    if (filterCat) {
      const currentVal = filterCat.value;
      filterCat.innerHTML = '<option value="">Categoría: Todos</option>';
      categories.forEach(c => {
        filterCat.insertAdjacentHTML('beforeend', `<option value="${c.name}">${c.name}</option>`);
      });
      filterCat.value = currentVal;
    }
    // update product form dropdown
    const prodCat = document.getElementById('prod-category');
    if (prodCat) {
      const currentVal = prodCat.value;
      prodCat.innerHTML = '';
      categories.forEach(c => {
        prodCat.insertAdjacentHTML('beforeend', `<option value="${c.name}">${c.name}</option>`);
      });
      if (currentVal && categories.some(c => c.name === currentVal)) {
        prodCat.value = currentVal;
      }
    }
  });
}

function openCategoriesModal() {
  renderCategoriesList();
  new bootstrap.Modal(document.getElementById('categories-modal')).show();
}

function renderCategoriesList() {
  const listGroup = document.getElementById('categories-list-group');
  listGroup.innerHTML = '';
  
  if (categoriesList.length === 0) {
    listGroup.innerHTML = '<li class="list-group-item text-center text-muted">No hay categorías. Crea una arriba.</li>';
    return;
  }
  
  categoriesList.forEach(c => {
    listGroup.insertAdjacentHTML('beforeend', `
      <li class="list-group-item d-flex justify-content-between align-items-center">
        <span>${c.name}</span>
        <button class="btn btn-sm btn-link text-danger border-0 p-0" onclick="deleteCategory(${c.id})"><i class="fa-solid fa-trash-can"></i></button>
      </li>
    `);
  });
}

function saveCategory() {
  const nameInput = document.getElementById('new-category-name');
  const name = nameInput.value.trim();
  if (!name) return;

  fetch(`${API_BASE}/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name })
  })
  .then(res => {
    if (!res.ok) return res.json().then(d => { throw new Error(d.error) });
    return res.json();
  })
  .then(() => {
    nameInput.value = '';
    showToast('Correcto', 'Categoría agregada con éxito', 'success');
    fetchCategories().then(() => {
      renderCategoriesList();
    });
  })
  .catch(err => showToast('Error', err.message, 'danger'));
}

function deleteCategory(id) {
  if (!confirm('¿Desea eliminar esta categoría?')) return;

  fetch(`${API_BASE}/categories/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => {
    if (!res.ok) return res.json().then(d => { throw new Error(d.error) });
    return res.json();
  })
  .then(() => {
    showToast('Correcto', 'Categoría eliminada', 'success');
    fetchCategories().then(() => {
      renderCategoriesList();
    });
  })
  .catch(err => showToast('Error', err.message, 'danger'));
}

function globalERPSearch(query) {
  const q = query.toLowerCase().trim();
  if (q.length === 0) return;
  
  if (activeModule === 'products' && dtProducts) {
    document.getElementById('search-product-input').value = query;
    applyProductFilters();
  } else if (activeModule === 'clients' && dtClients) {
    dtClients.search(q).draw();
  } else if (activeModule === 'providers' && dtProviders) {
    dtProviders.search(q).draw();
  } else if (activeModule === 'inventory' && dtKardex) {
    dtKardex.search(q).draw();
  } else {
    // Default search action (go to products and search)
    loadModule('products');
    setTimeout(() => {
      document.getElementById('search-product-input').value = query;
      applyProductFilters();
    }, 200);
  }
}

function toggleCollapse(bodyId, button) {
  const body = document.getElementById(bodyId);
  const icon = button.querySelector('i');
  if (body.style.display === 'none') {
    body.style.display = 'block';
    icon.className = 'fa-solid fa-chevron-up';
  } else {
    body.style.display = 'none';
    icon.className = 'fa-solid fa-chevron-down';
  }
}

function createFloatingKitties() {
  const container = document.getElementById('login-floating-kitties');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 40; i++) {
    const kitty = document.createElement('div');
    kitty.className = 'floating-kitty';
    const left = Math.random() * 100;
    const delay = Math.random() * 8;
    const duration = 6 + Math.random() * 6;
    const size = 50 + Math.random() * 60;
    
    kitty.style.left = `${left}%`;
    kitty.style.animationDelay = `${delay}s`;
    kitty.style.animationDuration = `${duration}s`;
    kitty.style.width = `${size}px`;
    kitty.style.height = `${size}px`;
    container.appendChild(kitty);
  }
}
