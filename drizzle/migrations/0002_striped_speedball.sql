CREATE TABLE `stations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`brand` text DEFAULT 'Independente' NOT NULL,
	`address` text DEFAULT 'Endereço não cadastrado' NOT NULL,
	`neighborhood` text DEFAULT 'Manaus' NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`cnpj` text,
	`amenities` text DEFAULT '[]' NOT NULL,
	`osmId` text,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
