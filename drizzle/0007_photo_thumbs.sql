ALTER TABLE `photo` ADD `thumb_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `photo_thumb_key_unique` ON `photo` (`thumb_key`);