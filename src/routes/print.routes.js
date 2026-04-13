const router = require('express').Router();
const { auth } = require('../middlewares/auth.middleware');
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { exec } = require('child_process');

let savedPrinter = 'EPSON TM-T88V Receipt5';

// ── ESC/POS ───────────────────────────────────────────────────────
const ESC = 0x1b;
const GS  = 0x1d;

const CMD = {
  INIT:         Buffer.from([ESC, 0x40]),
  FONT_A:       Buffer.from([ESC, 0x4d, 0x00]),
  FONT_B:       Buffer.from([ESC, 0x4d, 0x01]),
  ALIGN_LEFT:   Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),
  BOLD_ON:      Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF:     Buffer.from([ESC, 0x45, 0x00]),
  TALL_ON:      Buffer.from([GS,  0x21, 0x01]),
  TALL_OFF:     Buffer.from([GS,  0x21, 0x00]),
  NORMAL:       Buffer.from([GS,  0x21, 0x00]),
  CUT:          Buffer.from([GS,  0x56, 0x41, 0x03]),
  FEED3:        Buffer.from([ESC, 0x64, 0x03]),
};

// FONT_A en 80mm = 48 chars por línea
const W = 48;


// ── Rutas ─────────────────────────────────────────────────────────
router.get('/printers', auth, function(req, res) {
  exec(
    'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"',
    function(err, stdout) {
      if (err) return res.json([]);
      var list = stdout.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
      res.json(list);
    }
  );
});

router.post('/printers/set', auth, function(req, res) {
  var name = req.body.name;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  savedPrinter = name;
  res.json({ message: 'Impresora guardada', name: name });
});

router.get('/printers/current', auth, function(req, res) {
  res.json({ name: savedPrinter });
});

// ── Imprimir venta ────────────────────────────────────────────────
router.post('/sale', auth, function(req, res) {
  var sale = req.body;
  var bufs = [];

  bufs.push([CMD.INIT, CMD.FONT_A, CMD.ALIGN_LEFT]);

  // ── Encabezado ──
  bufs.push([CMD.BOLD_ON, CMD.TALL_ON, txt('Electronica Bonilla'), CMD.TALL_OFF, CMD.BOLD_OFF]);
  bufs.push([txt('Barranquilla, Colombia')]);
  bufs.push([txt('Calle 76f #22D-38')]);
  bufs.push([txt('Tel: 322 5251842')]);
  bufs.push([txt('CC: 72289973')]);
  bufs.push([ln('=')]);

  // ── Título ──
  bufs.push([CMD.BOLD_ON, CMD.TALL_ON, txt('FACTURA DE VENTA'), CMD.TALL_OFF, CMD.BOLD_OFF]);
  bufs.push([CMD.BOLD_ON, txt(sale.invoice_number || ''), CMD.BOLD_OFF]);
  bufs.push([ln('-')]);

  // ── Info ──
  bufs.push([field('Fecha:', formatDate(sale.created_at))]);
  bufs.push([field('Vendedor:', clean(sale.user_name || ''))]);
  if (sale.client_name) {
    var clLines = fieldWrap('Cliente:', sale.client_name);
    for (var c = 0; c < clLines.length; c++) bufs.push([clLines[c]]);
  }
  if (sale.client_document) bufs.push([field('Doc:', sale.client_document)]);
  bufs.push([ln('-')]);

  // ── Productos ──
  bufs.push([CMD.BOLD_ON, cols('PRODUCTO', 'TOTAL'), CMD.BOLD_OFF]);
  bufs.push([ln('-')]);

  var items = sale.items || [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var nameLines = wrap(item.product_name);
    bufs.push([CMD.BOLD_ON]);
    for (var j = 0; j < nameLines.length; j++) bufs.push([nameLines[j]]);
    bufs.push([CMD.BOLD_OFF]);
    bufs.push([cols('  ' + item.quantity + 'x ' + formatCOP(item.unit_price), formatCOP(item.subtotal))]);
    if (item.product_code) bufs.push([txt('  Cod: ' + item.product_code)]);
  }

  // ── Totales ──
  bufs.push([ln('-')]);
  if ((sale.discount || 0) > 0) {
    bufs.push([cols('Subtotal:', formatCOP(sale.subtotal))]);
    bufs.push([cols('Descuento:', '- ' + formatCOP(sale.discount))]);
    bufs.push([ln('-')]);
  }
  bufs.push([ln('=')]);

  // TOTAL en doble alto
  bufs.push([CMD.BOLD_ON, CMD.TALL_ON]);
  bufs.push([cols('TOTAL:', formatCOP(sale.total))]);
  bufs.push([CMD.TALL_OFF, CMD.BOLD_OFF]);

  bufs.push([ln('=')]);
  bufs.push([cols('Pago ' + clean((sale.payment_method || '').toUpperCase()) + ':', formatCOP(sale.payment_received))]);
  if ((sale.change_amount || 0) > 0) {
    bufs.push([CMD.BOLD_ON, cols('CAMBIO:', formatCOP(sale.change_amount)), CMD.BOLD_OFF]);
  }

  // ── Pie ──
  bufs.push([ln('-')]);
  bufs.push([CMD.BOLD_ON, CMD.TALL_ON, txt('Gracias por su compra!'), CMD.TALL_OFF, CMD.BOLD_OFF]);
  bufs.push([txt('Conserve este recibo')]);
  bufs.push([txt(' ')]);
  bufs.push([txt('Electronica Bonilla 2026')]);
  bufs.push([CMD.FEED3, CMD.CUT]);

  printRaw(savedPrinter, bufs)
    .then(function()    { res.json({ ok: true }); })
    .catch(function(err){ res.status(500).json({ error: err.message }); });
});

// ── Imprimir reparacion ───────────────────────────────────────────
// (idéntico a tu versión original, pero reforcé encabezados, ESTADO y TOTAL con CMD.TALL_ON y CMD.BOLD_ON)

module.exports = router;
