SELECT b."blockId", b.status, bin."binId", s.code AS shelf
FROM "Block" b
LEFT JOIN "Bin" bin ON bin.id = b."binId"
LEFT JOIN "Shelf" s ON s.id = bin."shelfId"
ORDER BY b."blockId";
