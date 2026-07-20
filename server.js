const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { db, initDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'pijamas-secure-secret-key-12345';

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Log audit action
function logAction(userId, username, action, details) {
  db.run(
    `INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)`,
    [userId, username, action, details],
    (err) => {
      if (err) console.error('Error logging audit action:', err.message);
    }
  );
}

// Helper: Verify Token Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Acceso no autorizado' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
    req.user = user;
    next();
  });
}

// ----------------------------------------------------
// AUTH ENDPOINTS
// ----------------------------------------------------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Por favor complete todos los campos' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ error: 'Error del servidor' });
    if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, JWT_SECRET, {
      expiresIn: '8h'
    });

    logAction(user.id, user.username, 'Login', 'Inicio de sesión exitoso');

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email
      }
    });
  });
});

app.get('/api/verify-token', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// ----------------------------------------------------
// CATEGORY ENDPOINTS
// ----------------------------------------------------
app.get('/api/categories', authenticateToken, (req, res) => {
  db.all('SELECT * FROM categories ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/categories', authenticateToken, (req, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ error: 'Permiso denegado' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre de la categoría es obligatorio.' });

  db.run('INSERT INTO categories (name) VALUES (?)', [name], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'La categoría ya existe.' });
      }
      return res.status(500).json({ error: err.message });
    }
    logAction(req.user.id, req.user.username, 'Crear Categoría', `Creación de categoría: ${name}`);
    res.status(201).json({ id: this.lastID, name });
  });
});

app.delete('/api/categories/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Permiso denegado' });
  const { id } = req.params;
  db.run('DELETE FROM categories WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    logAction(req.user.id, req.user.username, 'Eliminar Categoría', `Eliminación de categoría ID: ${id}`);
    res.json({ message: 'Categoría eliminada' });
  });
});

