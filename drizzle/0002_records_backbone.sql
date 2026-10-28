CREATE TABLE `ref_curriculum` (
	`id` text PRIMARY KEY NOT NULL,
	`program_code` text NOT NULL,
	`label` text NOT NULL,
	`effective_ay` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`program_code`) REFERENCES `ref_program`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ref_curriculum_subject` (
	`curriculum_id` text NOT NULL,
	`subject_code` text NOT NULL,
	`year_level` integer NOT NULL,
	`semester` integer NOT NULL,
	PRIMARY KEY(`curriculum_id`, `subject_code`),
	FOREIGN KEY (`curriculum_id`) REFERENCES `ref_curriculum`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_code`) REFERENCES `ref_subject`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ref_curriculum_subject_slot_idx` ON `ref_curriculum_subject` (`curriculum_id`,`year_level`,`semester`);--> statement-breakpoint
CREATE TABLE `ref_subject` (
	`code` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`lec_units` integer DEFAULT 0 NOT NULL,
	`lab_units` integer DEFAULT 0 NOT NULL,
	`credit_units` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ref_subject_prerequisite` (
	`subject_code` text NOT NULL,
	`requires_code` text NOT NULL,
	PRIMARY KEY(`subject_code`, `requires_code`),
	FOREIGN KEY (`subject_code`) REFERENCES `ref_subject`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requires_code`) REFERENCES `ref_subject`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rec_student` (
	`person_id` text PRIMARY KEY NOT NULL,
	`student_no` text NOT NULL,
	`program_code` text NOT NULL,
	`curriculum_id` text NOT NULL,
	`admit_term_id` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `core_person`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`program_code`) REFERENCES `ref_program`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`curriculum_id`) REFERENCES `ref_curriculum`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`admit_term_id`) REFERENCES `ref_term`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rec_student_student_no_unique` ON `rec_student` (`student_no`);--> statement-breakpoint
CREATE INDEX `rec_student_program_idx` ON `rec_student` (`program_code`,`status`);--> statement-breakpoint
CREATE TABLE `rec_student_no_counter` (
	`year` integer PRIMARY KEY NOT NULL,
	`last` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `enr_class_enrollment` (
	`application_id` text NOT NULL,
	`class_id` text NOT NULL,
	`status` text DEFAULT 'ENROLLED' NOT NULL,
	`enrolled_at` integer NOT NULL,
	PRIMARY KEY(`application_id`, `class_id`),
	FOREIGN KEY (`application_id`) REFERENCES `enr_application`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `enr_class`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `enr_class_enrollment_class_idx` ON `enr_class_enrollment` (`class_id`);--> statement-breakpoint
CREATE TABLE `enr_class_meeting` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`day` integer NOT NULL,
	`start_min` integer NOT NULL,
	`end_min` integer NOT NULL,
	`room` text,
	FOREIGN KEY (`class_id`) REFERENCES `enr_class`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "enr_class_meeting_time_ck" CHECK("enr_class_meeting"."start_min" < "enr_class_meeting"."end_min" AND "enr_class_meeting"."day" BETWEEN 1 AND 7)
);
--> statement-breakpoint
CREATE INDEX `enr_class_meeting_class_idx` ON `enr_class_meeting` (`class_id`);--> statement-breakpoint
CREATE TABLE `enr_class` (
	`id` text PRIMARY KEY NOT NULL,
	`term_id` text NOT NULL,
	`subject_code` text NOT NULL,
	`section_id` text,
	`code` text NOT NULL,
	`faculty_person_id` text,
	`capacity` integer NOT NULL,
	`enrolled` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`term_id`) REFERENCES `ref_term`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_code`) REFERENCES `ref_subject`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`section_id`) REFERENCES `enr_section`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`faculty_person_id`) REFERENCES `core_person`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "enr_class_capacity_ck" CHECK("enr_class"."enrolled" >= 0 AND "enr_class"."enrolled" <= "enr_class"."capacity")
);
--> statement-breakpoint
CREATE INDEX `enr_class_section_idx` ON `enr_class` (`section_id`);--> statement-breakpoint
CREATE INDEX `enr_class_subject_idx` ON `enr_class` (`term_id`,`subject_code`);--> statement-breakpoint
CREATE INDEX `enr_class_faculty_idx` ON `enr_class` (`term_id`,`faculty_person_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `enr_class_term_code_uq` ON `enr_class` (`term_id`,`code`);--> statement-breakpoint
CREATE TABLE `sys_session` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `sys_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sys_session_user_idx` ON `sys_session` (`user_id`);--> statement-breakpoint
CREATE TABLE `sys_user` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`roles` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`must_change_password` integer DEFAULT true NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `core_person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sys_user_person_id_unique` ON `sys_user` (`person_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sys_user_username_unique` ON `sys_user` (`username`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_core_person` (
	`id` text PRIMARY KEY NOT NULL,
	`last_name` text NOT NULL,
	`first_name` text NOT NULL,
	`middle_name` text,
	`suffix` text,
	`sex_at_birth` text,
	`birthdate` text,
	`mobile` text,
	`email` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_core_person`("id", "last_name", "first_name", "middle_name", "suffix", "sex_at_birth", "birthdate", "mobile", "email", "created_at", "updated_at") SELECT "id", "last_name", "first_name", "middle_name", "suffix", "sex_at_birth", "birthdate", "mobile", "email", "created_at", "updated_at" FROM `core_person`;--> statement-breakpoint
DROP TABLE `core_person`;--> statement-breakpoint
ALTER TABLE `__new_core_person` RENAME TO `core_person`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `ref_term` ADD `semester` integer DEFAULT 1 NOT NULL;