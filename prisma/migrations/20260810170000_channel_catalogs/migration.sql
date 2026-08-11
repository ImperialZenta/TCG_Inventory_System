-- CreateTable
CREATE TABLE "ChannelCatalog" (
    "id" TEXT NOT NULL,
    "channel" "BlockChannel" NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelCatalogBin" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "binId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelCatalogBin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelCatalog_channel_idx" ON "ChannelCatalog"("channel");

-- CreateIndex
CREATE INDEX "ChannelCatalogBin_binId_idx" ON "ChannelCatalogBin"("binId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelCatalogBin_catalogId_binId_key" ON "ChannelCatalogBin"("catalogId", "binId");

-- AddForeignKey
ALTER TABLE "ChannelCatalogBin" ADD CONSTRAINT "ChannelCatalogBin_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "ChannelCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelCatalogBin" ADD CONSTRAINT "ChannelCatalogBin_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
