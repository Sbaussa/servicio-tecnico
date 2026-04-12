const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.dashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd   = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Sales today
    const salesToday = await prisma.sale.aggregate({
      where: { createdAt: { gte: todayStart, lt: todayEnd }, status: 'COMPLETADA' },
      _count: true,
      _sum: { total: true },
    });

    // Sales month
    const salesMonth = await prisma.sale.aggregate({
      where: { createdAt: { gte: monthStart }, status: 'COMPLETADA' },
      _count: true,
      _sum: { total: true },
    });

    // Repairs open
    const repairsOpen = await prisma.repair.count({
      where: { status: { notIn: ['ENTREGADO', 'NO_REPARA'] } },
    });
    const repairsReady = await prisma.repair.count({ where: { status: 'LISTO' } });

    // Low stock
    const allProducts = await prisma.product.findMany({
      where: { active: true },
      select: { stock: true, minStock: true },
    });
    const lowStockCount = allProducts.filter(p => p.stock <= p.minStock).length;

    // Sales chart (last 30 days) — raw query for grouping by date
    const salesChart = await prisma.$queryRaw`
      SELECT DATE("createdAt") as date, SUM(total) as total, COUNT(*)::int as count
      FROM "Sale"
      WHERE "createdAt" >= ${thirtyDaysAgo} AND status = 'COMPLETADA'
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    // Top products this month
    const topProducts = await prisma.$queryRaw`
      SELECT p.name, p.code, SUM(si.quantity)::int as qty_sold, SUM(si.subtotal) as revenue
      FROM "SaleItem" si
      JOIN "Product" p ON si."productId" = p.id
      JOIN "Sale" s ON si."saleId" = s.id
      WHERE s.status = 'COMPLETADA' AND s."createdAt" >= ${monthStart}
      GROUP BY p.id, p.name, p.code
      ORDER BY qty_sold DESC
      LIMIT 5
    `;

    // Recent repairs
    const recentRepairs = await prisma.repair.findMany({
      include: { client: { select: { name: true } } },
      orderBy: { receivedAt: 'desc' },
      take: 5,
    });

    res.json({
      sales_today: { count: salesToday._count, total: salesToday._sum.total || 0 },
      sales_month: { count: salesMonth._count, total: salesMonth._sum.total || 0 },
      repairs_open: repairsOpen,
      repairs_ready: repairsReady,
      low_stock_count: lowStockCount,
      sales_chart: salesChart.map(r => ({ date: r.date, total: Number(r.total), count: r.count })),
      top_products: topProducts.map(p => ({ name: p.name, code: p.code, qty_sold: p.qty_sold, revenue: Number(p.revenue) })),
      recent_repairs: recentRepairs.map(r => ({
        ticket_number: r.ticketNumber,
        device_brand: r.deviceBrand,
        device_model: r.deviceModel,
        status: r.status.toLowerCase(),
        priority: r.priority.toLowerCase(),
        client_name: r.client?.name || null,
      })),
    });
  } catch (err) { next(err); }
};

exports.salesReport = async (req, res, next) => {
  try {
    const { from, to, group_by = 'day' } = req.query;
    const groupFormat = group_by === 'month' ? 'YYYY-MM' : group_by === 'year' ? 'YYYY' : 'YYYY-MM-DD';

    const rows = await prisma.$queryRawUnsafe(`
      SELECT TO_CHAR("createdAt", '${groupFormat}') as period,
             COUNT(*)::int as sales_count,
             SUM(total) as revenue,
             SUM(discount) as discounts,
             AVG(total) as avg_ticket
      FROM "Sale"
      WHERE status = 'COMPLETADA' AND DATE("createdAt") BETWEEN $1::date AND $2::date
      GROUP BY period ORDER BY period ASC
    `, from, to);

    res.json(rows.map(r => ({
      period: r.period,
      sales_count: r.sales_count,
      revenue: Number(r.revenue),
      discounts: Number(r.discounts),
      avg_ticket: Number(r.avg_ticket),
    })));
  } catch (err) { next(err); }
};

exports.inventoryReport = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      include: { category: { select: { name: true } } },
      orderBy: { stock: 'asc' },
    });

    res.json(products.map(p => ({
      id: p.id, code: p.code, name: p.name, brand: p.brand,
      category: p.category?.name || null,
      stock: p.stock, min_stock: p.minStock,
      purchase_price: p.purchasePrice, sale_price: p.salePrice,
      inventory_value: Number(p.purchasePrice) * p.stock,
      stock_status: p.stock === 0 ? 'agotado' : p.stock <= p.minStock ? 'bajo' : 'ok',
    })));
  } catch (err) { next(err); }
};

exports.repairsReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const byStatus = await prisma.$queryRaw`
      SELECT LOWER(status::text) as status, COUNT(*)::int as count
      FROM "Repair"
      WHERE DATE("receivedAt") BETWEEN ${from}::date AND ${to}::date
      GROUP BY status
    `;
    const byTech = await prisma.$queryRaw`
      SELECT u.name as technician, COUNT(*)::int as count, SUM(r."totalCost") as revenue
      FROM "Repair" r LEFT JOIN "User" u ON r."technicianId" = u.id
      WHERE DATE(r."receivedAt") BETWEEN ${from}::date AND ${to}::date
      GROUP BY r."technicianId", u.name
    `;
    res.json({
      by_status: byStatus,
      by_technician: byTech.map(t => ({ technician: t.technician, count: t.count, revenue: Number(t.revenue || 0) })),
    });
  } catch (err) { next(err); }
};