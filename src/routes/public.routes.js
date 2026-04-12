const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ── Productos públicos (catálogo) ─────────────────────────────────
router.get('/products', async (req, res, next) => {
  try {
    const { search, brand, category_id, page = '1', limit = '20' } = req.query;
    const where = { active: true, stock: { gt: 0 } };

    if (search) {
      where.OR = [
        { name:  { contains: search, mode: 'insensitive' } },
        { code:  { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { modelCompat: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (brand) where.brand = brand;
    if (category_id) where.categoryId = Number(category_id);

    const total = await prisma.product.count({ where });
    const products = await prisma.product.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy: { name: 'asc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    });

    // Marcas disponibles
    const brands = await prisma.product.groupBy({
      by: ['brand'],
      where: { active: true, stock: { gt: 0 }, brand: { not: null } },
      _count: true,
    });

    res.json({
      products: products.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        brand: p.brand,
        category: p.category?.name || null,
        sale_price: Number(p.salePrice),
        stock: p.stock,
        unit: p.unit,
        image_url: p.imageUrl,
      })),
      brands: brands.map(b => ({ name: b.brand, count: b._count })),
      total,
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) { next(err); }
});

// ── Ver estado de una reparación por ticket ───────────────────────
router.get('/repair/:ticket', async (req, res, next) => {
  try {
    const repair = await prisma.repair.findUnique({
      where: { ticketNumber: req.params.ticket.toUpperCase() },
      include: {
        client:     { select: { name: true } },
        technician: { select: { name: true } },
        history:    { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!repair) return res.status(404).json({ error: 'Ticket no encontrado' });

    res.json({
      ticket_number: repair.ticketNumber,
      device_brand: repair.deviceBrand,
      device_model: repair.deviceModel,
      screen_size: repair.screenSize,
      problem_desc: repair.problemDesc,
      diagnosis: repair.diagnosis,
      work_done: repair.workDone,
      status: repair.status.toLowerCase(),
      priority: repair.priority.toLowerCase(),
      labor_cost: Number(repair.laborCost),
      parts_cost: Number(repair.partsCost),
      total_cost: Number(repair.totalCost),
      advance_payment: Number(repair.advancePayment),
      received_at: repair.receivedAt,
      estimated_date: repair.estimatedDate,
      delivered_at: repair.deliveredAt,
      notes: repair.notes,
      client_name: repair.client?.name || null,
      technician_name: repair.technician?.name || null,
      history: repair.history.map(h => ({
        status: h.newStatus,
        comment: h.comment,
        date: h.createdAt,
      })).filter(h => h.status),
    });
  } catch (err) { next(err); }
});

// ── Crear solicitud de cotización ─────────────────────────────────
router.post('/quote', async (req, res, next) => {
  try {
    const { client_name, client_phone, client_email, device_brand, device_model, screen_size, problem_desc, service_type } = req.body;

    if (!client_name || !client_phone || !problem_desc || !device_brand) {
      return res.status(400).json({ error: 'Nombre, teléfono, equipo y problema son requeridos' });
    }

    let client = await prisma.client.findFirst({
      where: { OR: [{ phone: client_phone }, { AND: [{ name: client_name }, { phone: client_phone }] }] },
    });

    if (!client) {
      client = await prisma.client.create({
        data: { name: client_name, phone: client_phone, email: client_email || null },
      });
    }

    const d = new Date();
    const prefix = `REP-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
    const count = await prisma.repair.count({ where: { ticketNumber: { startsWith: prefix } } });
    const ticketNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    const notes = `Solicitud web — Tipo: ${service_type || 'reparacion'}`;

    const repair = await prisma.repair.create({
      data: {
        ticketNumber,
        clientId: client.id,
        userId: 1,
        deviceBrand: device_brand,
        deviceModel: device_model || '',
        screenSize: screen_size || null,
        problemDesc: problem_desc,
        status: 'RECIBIDO',
        notes,
      },
    });

    await prisma.repairHistory.create({
      data: {
        repairId: repair.id,
        userId: 1,
        newStatus: 'recibido',
        comment: 'Solicitud recibida desde el sitio web',
      },
    });

    res.status(201).json({ ticket_number: ticketNumber, message: 'Solicitud enviada correctamente' });
  } catch (err) { next(err); }
});

// ── Servicios disponibles ─────────────────────────────────────────
router.get('/services', async (req, res) => {
  res.json([
    { id: 1, icon: '📺', title: 'Diagnóstico de TV',      desc: 'Revisión completa del equipo para identificar la falla. Presupuesto sin costo.' },
    { id: 2, icon: '🔧', title: 'Reparación de TV',       desc: 'Samsung, LG, Sony, Hisense, TCL y más. Garantía en mano de obra y repuestos.' },
    { id: 3, icon: '🖥',  title: 'Pantallas y Displays',  desc: 'Reemplazo de paneles LED, LCD y OLED. Todas las pulgadas.' },
    { id: 4, icon: '⚡', title: 'Fuentes de Poder',       desc: 'Reparación e intercambio de tarjetas de poder. Solución al TV que no enciende.' },
    { id: 5, icon: '📡', title: 'Tarjetas Principales',   desc: 'Main board, T-Con, módulos Wi-Fi, Smart TV. Repuestos originales y alternativos.' },
    { id: 6, icon: '💡', title: 'Backlights y LED Strips', desc: 'Cambio de tiras LED, inversores y lámparas CCFL para TVs sin imagen.' },
    { id: 7, icon: '🛒', title: 'Venta de Repuestos',     desc: 'Repuestos para televisores de todas las marcas. Envíos a toda Colombia.' },
    { id: 8, icon: '🛡', title: 'Garantía',               desc: 'Hasta 6 meses de garantía en reparaciones. Respaldamos nuestro trabajo.' },
  ]);
});

module.exports = router;