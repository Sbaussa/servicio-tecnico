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
  ALIGN_LEFT:   Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),
  BOLD_ON:      Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF:     Buffer.from([ESC, 0x45, 0x00]),
  TALL_ON:      Buffer.from([GS,  0x21, 0x01]),
  TALL_OFF:     Buffer.from([GS,  0x21, 0x00]),
  DOUBLE_ON:    Buffer.from([GS,  0x21, 0x11]),
  NORMAL:       Buffer.from([GS,  0x21, 0x00]),
  CUT:          Buffer.from([GS,  0x56, 0x41, 0x03]),
  FEED3:        Buffer.from([ESC, 0x64, 0x03]),
  FEED5:        Buffer.from([ESC, 0x64, 0x05]),
};

// FONT_A en 80mm = 48 chars por línea
var W = 48;

// ── Helpers ───────────────────────────────────────────────────────
function clean(str) {
  return String(str || '')
    .replace(/\u00e1/g, 'a').replace(/\u00e9/g, 'e')
    .replace(/\u00ed/g, 'i').replace(/\u00f3/g, 'o')
    .replace(/\u00fa/g, 'u').replace(/\u00c1/g, 'A')
    .replace(/\u00c9/g, 'E').replace(/\u00cd/g, 'I')
    .replace(/\u00d3/g, 'O').replace(/\u00da/g, 'U')
    .replace(/\u00f1/g, 'n').replace(/\u00d1/g, 'N')
    .replace(/\u00bf/g, '?').replace(/\u00a1/g, '!');
}

function txt(str) {
  return Buffer.from(clean(str) + '\n', 'binary');
}

function ln(char) {
  char = char || '-';
  return txt(char.repeat(W));
}

function cols(left, right) {
  var l = clean(String(left  || '')).slice(0, W - 2);
  var r = clean(String(right || ''));
  var spaces = W - l.length - r.length;
  return txt(l + (spaces > 0 ? ' '.repeat(spaces) : ' ') + r);
}

function field(label, value) {
  return cols(label, value);
}

function wrap(str) {
  var words  = clean(String(str || '')).split(' ');
  var line   = '';
  var result = [];
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    if ((line + ' ' + w).trim().length > W - 2) {
      if (line) result.push(txt(line.trim()));
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) result.push(txt(line.trim()));
  return result;
}

function fieldWrap(label, value) {
  var full = clean(label) + ' ' + clean(value);
  if (full.length <= W) return [txt(full)];
  return [txt(clean(label)), txt('  ' + clean(value))];
}

function formatCOP(n) {
  return '$ ' + new Intl.NumberFormat('es-CO').format(Number(n) || 0);
}

function formatDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
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
    var flat = buffers.reduce(function(a, b) { return a.concat(b); }, []);
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

  bufs.push([CMD.INIT, CMD.FONT_A, CMD.ALIGN_LEFT]);

  // Encabezado
  bufs.push([CMD.BOLD_ON, CMD.TALL_ON, txt('Electronica Bonilla'), CMD.TALL_OFF, CMD.BOLD_OFF]);
  bufs.push([txt('Barranquilla, Colombia')]);
  bufs.push([txt('Calle 76f #22D-38')]);
  bufs.push([txt('Tel: 322 5251842')]);
  bufs.push([txt('CC: 72289973')]);
  bufs.push([ln('=')]);

  // Titulo
  bufs.push([CMD.BOLD_ON, CMD.TALL_ON, txt('FACTURA DE VENTA'), CMD.TALL_OFF, CMD.BOLD_OFF]);
  bufs.push([CMD.BOLD_ON, txt(sale.invoice_number || ''), CMD.BOLD_OFF]);
  bufs.push([ln('-')]);

  // Info
  bufs.push([field('Fecha:', formatDate(sale.created_at))]);
  bufs.push([field('Vendedor:', clean(sale.user_name || ''))]);
  if (sale.client_name) {
    var clLines = fieldWrap('Cliente:', sale.client_name);
    for (var c = 0; c < clLines.length; c++) bufs.push([clLines[c]]);
  }
  if (sale.client_document) bufs.push([field('Doc:', sale.client_document)]);
  bufs.push([ln('-')]);

  // Productos
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

  // Totales
  bufs.push([ln('-')]);
  if ((sale.discount || 0) > 0) {
    bufs.push([cols('Subtotal:', formatCOP(sale.subtotal))]);
    bufs.push([cols('Descuento:', '- ' + formatCOP(sale.discount))]);
    bufs.push([ln('-')]);
  }
  bufs.push([ln('=')]);
  bufs.push([CMD.BOLD_ON, CMD.TALL_ON]);
  bufs.push([cols('TOTAL:', formatCOP(sale.total))]);
  bufs.push([CMD.TALL_OFF, CMD.BOLD_OFF]);
  bufs.push([ln('=')]);
  bufs.push([cols('Pago ' + clean((sale.payment_method || '').toUpperCase()) + ':', formatCOP(sale.payment_received))]);
  if ((sale.change_amount || 0) > 0) {
    bufs.push([CMD.BOLD_ON, cols('CAMBIO:', formatCOP(sale.change_amount)), CMD.BOLD_OFF]);
  }

  // Pie
  bufs.push([ln('-')]);
  bufs.push([CMD.BOLD_ON, CMD.TALL_ON, txt('Gracias por su compra!'), CMD.TALL_OFF, CMD.BOLD_OFF]);
  bufs.push([txt('Conserve este recibo')]);
  bufs.push([txt(' ')]);
  bufs.push([txt('Electronica Bonilla 2026')]);
  bufs.push([CMD.FEED5, CMD.CUT]);

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

  bufs.push([CMD.INIT, CMD.FONT_A, CMD.ALIGN_LEFT]);

  // Encabezado
  bufs.push([CMD.BOLD_ON, CMD.TALL_ON, txt('Electronica Bonilla'), CMD.TALL_OFF, CMD.BOLD_OFF]);
  bufs.push([txt('Barranquilla, Colombia')]);
  bufs.push([txt('Calle 76f #22D-38')]);
  bufs.push([txt('Tel: 322 5251842')]);
  bufs.push([txt('CC: 72289973')]);
  bufs.push([ln('=')]);

  // Titulo
  bufs.push([CMD.BOLD_ON, CMD.TALL_ON, txt('ORDEN DE REPARACION'), CMD.TALL_OFF, CMD.BOLD_OFF]);
  bufs.push([CMD.BOLD_ON, CMD.DOUBLE_ON, txt(r.ticket_number || ''), CMD.NORMAL, CMD.BOLD_OFF]);
  bufs.push([ln('-')]);

  // Estado
  var statusLabel = STATUS_LABELS[r.status] || (r.status || '').toUpperCase();
  bufs.push([CMD.BOLD_ON, CMD.TALL_ON, txt('** ' + statusLabel + ' **'), CMD.TALL_OFF, CMD.BOLD_OFF]);
  bufs.push([ln('=')]);

  // Cliente
  bufs.push([CMD.BOLD_ON, txt('CLIENTE:'), CMD.BOLD_OFF]);
  bufs.push([txt(r.client_name || 'Sin registrar')]);
  if (r.client_phone) bufs.push([txt('Tel: ' + r.client_phone)]);
  bufs.push([ln('-')]);

  // Equipo
  bufs.push([CMD.BOLD_ON, txt('EQUIPO:'), CMD.BOLD_OFF]);
  bufs.push([CMD.TALL_ON, CMD.BOLD_ON, txt(((r.device_brand || '') + ' ' + (r.device_model || '')).trim()), CMD.NORMAL, CMD.BOLD_OFF]);
  if (r.screen_size)   bufs.push([txt('Pantalla: ' + r.screen_size + ' pulgadas')]);
  if (r.device_serial) bufs.push([txt('Serial: '   + r.device_serial)]);
  bufs.push([ln('-')]);

  // Problema
  bufs.push([CMD.BOLD_ON, txt('PROBLEMA:'), CMD.BOLD_OFF]);
  var problemLines = wrap(r.problem_desc || '');
  for (var i = 0; i < problemLines.length; i++) bufs.push([problemLines[i]]);

  if (r.accessories) {
    bufs.push([CMD.BOLD_ON, txt('ACCESORIOS:'), CMD.BOLD_OFF]);
    var accLines = wrap(r.accessories);
    for (var i = 0; i < accLines.length; i++) bufs.push([accLines[i]]);
  }
  if (r.diagnosis) {
    bufs.push([ln('-'), CMD.BOLD_ON, txt('DIAGNOSTICO:'), CMD.BOLD_OFF]);
    var diagLines = wrap(r.diagnosis);
    for (var i = 0; i < diagLines.length; i++) bufs.push([diagLines[i]]);
  }
  if (r.work_done) {
    bufs.push([CMD.BOLD_ON, txt('TRABAJO REALIZADO:'), CMD.BOLD_OFF]);
    var workLines = wrap(r.work_done);
    for (var i = 0; i < workLines.length; i++) bufs.push([workLines[i]]);
  }

  // Fechas y tecnico
  bufs.push([ln('-')]);
  bufs.push([field('Recibido:', formatDate(r.received_at))]);
  if (r.estimated_date)  bufs.push([field('Entrega est.:', String(r.estimated_date).slice(0,10))]);
  if (r.technician_name) bufs.push([field('Tecnico:', r.technician_name)]);
  if (r.priority === 'urgente') {
    bufs.push([CMD.BOLD_ON, CMD.TALL_ON, txt('!! URGENTE !!'), CMD.TALL_OFF, CMD.BOLD_OFF]);
  }

  // Costos
  if ((r.total_cost || 0) > 0 || (r.labor_cost || 0) > 0) {
    bufs.push([ln('=')]);
    if ((r.labor_cost || 0) > 0) bufs.push([cols('Mano de obra:', formatCOP(r.labor_cost))]);
    if ((r.parts_cost || 0) > 0) bufs.push([cols('Repuestos:',    formatCOP(r.parts_cost))]);
    bufs.push([CMD.BOLD_ON, CMD.TALL_ON, cols('TOTAL:', formatCOP(r.total_cost)), CMD.TALL_OFF, CMD.BOLD_OFF]);
    if ((r.advance_payment || 0) > 0) {
      bufs.push([cols('Anticipo:', formatCOP(r.advance_payment))]);
      bufs.push([CMD.BOLD_ON, CMD.TALL_ON, cols('SALDO:', formatCOP((r.total_cost || 0) - (r.advance_payment || 0))), CMD.TALL_OFF, CMD.BOLD_OFF]);
    }
  }

  // Pie
  bufs.push([ln('=')]);
  bufs.push([txt('Consultas al:')]);
  bufs.push([CMD.BOLD_ON, CMD.TALL_ON, txt('322 5251842'), CMD.TALL_OFF, CMD.BOLD_OFF]);
  bufs.push([txt('Ticket: ' + (r.ticket_number || ''))]);
  bufs.push([txt(' ')]);
  bufs.push([txt('Electronica Bonilla 2026')]);
  bufs.push([CMD.FEED5, CMD.CUT]);

  printRaw(savedPrinter, bufs)
    .then(function()    { res.json({ ok: true }); })
    .catch(function(err){ res.status(500).json({ error: err.message }); });
});

module.exports = router;