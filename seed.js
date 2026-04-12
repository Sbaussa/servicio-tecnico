require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Ejecutando seed...');

  // ── Categorías ──────────────────────────────────────────────────
  const categories = [
    { name: 'Tarjetas Principales', description: 'Main boards, power boards, T-con boards' },
    { name: 'Pantallas y Displays', description: 'Paneles LED, LCD, OLED' },
    { name: 'Fuentes de Poder', description: 'Power supply boards' },
    { name: 'Backlights y Lámparas', description: 'Tiras LED, inversores, lámparas CCFL' },
    { name: 'Controles y Botones', description: 'Controles remotos, botones de panel' },
    { name: 'Cables y Conectores', description: 'LVDS, cables flex, conectores' },
    { name: 'Condensadores y Componentes', description: 'Electrolíticos, MOSFETs, reguladores' },
    { name: 'Bocinas y Audio', description: 'Parlantes, módulos de audio' },
    { name: 'Soportes y Estructuras', description: 'Pedestales, tapas, marcos' },
    { name: 'Servicios', description: 'Mano de obra y servicios técnicos' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log('✅ 10 categorías creadas');

  // ── Proveedores ─────────────────────────────────────────────────
  const suppliers = [
    { name: 'Proveedor LG', contactName: 'Contacto LG', phone: '+57 300 0000001' },
    { name: 'Proveedor Samsung', contactName: 'Contacto Samsung', phone: '+57 300 0000002' },
    { name: 'Proveedor Panasonic', contactName: 'Contacto Panasonic', phone: '+57 300 0000003' },
    { name: 'Proveedor Genérico', contactName: 'Contacto Genérico', phone: '+57 300 0000004' },
    { name: 'Proveedor Sony', contactName: 'Contacto Sony', phone: '+57 300 0000005' },
  ];

  const supplierMap = {};
  for (const sup of suppliers) {
    const s = await prisma.supplier.upsert({
      where: { id: suppliers.indexOf(sup) + 1 },
      update: {},
      create: sup,
    });
    supplierMap[sup.name] = s.id;
  }
  console.log('✅ 5 proveedores creados');

  // ── Usuario admin ───────────────────────────────────────────────
  const hashedPwd = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { name: 'Administrador', username: 'admin', password: hashedPwd, role: 'ADMIN' },
  });

  // ── Técnico de ejemplo ──────────────────────────────────────────
  const techPwd = await bcrypt.hash('tecnico123', 10);
  await prisma.user.upsert({
    where: { username: 'tecnico' },
    update: {},
    create: { name: 'Técnico Junior', username: 'tecnico', password: techPwd, role: 'TECNICO' },
  });

  // ── Vendedor de ejemplo ─────────────────────────────────────────
  const vendPwd = await bcrypt.hash('vendedor123', 10);
  await prisma.user.upsert({
    where: { username: 'vendedor' },
    update: {},
    create: { name: 'Vendedor POS', username: 'vendedor', password: vendPwd, role: 'VENDEDOR' },
  });
  console.log('✅ 3 usuarios creados (admin / tecnico / vendedor)');

  // ── Cliente mostrador ───────────────────────────────────────────
  await prisma.client.upsert({
    where: { document: '0000000000' },
    update: {},
    create: { name: 'Cliente Mostrador', document: '0000000000', phone: '0000000000', email: 'mostrador@tienda.com' },
  });
  console.log('✅ Cliente mostrador creado');

  // ── Categoría por defecto para backlights ───────────────────────
  const catBacklights = await prisma.category.findFirst({ where: { name: 'Backlights y Lámparas' } });
  const catId = catBacklights?.id || 4;

  // ── Mapeo de marca → proveedor ──────────────────────────────────
  const brandSupplier = {
    'LG': supplierMap['Proveedor LG'],
    'SAMSUNG': supplierMap['Proveedor Samsung'],
    'PANASONIC': supplierMap['Proveedor Panasonic'],
    'GENERICO': supplierMap['Proveedor Genérico'],
    'SONY': supplierMap['Proveedor Sony'],
  };

  // ── INVENTARIO — 224 productos del Excel DATBASETVS.xlsx ────────
  const products = [
    { code: 'BA004', name: '32LB551A,LB561D,LB580D,LF550D,LF565D,LF585D,LF595D,LX330C,LB560B,LY560H,LY570H,LY340C', brand: 'LG', stock: 66, purchasePrice: 24200.0, salePrice: 50000.0, specs: '3R,6LED,6VOL,LC' },
    { code: 'BA002', name: '32LA613,32LB530D,LN5200B,LN5100,LN5400,LN5700', brand: 'LG', stock: 5, purchasePrice: 24200.0, salePrice: 50000.0, specs: '3R,7LED,3VOL,LR' },
    { code: 'BA003', name: '32LN540,LN570,LN5100', brand: 'LG', stock: 5, purchasePrice: 18000.0, salePrice: 50000.0, specs: '3R, 2R6,1R7,3VOL,LC' },
    { code: 'BA005', name: '32LH573D,LH570D,LH510D,LF510D', brand: 'LG', stock: 4, purchasePrice: 14048.0, salePrice: 50000.0, specs: '2R,5LED,3VOL,LR' },
    { code: 'BA411', name: '32 LM 6300', brand: 'LG', stock: 1, purchasePrice: 35019.0, salePrice: 70000.0, specs: '2R,8LED,3VOL,LR' },
    { code: 'BA007', name: '32 LM 3400-32 LS 3400,32LD340', brand: 'LG', stock: 4, purchasePrice: 25000.0, salePrice: 60000.0, specs: '4R,9LED,3VOL,LR' },
    { code: 'BA009', name: '32 LK 540 BPDA', brand: 'LG', stock: 3, purchasePrice: 45815.0, salePrice: 80000.0, specs: '3R,1OLED,3VOL,LR' },
    { code: 'BA008', name: '32LS3450,LS341C', brand: 'LG', stock: 0, purchasePrice: 25000.0, salePrice: 50000.0, specs: '4R,7LED' },
    { code: 'BA133', name: '32LJ550D,32LJ501D,32LJ500D,32LB-PF3030', brand: 'LG', stock: 8, purchasePrice: 21100.0, salePrice: 70000.0, specs: '3R,7LED VOL,LR' },
    { code: 'BA010', name: '39 LB 650', brand: 'LG', stock: 3, purchasePrice: 79978.0, salePrice: 110000.0, specs: '8R,4LED,6VOL,LR' },
    { code: 'BA011', name: '39LN5300,LN5400,LN5700,LA6200,LP645H', brand: 'LG', stock: 9, purchasePrice: 38000.0, salePrice: 80000.0, specs: '8R,9LED,3VOL,LR' },
    { code: 'BA012', name: '40LF635,LX340H,LX560H,LX570H,LX770H,LX774H', brand: 'LG', stock: 0, purchasePrice: 83300.0, salePrice: 110000.0, specs: '8R' },
    { code: 'BA014', name: '42LB550T,LB580,LB620T,LB650T,LF585T,LF640T,LY340C,LY540S', brand: 'LG', stock: 32, purchasePrice: 42000.0, salePrice: 80000.0, specs: '8R,8LED,6VOL,LR' },
    { code: 'BA016', name: '42 LM 3400,LS 3400', brand: 'LG', stock: 0, purchasePrice: 51646.0, salePrice: 110000.0, specs: '8 R' },
    { code: 'BA020', name: '42 LN 5400,     LUPA CUADRADA', brand: 'LG', stock: 3, purchasePrice: 68600.0, salePrice: 110000.0, specs: '10R,5LED,3VOL,LR' },
    { code: 'BA018', name: '42 LN 5200', brand: 'LG', stock: 4, purchasePrice: 39984.0, salePrice: 80000.0, specs: '10R,10LED,3VOL,LR' },
    { code: 'BA019', name: '42LN5390,LN5700,LA6130 LA6200,LA620T,42 LN 549 E, 42 LN541 C,', brand: 'LG', stock: 6, purchasePrice: 40000.0, salePrice: 80000.0, specs: '10R,5LED' },
    { code: 'BA022', name: '42LS3450,LS341C,LUPA REDONDA', brand: 'LG', stock: 0, purchasePrice: 86000.0, salePrice: 120000.0, specs: '10R' },
    { code: 'BA022-V2', name: '42LS3450,42LS341C     LUPA CUADRADA', brand: 'LG', stock: 3, purchasePrice: 55000.0, salePrice: 110000.0, specs: '10R,6LED' },
    { code: 'BA027', name: '43UH610,UF640,UH603T', brand: 'LG', stock: 6, purchasePrice: 28000.0, salePrice: 70000.0, specs: '3 RE' },
    { code: 'BA025', name: 'ED BAR FOR TV MODEL LG ORIGINAL 43LJ550T, 43LK5700PDC, 43UK6300PDB, 43UK6200PDA, 43UJ635T, 43UK631C, 43UU670H, 43LJ550', brand: 'LG', stock: 11, purchasePrice: 28100.0, salePrice: 70000.0, specs: '' },
    { code: 'BA029', name: '43LH600T,43LW340C,43LW540S,43LW560H', brand: 'LG', stock: 4, purchasePrice: 37485.0, salePrice: 90000.0, specs: '6R,4LED' },
    { code: 'BA343', name: '43 LH573T,LH57T,LH50T    VERSION 2', brand: 'LG', stock: 0, purchasePrice: 44900.0, salePrice: 80000.0, specs: '3R' },
    { code: 'BA030', name: '43LH570T,LH573T,LH510T,LF510T,  VERSION 1', brand: 'LG', stock: 0, purchasePrice: 24990.0, salePrice: 60000.0, specs: '3R' },
    { code: 'BA026', name: '43 UJ 620,43UJ6200', brand: 'LG', stock: 3, purchasePrice: 34153.0, salePrice: 70000.0, specs: '8R,5LED' },
    { code: 'BA255', name: '43UM7300PDA,43UM731CODA,43UM7360PSA,43UN7300PDC', brand: 'LG', stock: 4, purchasePrice: 34986.0, salePrice: 70000.0, specs: '3R' },
    { code: 'BA159', name: '43 LM 6300PDB,43LM6370PDB', brand: 'LG', stock: 6, purchasePrice: 31600.0, salePrice: 80000.0, specs: '3R' },
    { code: 'BA023', name: '43 LF 540T,541T,590T,UF690 T,43LX310C', brand: 'LG', stock: 10, purchasePrice: 30000.0, salePrice: 70000.0, specs: '2R' },
    { code: 'BA024', name: '43 LF 635T,LX340H,43LX341C,LX540S, LX560H,LX570H,LX770H,LX770M', brand: 'LG', stock: 5, purchasePrice: 53313.0, salePrice: 100000.0, specs: '3R' },
    { code: 'UJU', name: '47LB550.LB580TLB620T,650T,561T,581C,700T,LY340C,LY540S', brand: 'LG', stock: 4, purchasePrice: 38100.0, salePrice: 90000.0, specs: '8R' },
    { code: 'BA032', name: '47LS4600,LS5700,LM6200', brand: 'LG', stock: 1, purchasePrice: 23993.0, salePrice: 80000.0, specs: '2R' },
    { code: 'BA043', name: '49 LH 600 T,49LW540\'S,49LW560H   VERSION 1(5) VERSAION2(2)', brand: 'LG', stock: 3, purchasePrice: 34986.0, salePrice: 100000.0, specs: '8R' },
    { code: 'BA410', name: '49LH510T,LH570T', brand: 'LG', stock: 1, purchasePrice: 40817.0, salePrice: 90000.0, specs: '9R' },
    { code: 'BA042', name: '49LH510T,LH570T,LH573T  V(1)', brand: 'LG', stock: 0, purchasePrice: 59500.0, salePrice: 100000.0, specs: '8R' },
    { code: 'BA044', name: '49LJ550T,UJ635T,LK5700,UK6300 49UK6300,UK6200,49UN7300PDC,49UM7300PDA UN 7100PDA', brand: 'LG', stock: 0, purchasePrice: 38500.0, salePrice: 90000.0, specs: '8R' },
    { code: 'BA040', name: '49 LF510T,49UH610TUH 603T,UH620T,UF640T       V1', brand: 'LG', stock: 9, purchasePrice: 62400.0, salePrice: 110000.0, specs: '8R' },
    { code: 'BA038', name: '49LB650T,49LF640T,49LB550T', brand: 'LG', stock: 2, purchasePrice: 67473.0, salePrice: 110000.0, specs: '10R' },
    { code: 'BA261', name: '49UN7100PDA,49UN7300PDC    9LED 3 VOLTIOS V2', brand: 'LG', stock: 3, purchasePrice: 48000.0, salePrice: 100000.0, specs: '4R,9LED,3VOLT' },
    { code: 'BA259', name: '49 UJ620T', brand: 'LG', stock: 7, purchasePrice: 35000.0, salePrice: 80000.0, specs: '4R,LR' },
    { code: 'BA160', name: '49 UF770T,49UH623T', brand: 'LG', stock: 1, purchasePrice: 60000.0, salePrice: 100000.0, specs: '2R,DELGADA' },
    { code: 'BA410-V2', name: '49LF510T,49UH603T,49UH620T,49UF640T,UH610T          V2', brand: 'LG', stock: 0, purchasePrice: 63000.0, salePrice: 110000.0, specs: '8R' },
    { code: 'BA162', name: '49LF635T', brand: 'LG', stock: 3, purchasePrice: 74970.0, salePrice: 140000.0, specs: '2 R' },
    { code: 'BA039', name: '49LF540T,LF541T,LF590T,UF690T', brand: 'LG', stock: 5, purchasePrice: 55000.0, salePrice: 90000.0, specs: '2R' },
    { code: 'BA045', name: '49UJ651T,49LV640S,49UV340C', brand: 'LG', stock: 1, purchasePrice: 32487.0, salePrice: 90000.0, specs: '4R' },
    { code: 'BA048', name: '50LN5100,LA620T,LN5400, LA6200 NUEVO', brand: 'LG', stock: 2, purchasePrice: 63100.0, salePrice: 110000.0, specs: '12R' },
    { code: 'BA224', name: '50UM7300PDA,50UM7360PSA,50UM7500PDB,50UN7300PDC, 50UN731C0DC,50UN8000PBB', brand: 'LG', stock: 4, purchasePrice: 42040.0, salePrice: 100000.0, specs: '4R' },
    { code: 'BA236', name: '50UK6500,6300,UM7300,UM7360,UN7300,UN731,UM7500,PREGUNTAR CUANTAS REGLETAS VIENEN', brand: 'LG', stock: 2, purchasePrice: 44149.0, salePrice: 100000.0, specs: '3R' },
    { code: 'BA047', name: '50LB650T,50LB550T,50LB580T', brand: 'LG', stock: 1, purchasePrice: 65000.0, salePrice: 120000.0, specs: '' },
    { code: 'BA051', name: '55 LB 650 T,55 LY540 S,55 LF 650 T,55LX540S,55LH575T', brand: 'LG', stock: 2, purchasePrice: 72471.0, salePrice: 140000.0, specs: '10R,LR GRANDE' },
    { code: 'BA164', name: '55 UM 7400 PDA,UM 7470PSA,UM741CODA,UM7650PDB,UN7310PDC,UN731CODC', brand: 'LG', stock: 2, purchasePrice: 53312.0, salePrice: 100000.0, specs: '4R' },
    { code: 'BA058', name: '55UF770T,UH615T,UH623T,UF680T', brand: 'LG', stock: 17, purchasePrice: 50000.0, salePrice: 100000.0, specs: '2R' },
    { code: 'BA052', name: '55 LF 635 T', brand: 'LG', stock: 1, purchasePrice: 55400.0, salePrice: 110000.0, specs: '2R' },
    { code: 'BA057', name: '55 UJ620T,55LJ540T NUEVO', brand: 'LG', stock: 1, purchasePrice: 63000.0, salePrice: 110000.0, specs: '8R' },
    { code: 'BA163', name: '55LA620T,55LA6200,55LN5100,55LN5700,55LN549E,55LN5400,55LA6205', brand: 'LG', stock: 1, purchasePrice: 84133.0, salePrice: 150000.0, specs: '14R' },
    { code: 'BA056', name: '55LJ550T,55UJ635T,UK6300', brand: 'LG', stock: 0, purchasePrice: 44268.0, salePrice: 110000.0, specs: '10R,4LED,LR' },
    { code: 'BA055', name: '55UK6200,KU631-55UM7400,UK6350PDC', brand: 'LG', stock: 6, purchasePrice: 34153.0, salePrice: 90000.0, specs: '3R' },
    { code: 'BA060', name: '60 UK6200PDA,60UM7200PDA', brand: 'LG', stock: 1, purchasePrice: 101626.0, salePrice: 130000.0, specs: '5R,LUPA GRANDES' },
    { code: 'BA167', name: '60 UM 7200 PDA,60 UM7270PSA, 60 UN7310 PDA', brand: 'LG', stock: 9, purchasePrice: 63308.0, salePrice: 110000.0, specs: '5R' },
    { code: 'BA063', name: '60 LF 635 T', brand: 'LG', stock: 0, purchasePrice: 83300.0, salePrice: 130000.0, specs: '3R' },
    { code: 'BA062', name: '60 UH 615 T', brand: 'LG', stock: 3, purchasePrice: 57200.0, salePrice: 110000.0, specs: '2R' },
    { code: 'BA061', name: '60LB650T,60LF650T,55LB650T', brand: 'LG', stock: 2, purchasePrice: 139944.0, salePrice: 170000.0, specs: '12R' },
    { code: 'BA066', name: '65 UJ 630,635T', brand: 'LG', stock: 1, purchasePrice: 846000.0, salePrice: 140000.0, specs: '12R' },
    { code: 'BA245', name: '65UM7400PDA,65UM7470PSA,65UM7500PPA,65UN7310PDC,65UP7500PSF,65UP751COSF,65UU640C', brand: 'LG', stock: 2, purchasePrice: 74970.0, salePrice: 130000.0, specs: '5R' },
    { code: 'BA067', name: '65 UK 6350 PDC,65 UN 7100 PDA,65UM7400PDA', brand: 'LG', stock: 0, purchasePrice: 96628.0, salePrice: 150000.0, specs: '4R' },
    { code: 'BA074', name: '65UH615T,65UF680T,65UH6030', brand: 'LG', stock: 0, purchasePrice: 47481.0, salePrice: 100000.0, specs: '2R' },
    { code: 'BA068', name: '70LB650T,70LB720T', brand: 'LG', stock: 1, purchasePrice: 298200.0, salePrice: 350000.0, specs: '24R' },
    { code: 'BA069', name: 'TC-L32B6H,TC-L32SV6H', brand: 'PANASONIC', stock: 5, purchasePrice: 17493.0, salePrice: 80000.0, specs: '3R' },
    { code: 'BA364', name: 'TC-32DS600H,TC-32ES600H, TC-32D400H', brand: 'PANASONIC', stock: 1, purchasePrice: 35000.0, salePrice: 80000.0, specs: '3R' },
    { code: 'BA071', name: 'TC 40 A 400 H PANASONIC, TC40A600H', brand: 'PANASONIC', stock: 1, purchasePrice: 22000.0, salePrice: 60000.0, specs: '1R' },
    { code: 'BA070', name: 'TC 39 AS 600 H PANASONIC,TC 39A400H,SYLED391,V39OHJ1,', brand: 'PANASONIC', stock: 6, purchasePrice: 44982.0, salePrice: 80000.0, specs: '1R' },
    { code: 'BA225', name: 'V39OHK1-LSSTREME4,TCL L39E5050A/HISEN SELED39H310-DO747762', brand: 'PANASONIC', stock: 7, purchasePrice: 48000.0, salePrice: 80000.0, specs: '1R' },
    { code: 'BA072', name: 'TC-L 42 D 30X,TC -L42E30H', brand: 'PANASONIC', stock: 1, purchasePrice: 72000.0, salePrice: 110000.0, specs: '2R' },
    { code: 'BA370', name: 'TC-PANASPNIC,TC40DS600H,TC40DS630H', brand: 'PANASONIC', stock: 2, purchasePrice: 76636.0, salePrice: 130000.0, specs: '8R' },
    { code: 'BA171', name: 'TC - 49 DS 630 H,49D600H,ES600H', brand: 'PANASONIC', stock: 0, purchasePrice: 104000.0, salePrice: 150000.0, specs: '3R,8LED,LR' },
    { code: 'BA073', name: 'UN32F5000,F5500,F4000,UN32F4300', brand: 'SAMSUNG', stock: 4, purchasePrice: 31654.0, salePrice: 70000.0, specs: '5R,LR' },
    { code: 'BA074-V2', name: '(V1) UN32J4000AKZL,UN32J4300AKZL,UN32J4290AKZL,UN32T4300AKZL', brand: 'SAMSUNG', stock: 7, purchasePrice: 14161.0, salePrice: 50000.0, specs: '2R5 led 3vol' },
    { code: 'BA421', name: '(V2) UN32J4000AKZL,UN32J4300AKZL,UN32J4290KZL,', brand: 'SAMSUNG', stock: 2, purchasePrice: 54145.0, salePrice: 70000.0, specs: '2R,7LED,LR' },
    { code: 'BA076', name: 'UN32EH4003MXZL,UN32FH4005KXZL,UN32H4303AKXZL,HG32NB460GFXZA', brand: 'SAMSUNG', stock: 6, purchasePrice: 54400.0, salePrice: 80000.0, specs: '' },
    { code: 'BA176', name: 'UN32EH5300MXZL,UN32EH5000MXZL,UN32EH6030MXZL,', brand: 'SAMSUNG', stock: 7, purchasePrice: 34300.0, salePrice: 70000.0, specs: '' },
    { code: 'BA078', name: 'UN 39 EH 5003', brand: 'SAMSUNG', stock: 8, purchasePrice: 68700.0, salePrice: 90000.0, specs: '10R' },
    { code: 'BA077', name: 'UN 39 FH 5005,UN39EH5003MXZL', brand: 'SAMSUNG', stock: 2, purchasePrice: 42000.0, salePrice: 80000.0, specs: '3R' },
    { code: 'BA079', name: 'UN40F5000,40F5500,40F6100,40F6400', brand: 'SAMSUNG', stock: 6, purchasePrice: 63000.0, salePrice: 110000.0, specs: '14R' },
    { code: 'BA084', name: 'UN40 J 5200', brand: 'SAMSUNG', stock: 3, purchasePrice: 22000.0, salePrice: 70000.0, specs: '3R,LR' },
    { code: 'BA081', name: 'UN40EH5300, FH 5000,FH5005,FH5303,H5303,H6203,H5103,H5100,H4200', brand: 'SAMSUNG', stock: 0, purchasePrice: 65000.0, salePrice: 110000.0, specs: '10R' },
    { code: 'BA080', name: 'UN40EH5300, FH 5000,FH5005,FH5303,H5303,H6203,H5103,H5100,H4200', brand: 'SAMSUNG', stock: 3, purchasePrice: 25823.0, salePrice: 70000.0, specs: '3R' },
    { code: 'BA178', name: 'UN 40 K 5100', brand: 'SAMSUNG', stock: 4, purchasePrice: 52479.0, salePrice: 100000.0, specs: '2R' },
    { code: 'BA342', name: 'UN40KU6000KXZL,VERSIONFD04/FF06/FB02,UN40JU6100KXZL(VERSIONTH01', brand: 'SAMSUNG', stock: 0, purchasePrice: 58310.0, salePrice: 100000.0, specs: '10R' },
    { code: 'BA082', name: 'UN40KU6000,,JU6100  VERSION,FA01,VH03,', brand: 'SAMSUNG', stock: 1, purchasePrice: 106624.0, salePrice: 150000.0, specs: '10R' },
    { code: 'BA083', name: 'UN 40 K 6500', brand: 'SAMSUNG', stock: 3, purchasePrice: 35105.0, salePrice: 70000.0, specs: '1R' },
    { code: 'BA085', name: 'UN40H6400,H5500,UN40J5300,J5500,', brand: 'SAMSUNG', stock: 0, purchasePrice: 69619.0, salePrice: 110000.0, specs: '10R' },
    { code: 'BA179', name: 'UN 40 J 6500', brand: 'SAMSUNG', stock: 1, purchasePrice: 54978.0, salePrice: 110000.0, specs: '8R' },
    { code: 'BA549', name: 'HG43BU8000NFXZA,LS43BM702UNXZA,UN43AU8000KXZL,UN43BU8000KXZL,AU 7000P', brand: 'SAMSUNG', stock: 0, purchasePrice: 25000.0, salePrice: 70000.0, specs: '2R' },
    { code: 'BA088', name: 'UN43NU7100,UN43RU7100,UN43RU7300,UN43NU7300KXZL', brand: 'SAMSUNG', stock: 5, purchasePrice: 24000.0, salePrice: 70000.0, specs: '2R' },
    { code: 'BA292', name: 'UN43TU700,TU8000,AU7000,TU6900,43CU7000,LH43BECHLGKXZL.LH43BETHLGKXZL', brand: 'SAMSUNG', stock: 8, purchasePrice: 60000.0, salePrice: 100000.0, specs: '' },
    { code: 'BA086', name: 'UN43J5200, UN5290, UN43T5300', brand: 'SAMSUNG', stock: 15, purchasePrice: 34600.0, salePrice: 70000.0, specs: '8R' },
    { code: 'BA089', name: 'UN46F5000,F5500,46F6100,F6400', brand: 'SAMSUNG', stock: 3, purchasePrice: 84966.0, salePrice: 130000.0, specs: '16R' },
    { code: 'BA090', name: 'UN46EH5300,FH5005,FH5303,FH6203,H5303,H6203', brand: 'SAMSUNG', stock: 0, purchasePrice: 56100.0, salePrice: 100000.0, specs: '8R' },
    { code: 'BA222', name: 'UN 48J5200,', brand: 'SAMSUNG', stock: 9, purchasePrice: 39151.0, salePrice: 80000.0, specs: '8R' },
    { code: 'BA095', name: 'UN48H4200AKXZL,UN48H4203KXZL,HG48NC46KFXZA', brand: 'SAMSUNG', stock: 4, purchasePrice: 46648.0, salePrice: 110000.0, specs: '8R' },
    { code: 'BA237', name: 'UN48J6500AKXZL', brand: 'SAMSUNG', stock: 2, purchasePrice: 94605.0, salePrice: 140000.0, specs: '10R' },
    { code: 'BA092', name: 'UN48H5500,H6300,H6400,48J5300,', brand: 'SAMSUNG', stock: 1, purchasePrice: 75289.0, salePrice: 110000.0, specs: '12R' },
    { code: 'BA095-V2', name: 'UN49K6500', brand: 'SAMSUNG', stock: 0, purchasePrice: 41650.0, salePrice: 100000.0, specs: '1R' },
    { code: 'BA098', name: '49NU7100,NU7300,RU7300,', brand: 'SAMSUNG', stock: 9, purchasePrice: 36000.0, salePrice: 80000.0, specs: '2R' },
    { code: 'BA104', name: 'UN 50KU6000KXZL,UN50MU6103KXZL', brand: 'SAMSUNG', stock: 3, purchasePrice: 83000.0, salePrice: 130000.0, specs: '12R' },
    { code: 'BA312', name: '50BU80000,AU80000', brand: 'SAMSUNG', stock: 6, purchasePrice: 41700.0, salePrice: 90000.0, specs: '' },
    { code: 'BA226', name: 'UN 50 TU 8000 KXZL,UN50TU7000K,UN50AU7000KXZL,HG50T690UFXZA,UN50CU7000', brand: 'SAMSUNG', stock: 3, purchasePrice: 36652.0, salePrice: 90000.0, specs: '6R' },
    { code: 'BA312-V2', name: 'HG50BU8000NFXZA,UN50AU8000KXZL,UN50AU8200KXZL,UN50AU9000,BU8000,BU8200', brand: 'SAMSUNG', stock: 17, purchasePrice: 41700.0, salePrice: 80000.0, specs: '2R' },
    { code: 'BA101', name: 'UN50H5303,EH5300,FH5303', brand: 'SAMSUNG', stock: 2, purchasePrice: 43345.0, salePrice: 90000.0, specs: '8R' },
    { code: 'BA099', name: 'UN50NU7100,RU7100,NU7090', brand: 'SAMSUNG', stock: 10, purchasePrice: 36000.0, salePrice: 80000.0, specs: '2R' },
    { code: 'BA102', name: 'UN50 JU 6500KXZL', brand: 'SAMSUNG', stock: 1, purchasePrice: 149940.0, salePrice: 190000.0, specs: '12R' },
    { code: 'BA103', name: 'UN 50 J5500', brand: 'SAMSUNG', stock: 2, purchasePrice: 78000.0, salePrice: 130000.0, specs: '12R' },
    { code: 'BA105', name: 'UN55J 6300 AKXZL,UN55H6400AKXL,UN55J5300AKXZL,UN55J5500,H6350,55H6300', brand: 'SAMSUNG', stock: 0, purchasePrice: 85799.0, salePrice: 130000.0, specs: '12R' },
    { code: 'BA106', name: 'UN55JU6000KXZL,55JU6100,55JU6700,55JU7500,KU6000,MU6100,MU6103,KU6270', brand: 'SAMSUNG', stock: 0, purchasePrice: 105000.0, salePrice: 150000.0, specs: '12R' },
    { code: 'BA107', name: 'UN 55 K 6500', brand: 'SAMSUNG', stock: 1, purchasePrice: 65200.0, salePrice: 110000.0, specs: '1R' },
    { code: 'BA543', name: 'UN55AU8000,UN55BU7000,UN55AU7000', brand: 'SAMSUNG', stock: 14, purchasePrice: 55811.0, salePrice: 80000.0, specs: '2R' },
    { code: 'BA109', name: 'UN55NU7100,NU7300,RU7100,RU7300,NU7090,NU69000', brand: 'SAMSUNG', stock: 6, purchasePrice: 39000.0, salePrice: 80000.0, specs: '2R' },
    { code: 'BA287', name: 'UN58TU6900KXZL,UN58TU7000KXZL,UN58TU8000KXZL,UN58AU7000KXZL', brand: 'SAMSUNG', stock: 2, purchasePrice: 105791.0, salePrice: 150000.0, specs: '8R' },
    { code: 'BA190', name: 'UN 58 H 5203AKZL,UN58H5200,UN58J5200,UN58H5202,UN58H5005,UE58H5273,UE58H5203,UE58H5270', brand: 'SAMSUNG', stock: 0, purchasePrice: 73304.0, salePrice: 130000.0, specs: '12R' },
    { code: 'BA115', name: 'UN58NU7100,RU7100', brand: 'SAMSUNG', stock: 33, purchasePrice: 40000.0, salePrice: 90000.0, specs: '2R' },
    { code: 'BA116', name: 'UN58MU6120KXZL', brand: 'SAMSUNG', stock: 0, purchasePrice: 113570.0, salePrice: 160000.0, specs: '14R' },
    { code: 'BA511', name: 'UN60BU8000KXZL,UN60AU8000KXZL,', brand: 'SAMSUNG', stock: 13, purchasePrice: 46000.0, salePrice: 90000.0, specs: '2R' },
    { code: 'BA497', name: 'UN65BU8000FXZA,', brand: 'SAMSUNG', stock: 6, purchasePrice: 47000.0, salePrice: 100000.0, specs: '2R' },
    { code: 'BA120', name: 'UN 65 UN 7100,RU 7100,UN65TU8300', brand: 'SAMSUNG', stock: 0, purchasePrice: 32000.0, salePrice: 100000.0, specs: '2R' },
    { code: 'BA288', name: 'UN70 RU 7100,NU7300', brand: 'SAMSUNG', stock: 0, purchasePrice: 76.636, salePrice: 140000.0, specs: '' },
    { code: 'BA521', name: 'UN75 AU8000KXZL,UN75BU8000KXZL', brand: 'SAMSUNG', stock: 4, purchasePrice: 67000.0, salePrice: 120000.0, specs: '4R' },
    { code: 'BA121', name: 'UN75RU7100,UN75NU7100,UN75RU7300', brand: 'SAMSUNG', stock: 2, purchasePrice: 65473.0, salePrice: 140000.0, specs: '3R' },
    { code: 'BA232', name: '32"32 L 51,E32EK1NI61FHNA4', brand: 'GENERICO', stock: 0, purchasePrice: 17493.0, salePrice: 50000.0, specs: '3R' },
    { code: 'BA197', name: '32D2200,KALED32HDSPT2,L32D2700,KLED32HDXT2,LED32D27,K-LED32HDST2,32D28T2', brand: 'GENERICO', stock: 13, purchasePrice: 30000.0, salePrice: 50000.0, specs: '2R' },
    { code: 'BA132', name: '32"32T15T2,32T16T2,32T18,K-LED32HDXDT2,K-LED32HDSDT2,K-LEDHDRST2,K-LED32HDSQT2', brand: 'GENERICO', stock: 68, purchasePrice: 17399.0, salePrice: 50000.0, specs: '2R' },
    { code: 'BA134', name: '32"LED32L31HD,E32DK2NS31D15A4,LE32W234D2', brand: 'GENERICO', stock: 7, purchasePrice: 19159.0, salePrice: 50000.0, specs: '3R' },
    { code: 'BA198', name: '32"KLEDHDSPT2  REGLETA DELGADA', brand: 'GENERICO', stock: 2, purchasePrice: 55200.0, salePrice: 80000.0, specs: '2R' },
    { code: 'BA200', name: '32"32T21,32T12,32T22,K-LED32HDFT2,32 d 2080,OLIMPO 32D 2200S,32D2930,TC32FS500H', brand: 'GENERICO', stock: 67, purchasePrice: 12000.0, salePrice: 50000.0, specs: '2R,5LED,LR' },
    { code: 'BA384', name: '32K1000,32F1000TB,32F1000T,SV3220B', brand: 'GENERICO', stock: 0, purchasePrice: 17493.0, salePrice: 50000.0, specs: '2R' },
    { code: 'BA203', name: '32"SYLED3215', brand: 'GENERICO', stock: 5, purchasePrice: 26500.0, salePrice: 50000.0, specs: '1R' },
    { code: 'BA242', name: '28"SLED2801,HYLED28D,HLED28D', brand: 'GENERICO', stock: 1, purchasePrice: 39984.0, salePrice: 80000.0, specs: '3R' },
    { code: 'BA381', name: 'K-LED32 HDZ2, HE315GH-B11(010)', brand: 'GENERICO', stock: 1, purchasePrice: 35652.0, salePrice: 70000.0, specs: '1R' },
    { code: 'BA395', name: '32"K-LED32HDZD      3REGLETASX6LEDX3VOLTIOS', brand: 'GENERICO', stock: 35, purchasePrice: 24157.0, salePrice: 50000.0, specs: '3R' },
    { code: 'BA393', name: '32"SV3220B SMART VISION (V1)', brand: 'GENERICO', stock: 0, purchasePrice: 13000.0, salePrice: 40000.0, specs: '2R' },
    { code: 'BA557', name: '32"SV3220S    SMART VIRSION  (V2)', brand: 'GENERICO', stock: 15, purchasePrice: 17612.0, salePrice: 50000.0, specs: '2R' },
    { code: 'BA450', name: 'LED32D2080 CHINO     10LEDX2REGLETAS 6VOLT', brand: 'GENERICO', stock: 2, purchasePrice: 33000.0, salePrice: 60000.0, specs: '2R,10LED,6VOL' },
    { code: 'BA363', name: '32"CLED 32-DV01', brand: 'GENERICO', stock: 10, purchasePrice: 33300.0, salePrice: 60000.0, specs: '2R' },
    { code: 'BA382', name: '40 KLED-40A03,CELED40A03', brand: 'GENERICO', stock: 6, purchasePrice: 45815.0, salePrice: 80000.0, specs: '3R' },
    { code: 'BA138', name: 'K LED 40 FHD', brand: 'GENERICO', stock: 2, purchasePrice: 54145.0, salePrice: 90000.0, specs: '2R' },
    { code: 'BA140', name: '40"K-LED40FHDXT2,L40D2700B,MS306GPB,VISIVO VTL-4030ST2,K-LED40FHDST2', brand: 'GENERICO', stock: 6, purchasePrice: 10380.0, salePrice: 70000.0, specs: '3R' },
    { code: 'BA385', name: 'HYLED 3230 D', brand: 'GENERICO', stock: 5, purchasePrice: 44982.0, salePrice: 60000.0, specs: '3,7led' },
    { code: 'BA528', name: '32"(V2)HYLED3239INTM,(V3)HYLED3215INT2   6LED, 3VOL', brand: 'GENERICO', stock: 0, purchasePrice: 13450.0, salePrice: 40000.0, specs: '2R,6LED,3VOL' },
    { code: 'BA244', name: 'HYLED 3211 INTC', brand: 'GENERICO', stock: 5, purchasePrice: 14000.0, salePrice: 50000.0, specs: '2R' },
    { code: 'BA135', name: 'HYLED 3213 INTC,SYLED 324 T2,SYLED325T2,CLED-32SDV2,OPLED3202S,HYLED32451INT,SYLED325T2', brand: 'GENERICO', stock: 8, purchasePrice: 15000.0, salePrice: 40000.0, specs: '2R' },
    { code: 'BA415', name: 'HYLED 3216 CURVAS,MGTV320KA,MSL3150 (V2)', brand: 'GENERICO', stock: 11, purchasePrice: 18000.0, salePrice: 50000.0, specs: '2R' },
    { code: 'BA202', name: 'HYLED 3216   RECTAS (V1)', brand: 'GENERICO', stock: 1, purchasePrice: 12495.0, salePrice: 40000.0, specs: '2R' },
    { code: 'BA390', name: 'HYLED 326 ED', brand: 'GENERICO', stock: 1, purchasePrice: 24990.0, salePrice: 50000.0, specs: '3R' },
    { code: 'BA370-V2', name: '32"REC-LE32Z4SSMT,EL32P28SM,CX32P28SM,IND-TVLED32Z1,CX32F1SM,ARV32Z1', brand: 'GENERICO', stock: 3, purchasePrice: 18000.0, salePrice: 50000.0, specs: '3R' },
    { code: 'BA433', name: '32"TV LED32L85HDT2,SYLED326IX,VTLHD3241ST2,KTR3219CES,LED32LL48HDT2,32LL30,32O68', brand: 'GENERICO', stock: 8, purchasePrice: 22000.0, salePrice: 50000.0, specs: '2R' },
    { code: 'BA388', name: 'HYLED-3238 D,HYLED3237INTMG', brand: 'GENERICO', stock: 2, purchasePrice: 14169.0, salePrice: 50000.0, specs: '2R' },
    { code: 'BA631', name: '39"HYLEDD397W,SYLED394iv', brand: 'GENERICO', stock: 0, purchasePrice: 21150.0, salePrice: 70000.0, specs: '8 r' },
    { code: 'BA427', name: 'HYLED39T2', brand: 'GENERICO', stock: 2, purchasePrice: 43316.0, salePrice: 90000.0, specs: '3R' },
    { code: 'BA206', name: 'HYLED 4010,HYLED 4003,SYLED4010F,HYLED402ED (V2)', brand: 'GENERICO', stock: 9, purchasePrice: 40017.0, salePrice: 80000.0, specs: '' },
    { code: 'BA204', name: 'SYLED4010F,OLED4010,HYLED401E,HYLED401iNT,OLED403W,HYLED40D1 (V1)', brand: 'GENERICO', stock: 2, purchasePrice: 18000.0, salePrice: 50000.0, specs: '1R' },
    { code: 'BA139', name: '40" OPEM005634,LED40T20ANDROID T2,HYLED4021NIM', brand: 'GENERICO', stock: 7, purchasePrice: 49100.0, salePrice: 80000.0, specs: '3R' },
    { code: 'BA369', name: '40"D2930,2080 LUPA CUADRARA (V2)', brand: 'GENERICO', stock: 1, purchasePrice: 55000.0, salePrice: 90000.0, specs: '3R' },
    { code: 'BA501', name: '40D2080,40D2930,40D2900  LUPA REDONDA (V1)', brand: 'GENERICO', stock: 7, purchasePrice: 20025.0, salePrice: 70000.0, specs: '3R' },
    { code: 'BA141', name: '40 HYLED 40395', brand: 'GENERICO', stock: 0, purchasePrice: 31153.0, salePrice: 90000.0, specs: '4R' },
    { code: 'BA482', name: '40"LED40T15T2,K-LED40FHDSQT2(V1).KLEDFHDLT2', brand: 'GENERICO', stock: 6, purchasePrice: 40000.0, salePrice: 80000.0, specs: '3R,8LED6 VOLT,' },
    { code: 'BA455', name: '40"CX40P28FSM', brand: 'GENERICO', stock: 5, purchasePrice: 17000.0, salePrice: 60000.0, specs: '' },
    { code: 'BA204-V2', name: 'CELED40A03       V2', brand: 'GENERICO', stock: 0, purchasePrice: 34000.0, salePrice: 70000.0, specs: '1R' },
    { code: 'BA778', name: '42LL30', brand: 'GENERICO', stock: 0, purchasePrice: 21658.0, salePrice: 90000.0, specs: '3R' },
    { code: 'BA463', name: '43HYLED 4313 INTM,CELED43GK4X12,HYLED43INT2', brand: 'GENERICO', stock: 1, purchasePrice: 28322.0, salePrice: 70000.0, specs: '4R' },
    { code: 'BA404', name: '43"T21,43T16,43T18,43T20,K-LED43FHDSQT2,K-LED43FHDRST2,43D2080', brand: 'GENERICO', stock: 0, purchasePrice: 21000.0, salePrice: 70000.0, specs: '3R' },
    { code: 'BA173', name: '43"(V2)HYLED4315INT2', brand: 'GENERICO', stock: 0, purchasePrice: 26656.0, salePrice: 70000.0, specs: '3R' },
    { code: 'BA850', name: '43P635', brand: 'GENERICO', stock: 5, purchasePrice: 35000.0, salePrice: 70000.0, specs: '1R' },
    { code: 'BA209', name: '43"REC-LE4319NSMT,CX43P28FSM,CX43Z1', brand: 'GENERICO', stock: 0, purchasePrice: 12500.0, salePrice: 70000.0, specs: '3R' },
    { code: 'BA770', name: '43"SYLED436iV', brand: 'GENERICO', stock: 0, purchasePrice: 17493.0, salePrice: 70000.0, specs: '3R' },
    { code: 'BA409', name: '43"43LL49,LED4317SMR,NEX431INT,K430WDD1', brand: 'GENERICO', stock: 11, purchasePrice: 42000.0, salePrice: 90000.0, specs: '3R' },
    { code: 'BA487', name: 'HYLED43INTC,  12LEDX4REGLETAS    HYLED43INT2', brand: 'GENERICO', stock: 2, purchasePrice: 32640.0, salePrice: 100000.0, specs: '4R' },
    { code: 'BA503', name: '43"K-LED43FHDSF2BT,K-LED43FHDSFBT,43D2200S', brand: 'GENERICO', stock: 0, purchasePrice: 31000.0, salePrice: 90000.0, specs: '3R' },
    { code: 'BA712', name: 'BA712', brand: 'GENERICO', stock: 0, purchasePrice: 42000.0, salePrice: 80000.0, specs: '3R,LC,7LED,3VOL' },
    { code: 'BA337', name: 'K-LED43H54', brand: 'GENERICO', stock: 2, purchasePrice: 41650.0, salePrice: 110000.0, specs: '8R' },
    { code: 'BA449', name: '(V1)IBG435AN,SYLED432T2I,HYLED4315INT2,HYLED431INTC,TV6463DVBT2CV,   8LEDX6VOLT', brand: 'GENERICO', stock: 0, purchasePrice: 73304.0, salePrice: 110000.0, specs: '3R' },
    { code: 'BA515', name: '43"(V2)K-LED43FHDSN,K-ATV43FHDS,', brand: 'GENERICO', stock: 0, purchasePrice: 22000.0, salePrice: 70000.0, specs: '3R' },
    { code: 'BA143', name: 'SYLED 4810 F', brand: 'GENERICO', stock: 4, purchasePrice: 102459.0, salePrice: 140000.0, specs: '8R' },
    { code: 'BA462', name: 'HYLED 4501', brand: 'GENERICO', stock: 7, purchasePrice: 37485.0, salePrice: 80000.0, specs: '4R' },
    { code: 'BA214', name: '49"K-LED 49FHDSPT2,TC-49FX500H,TC-49UHDSMT2,UHD49T23BT ANDROID T2', brand: 'GENERICO', stock: 7, purchasePrice: 43316.0, salePrice: 90000.0, specs: '9R' },
    { code: 'BA427-V2', name: '49"K-LED49FHDSQT2,49D2080,49D6080', brand: 'GENERICO', stock: 3, purchasePrice: 70805.0, salePrice: 110000.0, specs: '8R' },
    { code: 'BA449-V2', name: 'K-LED49FHDSZT2', brand: 'GENERICO', stock: 2, purchasePrice: 59143.0, salePrice: 110000.0, specs: '4R' },
    { code: 'BA213', name: '49"HYLED4951INTC,HYLED4914C4K,CLD49SCVD5,CLD49SCV02', brand: 'GENERICO', stock: 2, purchasePrice: 72200.0, salePrice: 110000.0, specs: '10R' },
    { code: 'BA142', name: 'HYLED 501 INT,HY502INTOLED5010,OLED5020W', brand: 'GENERICO', stock: 0, purchasePrice: 80747.0, salePrice: 130000.0, specs: '10R' },
    { code: 'BA679', name: '(V2)50"CELED-50SDV3', brand: 'GENERICO', stock: 4, purchasePrice: 12495.0, salePrice: 90000.0, specs: '4R' },
    { code: 'BA371', name: '50"K-LED50UHDSZ', brand: 'GENERICO', stock: 3, purchasePrice: 32487.0, salePrice: 100000.0, specs: '11R' },
    { code: 'BA481', name: 'K-LED50UHDSFBT', brand: 'GENERICO', stock: 1, purchasePrice: 41300.0, salePrice: 90000.0, specs: '3R' },
    { code: 'BA450-V2', name: '50"EL50P28FSM,EL50P28USM,CX50P28FSM,REC-LE50P28SMT   LUPA CUADRADA,  96CM', brand: 'GENERICO', stock: 8, purchasePrice: 32000.0, salePrice: 90000.0, specs: '4R' },
    { code: 'BA146', name: '50 EL"502USM,CX50F2USM,REC5019NSMT,TROSO19S    LUPA REDONDA    96CM', brand: 'GENERICO', stock: 2, purchasePrice: 32000.0, salePrice: 80000.0, specs: '4R' },
    { code: 'BA173-V2', name: '50L82,50YCA', brand: 'GENERICO', stock: 2, purchasePrice: 19992.0, salePrice: 60000.0, specs: '1R' },
    { code: 'BA389', name: 'HYLED50104K (V1)', brand: 'GENERICO', stock: 8, purchasePrice: 47000.0, salePrice: 100000.0, specs: '8R' },
    { code: 'BA468', name: 'L50D2700MS08,50"D27T2MS08G', brand: 'GENERICO', stock: 3, purchasePrice: 26700.0, salePrice: 60000.0, specs: '10R' },
    { code: 'BA572', name: '50H6000FY,K-LED50UHDSNBT', brand: 'GENERICO', stock: 9, purchasePrice: 43800.0, salePrice: 100000.0, specs: '4R,9LED,3VOL,LC' },
    { code: 'BA229', name: '50"HYLED 5013 INTM,OPEN5001S4K', brand: 'GENERICO', stock: 4, purchasePrice: 29155.0, salePrice: 80000.0, specs: '4R,10LED,LR' },
    { code: 'BA137', name: '55"K-LED55FHDSQT2,55D2080,55D1600,K-LED55FHDXST2,55T18,CLED55SME3', brand: 'GENERICO', stock: 4, purchasePrice: 43316.0, salePrice: 90000.0, specs: '10R' },
    { code: 'BA422', name: '55"HYLED551,5515,OPLE5501S4K,CELED95966 CONTINENTAL BA149,BA744', brand: 'GENERICO', stock: 1, purchasePrice: 46780.0, salePrice: 110000.0, specs: '8R,5LED,6VOLT,LR' },
    { code: 'BA338', name: '55"K-LED55FHDSFBT,55 D2200S,55U 3200S,JL.D550C1330-CX55S1USM', brand: 'GENERICO', stock: 0, purchasePrice: 62300.0, salePrice: 100000.0, specs: '3R,12LED,LR' },
    { code: 'BA422-V2', name: 'HYLED 5518INTM', brand: 'GENERICO', stock: 4, purchasePrice: 30821.0, salePrice: 100000.0, specs: '9R,' },
    { code: 'BA149', name: '55"HYLED 551-5515,OPLED5501S4K,CELED 95966,CONTINENTAL      V1,V2  BA149,BA744', brand: 'GENERICO', stock: 7, purchasePrice: 46780.0, salePrice: 110000.0, specs: '6R' },
    { code: 'BA218', name: '55"K-LED55FHDSFBT,55 D2200S,55U 3200S,JL.D550C1330-CX55S1USM', brand: 'GENERICO', stock: 0, purchasePrice: 53312.0, salePrice: 110000.0, specs: '6R' },
    { code: 'BA507', name: '55"CX55S1USM,CX55F2USM   12LEDX4REGL6VOLT  LUPA REDONDA', brand: 'GENERICO', stock: 12, purchasePrice: 13328.0, salePrice: 90000.0, specs: '4R,12LED,6VOLT' },
    { code: 'BA503-V2', name: '55"(V1)HYLED5519N4KM,,SYLED55UHDW', brand: 'GENERICO', stock: 0, purchasePrice: 36652.0, salePrice: 90000.0, specs: '3R' },
    { code: 'BA701', name: '55"(V2)HYLED5519N4KM,SYLED55UHDW,HYLED 5520', brand: 'GENERICO', stock: 1, purchasePrice: 37604.0, salePrice: 90000.0, specs: '3R.LC' },
    { code: 'BA819', name: '55"HYLED5521W4KM,(V1),SYLED554UHDW,552MM                3VOLTIOS', brand: 'GENERICO', stock: 0, purchasePrice: 30821.0, salePrice: 100000.0, specs: '10R' },
    { code: 'BA422-V3', name: 'HYLED 5518 INTM,HYLED 55181WTM', brand: 'GENERICO', stock: 9, purchasePrice: 30821.0, salePrice: 100000.0, specs: '9R' },
    { code: 'BA218-V2', name: '55Q9000AU 55"', brand: 'GENERICO', stock: 4, purchasePrice: 49980.0, salePrice: 100000.0, specs: '8R' },
    { code: 'BA679-V2', name: '55"K-LED55FHDSPBT2,K-LED55FHDSPT2', brand: 'GENERICO', stock: 0, purchasePrice: 51646.0, salePrice: 100000.0, specs: '9R' },
    { code: 'BA468-V2', name: '58"CX5819NUSM,CX580DLEDM,EL58F2USM,EL5819NUSM', brand: 'GENERICO', stock: 0, purchasePrice: 19992.0, salePrice: 90000.0, specs: '' },
    { code: 'BA367', name: '65" K-LED65UHDSFBT', brand: 'GENERICO', stock: 3, purchasePrice: 45815.0, salePrice: 120000.0, specs: '8R' },
    { code: 'BA567', name: 'CX65E1USM,EL65E1USM', brand: 'GENERICO', stock: 2, purchasePrice: 57000.0, salePrice: 120000.0, specs: '12R,7LES,6V' },
    { code: 'BA326', name: 'KDL 32R327C', brand: 'GENERICO', stock: 6, purchasePrice: 54978.0, salePrice: 100000.0, specs: '3R' },
    { code: 'BA190-V2', name: 'KDL-40R377C  SONY', brand: 'GENERICO', stock: 0, purchasePrice: 51000.0, salePrice: 90000.0, specs: '10R' },
    { code: 'BA192/839', name: 'KDL40R467A,KDL40R477B,KDL40W607B', brand: 'GENERICO', stock: 3, purchasePrice: 51000.0, salePrice: 110000.0, specs: '10R' },
    { code: 'BA122', name: 'KDL40R455A,KDL40-R457A,KDL-40R450A,KDL-40R475B', brand: 'GENERICO', stock: 11, purchasePrice: 56100.0, salePrice: 110000.0, specs: '10R' },
    { code: 'BA126', name: 'KDL 46R457A', brand: 'GENERICO', stock: 1, purchasePrice: 111622.0, salePrice: 140000.0, specs: '12R' },
    { code: 'BA482-V2', name: '48VTL-4830ST2,48FS3750', brand: 'GENERICO', stock: 0, purchasePrice: 22491.0, salePrice: 90000.0, specs: '3R' },
    { code: 'UN43NU7100', name: 'UN43NU7100', brand: 'GENERICO', stock: 0, purchasePrice: 96000.0, salePrice: 150000.0, specs: '' },
    { code: 'UN49NU7100', name: 'UN49NU7100', brand: 'GENERICO', stock: 0, purchasePrice: 109000.0, salePrice: 160000.0, specs: '' },
    { code: 'UN58RU7100', name: 'UN58RU7100', brand: 'GENERICO', stock: 1, purchasePrice: 140100.0, salePrice: 280200.0, specs: '' },
    { code: 'UN60BU8000', name: 'UN60BU8000', brand: 'GENERICO', stock: 7, purchasePrice: 145000.0, salePrice: 240000.0, specs: '' },
    { code: 'UN65BU8000', name: 'UN65BU8000', brand: 'GENERICO', stock: 8, purchasePrice: 129000.0, salePrice: 270000.0, specs: '' },
    { code: 'UN75AU8000', name: 'UN75AU8000', brand: 'GENERICO', stock: 2, purchasePrice: 248000.0, salePrice: 350000.0, specs: '' },
  ];

  let created = 0;
  let skipped = 0;

  for (const p of products) {
    try {
      await prisma.product.upsert({
        where: { code: p.code },
        update: {
          stock: p.stock,
          purchasePrice: p.purchasePrice,
          salePrice: p.salePrice,
        },
        create: {
          code: p.code,
          name: p.name,
          brand: p.brand,
          stock: p.stock,
          minStock: 2,
          unit: 'und',
          purchasePrice: p.purchasePrice,
          salePrice: p.salePrice,
          modelCompat: p.name,
          description: p.specs || null,
          categoryId: catId,
          supplierId: brandSupplier[p.brand] || null,
        },
      });
      created++;
    } catch (err) {
      skipped++;
      console.log(`⚠️  Saltado ${p.code}: ${err.message.slice(0, 80)}`);
    }
  }

  console.log(`✅ Productos: ${created} creados/actualizados, ${skipped} saltados`);
  console.log('');
  console.log('🎉 Seed completado exitosamente');
  console.log('');
  console.log('👤 Usuarios disponibles:');
  console.log('   admin    / admin123    (Administrador)');
  console.log('   tecnico  / tecnico123  (Técnico)');
  console.log('   vendedor / vendedor123 (Vendedor)');
}

main()
  .catch(e => { console.error('❌ Error en seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
