CREATE TABLE `appareil` (
	`id` text PRIMARY KEY NOT NULL,
	`joueur_id` integer NOT NULL,
	`vu_le` integer NOT NULL,
	`cree_le` integer NOT NULL,
	FOREIGN KEY (`joueur_id`) REFERENCES `joueur`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `appareil_joueur_id_idx` ON `appareil` (`joueur_id`);--> statement-breakpoint
CREATE TABLE `joueur` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text NOT NULL,
	`cree_le` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `journal` (
	`id` integer PRIMARY KEY NOT NULL,
	`partie_id` integer NOT NULL,
	`geste` text NOT NULL,
	`joueur_agissant_id` integer NOT NULL,
	`appareil_id` text,
	`manche_numero` integer,
	`joueur_concerne_id` integer,
	`detail` text,
	`ecrit_le` integer NOT NULL,
	FOREIGN KEY (`partie_id`) REFERENCES `partie`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`joueur_agissant_id`) REFERENCES `joueur`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appareil_id`) REFERENCES `appareil`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`joueur_concerne_id`) REFERENCES `joueur`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `journal_partie_id_ecrit_le_idx` ON `journal` (`partie_id`,"ecrit_le" desc);--> statement-breakpoint
CREATE TABLE `manche` (
	`id` integer PRIMARY KEY NOT NULL,
	`partie_id` integer NOT NULL,
	`numero` integer NOT NULL,
	`close_le` integer,
	`close_par` integer,
	FOREIGN KEY (`partie_id`) REFERENCES `partie`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`close_par`) REFERENCES `joueur`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `manche_partie_id_numero_unique` ON `manche` (`partie_id`,`numero`);--> statement-breakpoint
CREATE TABLE `participant` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`partie_id` integer NOT NULL,
	`joueur_id` integer NOT NULL,
	`retire_le` integer,
	FOREIGN KEY (`partie_id`) REFERENCES `partie`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`joueur_id`) REFERENCES `joueur`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participant_partie_id_joueur_id_unique` ON `participant` (`partie_id`,`joueur_id`);--> statement-breakpoint
CREATE INDEX `participant_joueur_id_idx` ON `participant` (`joueur_id`);--> statement-breakpoint
CREATE TABLE `partie` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`jeu_id` text NOT NULL,
	`regles` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`fin_le` integer,
	`fin_cause` text,
	`fin_par` integer,
	`cree_le` integer NOT NULL,
	FOREIGN KEY (`fin_par`) REFERENCES `joueur`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "partie_fin_coherente" CHECK(("partie"."fin_le" is null) = ("partie"."fin_cause" is null) and ("partie"."fin_le" is null) = ("partie"."fin_par" is null)),
	CONSTRAINT "partie_fin_cause_connue" CHECK("partie"."fin_cause" is null or "partie"."fin_cause" in ('terminee', 'abandonnee'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partie_code_unique` ON `partie` (`code`);--> statement-breakpoint
CREATE INDEX `partie_fin_le_idx` ON `partie` ("fin_le" desc) WHERE "partie"."fin_le" is not null;--> statement-breakpoint
CREATE INDEX `partie_jeu_id_idx` ON `partie` (`jeu_id`);--> statement-breakpoint
CREATE TABLE `saisie` (
	`id` integer PRIMARY KEY NOT NULL,
	`manche_id` integer NOT NULL,
	`joueur_id` integer NOT NULL,
	`valeur` integer,
	FOREIGN KEY (`manche_id`) REFERENCES `manche`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`joueur_id`) REFERENCES `joueur`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "saisie_valeur_positive" CHECK("saisie"."valeur" is null or "saisie"."valeur" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saisie_manche_id_joueur_id_unique` ON `saisie` (`manche_id`,`joueur_id`);