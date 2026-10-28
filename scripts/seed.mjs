#!/usr/bin/env node
// Dev/demo seed: one open term, two programs with curricula, block sections and their classes
// (schedule, room, sample professor). Idempotent: safe to run again.
// Usage: npm run db:seed  (start the app once first so migrations have created the tables)
import Database from 'better-sqlite3';

const db = new Database(process.env.DATABASE_URL ?? 'data/enrollment.db');
db.pragma('foreign_keys = ON');

const TERM = '2026-2';
const uuid = () => crypto.randomUUID();
const fixedId = (n) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const hm = (h, m = 0) => h * 60 + m;

// [code, title, lec, lab, credit]
const SUBJECTS = [
	['IT 102', 'Computer Programming 2', 2, 1, 3],
	['IT 103', 'Discrete Mathematics', 3, 0, 3],
	['EDUC 102', 'The Teaching Profession', 3, 0, 3],
	['EDUC 103', 'The Child and Adolescent Learners and Learning Principles', 3, 0, 3],
	['GE 4', 'Mathematics in the Modern World', 3, 0, 3],
	['GE 5', 'Purposive Communication', 3, 0, 3],
	['GE 6', 'Art Appreciation', 3, 0, 3],
	['PE 2', 'Rhythmic Activities', 2, 0, 2],
	['NSTP 2', 'National Service Training Program 2', 3, 0, 3],
	['IT 101', 'Computer Programming 1', 2, 1, 3]
];

const PROGRAMS = {
	BSIT: {
		name: 'Bachelor of Science in Information Technology',
		curriculum: fixedId(101),
		y1s2: ['IT 102', 'IT 103', 'GE 4', 'GE 5', 'GE 6', 'PE 2', 'NSTP 2'],
		y1s1: ['IT 101'],
		sections: ['BSIT 1-A', 'BSIT 1-B']
	},
	BSED: {
		name: 'Bachelor of Secondary Education',
		curriculum: fixedId(102),
		y1s2: ['EDUC 102', 'EDUC 103', 'GE 4', 'GE 5', 'GE 6', 'PE 2', 'NSTP 2'],
		y1s1: [],
		sections: ['BSED 1-A']
	}
};

// Clearly fictional placeholder faculty (replace with real staff via the admin screens later).
const FACULTY = ['A', 'B', 'C', 'D', 'E', 'F'].map((letter, i) => ({
	id: fixedId(900 + i),
	last: 'SAMPLE',
	first: `INSTRUCTOR ${letter}`
}));

// Weekly patterns: MWF 1-hour or TTh 1.5-hour slots. Section index shifts morning/afternoon.
const SLOTS = [
	{ days: [1, 3, 5], start: hm(7, 30), len: 60 },
	{ days: [1, 3, 5], start: hm(8, 30), len: 60 },
	{ days: [1, 3, 5], start: hm(9, 30), len: 60 },
	{ days: [2, 4], start: hm(7, 30), len: 90 },
	{ days: [2, 4], start: hm(9, 0), len: 90 },
	{ days: [1, 3, 5], start: hm(10, 30), len: 60 },
	{ days: [6], start: hm(8, 0), len: 180 }
];