// ----------------------------------------------------
// PRODUCT ENDPOINTS
// ----------------------------------------------------
app.get('/api/products', authenticateToken, (req, res) => {
  db.all('SELECT * FROM products ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/products', authenticateToken, (req, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ error: 'Permiso denegado' });

  const {
    code, name, category, brand, description, color, size, material,
    purchase_price, sale_price, stock, min_stock, location, status, barcode, images
  } = req.body;

  if (!code || !name) return res.status(400).json({ error: 'Código y Nombre son campos obligatorios.' });

  // Check if code exists
  db.get('SELECT id FROM products WHERE code = ?', [code], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) return res.status(400).json({ error: 'El código de producto ya existe.' });

    const imagesJson = images ? JSON.stringify(images) : '[]';

    db.run(`
      INSERT INTO products (
        code, name, category, brand, description, color, size, material,
        purchase_price, sale_price, stock, min_stock, location, status, barcode, images
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      code, name, category, brand, description, color, size, material,
      purchase_price || 0, sale_price || 0, stock || 0, min_stock || 0,
      location, status || 'Disponible', barcode, imagesJson
    ], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const productId = this.lastID;

      // Log initial transaction if stock > 0
      if (stock > 0) {
        db.run(`
          INSERT INTO inventory_transactions (product_id, type, quantity, reason, user_id)
          VALUES (?, 'Entrada', ?, 'Inventario inicial al crear producto', ?)
        `, [productId, stock, req.user.id]);
      }

      logAction(req.user.id, req.user.username, 'Crear Producto', `Creación de producto: ${name} (${code})`);
      res.status(201).json({ id: productId, message: 'Producto creado exitosamente' });
    });
  });
});

app.put('/api/products/:id', authenticateToken, (req, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ error: 'Permiso denegado' });

  const { id } = req.params;
  const {
    code, name, category, brand, description, color, size, material,
    purchase_price, sale_price, stock, min_stock, location, status, barcode, images
  } = req.body;

  const imagesJson = images ? JSON.stringify(images) : '[]';

  db.run(`
    UPDATE products SET
      code = ?, name = ?, category = ?, brand = ?, description = ?, color = ?,
      size = ?, material = ?, purchase_price = ?, sale_price = ?, stock = ?,
      min_stock = ?, location = ?, status = ?, barcode = ?, images = ?
    WHERE id = ?
  `, [
    code, name, category, brand, description, color, size, material,
    purchase_price, sale_price, stock, min_stock, location, status, barcode, imagesJson, id
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    logAction(req.user.id, req.user.username, 'Editar Producto', `Edición de producto ID: ${id}`);
    res.json({ message: 'Producto actualizado con éxito' });
  });
});

app.delete('/api/products/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Permiso denegado. Se requiere Administrador.' });

  const { id } = req.params;
  db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    logAction(req.user.id, req.user.username, 'Eliminar Producto', `Eliminación de producto ID: ${id}`);
    res.json({ message: 'Producto eliminado exitosamente' });
  });
});

app.post('/api/products/:id/duplicate', authenticateToken, (req, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ error: 'Permiso denegado' });

  const { id } = req.params;
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    const newCode = `${product.code}-COPIA`;
    const newName = `${product.name} (Copia)`;

    db.run(`
      INSERT INTO products (
        code, name, category, brand, description, color, size, material,
        purchase_price, sale_price, stock, min_stock, location, status, barcode, images
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'Disponible', ?, ?)
    `, [
      newCode, newName, product.category, product.brand, product.description,
      product.color, product.size, product.material, product.purchase_price,
      product.sale_price, product.min_stock, product.location,
      product.barcode ? `${product.barcode}0` : null, product.images
    ], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logAction(req.user.id, req.user.username, 'Duplicar Producto', `Duplicación de producto ID: ${id} a nueva copia`);
      res.status(201).json({ id: this.lastID, message: 'Producto duplicado correctamente' });
    });
  });
});

// ----------------------------------------------------
// CLIENTS ENDPOINTS
// ----------------------------------------------------
app.get('/api/clients', authenticateToken, (req, res) => {
  db.all('SELECT * FROM clients', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/clients', authenticateToken, (req, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ error: 'Permiso denegado' });
  const { name, email, phone, address, balance } = req.body;
  db.run(`
    INSERT INTO clients (name, email, phone, address, balance) VALUES (?, ?, ?, ?, ?)
  `, [name, email, phone, address, balance || 0.0], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    logAction(req.user.id, req.user.username, 'Crear Cliente', `Creación de cliente: ${name}`);
    res.status(201).json({ id: this.lastID, message: 'Cliente registrado con éxito' });
  });
});

app.put('/api/clients/:id', authenticateToken, (req, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ error: 'Permiso denegado' });
  const { id } = req.params;
  const { name, email, phone, address, balance } = req.body;
  db.run(`
    UPDATE clients SET name = ?, email = ?, phone = ?, address = ?, balance = ? WHERE id = ?
  `, [name, email, phone, address, balance, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    logAction(req.user.id, req.user.username, 'Editar Cliente', `Edición de cliente ID: ${id}`);
    res.json({ message: 'Cliente actualizado con éxito' });
  });
});

app.delete('/api/clients/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Permiso denegado' });
  const { id } = req.params;
  db.run('DELETE FROM clients WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    logAction(req.user.id, req.user.username, 'Eliminar Cliente', `Eliminación de cliente ID: ${id}`);
    res.json({ message: 'Cliente eliminado' });
  });
});

// ----------------------------------------------------
// PROVIDERS ENDPOINTS
// ----------------------------------------------------
app.get('/api/providers', authenticateToken, (req, res) => {
  db.all('SELECT * FROM providers', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/providers', authenticateToken, (req, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ error: 'Permiso denegado' });
  const { name, contact_name, phone, email, address } = req.body;
  db.run(`
    INSERT INTO providers (name, contact_name, phone, email, address) VALUES (?, ?, ?, ?, ?)
  `, [name, contact_name, phone, email, address], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    logAction(req.user.id, req.user.username, 'Crear Proveedor', `Creación de proveedor: ${name}`);
    res.status(201).json({ id: this.lastID, message: 'Proveedor creado' });
  });
});

app.put('/api/providers/:id', authenticateToken, (req, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ error: 'Permiso denegado' });
  const { id } = req.params;
  const { name, contact_name, phone, email, address } = req.body;
  db.run(`
    UPDATE providers SET name = ?, contact_name = ?, phone = ?, email = ?, address = ? WHERE id = ?
  `, [name, contact_name, phone, email, address, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    logAction(req.user.id, req.user.username, 'Editar Proveedor', `Edición de proveedor ID: ${id}`);
    res.json({ message: 'Proveedor actualizado con éxito' });
  });
});

app.delete('/api/providers/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Permiso denegado' });
  const { id } = req.params;
  db.run('DELETE FROM providers WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    logAction(req.user.id, req.user.username, 'Eliminar Proveedor', `Eliminación de proveedor ID: ${id}`);
    res.json({ message: 'Proveedor eliminado' });
  });
});

// ----------------------------------------------------
// INVENTORY TRANSACTIONS / KARDEX ENDPOINTS
// ----------------------------------------------------
app.get('/api/inventory/kardex', authenticateToken, (req, res) => {
  db.all(`
    SELECT t.*, p.name as product_name, p.code as product_code, u.name as user_name
    FROM inventory_transactions t
    LEFT JOIN products p ON t.product_id = p.id
    LEFT JOIN users u ON t.user_id = u.id
    ORDER BY t.date DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/inventory/transactions', authenticateToken, (req, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ error: 'Permiso denegado' });
  const { product_id, type, quantity, reason } = req.body;

  if (!product_id || !type || !quantity) {
    return res.status(400).json({ error: 'Faltan campos requeridos.' });
  }

  db.get('SELECT stock, name FROM products WHERE id = ?', [product_id], (err, product) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    let newStock = product.stock;
    const qty = parseInt(quantity);
    if (type === 'Entrada') {
      newStock += qty;
    } else if (type === 'Salida' || type === 'Ajuste' || type === 'Transferencia') {
      // Adjustment can be positive or negative, but we'll assume quantity logic handled by client
      if (type === 'Salida' && product.stock < qty) {
        return res.status(400).json({ error: `Existencias insuficientes. Stock actual: ${product.stock}` });
      }
      newStock -= qty; // If negative adjustment or exit
    }

    const finalStatus = newStock <= 0 ? 'Agotado' : 'Disponible';

    db.serialize(() => {
      db.run('UPDATE products SET stock = ?, status = ? WHERE id = ?', [newStock, finalStatus, product_id]);
      db.run(`
        INSERT INTO inventory_transactions (product_id, type, quantity, reason, user_id)
        VALUES (?, ?, ?, ?, ?)
      `, [product_id, type, qty, reason, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        logAction(req.user.id, req.user.username, 'Movimiento de Inventario', `${type} de ${qty} unidades de ${product.name}`);
        res.json({ message: 'Movimiento registrado con éxito', newStock });
      });
    });
  });
});

