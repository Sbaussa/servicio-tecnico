const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const count = await prisma.sale.count({
    where: { createdAt: { gte: startOfYear } },
  });
  return `FAC-${year}-${String(count + 1).padStart(5, '0')}`;
}

exports.getAll = async (req, res, next) => {
  try {
    const { from, to, status, client_id, limit = '50', offset = '0' } = req.query;
    const where = {};
    if (from) where.createdAt = { ...(where.createdAt || {}), gte: new Date(from) };
    if (to)   where.createdAt = { ...(where.createdAt || {}), lte: new Date(to + 'T23:59:59') };
    if (status) where.status = status.toUpperCase();
    if (client_id) where.clientId = Number(client_id);

    const sales = await prisma.sale.findMany({
      where,
      include: {
        client: { select: { name: true } },
        user:   { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    res.json(sales.map(s => ({
      id: s.id,
      invoice_number: s.invoiceNumber,
      client_id: s.clientId,
      client_name: s.client?.name || null,
      user_id: s.userId,
      user_name: s.user?.name || null,
      subtotal: Number(s.subtotal),
      discount: Number(s.discount),
      tax: Number(s.tax),
      total: Number(s.total),
      payment_method: s.paymentMethod.toLowerCase(),
      payment_received: Number(s.paymentReceived),
      change_amount: Number(s.changeAmount),
      status: s.status.toLowerCase(),
      notes: s.notes,
      created_at: s.createdAt,
    })));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        client: { select: { name: true, document: true, phone: true } },
        user:   { select: { name: true } },
        items:  true,
      },
    });
    if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

    res.json({
      id: sale.id,
      invoice_number: sale.invoiceNumber,
      client_name: sale.client?.name || null,
      client_document: sale.client?.document || null,
      client_phone: sale.client?.phone || null,
      user_name: sale.user?.name || null,
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      tax: Number(sale.tax),
      total: Number(sale.total),
      payment_method: sale.paymentMethod.toLowerCase(),
      payment_received: Number(sale.paymentReceived),
      change_amount: Number(sale.changeAmount),
      status: sale.status.toLowerCase(),
      notes: sale.notes,
      created_at: sale.createdAt,
      items: sale.items.map(i => ({
        id: i.id,
        product_id: i.productId,
        product_name: i.productName,
        product_code: i.productCode,
        quantity: i.quantity,
        unit_price: Number(i.unitPrice),
        discount: Number(i.discount),
        subtotal: Number(i.subtotal),
      })),
    });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { client_id, items, payment_method, notes } = req.body;
    const discount         = Number(req.body.discount)         || 0;
    const tax              = Number(req.body.tax)              || 0;
    const payment_received = Number(req.body.payment_received) || 0;

    if (!items?.length) return res.status(400).json({ error: 'Se requieren productos' });

    const invoiceNumber = await generateInvoiceNumber();

    const result = await prisma.$transaction(async (tx) => {
      let subtotal = 0;

      for (const item of items) {
        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.unit_price) || 0;
        const itemDisc = Number(item.discount) || 0;
        const prod = await tx.product.findFirst({ where: { id: item.product_id, active: true } });
        if (!prod) throw { status: 400, message: `Producto ${item.product_id} no encontrado` };
        if (prod.stock < qty) throw { status: 400, message: `Stock insuficiente para ${prod.name}` };
        subtotal += unitPrice * qty - itemDisc;
      }

      const total = Math.max(0, subtotal - discount + tax);
      const changeAmount = Math.max(0, payment_received - total);

      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          clientId: client_id ? Number(client_id) : null,
          userId: req.user.id,
          subtotal,
          discount,
          tax,
          total,
          paymentMethod: (payment_method || 'efectivo').toUpperCase(),
          paymentReceived: payment_received || total,
          changeAmount,
          notes: notes || null,
        },
      });

      for (const item of items) {
        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.unit_price) || 0;
        const itemDisc = Number(item.discount) || 0;
        const itemSubtotal = unitPrice * qty - itemDisc;
        const prod = await tx.product.findUnique({ where: { id: item.product_id } });

        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.product_id,
            productName: prod.name,
            productCode: prod.code || null,
            quantity: qty,
            unitPrice,
            discount: itemDisc,
            subtotal: itemSubtotal,
          },
        });

        const newStock = prod.stock - qty;
        await tx.product.update({ where: { id: prod.id }, data: { stock: newStock } });

        await tx.inventoryMovement.create({
          data: {
            productId: prod.id,
            userId: req.user.id,
            type: 'VENTA',
            quantity: qty,
            stockBefore: prod.stock,
            stockAfter: newStock,
            reference: invoiceNumber,
            notes: 'Venta POS',
          },
        });
      }

      if (client_id) {
        await tx.client.update({
          where: { id: Number(client_id) },
          data: { totalPurchases: { increment: total } },
        });
      }

      return { id: sale.id, invoice_number: invoiceNumber, total, change_amount: changeAmount };
    });

    res.status(201).json({ ...result, message: 'Venta registrada' });
  } catch (err) { next(err); }
};

exports.cancel = async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: Number(req.params.id), status: 'COMPLETADA' },
        include: { items: true },
      });
      if (!sale) throw { status: 400, message: 'Venta no encontrada o ya anulada' };

      for (const item of sale.items) {
        if (item.productId) {
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          const newStock = prod.stock + item.quantity;
          await tx.product.update({ where: { id: prod.id }, data: { stock: newStock } });
          await tx.inventoryMovement.create({
            data: {
              productId: prod.id,
              userId: req.user.id,
              type: 'ENTRADA',
              quantity: item.quantity,
              stockBefore: prod.stock,
              stockAfter: newStock,
              reference: sale.invoiceNumber,
              notes: 'Anulación venta',
            },
          });
        }
      }

      await tx.sale.update({ where: { id: sale.id }, data: { status: 'ANULADA' } });

      if (sale.clientId) {
        await tx.client.update({
          where: { id: sale.clientId },
          data: { totalPurchases: { decrement: Number(sale.total) } },
        });
      }

      return { message: 'Venta anulada' };
    });

    res.json(result);
  } catch (err) { next(err); }
};