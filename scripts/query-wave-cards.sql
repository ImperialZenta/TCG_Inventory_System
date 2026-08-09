SELECT b."blockId", s.code AS shelf, bin."binId",
       c.name, c."setCode", c."collectorNumber", c.condition, c.finish, c.language, c."scryfallId", c.position
FROM "CardLine" c
JOIN "Block" b ON b.id = c."blockId"
LEFT JOIN "Bin" bin ON bin.id = b."binId"
LEFT JOIN "Shelf" s ON s.id = bin."shelfId"
WHERE (b."blockId" = 'MTG-0001' AND c.position = 1)
   OR (b."blockId" = 'MTG-0006' AND c.position = 1);
