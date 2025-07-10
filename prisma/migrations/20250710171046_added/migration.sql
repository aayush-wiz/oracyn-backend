/*
  Warnings:

  - A unique constraint covering the columns `[title]` on the table `Chat` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Chat_title_key" ON "Chat"("title");
