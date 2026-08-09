SELECT b."blockId", b.status, b.label, b."targetCount",
       COUNT(c.id)::int AS line_count,
       COALESCE(SUM(c.quantity), 0)::int AS total_qty
FROM "Block" b
LEFT JOIN "CardLine" c ON c."blockId" = b.id
GROUP BY b.id
ORDER BY b."blockId";

SELECT c.name, c."setCode", c.quantity, c.position, b."blockId"
FROM "CardLine" c
JOIN "Block" b ON b.id = c."blockId"
ORDER BY b."blockId", c.position;
