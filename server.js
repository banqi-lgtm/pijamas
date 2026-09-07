const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  // Normalize and decode URL
  let parsedUrl = '/';
  try {
    parsedUrl = decodeURIComponent(req.url.split('?')[0]);
  } catch (e) {
    parsedUrl = req.url.split('?')[0];
  }

  // Dynamic API for Equipos Gallery
  if (parsedUrl === '/api/equipos' || parsedUrl === '/api/gallery') {
    const galleryDir = path.join(PUBLIC_DIR, 'f.galeria');
    fs.readdir(galleryDir, (err, files) => {
      if (err) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify([]));
      }
      const images = files.filter(f => /\.(jpe?g|png|webp|gif)$/i.test(f));
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=UTF-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });
      res.end(JSON.stringify(images));
    });
    return;
  }

  // Dynamic API for Stock Consultation (Consulta de Stock de Componentes)
  if (req.method === 'POST' && (parsedUrl === '/api/consultar-stock' || parsedUrl === '/api/stock')) {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) req.destroy(); // Limit payload to 1MB
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        const storeFile = path.join(dataDir, 'solicitudes_stock.json');
        let records = [];
        if (fs.existsSync(storeFile)) {
          try {
            records = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
          } catch (e) {
            records = [];
          }
        }
        const record = {
          id: 'STK-' + Date.now(),
          nombre: payload.nombre || '',
          correo: payload.correo || '',
          telefono: payload.telefono || '',
          referencia: payload.referencia || '',
          cantidad: parseInt(payload.cantidad, 10) || 1,
          fecha: payload.fecha || new Date().toISOString()
        };
        records.push(record);
        fs.writeFileSync(storeFile, JSON.stringify(records, null, 2), 'utf8');

        console.log('📩 [NUEVA CONSULTA DE STOCK]:', record);

        /*
         * =========================================================================
         * TODO: Configuración de envío de correo (Nodemailer / SendGrid / SMTP):
         * 1. Enviar correo de confirmación al cliente: payload.correo
         * 2. Enviar correo de notificación a ALFA: co@alfa-electronic.co
         * =========================================================================
         */

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=UTF-8',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          success: true,
          message: 'Solicitud de stock registrada correctamente',
          id: record.id
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, error: 'Datos JSON no válidos' }));
      }
    });
    return;
  }

  if (parsedUrl === '/') {
    parsedUrl = '/index.html';
  }

  // Safe file path resolution
  const safePath = path.normalize(parsedUrl).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routes
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Check Gzip support
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const shouldGzip = /\bgzip\b/.test(acceptEncoding) && /text|javascript|json|svg/.test(contentType);

    const headers = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': (ext === '.html' || ext === '.js') ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600'
    };

    if (shouldGzip) {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      const rawStream = fs.createReadStream(filePath);
      const gzip = zlib.createGzip();
      rawStream.pipe(gzip).pipe(res);
    } else {
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

server.listen(PORT, () => {
  console.log('====================================================');
  console.log('⚡ ALFA ELECTRONIC COLOMBIA SAS - SERVIDOR LOCAL');
  console.log('====================================================');
  console.log(`🌐 Local:   http://localhost:${PORT}`);
  console.log(`📂 Carpeta: ${PUBLIC_DIR}`);
  console.log('====================================================');
});
