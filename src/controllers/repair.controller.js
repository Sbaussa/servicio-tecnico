const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function generateTicket() {
  const d = new Date();
  const prefix = `REP-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const count = await prisma.repair.count({
    where: { ticketNumber: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}

exports.getAll = async (req, res, next) => {
  try {
    const { status, search, technician_id, from, to, priority } = req.query;
    const where = {};
    if (status) where.status = status.toUpperCase();
    if (priority) where.priority = priority.toUpperCase();
    if (technician_id) where.technicianId = Number(technician_id);
    if (from) where.receivedAt = { ...(where.receivedAt || {}), gte: new Date(from) };
    if (to)   where.receivedAt = { ...(where.receivedAt || {}), lte: new Date(to + 'T23:59:59') };
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { deviceBrand:  { contains: search, mode: 'insensitive' } },
        { deviceModel:  { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const repairs = await prisma.repair.findMany({
      where,
      include: {
        client:     { select: { name: true, phone: true } },
        user:       { select: { name: true } },
        technician: { select: { name: true } },
      },
      orderBy: { receivedAt: 'desc' },
    });

    res.json(repairs.map(r => ({
      id: r.id,
      ticket_number: r.ticketNumber,
      client_id: r.clientId,
      client_name: r.client?.name || null,
      client_phone: r.client?.phone || null,
      user_name: r.user?.name || null,
      technician_name: r.technician?.name || null,
      device_brand: r.deviceBrand,
      device_model: r.deviceModel,
      device_serial: r.deviceSerial,
      screen_size: r.screenSize,
      problem_desc: r.problemDesc,
      accessories: r.accessories,
      diagnosis: r.diagnosis,
      work_done: r.workDone,
      parts_used: r.partsUsed,
      labor_cost: r.laborCost,
      parts_cost: r.partsCost,
      total_cost: r.totalCost,
      advance_payment: r.advancePayment,
      status: r.status.toLowerCase(),
      priority: r.priority.toLowerCase(),
      estimated_date: r.estimatedDate,
      received_at: r.receivedAt,
      delivered_at: r.deliveredAt,
      notes: r.notes,
    })));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const repair = await prisma.repair.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        client:     { select: { name: true, phone: true, document: true } },
        user:       { select: { name: true } },
        technician: { select: { name: true } },
        history: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!repair) return res.status(404).json({ error: 'Reparación no encontrada' });

    res.json({
      id: repair.id,
      ticket_number: repair.ticketNumber,
      client_id: repair.clientId,
      client_name: repair.client?.name || null,
      client_phone: repair.client?.phone || null,
      client_document: repair.client?.document || null,
      user_name: repair.user?.name || null,
      technician_id: repair.technicianId,
      technician_name: repair.technician?.name || null,
      device_brand: repair.deviceBrand,
      device_model: repair.deviceModel,
      device_serial: repair.deviceSerial,
      screen_size: repair.screenSize,
      problem_desc: repair.problemDesc,
      accessories: repair.accessories,
      diagnosis: repair.diagnosis,
      work_done: repair.workDone,
      parts_used: repair.partsUsed,
      labor_cost: repair.laborCost,
      parts_cost: repair.partsCost,
      total_cost: repair.totalCost,
      advance_payment: repair.advancePayment,
      status: repair.status.toLowerCase(),
      priority: repair.priority.toLowerCase(),
      estimated_date: repair.estimatedDate,
      received_at: repair.receivedAt,
      delivered_at: repair.deliveredAt,
      notes: repair.notes,
      history: repair.history.map(h => ({
        id: h.id,
        old_status: h.oldStatus,
        new_status: h.newStatus,
        comment: h.comment,
        user_name: h.user?.name || null,
        created_at: h.createdAt,
      })),
    });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { client_id, device_brand, device_model, device_serial, screen_size, problem_desc, accessories, priority, estimated_date, notes, technician_id, advance_payment } = req.body;
    const ticketNumber = await generateTicket();

    const repair = await prisma.repair.create({
      data: {
        ticketNumber,
        clientId: client_id ? Number(client_id) : null,
        userId: req.user.id,
        technicianId: technician_id ? Number(technician_id) : null,
        deviceBrand: device_brand,
        deviceModel: device_model || null,
        deviceSerial: device_serial || null,
        screenSize: screen_size || null,
        problemDesc: problem_desc,
        accessories: accessories || null,
        priority: (priority || 'normal').toUpperCase(),
        estimatedDate: estimated_date ? new Date(estimated_date) : null,
        advancePayment: Number(advance_payment) || 0,
        notes: notes || null,
      },
    });

    await prisma.repairHistory.create({
      data: {
        repairId: repair.id,
        userId: req.user.id,
        newStatus: 'recibido',
        comment: 'Equipo recibido en taller',
      },
    });

    res.status(201).json({ id: repair.id, ticket_number: ticketNumber, message: 'Reparación creada' });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { device_brand, device_model, device_serial, screen_size, problem_desc, accessories, diagnosis, work_done, parts_used, labor_cost, parts_cost, estimated_date, technician_id, notes, advance_payment, priority } = req.body;
    const lc = Number(labor_cost) || 0;
    const pc = Number(parts_cost) || 0;

    await prisma.repair.update({
      where: { id: Number(req.params.id) },
      data: {
        deviceBrand: device_brand,
        deviceModel: device_model || null,
        deviceSerial: device_serial || null,
        screenSize: screen_size || null,
        problemDesc: problem_desc,
        accessories: accessories || null,
        diagnosis: diagnosis || null,
        workDone: work_done || null,
        partsUsed: parts_used || null,
        laborCost: lc,
        partsCost: pc,
        totalCost: lc + pc,
        estimatedDate: estimated_date ? new Date(estimated_date) : null,
        technicianId: technician_id ? Number(technician_id) : null,
        notes: notes || null,
        advancePayment: Number(advance_payment) || 0,
        priority: (priority || 'normal').toUpperCase(),
      },
    });
    res.json({ message: 'Reparación actualizada' });
  } catch (err) { next(err); }
};

exports.changeStatus = async (req, res, next) => {
  try {
    const { status, comment } = req.body;
    const repair = await prisma.repair.findUnique({ where: { id: Number(req.params.id) } });
    if (!repair) return res.status(404).json({ error: 'Reparación no encontrada' });

    const oldStatus = repair.status.toLowerCase();
    const updateData = { status: status.toUpperCase() };
    if (status === 'entregado') updateData.deliveredAt = new Date();

    await prisma.repair.update({ where: { id: repair.id }, data: updateData });

    await prisma.repairHistory.create({
      data: {
        repairId: repair.id,
        userId: req.user.id,
        oldStatus,
        newStatus: status,
        comment: comment || '',
      },
    });

    res.json({ message: 'Estado actualizado' });
  } catch (err) { next(err); }
};