db.transaction(() => {
	db.prepare(
		`INSERT INTO ref_term (id, label, semester, starts_on, ends_on, enrollment_open)
		 VALUES (?, 'AY 2026–2027 · 2nd Semester', 2, '2027-01-11', '2027-05-28', 1)
		 ON CONFLICT(id) DO UPDATE SET semester = 2`
	).run(TERM);

	const subj = db.prepare(
		`INSERT OR IGNORE INTO ref_subject (code, title, lec_units, lab_units, credit_units) VALUES (?, ?, ?, ?, ?)`
	);
	for (const s of SUBJECTS) subj.run(...s);
	db.prepare(
		`INSERT OR IGNORE INTO ref_subject_prerequisite (subject_code, requires_code) VALUES ('IT 102', 'IT 101')`
	).run();

	const person = db.prepare(
		`INSERT OR IGNORE INTO core_person (id, last_name, first_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
	);
	for (const f of FACULTY) person.run(f.id, f.last, f.first, Date.now(), Date.now());

	let slotRoom = 101;
	let facultyTurn = 0;
	for (const [code, p] of Object.entries(PROGRAMS)) {
		db.prepare(
			`INSERT OR IGNORE INTO ref_program (code, name, copc_no, normal_years, active) VALUES (?, ?, NULL, 4, 1)`
		).run(code, p.name);
		db.prepare(
			`INSERT OR IGNORE INTO ref_curriculum (id, program_code, label, effective_ay, active) VALUES (?, ?, ?, 2024, 1)`
		).run(p.curriculum, code, `${code} 2024`);
		const cs = db.prepare(
			`INSERT OR IGNORE INTO ref_curriculum_subject (curriculum_id, subject_code, year_level, semester) VALUES (?, ?, 1, ?)`
		);
		for (const s of p.y1s1) cs.run(p.curriculum, s, 1);
		for (const s of p.y1s2) cs.run(p.curriculum, s, 2);

		const units = p.y1s2.reduce((t, c) => t + SUBJECTS.find((s) => s[0] === c)[4], 0);
		p.sections.forEach((sectionCode, si) => {
			db.prepare(
				`INSERT INTO enr_section (id, term_id, program_code, year_level, code, units, capacity, enrolled)
				 VALUES (?, ?, ?, 1, ?, ?, 40, 0)
				 ON CONFLICT(term_id, code) DO UPDATE SET units = excluded.units`
			).run(uuid(), TERM, code, sectionCode, units);
			const sectionId = db
				.prepare(`SELECT id FROM enr_section WHERE term_id = ? AND code = ?`)
				.get(TERM, sectionCode).id;
			const room = `Rm ${slotRoom++}`;

			p.y1s2.forEach((subjectCode, i) => {
				const classCode = `${subjectCode.replace(' ', '')}-${sectionCode.replace(/[ -]/g, '')}`; // GE4-BSIT1A
				const existing = db
					.prepare(`SELECT id FROM enr_class WHERE term_id = ? AND code = ?`)
					.get(TERM, classCode);
				if (existing) return;
				const classId = uuid();
				const teacher = FACULTY[facultyTurn++ % FACULTY.length];
				db.prepare(
					`INSERT INTO enr_class (id, term_id, subject_code, section_id, code, faculty_person_id, capacity, enrolled)
					 VALUES (?, ?, ?, ?, ?, ?, 40, 0)`
				).run(
					classId,
					TERM,
					subjectCode,
					sectionId,
					classCode,
					subjectCode === 'NSTP 2' ? null : teacher.id
				);
				const slot = SLOTS[i % SLOTS.length];
				const start = slot.start + (si % 2 === 1 ? hm(5) : 0); // B sections in the afternoon
				for (const day of slot.days) {
					db.prepare(
						`INSERT INTO enr_class_meeting (id, class_id, day, start_min, end_min, room) VALUES (?, ?, ?, ?, ?, ?)`
					).run(
						uuid(),
						classId,
						day,
						start,
						start + slot.len,
						subjectCode.startsWith('PE') ? 'Gym' : room
					);
				}
			});
		});
	}

	// Sample fee schedule (centavos). FHE (RA 10931) covers tuition and the listed school fees;
	// student-organization fees are not covered, so FHE students still owe a small amount.
	const fees = [
		['TUITION', 'Tuition', 'PER_UNIT', 20000, 1, null],
		['REG', 'Registration', 'FIXED', 15000, 1, null],
		['LIB', 'Library', 'FIXED', 10000, 1, null],
		['ATH', 'Athletic', 'FIXED', 10000, 1, null],
		['MED', 'Medical and dental', 'FIXED', 5000, 1, null],
		['ID', 'School ID', 'FIXED', 10000, 1, null],
		['CLAB', 'Computer laboratory', 'FIXED', 30000, 1, 'BSIT'],
		['SC', 'Student council', 'FIXED', 5000, 0, null]
	];
	const feeStmt = db.prepare(
		`INSERT OR IGNORE INTO fin_fee (id, term_id, program_code, code, label, basis, amount_centavos, fhe_covered, sort)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	);
	fees.forEach(([code, label, basis, amount, covered, prog], i) =>
		feeStmt.run(fixedId(500 + i), TERM, prog, code, label, basis, amount, covered, i)
	);

	// Backfill: block students seated before classes existed get their class seats now.
	db.prepare(
		`INSERT OR IGNORE INTO enr_class_enrollment (application_id, class_id, status, enrolled_at)
		 SELECT a.id, c.id, 'ENROLLED', ? FROM enr_application a JOIN enr_class c ON c.section_id = a.section_id
		 WHERE a.section_id IS NOT NULL`
	).run(Date.now());
	db.prepare(
		`UPDATE enr_class SET enrolled = (SELECT count(*) FROM enr_class_enrollment e WHERE e.class_id = enr_class.id AND e.status = 'ENROLLED')`
	).run();
})();

const n = (sql) => db.prepare(sql).get().n;
console.log(
	`✓ seeded term ${TERM}: ${n('SELECT count(*) n FROM ref_subject')} subjects, ` +
		`${n('SELECT count(*) n FROM enr_section')} sections, ${n('SELECT count(*) n FROM enr_class')} classes, ` +
		`${n('SELECT count(*) n FROM enr_class_meeting')} meetings`
);
db.close();
