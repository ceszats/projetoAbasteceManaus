CREATE TABLE `confirmations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contributionId` integer NOT NULL,
	`userId` integer NOT NULL,
	`isValid` integer NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
