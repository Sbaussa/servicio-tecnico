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
  // Doble alto (para totales grandes)
  TALL_ON:      Buffer.from([GS,  0x21, 0x01]),
  TALL_OFF:     Buffer.from([GS,  0x21, 0x00]),
  // Doble ancho + alto (para destacar más)
  BIG_ON:       Buffer.from([GS,  0x21, 0x11]),
  BIG_OFF:      Buffer.from([GS,  0x21, 0x00]),
  NORMAL:       Buffer.from([GS,  0x21, 0x00]),
  CUT:          Buffer.from([GS,  0x56, 0x41, 0x03]),
  FEED3:        Buffer.from([ESC, 0x64, 0x03]),
};

// 58mm con FONT_A ≈ 42 chars — mismo tamaño legible que 80mm con FONT_B

const W = 42;

function clean(str) {
  return String(str || '')
    .replace(/\u00e1/g,'a').replace(/\u00e9/g,'e')
    .replace(/\u00ed/g,'i').replace(/\u00f3/g,'o')
    .replace(/\u00fa/g,'u').replace(/\u00c1/g,'A')
    .replace(/\u00c9/g,'E').replace(/\u00cd/g,'I')
    .replace(/\u00d3/g,'O').replace(/\u00da/g,'U')
    .replace(/\u00f1/g,'n').replace(/\u00d1/g,'N')
    .replace(/\u00bf/g,'?').replace(/\u00a1/g,'!');
}

function txt(str) {
  return Buffer.from(clean(str) + '\n', 'binary');
}

function ln(char) {
  return txt((char || '-').repeat(W));
}

// Dos columnas ajustadas a W — label izq, valor der
function cols(left, right) {
  var l = clean(String(left  || '')).slice(0, W - 2);
  var r = clean(String(right || '')).slice(0, W - l.length - 1);
  var spaces = W - l.length - r.length;
  return txt(l + (spaces > 0 ? ' '.repeat(spaces) : ' ') + r);
}

// Label y valor centrados juntos como una línea
function centerPair(label, value) {
  var s = clean(String(label || '')) + ' ' + clean(String(value || ''));
  s = s.slice(0, W);
  var pad = Math.max(0, Math.floor((W - s.length) / 2));
  return txt(' '.repeat(pad) + s);
}

function center(str) {
  var s   = clean(String(str || '')).slice(0, W);
  var pad = Math.max(0, Math.floor((W - s.length) / 2));
  return txt(' '.repeat(pad) + s);
}

function wrap(str) {
  var words  = clean(String(str || '')).split(' ');
  var line   = '';
  var result = [];
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    if ((line + ' ' + word).trim().length > W) {
      if (line) result.push(txt(line.trim()));
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) result.push(txt(line.trim()));
  return result;
}

// Wrap centrado
function wrapCenter(str) {
  var words  = clean(String(str || '')).split(' ');
  var line   = '';
  var result = [];
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    if ((line + ' ' + word).trim().length > W) {
      if (line) result.push(center(line.trim()));
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) result.push(center(line.trim()));
  return result;
}

function formatCOP(n) {
  return '$' + new Intl.NumberFormat('es-CO').format(Number(n) || 0);
}

function formatDate(d) {
  if (!d) return '';
  try {
    var dt  = new Date(d);
    var dd  = String(dt.getDate()).padStart(2,'0');
    var mm  = String(dt.getMonth() + 1).padStart(2,'0');
    var yy  = dt.getFullYear();
    var hh  = String(dt.getHours()).padStart(2,'0');
    var min = String(dt.getMinutes()).padStart(2,'0');
    return dd + '/' + mm + '/' + yy + ' ' + hh + ':' + min;
  } catch(e) { return String(d); }
}

