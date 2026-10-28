-- RA 10173 accountability + event-log integrity: these tables can only grow.
CREATE TRIGGER sys_audit_log_no_update BEFORE UPDATE ON sys_audit_log
BEGIN SELECT RAISE(ABORT, 'sys_audit_log is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER sys_audit_log_no_delete BEFORE DELETE ON sys_audit_log
BEGIN SELECT RAISE(ABORT, 'sys_audit_log is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER sys_event_no_update BEFORE UPDATE ON sys_event
BEGIN SELECT RAISE(ABORT, 'sys_event is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER sys_event_no_delete BEFORE DELETE ON sys_event
BEGIN SELECT RAISE(ABORT, 'sys_event is append-only'); END;
