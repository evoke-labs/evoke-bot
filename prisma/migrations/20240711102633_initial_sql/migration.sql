-- CreateTable
CREATE TABLE `PointAllocation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requestedBy` VARCHAR(191) NULL,
    `allocatedTo` VARCHAR(191) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `rejectedBy` VARCHAR(191) NULL,
    `type` ENUM('Assignee', 'Reviewer', 'Helper', 'BestPractices', 'Reusability', 'ExtraMile', 'Readablilty', 'RND', 'DevTesting', 'Other') NOT NULL,
    `points` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `issueId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Issue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `githubId` INTEGER NOT NULL,
    `assigneeId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `cardId` INTEGER NULL,
    `closed` BOOLEAN NULL DEFAULT false,
    `closedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Issue_githubId_key`(`githubId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PointAllocation` ADD CONSTRAINT `PointAllocation_issueId_fkey` FOREIGN KEY (`issueId`) REFERENCES `Issue`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
