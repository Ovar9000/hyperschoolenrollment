CREATE TABLE `enr_requirement` (
	`application_id` text NOT NULL,
	`kind` text NOT NULL,
	`received_at` integer NOT NULL,
	`received_by` text NOT NULL,
	PRIMARY KEY(`application_id`, `kind`),
	FOREIGN KEY (`application_id`) REFERENCES `enr_application`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fin_assessment` (
	`application_id` text PRIMARY KEY NOT NULL,
	`units` integer NOT NULL,
	`total_centavos` integer NOT NULL,
	`fhe_covered_centavos` integer NOT NULL,
	`net_due_centavos` integer NOT NULL,
	`issued_at` integer NOT NULL,
	`issued_by` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `enr_application`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`issued_by`) REFERENCES `sys_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fin_assessment_line` (
	`application_id` text NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`amount_centavos` integer NOT NULL,
	`fhe_covered` integer NOT NULL,
	`sort` integer NOT NULL,
	PRIMARY KEY(`application_id`, `code`),
	FOREIGN KEY (`application_id`) REFERENCES `fin_assessment`(`application_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fin_fee` (
	`id` text PRIMARY KEY NOT NULL,
	`term_id` text NOT NULL,
	`program_code` text,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`basis` text NOT NULL,
	`amount_centavos` integer NOT NULL,
	`fhe_covered` integer NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`term_id`) REFERENCES `ref_term`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`program_code`) REFERENCES `ref_program`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `fin_fee_term_idx` ON `fin_fee` (`term_id`);--> statement-breakpoint
CREATE TABLE `fin_payment` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`or_number` text NOT NULL,
	`amount_centavos` integer NOT NULL,
	`method` text NOT NULL,
	`paid_at` integer NOT NULL,
	`received_by` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `enr_application`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`received_by`) REFERENCES `sys_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fin_payment_or_number_unique` ON `fin_payment` (`or_number`);--> statement-breakpoint
CREATE INDEX `fin_payment_application_idx` ON `fin_payment` (`application_id`);--> statement-breakpoint
ALTER TABLE `ref_program` ADD `fhe_eligible` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `enr_application` ADD `cancel_reason` text;