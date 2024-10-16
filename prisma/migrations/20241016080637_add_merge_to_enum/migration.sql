-- AlterTable
ALTER TABLE `PointAllocation` MODIFY `type` ENUM('Assignee', 'Reviewer', 'Helper', 'BestPractices', 'Reusability', 'ExtraMile', 'Readablilty', 'RND', 'DevTesting', 'Merge', 'Other') NOT NULL;
