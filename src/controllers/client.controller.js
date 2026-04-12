const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAll = async (req, res, next) => {
  try {
    const { search } = req.query;
    const where = { active: true };
    if (search) {
      where.OR = [
        { name:     { contains: search, mode: 'insensitive' } },
        { document: { contains: search, mode: 'insensitive' } },
        { phone:    { contains: search, mode: 'insensitive' } },
        { email:    { contains: search, mode: 'insensitive' } },
      ];
    }
    const clients = await prisma.client.findMany({ where, orderBy: { name: 'asc' } });
    // Mapear campos para compatibilidad con frontend
    res.json(clients.map(c => ({
      id: c.id,
      name: c.name,
      document_type: c.documentType,
      document: c.document,
      phone: c.phone,
      email: c.email,
      address: c.address,
      notes: c.notes,
      total_purchases: c.totalPurchases,
      active: c.active,
      created_at: c.createdAt,
    })));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        sales: {
          select: { id: true, invoiceNumber: true, total: true, createdAt: true, status: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        repairs: {
          select: { id: true, ticketNumber: true, deviceBrand: true, deviceModel: true, status: true, receivedAt: true },
          orderBy: { receivedAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({
      id: client.id,
      name: client.name,
      document_type: client.documentType,
      document: client.document,
      phone: client.phone,
      email: client.email,
      address: client.address,
      notes: client.notes,
      total_purchases: client.totalPurchases,
      sales: client.sales.map(s => ({
        id: s.id,
        invoice_number: s.invoiceNumber,
        total: s.total,
        created_at: s.createdAt,
        status: s.status.toLowerCase(),
      })),
      repairs: client.repairs.map(r => ({
        id: r.id,
        ticket_number: r.ticketNumber,
        device_brand: r.deviceBrand,
        device_model: r.deviceModel,
        status: r.status.toLowerCase(),
        received_at: r.receivedAt,
      })),
    });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, document_type, document, phone, email, address, notes } = req.body;
    const client = await prisma.client.create({
      data: {
        name,
        documentType: document_type || 'CC',
        document: document || null,
        phone, email, address, notes,
      },
    });
    res.status(201).json({ id: client.id, message: 'Cliente creado' });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { name, document_type, document, phone, email, address, notes } = req.body;
    await prisma.client.update({
      where: { id: Number(req.params.id) },
      data: {
        name,
        documentType: document_type,
        document: document || null,
        phone, email, address, notes,
      },
    });
    res.json({ message: 'Cliente actualizado' });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    await prisma.client.update({
      where: { id: Number(req.params.id) },
      data: { active: false },
    });
    res.json({ message: 'Cliente desactivado' });
  } catch (err) { next(err); }
};
