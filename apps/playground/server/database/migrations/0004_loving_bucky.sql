PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_article_categories` (
	`article_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	PRIMARY KEY(`article_id`, `category_id`),
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_article_categories`("article_id", "category_id") SELECT "article_id", "category_id" FROM `article_categories`;--> statement-breakpoint
DROP TABLE `article_categories`;--> statement-breakpoint
ALTER TABLE `__new_article_categories` RENAME TO `article_categories`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_article_tags` (
	`article_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`article_id`, `tag_id`),
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_article_tags`("article_id", "tag_id") SELECT "article_id", "tag_id" FROM `article_tags`;--> statement-breakpoint
DROP TABLE `article_tags`;--> statement-breakpoint
ALTER TABLE `__new_article_tags` RENAME TO `article_tags`;--> statement-breakpoint
ALTER TABLE `users` ADD `signup_ip` text;--> statement-breakpoint
ALTER TABLE `users` ADD `signup_country` text;--> statement-breakpoint
ALTER TABLE `users` ADD `signup_meta` text;--> statement-breakpoint
ALTER TABLE `users` ADD `last_ip` text;--> statement-breakpoint
ALTER TABLE `users` ADD `last_seen` integer;