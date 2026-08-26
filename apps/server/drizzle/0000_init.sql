CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`tool_call_id` text NOT NULL,
	`thread_id` text,
	`action_type` text NOT NULL,
	`description` text NOT NULL,
	`payload` text,
	`decision` text,
	`rejection_reason` text,
	`decided_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `approvals_job_idx` ON `approvals` (`job_id`);--> statement-breakpoint
CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`path` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `artifacts_job_idx` ON `artifacts` (`job_id`);--> statement-breakpoint
CREATE TABLE `conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`conflict_type` text NOT NULL,
	`description` text NOT NULL,
	`affected_parties` text DEFAULT '[]' NOT NULL,
	`raw_data` text,
	`sandbox_script` text,
	`sandbox_output` text,
	`resolution` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conflicts_job_idx` ON `conflicts` (`job_id`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`party_id` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`path` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `files_job_idx` ON `files` (`job_id`);--> statement-breakpoint
CREATE TABLE `job_log` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`party_id` text,
	`direction` text NOT NULL,
	`message` text NOT NULL,
	`message_type` text DEFAULT 'chat' NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `job_log_job_idx` ON `job_log` (`job_id`);--> statement-breakpoint
CREATE INDEX `job_log_party_idx` ON `job_log` (`party_id`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'planning' NOT NULL,
	`execution_plan` text,
	`trueforge_session_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `parties` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`channel` text DEFAULT 'chat' NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `parties_job_idx` ON `parties` (`job_id`);--> statement-breakpoint
CREATE TABLE `party_registry` (
	`id` text PRIMARY KEY NOT NULL,
	`party_name_normalized` text NOT NULL,
	`party_type` text NOT NULL,
	`job_id` text NOT NULL,
	`job_title` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `party_registry_name_idx` ON `party_registry` (`party_name_normalized`);--> statement-breakpoint
CREATE TABLE `steps` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`sequence_num` integer NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`required_parties` text DEFAULT '[]' NOT NULL,
	`depends_on` text DEFAULT '[]' NOT NULL,
	`conditions` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text,
	`completed_at` text,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `steps_job_idx` ON `steps` (`job_id`);