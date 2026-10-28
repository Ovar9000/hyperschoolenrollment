CREATE TABLE `core_address` (
	`person_id` text NOT NULL,
	`kind` text NOT NULL,
	`psgc_barangay` text,
	`psgc_city_mun` text,
	`psgc_province` text,
	`line` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`person_id`, `kind`),
	FOREIGN KEY (`person_id`) REFERENCES `core_person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `core_consent` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`purpose` text NOT NULL,
	`notice_version` text NOT NULL,
	`guardian_name` text,
	`granted_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`person_id`) REFERENCES `core_person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `core_consent_person_idx` ON `core_consent` (`person_id`);--> statement-breakpoint
CREATE TABLE `core_person` (
	`id` text PRIMARY KEY NOT NULL,
	`last_name` text NOT NULL,
	`first_name` text NOT NULL,
	`middle_name` text,
	`suffix` text,
	`sex_at_birth` text NOT NULL,
	`birthdate` text NOT NULL,
	`mobile` text,
	`email` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `core_person_identifier` (
	`scheme` text NOT NULL,
	`value` text NOT NULL,
	`person_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`scheme`, `value`),
	FOREIGN KEY (`person_id`) REFERENCES `core_person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `core_person_identifier_person_idx` ON `core_person_identifier` (`person_id`);--> statement-breakpoint
CREATE TABLE `ref_program` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`copc_no` text,
	`normal_years` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ref_term` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`enrollment_open` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `enr_application` (
	`id` text PRIMARY KEY NOT NULL,
	`ref_code` text NOT NULL,
	`person_id` text NOT NULL,
	`term_id` text NOT NULL,
	`program_code` text NOT NULL,
	`year_level` integer NOT NULL,
	`mode` text NOT NULL,
	`section_id` text,
	`status` text DEFAULT 'SUBMITTED' NOT NULL,
	`fhe_status` text DEFAULT 'PENDING' NOT NULL,
	`submitted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `core_person`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`term_id`) REFERENCES `ref_term`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`program_code`) REFERENCES `ref_program`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`section_id`) REFERENCES `enr_section`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enr_application_ref_code_unique` ON `enr_application` (`ref_code`);--> statement-breakpoint
CREATE INDEX `enr_application_status_idx` ON `enr_application` (`term_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `enr_application_person_term_uq` ON `enr_application` (`person_id`,`term_id`);--> statement-breakpoint
CREATE TABLE `enr_document` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`kind` text NOT NULL,
	`storage_path` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`uploaded_at` integer NOT NULL,
	`hardcopy_verified_at` integer,
	`hardcopy_verified_by` text,
	FOREIGN KEY (`application_id`) REFERENCES `enr_application`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `enr_document_application_idx` ON `enr_document` (`application_id`);--> statement-breakpoint
CREATE TABLE `enr_section` (
	`id` text PRIMARY KEY NOT NULL,
	`term_id` text NOT NULL,
	`program_code` text NOT NULL,
	`year_level` integer NOT NULL,
	`code` text NOT NULL,
	`units` integer NOT NULL,
	`capacity` integer NOT NULL,
	`enrolled` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`term_id`) REFERENCES `ref_term`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`program_code`) REFERENCES `ref_program`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "enr_section_capacity_ck" CHECK("enr_section"."enrolled" >= 0 AND "enr_section"."enrolled" <= "enr_section"."capacity")
);
--> statement-breakpoint
CREATE INDEX `enr_section_lookup_idx` ON `enr_section` (`term_id`,`program_code`,`year_level`);--> statement-breakpoint
CREATE UNIQUE INDEX `enr_section_term_code_uq` ON `enr_section` (`term_id`,`code`);--> statement-breakpoint
CREATE TABLE `sys_audit_log` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`ip` text
);
--> statement-breakpoint
CREATE INDEX `sys_audit_log_entity_idx` ON `sys_audit_log` (`entity`,`entity_id`);--> statement-breakpoint
CREATE TABLE `sys_event` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`type` text NOT NULL,
	`subject` text NOT NULL,
	`data` text NOT NULL,
	`time` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sys_event_id_unique` ON `sys_event` (`id`);--> statement-breakpoint
CREATE INDEX `sys_event_type_idx` ON `sys_event` (`type`,`seq`);