// ----------------------------------------------------
// SALES ENDPOINTS (POS Billing)
// ----------------------------------------------------
app.get('/api/sales', authenticateToken, (req, res) => {
  db.all(`
    SELECT s.*, c.name as client_name, u.name as user_name
    FROM sales s
    LEFT JOIN clients c ON s.client_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    ORDER BY s.date DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/sales', authenticateToken, (req, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ error: 'Permiso denegado' });
  const { client_id, items, discount, payment_method } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'La venta debe contener al menos un producto.' });
  }

  // Get invoice numbering settings
  db.all('SELECT key, value FROM settings', [], (err, settingsRows) => {
    if (err) return res.status(500).json({ error: err.message });

    const config = {};
    settingsRows.forEach(r => config[r.key] = r.value);

    // Get tax rate and generate invoice number
    const taxRate = parseFloat(config.tax_rate || 19) / 100;
    const prefix = config.invoice_prefix || 'FE-';

    db.get('SELECT COUNT(*) as count FROM sales', [], (err, rowCount) => {
      if (err) return res.status(500).json({ error: err.message });
      const nextNum = parseInt(config.invoice_start_number || 1001) + rowCount.count;
      const invoiceNumber = `${prefix}${nextNum}`;

      // Calculate totals
      let subtotal = 0;
      items.forEach(item => {
        subtotal += item.price * item.quantity;
      });

      const totalDiscount = parseFloat(discount || 0);
      const subtotalWithDisc = subtotal - totalDiscount;
      const tax = subtotalWithDisc * (taxRate / (1 + taxRate)); // Included Tax logic or Added Tax. Let's do added or included.
      // Standard: Sales Total = Subtotal - Discount
      const total = subtotalWithDisc;

      // Start transaction database execution
      db.serialize(() => {
        db.run(
          `INSERT INTO sales (invoice_number, client_id, total, tax, discount, user_id, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [invoiceNumber, client_id, total, tax, totalDiscount, req.user.id, payment_method],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const saleId = this.lastID;

            // Process items
            const itemStmt = db.prepare(`INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES (?, ?, ?, ?)`);
            const updateStockStmt = db.prepare(`UPDATE products SET stock = stock - ?, status = CASE WHEN stock - ? <= 0 THEN 'Agotado' ELSE 'Disponible' END WHERE id = ?`);
            const invTransStmt = db.prepare(`INSERT INTO inventory_transactions (product_id, type, quantity, reason, user_id) VALUES (?, 'Salida', ?, ?, ?)`);

            items.forEach(item => {
              itemStmt.run(saleId, item.product_id, item.quantity, item.price);
              updateStockStmt.run(item.quantity, item.quantity, item.product_id);
              invTransStmt.run(item.product_id, item.quantity, `Venta Factura ${invoiceNumber}`, req.user.id);
            });

            itemStmt.finalize();
            updateStockStmt.finalize();
            invTransStmt.finalize();

            logAction(req.user.id, req.user.username, 'Crear Venta', `Venta registrada: ${invoiceNumber} por total: ${total}`);
            res.status(201).json({ id: saleId, invoiceNumber, total, message: 'Venta registrada con éxito.' });
          }
        );
      });
    });
  });
});

