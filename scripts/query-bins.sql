SELECT s.code AS shelf, bin."binId", bin.label
FROM "Bin" bin
JOIN "Shelf" s ON s.id = bin."shelfId"
ORDER BY s."sortOrder", bin."sortOrder";