// ── PowerShell winspool ───────────────────────────────────────────
function buildPsScript(printerName, filePath) {
  var escaped = filePath.replace(/\\/g, '\\\\');
  return [
    '$printerName = "' + printerName + '"',
    '$filePath    = "' + escaped + '"',
    '$bytes       = [System.IO.File]::ReadAllBytes($filePath)',
    '$src = @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class RawPrint {',
    '  [DllImport("winspool.drv", CharSet=CharSet.Unicode)]',
    '  public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);',
    '  [DllImport("winspool.drv")]',
    '  public static extern bool ClosePrinter(IntPtr h);',
    '  [DllImport("winspool.drv", CharSet=CharSet.Unicode)]',
    '  public static extern bool StartDocPrinter(IntPtr h, int lvl, ref DOCINFO di);',
    '  [DllImport("winspool.drv")]',
    '  public static extern bool EndDocPrinter(IntPtr h);',
    '  [DllImport("winspool.drv")]',
    '  public static extern bool StartPagePrinter(IntPtr h);',
    '  [DllImport("winspool.drv")]',
    '  public static extern bool EndPagePrinter(IntPtr h);',
    '  [DllImport("winspool.drv")]',
    '  public static extern bool WritePrinter(IntPtr h, IntPtr buf, int len, out int written);',
    '  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]',
    '  public struct DOCINFO {',
    '    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;',
    '    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;',
    '    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;',
    '  }',
    '}',
    '"@',
    'Add-Type -TypeDefinition $src',
    '$h = [IntPtr]::Zero',
    '[RawPrint]::OpenPrinter($printerName, [ref]$h, [IntPtr]::Zero) | Out-Null',
    '$di = New-Object RawPrint+DOCINFO',
    '$di.pDocName    = "Ticket"',
    '$di.pDataType   = "RAW"',
    '$di.pOutputFile = $null',
    '[RawPrint]::StartDocPrinter($h, 1, [ref]$di) | Out-Null',
    '[RawPrint]::StartPagePrinter($h)              | Out-Null',
    '$ptr     = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)',
    '[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)',
    '$written = 0',
    '[RawPrint]::WritePrinter($h, $ptr, $bytes.Length, [ref]$written) | Out-Null',
    '[System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)',
    '[RawPrint]::EndPagePrinter($h)  | Out-Null',
    '[RawPrint]::EndDocPrinter($h)   | Out-Null',
    '[RawPrint]::ClosePrinter($h)    | Out-Null',
    'Write-Output "OK:$written"',
  ].join('\n');
}

function printRaw(printerName, buffers) {
  return new Promise(function(resolve, reject) {
    var flat    = buffers.reduce(function(a, b) { return a.concat(b); }, []);
    var receipt = Buffer.concat(flat);
    var tmpBin  = path.join(os.tmpdir(), 'ticket_' + Date.now() + '.bin');
    var tmpPs   = path.join(os.tmpdir(), 'print_'  + Date.now() + '.ps1');
    fs.writeFileSync(tmpBin, receipt);
    fs.writeFileSync(tmpPs, buildPsScript(printerName, tmpBin), 'utf8');
    exec(
      'powershell -NoProfile -ExecutionPolicy Bypass -File "' + tmpPs + '"',
      function(err, stdout, stderr) {
        try { fs.unlinkSync(tmpBin); } catch(e) {}
        try { fs.unlinkSync(tmpPs);  } catch(e) {}
        if (err) return reject(new Error(stderr || err.message));
        resolve(stdout.trim());
      }
    );
  });
}

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

  bufs.push([CMD.INIT, CMD.FONT_A, CMD.ALIGN_CENTER]);

  // ── Encabezado centrado ──
  bufs.push([CMD.BOLD_ON, center('Electronica Bonilla'), CMD.BOLD_OFF]);
  bufs.push([center('Barranquilla, Colombia')]);
  bufs.push([center('Calle 76f #22D-38')]);
  bufs.push([center('Tel: 322 5251842')]);
  bufs.push([center('CC: 72289973')]);
  bufs.push([ln('=')]);

  // ── Título centrado ──
  bufs.push([CMD.BOLD_ON, center('FACTURA DE VENTA'), CMD.BOLD_OFF]);
  bufs.push([CMD.BOLD_ON, center(sale.invoice_number || ''), CMD.BOLD_OFF]);
  bufs.push([ln('-')]);

  // ── Info: pares centrados ──
  bufs.push([CMD.ALIGN_CENTER]);
  bufs.push([centerPair('Fecha:', formatDate(sale.created_at))]);
  bufs.push([centerPair('Vendedor:', clean(sale.user_name || ''))]);
  if (sale.client_name) {
    var clLines = wrapCenter('Cliente: ' + sale.client_name);
    for (var c = 0; c < clLines.length; c++) bufs.push([clLines[c]]);
  }
  if (sale.client_document) bufs.push([centerPair('Doc:', sale.client_document)]);
  bufs.push([ln('-')]);

  // ── Items ──
  bufs.push([CMD.ALIGN_LEFT]);
  bufs.push([CMD.BOLD_ON, txt('PRODUCTOS:'), CMD.BOLD_OFF]);
  bufs.push([ln('-')]);

  var items = sale.items || [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var nameLines = wrap(item.product_name);
    bufs.push([CMD.BOLD_ON]);
    for (var j = 0; j < nameLines.length; j++) bufs.push([nameLines[j]]);
    bufs.push([CMD.BOLD_OFF]);
    // cantidad x precio = subtotal — centrado para que se lea bien
    var det = item.quantity + 'x ' + formatCOP(item.unit_price) + ' = ' + formatCOP(item.subtotal);
    bufs.push([center(det)]);
    if (item.product_code) bufs.push([center('Cod: ' + item.product_code)]);
  }

  // ── Totales ──
  bufs.push([CMD.ALIGN_LEFT]);
  bufs.push([ln('-')]);
  if ((sale.discount || 0) > 0) {
    bufs.push([cols('Subtotal:', formatCOP(sale.subtotal))]);
    bufs.push([cols('Descuento:', '- ' + formatCOP(sale.discount))]);
    bufs.push([ln('-')]);
  }
  bufs.push([ln('=')]);

  // TOTAL en doble alto + negrita para que se vea grande
  bufs.push([CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.TALL_ON]);
  bufs.push([center('TOTAL: ' + formatCOP(sale.total))]);
  bufs.push([CMD.TALL_OFF, CMD.BOLD_OFF]);

  bufs.push([ln('='), CMD.ALIGN_LEFT]);

  // Método de pago y cambio
  bufs.push([cols('Pago ' + clean((sale.payment_method || '').toUpperCase()) + ':', formatCOP(sale.payment_received))]);
  if ((sale.change_amount || 0) > 0) {
    bufs.push([CMD.BOLD_ON, cols('CAMBIO:', formatCOP(sale.change_amount)), CMD.BOLD_OFF]);
  }

  // ── Pie centrado ──
  bufs.push([ln('-'), CMD.ALIGN_CENTER]);
  bufs.push([CMD.BOLD_ON, center('Gracias por su compra!'), CMD.BOLD_OFF]);
  bufs.push([center('Conserve este recibo')]);
  bufs.push([txt(' ')]);
  bufs.push([center('Electronica Bonilla 2026')]);
  bufs.push([CMD.FEED3, CMD.CUT]);

  printRaw(savedPrinter, bufs)
    .then(function()    { res.json({ ok: true }); })
    .catch(function(err){ res.status(500).json({ error: err.message }); });
});

