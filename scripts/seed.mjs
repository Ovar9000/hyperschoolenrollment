#!/usr/bin/env node
// Dev/demo seed: one open term, two programs, block sections. Idempotent.
// Usage: npm run db:seed  (run the app once first so migrations have created the tables)
import Database from 'better-sqlite3';

const db = new Database(process.env.DATABASE_URL ?? 'data/enrollment.db');
db.pragma('foreign_keys = ON');

const uuid = () => crypto.randomUUID();

db.transaction(() => {
	db.prepare(
		`INSERT OR IGNORE INTO ref_term (id, label, starts_on, ends_on, enrollment_open)
		 VALUES ('2026-2', 'AY 2026–2027 · 2nd Semester', '2027-01-11', '2027-05-28', 1)`
	).run();

	const program = db.prepare(
		`INSERT OR IGNORE INTO ref_program (code, name, copc_no, normal_years, active) VALUES (?, ?, ?, ?, 1)`
	);
	program.run('BSIT', 'Bachelor of Science in Information Technology', null, 4);
	program.run('BSED', 'Bachelor of Secondary Education', null, 4);

	const section = db.prepare(
		`INSERT OR IGNORE INTO enr_section (id, term_id, program_code, year_level, code, units, capacity, enrolled)
		 VALUES (?, '2026-2', ?, 1, ?, 23, 40, 0)`
	);
	for (const [prog, code] of [
		['BSIT', 'BSIT 1-A'],
		['BSIT', 'BSIT 1-B'],
		['BSED', 'BSED 1-A']
	]) {
		section.run(uuid(), prog, code);
	}
})();

console.log('✓ seeded term 2026-2, programs BSIT/BSED, 3 block sections');
db.close();
