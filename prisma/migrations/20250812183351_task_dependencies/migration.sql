/*
  Warnings:

  - You are about to drop the `_TaskDeps` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_TaskDeps";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Dependency" (
    "fromId" INTEGER NOT NULL,
    "toId" INTEGER NOT NULL,

    PRIMARY KEY ("fromId", "toId"),
    CONSTRAINT "Dependency_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Todo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Dependency_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Todo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Dependency_toId_idx" ON "Dependency"("toId");
