SELECT b."blockId", b.status, bin."binId", s.code AS shelf,
       c.name, c."setCode", c."collectorNumber", c.condition, c.finish, c.language,
       c."scryfallId", c.position, c.quantity
FROM "CardLine" c
JOIN "Block" b ON b.id = c."blockId"
LEFT JOIN "Bin" bin ON bin.id = b."binId"
LEFT JOIN "Shelf" s ON s.id = bin."shelfId"
WHERE c.quantity > 0
  AND b.status IN ('ACTIVE', 'SEALED')
  AND c."isBulkLine" = false
ORDER BY b."blockId", c.position;
