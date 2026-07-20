const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'pijamas.db');
const db = new sqlite3.Database(dbPath);

function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL, -- 'admin', 'employee', 'readonly'
          email TEXT,
          name TEXT
        )
      `);

      // 1b. Categories table
      db.run(`
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL
        )
      `);

      // 2. Products table
      db.run(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          category TEXT, -- name of the category
          brand TEXT,
          description TEXT,
          color TEXT,
          size TEXT, -- 'XS', 'S', 'M', 'L', 'XL', 'XXL', etc.
          material TEXT,
          purchase_price REAL,
          sale_price REAL,
          stock INTEGER DEFAULT 0,
          min_stock INTEGER DEFAULT 5,
          location TEXT,
          status TEXT DEFAULT 'Disponible', -- 'Disponible', 'Agotado', 'Descontinuado'
          barcode TEXT,
          images TEXT -- JSON string array or comma separated URLs
        )
      `);

      // 3. Clients table
      db.run(`
        CREATE TABLE IF NOT EXISTS clients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          address TEXT,
          balance REAL DEFAULT 0.0
        )
      `);

      // 4. Providers table
      db.run(`
        CREATE TABLE IF NOT EXISTS providers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          contact_name TEXT,
          phone TEXT,
          email TEXT,
          address TEXT
        )
      `);

      // 5. Inventory Transactions (Kardex)
      db.run(`
        CREATE TABLE IF NOT EXISTS inventory_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER,
          type TEXT NOT NULL, -- 'Entrada', 'Salida', 'Ajuste', 'Transferencia'
          quantity INTEGER NOT NULL,
          reason TEXT,
          date TEXT DEFAULT CURRENT_TIMESTAMP,
          user_id INTEGER,
          FOREIGN KEY(product_id) REFERENCES products(id)
        )
      `);

      // 6. Sales table
      db.run(`
        CREATE TABLE IF NOT EXISTS sales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice_number TEXT UNIQUE NOT NULL,
          client_id INTEGER,
          total REAL,
          tax REAL,
          discount REAL,
          date TEXT DEFAULT CURRENT_TIMESTAMP,
          user_id INTEGER,
          payment_method TEXT DEFAULT 'Efectivo',
          FOREIGN KEY(client_id) REFERENCES clients(id)
        )
      `);

      // 7. Sale Items
      db.run(`
        CREATE TABLE IF NOT EXISTS sale_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_id INTEGER,
          product_id INTEGER,
          quantity INTEGER,
          price REAL,
          FOREIGN KEY(sale_id) REFERENCES sales(id),
          FOREIGN KEY(product_id) REFERENCES products(id)
        )
      `);

      // 8. Purchases table (Orders to providers)
      db.run(`
        CREATE TABLE IF NOT EXISTS purchases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_number TEXT UNIQUE NOT NULL,
          provider_id INTEGER,
          total REAL,
          status TEXT DEFAULT 'Recibido', -- 'Pendiente', 'Recibido'
          date TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(provider_id) REFERENCES providers(id)
        )
      `);

      // 9. Purchase Items
      db.run(`
        CREATE TABLE IF NOT EXISTS purchase_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          purchase_id INTEGER,
          product_id INTEGER,
          quantity INTEGER,
          cost REAL,
          FOREIGN KEY(purchase_id) REFERENCES purchases(id),
          FOREIGN KEY(product_id) REFERENCES products(id)
        )
      `);

      // 10. Audit Logs
      db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          username TEXT,
          action TEXT NOT NULL,
          details TEXT,
          timestamp TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 11. Settings table
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT UNIQUE NOT NULL,
          value TEXT
        )
      `);

      // Add Seed Data
      // Users
      const salt = bcrypt.genSaltSync(10);
      const adminPass = bcrypt.hashSync('admin123', salt);
      const employeePass = bcrypt.hashSync('empleado123', salt);
      const readonlyPass = bcrypt.hashSync('lector123', salt);

      db.run(`INSERT OR IGNORE INTO users (id, username, password, role, email, name) VALUES 
        (1, 'admin', '${adminPass}', 'admin', 'admin@pijamas.com', 'Administrador Principal'),
        (2, 'empleado', '${employeePass}', 'employee', 'empleado@pijamas.com', 'Carlos Vendedor'),
        (3, 'lector', '${readonlyPass}', 'readonly', 'lector@pijamas.com', 'Auditor Invitado')
      `);

      // Settings
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES 
        ('company_name', 'KITTY PIJAMAS'),
        ('company_nit', '900.123.456-7'),
        ('company_phone', '+57 300 123 4567'),
        ('company_email', 'contacto@pijamassoftdream.com'),
        ('company_address', 'Calle 100 #15-30, Bogotá, Colombia'),
        ('currency', 'COP'),
        ('tax_rate', '19'),
        ('invoice_prefix', 'FE-'),
        ('invoice_start_number', '1001')
      `);

      // Categories Seed
      db.run(`INSERT OR IGNORE INTO categories (id, name) VALUES 
        (1, 'Pijama Dama'),
        (2, 'Pijama Hombre'),
        (3, 'Pijama Niño'),
        (4, 'Pijama Niña'),
        (5, 'Bebé'),
        (6, 'Babuchas')
      `);

      // Clients
      db.run(`INSERT OR IGNORE INTO clients (id, name, email, phone, address, balance) VALUES
        (1, 'Consumidor Final', 'consumidor@pijamas.com', '0000000000', 'Ciudad', 0.0),
        (2, 'Maria Alejandra Gomez', 'maria.gomez@gmail.com', '3124567890', 'Carrera 7 #45-12, Apto 402', 150000.0),
        (3, 'Juan Fernando Hoyos', 'juan.hoyos@outlook.com', '3209876543', 'Calle 53 #22-09', 0.0),
        (4, 'Sofia Restrepo', 'sofia.res@hotmail.com', '3157654321', 'Transversal 15 #98-44', 45000.0)
      `);

      // Providers
      db.run(`INSERT OR IGNORE INTO providers (id, name, contact_name, phone, email, address) VALUES
        (1, 'Textiles Algodón Suave Ltda', 'Andres Fonseca', '3102223344', 'contacto@algodonsuave.com', 'Zona Industrial Alamos, Bogota'),
        (2, 'Confecciones del Norte', 'Liliana Restrepo', '3114445566', 'liliana@confeccionesnorte.com', 'Medellin, Antioquia'),
        (3, 'Importadora Silk & Satin S.A.S.', 'Carlos Chen', '3159998877', 'ventas@silksatin.com', 'Zona Franca, Barranquilla')
      `);

      // Products
      db.run(`INSERT OR IGNORE INTO products (id, code, name, category, brand, description, color, size, material, purchase_price, sale_price, stock, min_stock, location, status, barcode, images) VALUES
        (1, 'PIJ-DAM-001', 'Pijama Satin Elegance Dama', 'Pijama Dama', 'Soft & Dream', 'Pijama de dos piezas tipo camisa y pantalón en satín premium.', 'Azul Marino', 'M', 'Satín / Poliéster', 45000.0, 95000.0, 15, 5, 'Estantería A-3', 'Disponible', '7701234567890', '["https://images.unsplash.com/photo-1598121610739-cfb860693562?auto=format&fit=crop&q=80&w=400"]'),
        (2, 'PIJ-DAM-002', 'Pijama Térmica Cozy Dama', 'Pijama Dama', 'Cozy Warm', 'Pijama abrigadora de micropolar, ideal para climas fríos.', 'Rosa Pastel', 'L', 'Micropolar', 50000.0, 110000.0, 2, 5, 'Estantería A-4', 'Disponible', '7701234567891', '["https://images.unsplash.com/photo-1562572159-4ebcd318f4dd?auto=format&fit=crop&q=80&w=400"]'),
        (3, 'PIJ-HOM-001', 'Pijama Algodón Classic Hombre', 'Pijama Hombre', 'Classic Men', 'Pijama clásica de pantalón y camiseta de manga larga, 100% algodón.', 'Gris Oxford', 'L', '100% Algodón', 48000.0, 98000.0, 20, 5, 'Estantería B-1', 'Disponible', '7701234567892', '["https://images.unsplash.com/photo-1608096293090-b552b5f91000?auto=format&fit=crop&q=80&w=400"]'),
        (4, 'PIJ-HOM-002', 'Pijama Short Sport Hombre', 'Pijama Hombre', 'Classic Men', 'Conjunto de camiseta manga corta y bermuda ligera.', 'Verde Militar', 'XL', 'Algodón / Poliéster', 35000.0, 75000.0, 0, 3, 'Estantería B-2', 'Agotado', '7701234567893', '["https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&q=80&w=400"]'),
        (5, 'PIJ-NIN-001', 'Pijama Dinosaurio Niños', 'Pijama Niño', 'Sweet Dreams Kids', 'Pijama infantil con estampado de dinosaurios que brillan en la oscuridad.', 'Azul Celeste', '8', 'Algodón Interlock', 25000.0, 55000.0, 8, 4, 'Estantería C-1', 'Disponible', '7701234567894', '["https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&q=80&w=400"]'),
        (6, 'PIJ-NNA-001', 'Pijama Unicornio Mágico Niñas', 'Pijama Niña', 'Sweet Dreams Kids', 'Pijama enteriza tipo mameluco de unicornio con capucha y detalles en relieve.', 'Multicolor', '10', 'Poliéster Soft', 38000.0, 85000.0, 4, 5, 'Estantería C-2', 'Disponible', '7701234567895', '["https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&q=80&w=400"]'),
        (7, 'PIJ-BEB-001', 'Mameluco Algodón Orgánico Bebé', 'Bebé', 'Baby Soft', 'Mameluco entero con cremallera frontal y protector de barbilla.', 'Amarillo', '12M', 'Algodón Orgánico', 20000.0, 45000.0, 30, 10, 'Estantería D-1', 'Disponible', '7701234567896', '["https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80&w=400"]'),
        (8, 'PIJ-DAM-003', 'Pijama Camisera Silk Dama', 'Pijama Dama', 'Soft & Dream', 'Camisola tipo vestido corto abotonado en seda sintética ultra suave.', 'Rojo Borgoña', 'S', 'Seda Sintética', 38000.0, 85000.0, 12, 5, 'Estantería A-1', 'Disponible', '7701234567897', '["https://images.unsplash.com/photo-1598121610739-cfb860693562?auto=format&fit=crop&q=80&w=400"]')
      `);

      // Transactions
      db.run(`INSERT OR IGNORE INTO inventory_transactions (id, product_id, type, quantity, reason, date, user_id) VALUES
        (1, 1, 'Entrada', 15, 'Inventario Inicial', '2026-07-10 10:00:00', 1),
        (2, 2, 'Entrada', 2, 'Inventario Inicial', '2026-07-10 10:15:00', 1),
        (3, 3, 'Entrada', 20, 'Inventario Inicial', '2026-07-10 10:30:00', 1),
        (4, 5, 'Entrada', 8, 'Inventario Inicial', '2026-07-10 10:45:00', 1),
        (5, 6, 'Entrada', 4, 'Inventario Inicial', '2026-07-10 11:00:00', 1),
        (6, 7, 'Entrada', 30, 'Inventario Inicial', '2026-07-10 11:15:00', 1),
        (7, 8, 'Entrada', 12, 'Inventario Inicial', '2026-07-10 11:30:00', 1)
      `);

      // Sales & Items (Seed some sales for Chart.js)
      db.run(`INSERT OR IGNORE INTO sales (id, invoice_number, client_id, total, tax, discount, date, user_id, payment_method) VALUES
        (1, 'FE-1001', 2, 226100.0, 36100.0, 0.0, '2026-07-15 15:30:00', 2, 'Tarjeta de Crédito'),
        (2, 'FE-1002', 1, 95000.0, 15168.0, 0.0, '2026-07-17 18:20:00', 2, 'Efectivo'),
        (3, 'FE-1003', 4, 140000.0, 22352.0, 10000.0, '2026-07-19 11:00:00', 2, 'Transferencia')
      `);

      db.run(`INSERT OR IGNORE INTO sale_items (id, sale_id, product_id, quantity, price) VALUES
        (1, 1, 1, 1, 95000.0),
        (2, 1, 2, 1, 110000.0),
        (3, 2, 1, 1, 95000.0),
        (4, 3, 5, 1, 55000.0),
        (5, 3, 8, 1, 85000.0)
      `);

      // Purchases & Items
      db.run(`INSERT OR IGNORE INTO purchases (id, order_number, provider_id, total, status, date) VALUES
        (1, 'OC-0001', 1, 750000.0, 'Recibido', '2026-07-12 09:00:00')
      `);
      db.run(`INSERT OR IGNORE INTO purchase_items (id, purchase_id, product_id, quantity, cost) VALUES
        (1, 1, 7, 30, 20000.0),
        (2, 1, 5, 6, 25000.0)
      `);

      // Audit Logs
      db.run(`INSERT OR IGNORE INTO audit_logs (id, user_id, username, action, details, timestamp) VALUES
        (1, 1, 'admin', 'Inicialización', 'Base de datos creada y configurada con datos semilla.', '2026-07-20 00:00:00')
      `);

      console.log('Database tables and seed data created successfully.');
      resolve();
    });
  });
}

module.exports = {
  db,
  initDb
};
