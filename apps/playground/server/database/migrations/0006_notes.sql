CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_by` text,
	`updated_by` text,
	`deleted_at` integer,
	`deleted_by` text,
	`deletion_id` text,
	`deleted_reason` text
);
--> statement-breakpoint
CREATE INDEX `notes_trash_idx` ON `notes` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `notes_batch_idx` ON `notes` (`deletion_id`);