// ----------------------------------------------------
// PURCHASES ENDPOINTS (Restocking)
// ----------------------------------------------------
app.get('/api/purchases', authenticateToken, (req, res) => {
  db.all(`
    SELECT p.*, prov.name as provider_name
    FROM purchases p
    LEFT JOIN providers prov ON p.provider_id = prov.id
    ORDER BY p.date DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/purchases', authenticateToken, (req, res) => {
  if (req.user.role === 'readonly') return res.status(403).json({ error: 'Permiso denegado' });
  const { provider_id, items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'La compra debe contener al menos un producto.' });
  }

  db.get('SELECT COUNT(*) as count FROM purchases', [], (err, countRow) => {
    if (err) return res.status(500).json({ error: err.message });
    const orderNumber = `OC-${String(countRow.count + 1).padStart(4, '0')}`;

    let total = 0;
    items.forEach(item => {
      total += item.cost * item.quantity;
    });

    db.serialize(() => {
      db.run(
        `INSERT INTO purchases (order_number, provider_id, total, status) VALUES (?, ?, ?, 'Recibido')`,
        [orderNumber, provider_id, total],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          const purchaseId = this.lastID;

          const itemStmt = db.prepare(`INSERT INTO purchase_items (purchase_id, product_id, quantity, cost) VALUES (?, ?, ?, ?)`);
          const updateStockStmt = db.prepare(`UPDATE products SET stock = stock + ?, purchase_price = ?, status = 'Disponible' WHERE id = ?`);
          const invTransStmt = db.prepare(`INSERT INTO inventory_transactions (product_id, type, quantity, reason, user_id) VALUES (?, 'Entrada', ?, ?, ?)`);

          items.forEach(item => {
            itemStmt.run(purchaseId, item.product_id, item.quantity, item.cost);
            updateStockStmt.run(item.quantity, item.cost, item.product_id);
            invTransStmt.run(item.product_id, item.quantity, `Recepción Compra ${orderNumber}`, req.user.id);
          });

          itemStmt.finalize();
          updateStockStmt.finalize();
          invTransStmt.finalize();

          logAction(req.user.id, req.user.username, 'Crear Compra', `Compra registrada: ${orderNumber} por total: ${total}`);
          res.status(201).json({ id: purchaseId, orderNumber, total, message: 'Compra registrada e inventario actualizado.' });
        }
      );
    });
  });
});

// ----------------------------------------------------
// AUDIT LOGS ENDPOINT
// ----------------------------------------------------
app.get('/api/audit-logs', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Permiso denegado. Requiere administrador.' });
  db.all('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 200', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ----------------------------------------------------
// SYSTEM SETTINGS ENDPOINTS
// ----------------------------------------------------
app.get('/api/settings', authenticateToken, (req, res) => {
  db.all('SELECT * FROM settings', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.json(settings);
  });
});

app.post('/api/settings', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Permiso denegado.' });
  const settings = req.body;

  db.serialize(() => {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    Object.keys(settings).forEach(key => {
      stmt.run(key, String(settings[key]));
    });
    stmt.finalize();
    logAction(req.user.id, req.user.username, 'Configuración', 'Actualización de configuración general');
    res.json({ message: 'Configuración guardada con éxito' });
  });
});

// ----------------------------------------------------
// BACKUP AND RESTORE SIMULATION
// ----------------------------------------------------
app.post('/api/settings/backup', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Permiso denegado.' });

  try {
    const backupFile = path.join(__dirname, 'pijamas.db.backup');
    fs.copyFileSync(path.join(__dirname, 'pijamas.db'), backupFile);
    logAction(req.user.id, req.user.username, 'Backup de BD', 'Copia de seguridad del sistema realizada con éxito');
    res.json({ message: 'Respaldo de base de datos generado con éxito.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al generar la copia de seguridad: ' + err.message });
  }
});

app.post('/api/settings/restore', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Permiso denegado.' });

  try {
    const backupFile = path.join(__dirname, 'pijamas.db.backup');
    if (!fs.existsSync(backupFile)) {
      return res.status(400).json({ error: 'No se encontró ninguna copia de seguridad previa.' });
    }
    db.close((err) => {
      if (err) return res.status(500).json({ error: 'Error al cerrar base de datos: ' + err.message });

      fs.copyFileSync(backupFile, path.join(__dirname, 'pijamas.db'));
      // Reopen
      const sqlite3 = require('sqlite3').verbose();
      const dbPath = path.join(__dirname, 'pijamas.db');
      global.db = new sqlite3.Database(dbPath); // Re-set global db if needed or let process reload.
      res.json({ message: 'Base de datos restaurada con éxito. Por favor reinicie el servidor o recargue la página.' });
      process.exit(0); // Exit process, daemon or package.json restart script will restart it.
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al restaurar base de datos: ' + err.message });
  }
});

// ----------------------------------------------------
// REPORT / DASHBOARD ENDPOINTS
// ----------------------------------------------------
app.get('/api/reports/dashboard', authenticateToken, (req, res) => {
  // Return stats, stock metrics, recent transactions, sales graph data
  const responseData = {};

  db.serialize(() => {
    // 1. Total products
    db.get('SELECT COUNT(*) as count FROM products', [], (err, r) => {
      responseData.totalProducts = r.count;
    });

    // 2. Low stock products
    db.get('SELECT COUNT(*) as count FROM products WHERE stock <= min_stock AND stock > 0', [], (err, r) => {
      responseData.lowStockProducts = r.count;
    });

    // 3. Out of stock products
    db.get('SELECT COUNT(*) as count FROM products WHERE stock = 0', [], (err, r) => {
      responseData.outOfStockProducts = r.count;
    });

    // 4. Total sales and transactions summary
    db.get('SELECT SUM(total) as sum, COUNT(*) as count FROM sales', [], (err, r) => {
      responseData.totalSales = r.sum || 0;
      responseData.totalTransactions = r.count || 0;
      responseData.averageTicket = r.count > 0 ? (r.sum / r.count) : 0;
    });

    // 5. Total inventory valuation (based on purchase price * stock)
    db.get('SELECT SUM(purchase_price * stock) as sum FROM products', [], (err, r) => {
      responseData.inventoryValuation = r.sum || 0;
    });

    // 6. Most sold products
    db.all(`
      SELECT p.name, p.code, p.images, SUM(si.quantity) as sold_qty
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      GROUP BY si.product_id
      ORDER BY sold_qty DESC
      LIMIT 5
    `, [], (err, rows) => {
      responseData.topProducts = rows || [];
    });

    // 7. Recent low stock items list
    db.all(`
      SELECT name, code, stock, min_stock
      FROM products
      WHERE stock <= min_stock
      ORDER BY stock ASC
      LIMIT 5
    `, [], (err, rows) => {
      responseData.lowStockList = rows || [];
    });

    // 8. Sales monthly summary (group by month/day for graph)
    db.all(`
      SELECT strftime('%Y-%m-%d', date) as sale_day, SUM(total) as daily_total
      FROM sales
      GROUP BY sale_day
      ORDER BY sale_day ASC
      LIMIT 30
    `, [], (err, rows) => {
      responseData.salesGraphData = rows || [];
      // Send the final result when this query is finished as serialize runs sequentially
      res.json(responseData);
    });
  });
});

app.get('/api/reports/sales-summary', authenticateToken, (req, res) => {
  // Returns detailed sales report
  db.all(`
    SELECT s.invoice_number, s.date, s.total, s.tax, s.discount, s.payment_method,
           c.name as client_name, u.name as seller_name
    FROM sales s
    LEFT JOIN clients c ON s.client_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    ORDER BY s.date DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Start database check and listen
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to initialize database:', err);
});
