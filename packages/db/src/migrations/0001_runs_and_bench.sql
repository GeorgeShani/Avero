CREATE TYPE "public"."decision_kind" AS ENUM('approved', 'changes-requested', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."risk_tier" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('FINISHED', 'ERROR', 'CANCELLED', 'EXPIRED', 'RUNNING');--> statement-breakpoint
CREATE TABLE "bench_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"suite_pk" uuid NOT NULL,
	"result_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "bench_results_suite_result_unique" UNIQUE("suite_pk","result_id")
);
--> statement-breakpoint
CREATE TABLE "bench_suites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "bench_suites_workspace_slug_unique" UNIQUE("workspace_id","slug")
);
--> statement-breakpoint
CREATE TABLE "hillclimbs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"suite_pk" uuid NOT NULL,
	"hillclimb_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "hillclimbs_suite_hillclimb_unique" UNIQUE("suite_pk","hillclimb_id")
);
--> statement-breakpoint
CREATE TABLE "run_decisions" (
	"run_pk" uuid PRIMARY KEY NOT NULL,
	"decision" "decision_kind" NOT NULL,
	"note" text,
	"decided_at" timestamp with time zone NOT NULL,
	"decided_by" uuid
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"run_id" text NOT NULL,
	"task" text NOT NULL,
	"model" text NOT NULL,
	"status" "run_status" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"duration_ms" integer NOT NULL,
	"total_tokens" double precision NOT NULL,
	"cost_cents" double precision,
	"tool_calls" integer NOT NULL,
	"files_changed" integer NOT NULL,
	"additions" integer NOT NULL,
	"deletions" integer NOT NULL,
	"record_jsonl" text NOT NULL,
	"pushed_by" uuid,
	"pushed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runs_workspace_run_unique" UNIQUE("workspace_id","run_id")
);
--> statement-breakpoint
CREATE TABLE "verdicts" (
	"run_pk" uuid PRIMARY KEY NOT NULL,
	"risk" "risk_tier" NOT NULL,
	"failed_checks" integer NOT NULL,
	"data" jsonb NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bench_results" ADD CONSTRAINT "bench_results_suite_pk_bench_suites_id_fk" FOREIGN KEY ("suite_pk") REFERENCES "public"."bench_suites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bench_suites" ADD CONSTRAINT "bench_suites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hillclimbs" ADD CONSTRAINT "hillclimbs_suite_pk_bench_suites_id_fk" FOREIGN KEY ("suite_pk") REFERENCES "public"."bench_suites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_decisions" ADD CONSTRAINT "run_decisions_run_pk_runs_id_fk" FOREIGN KEY ("run_pk") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_decisions" ADD CONSTRAINT "run_decisions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_pushed_by_users_id_fk" FOREIGN KEY ("pushed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verdicts" ADD CONSTRAINT "verdicts_run_pk_runs_id_fk" FOREIGN KEY ("run_pk") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bench_results_started_idx" ON "bench_results" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "runs_workspace_started_idx" ON "runs" USING btree ("workspace_id","started_at");