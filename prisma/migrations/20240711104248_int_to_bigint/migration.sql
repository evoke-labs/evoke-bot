/*
  Warnings:

  - The primary key for the `Issue` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PointAllocation` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE `PointAllocation` DROP FOREIGN KEY `PointAllocation_issueId_fkey`;

-- AlterTable
ALTER TABLE `Issue` DROP PRIMARY KEY,
    MODIFY `id` BIGINT NOT NULL AUTO_INCREMENT,
    MODIFY `githubId` BIGINT NOT NULL,
    MODIFY `assigneeId` BIGINT NULL,
    MODIFY `cardId` BIGINT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `PointAllocation` DROP PRIMARY KEY,
    MODIFY `id` BIGINT NOT NULL AUTO_INCREMENT,
    MODIFY `points` BIGINT NOT NULL,
    MODIFY `issueId` BIGINT NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AddForeignKey
ALTER TABLE `PointAllocation` ADD CONSTRAINT `PointAllocation_issueId_fkey` FOREIGN KEY (`issueId`) REFERENCES `Issue`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