// ── Imprimir reparacion ───────────────────────────────────────────
var STATUS_LABELS = {
  recibido:           'RECIBIDO EN TALLER',
  diagnostico:        'EN DIAGNOSTICO',
  en_reparacion:      'EN REPARACION',
  esperando_repuesto: 'ESP. REPUESTO',
  listo:              'LISTO P/ENTREGAR',
  entregado:          'ENTREGADO',
  no_repara:          'NO REPARA',
  garantia:           'EN GARANTIA',
};

router.post('/repair', auth, function(req, res) {
  var r    = req.body;
  var bufs = [];

  bufs.push([CMD.INIT, CMD.FONT_A, CMD.ALIGN_CENTER]);

  // ── Encabezado centrado ──
  bufs.push([CMD.BOLD_ON, center('Electronica Bonilla'), CMD.BOLD_OFF]);
  bufs.push([center('Barranquilla, Colombia')]);
  bufs.push([center('Calle 76f #22D-38')]);
  bufs.push([center('Tel: 322 5251842')]);
  bufs.push([center('NIT: 72289973')]);
  bufs.push([ln('=')]);

  // ── Título centrado ──
  bufs.push([CMD.BOLD_ON, center('ORDEN DE REPARACION'), CMD.BOLD_OFF]);
  bufs.push([CMD.BOLD_ON, center(r.ticket_number || ''), CMD.BOLD_OFF]);
  bufs.push([ln('-')]);

  // Estado centrado y destacado
  var statusLabel = STATUS_LABELS[r.status] || (r.status || '').toUpperCase();
  bufs.push([CMD.BOLD_ON, CMD.TALL_ON, center(statusLabel), CMD.TALL_OFF, CMD.BOLD_OFF]);
  bufs.push([ln('-')]);

  // ── Cliente centrado ──
  bufs.push([CMD.BOLD_ON, center('-- CLIENTE --'), CMD.BOLD_OFF]);
  var clNameLines = wrapCenter(r.client_name || 'Sin registrar');
  for (var c = 0; c < clNameLines.length; c++) bufs.push([clNameLines[c]]);
  if (r.client_phone) bufs.push([centerPair('Tel:', r.client_phone)]);
  bufs.push([ln('-')]);

  // ── Equipo centrado ──
  bufs.push([CMD.BOLD_ON, center('-- EQUIPO --'), CMD.BOLD_OFF]);
  var deviceName  = ((r.device_brand || '') + ' ' + (r.device_model || '')).trim();
  var deviceLines = wrapCenter(deviceName);
  bufs.push([CMD.BOLD_ON]);
  for (var i = 0; i < deviceLines.length; i++) bufs.push([deviceLines[i]]);
  bufs.push([CMD.BOLD_OFF]);
  if (r.screen_size)   bufs.push([centerPair('Pantalla:', r.screen_size + '"')]);
  if (r.device_serial) bufs.push([centerPair('Serial:', r.device_serial)]);
  bufs.push([ln('-')]);

  // ── Problema ──
  bufs.push([CMD.BOLD_ON, center('PROBLEMA:'), CMD.BOLD_OFF]);
  var problemLines = wrapCenter(r.problem_desc || '');
  for (var i = 0; i < problemLines.length; i++) bufs.push([problemLines[i]]);

  // Accesorios
  if (r.accessories) {
    bufs.push([CMD.BOLD_ON, center('ACCESORIOS:'), CMD.BOLD_OFF]);
    var accLines = wrapCenter(r.accessories);
    for (var i = 0; i < accLines.length; i++) bufs.push([accLines[i]]);
  }

  // Diagnóstico
  if (r.diagnosis) {
    bufs.push([ln('-'), CMD.BOLD_ON, center('DIAGNOSTICO:'), CMD.BOLD_OFF]);
    var diagLines = wrapCenter(r.diagnosis);
    for (var i = 0; i < diagLines.length; i++) bufs.push([diagLines[i]]);
  }

  // Trabajo
  if (r.work_done) {
    bufs.push([CMD.BOLD_ON, center('TRABAJO REALIZADO:'), CMD.BOLD_OFF]);
    var workLines = wrapCenter(r.work_done);
    for (var i = 0; i < workLines.length; i++) bufs.push([workLines[i]]);
  }

  // Fechas / técnico centrados
  bufs.push([ln('-')]);
  bufs.push([centerPair('Recibido:', formatDate(r.received_at))]);
  if (r.estimated_date)  bufs.push([centerPair('Entrega:', String(r.estimated_date).slice(0,10))]);
  if (r.technician_name) bufs.push([centerPair('Tecnico:', r.technician_name)]);

  // Urgente
  if (r.priority === 'urgente') {
    bufs.push([ln('*')]);
    bufs.push([CMD.BOLD_ON, CMD.TALL_ON, center('!! URGENTE !!'), CMD.TALL_OFF, CMD.BOLD_OFF]);
    bufs.push([ln('*')]);
  }

  // ── Costos ──
  if ((r.total_cost || 0) > 0 || (r.labor_cost || 0) > 0) {
    bufs.push([ln('=')]);
    bufs.push([CMD.ALIGN_LEFT]);
    if ((r.labor_cost || 0) > 0) bufs.push([cols('M. obra:', formatCOP(r.labor_cost))]);
    if ((r.parts_cost || 0) > 0) bufs.push([cols('Repuestos:', formatCOP(r.parts_cost))]);
    bufs.push([ln('-')]);

    // TOTAL grande centrado
    bufs.push([CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.TALL_ON]);
    bufs.push([center('TOTAL: ' + formatCOP(r.total_cost))]);
    bufs.push([CMD.TALL_OFF, CMD.BOLD_OFF]);
    bufs.push([ln('='), CMD.ALIGN_LEFT]);

    if ((r.advance_payment || 0) > 0) {
      bufs.push([cols('Anticipo:', formatCOP(r.advance_payment))]);
      var saldo = (r.total_cost || 0) - (r.advance_payment || 0);
      bufs.push([CMD.BOLD_ON, cols('SALDO:', formatCOP(saldo)), CMD.BOLD_OFF]);
    }
  }

  // ── Pie centrado ──
  bufs.push([ln('='), CMD.ALIGN_CENTER]);
  bufs.push([center('Consultas: 322 5251842')]);
  bufs.push([CMD.BOLD_ON, center('Ticket: ' + (r.ticket_number || '')), CMD.BOLD_OFF]);
  bufs.push([txt(' ')]);
  bufs.push([CMD.BOLD_ON, center('Gracias por confiar en nosotros!'), CMD.BOLD_OFF]);
  bufs.push([txt(' ')]);
  bufs.push([center('Electronica Bonilla 2026')]);
  bufs.push([CMD.FEED3, CMD.CUT]);

  printRaw(savedPrinter, bufs)
    .then(function()    { res.json({ ok: true }); })
    .catch(function(err){ res.status(500).json({ error: err.message }); });
});

module.exports = router;