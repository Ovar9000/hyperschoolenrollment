#!/usr/bin/env node
// End-to-end lifecycle test over real HTTP against the production build, in a throwaway database:
// student submits → Registrar accepts, checks documents, assesses → Cashier records the OR → official.
// Also: role checks, wrong amounts, duplicate ORs, a double-click race, cancel/move seat release,
// the student status lookup, and that every seat counter still equals the rows it counts.
// Run after `npm run build`:  npm run test:e2e
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 4182;
const BASE = `http://localhost:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), 'e2e-'));
const env = {
	...process.env,
	DATABASE_URL: join(dir, 'e2e.db'),
	PORT: String(PORT),
	HOST: '127.0.0.1',
	PROTOCOL_HEADER: 'x-forwarded-proto',
	INTEGRATION_TOKENS: ''
};

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
	if (ok) passed++;
	else failed++;
	console.log(`${ok ? '✓' : '✖'} ${name}${ok || !detail ? '' : `  → ${detail}`}`);
}

const server = spawn(process.execPath, ['build'], {
	cwd: ROOT,
	env,
	stdio: ['ignore', 'ignore', 'inherit']
});

/** Minimal browser: keeps cookies, sends the headers SvelteKit's CSRF check expects. */
function client() {
	const jar = new Map();
	return async function req(path, { form, accept = 'application/json' } = {}) {
		const headers = {
			'x-forwarded-proto': 'http',
			accept,
			cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
		};
		let body;
		if (form) {
			headers['content-type'] = 'application/x-www-form-urlencoded';
			headers.origin = BASE;
			body = new URLSearchParams(form).toString();
		}
		const res = await fetch(BASE + path, {
			method: form ? 'POST' : 'GET',
			headers,
			body,
			redirect: 'manual'
		});
		for (const c of res.headers.getSetCookie()) {
			const [pair] = c.split(';');
			const [k, v] = pair.split('=');
			if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)) jar.delete(k);
			else jar.set(k, v);
		}
		const text = await res.text();
		return { status: res.status, location: res.headers.get('location'), text };
	};
}

/** SvelteKit enhanced-action JSON: { type: 'success' | 'failure' | 'redirect', ... } */
const result = (r) => {
	try {
		return JSON.parse(r.text);
	} catch {
		return { type: `http-${r.status}` };
	}
};

function staff(username, roles) {
	const out = spawnSync(
		process.execPath,
		[
			'--experimental-strip-types',
			'--disable-warning=ExperimentalWarning',
			'scripts/staff.ts',
			'add',
			'--username',
			username,
			'--name',
			`Test ${username}`,
			'--roles',
			roles
		],
		{ cwd: ROOT, env, encoding: 'utf8' }
	);
	const password = out.stdout.match(/temporary password: (\S+)/)?.[1];
	if (!password) throw new Error(`could not create ${username}: ${out.stderr || out.stdout}`);
	return password;
}

async function login(username, password) {
	const c = client();
	const r = await c('/staff/login', { form: { username, password }, accept: 'text/html' });
	check(`${username} signs in`, r.status === 303, `status ${r.status}`);
	return c;
}

async function submit(student, lrn, mode, program = 'BSIT') {
	const r = await student('/enroll', {
		accept: 'text/html',
		form: {
			consent: 'yes',
			lrn,
			last_name: 'Tester',
			first_name: `S${lrn.slice(-3)}`,
			sex: 'F',
			birthdate: '2005-02-03',
			mobile: '09170000000',
			program,
			mode
		}
	});
	const ref = r.location?.match(/ref=(\w+)/)?.[1];
	check(
		`student ${lrn.slice(-3)} submits (${mode})`,
		r.status === 303 && !!ref,
		`status ${r.status}`
	);
	const id = db.prepare('SELECT id FROM enr_application WHERE ref_code = ?').get(ref)?.id;
	return { ref, id };
}

let db;
try {
	for (let i = 0; i < 50; i++) {
		try {
			if ((await fetch(`${BASE}/healthz`)).ok) break;
		} catch {}
		await new Promise((r) => setTimeout(r, 200));
	}
	spawnSync(process.execPath, ['scripts/seed.mjs'], { cwd: ROOT, env, stdio: 'ignore' });
	db = new Database(env.DATABASE_URL);

	const regPw = staff('e2e.registrar', 'REGISTRAR');
	const cashPw = staff('e2e.cashier', 'CASHIER');
	db.prepare('UPDATE sys_user SET must_change_password = 0').run(); // skip the forced change in tests

	const student = client();
	const registrar = await login('e2e.registrar', regPw);
	const cashier = await login('e2e.cashier', cashPw);
	const enrolled = (code) =>
		db.prepare('SELECT enrolled FROM enr_section WHERE code = ?').get(code).enrolled;
	const classSum = (code) =>
		db
			.prepare(
				'SELECT sum(c.enrolled) n FROM enr_class c JOIN enr_section s ON s.id = c.section_id WHERE s.code = ?'
			)
			.get(code).n;

	// --- Happy path: FHE student owes only the non-covered fee ------------------------------
	const a = await submit(student, '900000000001', 'BLOCK');
	const appUrl = (id) => `/staff/applications/${id}`;
	check(
		'registrar opens the application',
		(await registrar(appUrl(a.id), { accept: 'text/html' })).status === 200
	);
	check(
		'cashier cannot open Registrar pages',
		(await cashier(appUrl(a.id), { accept: 'text/html' })).status === 403
	);

	let r = result(await registrar(`${appUrl(a.id)}?/accept`, { form: {} }));
	check('accept → PROVISIONAL', r.type === 'success');
	r = result(await registrar(`${appUrl(a.id)}?/accept`, { form: {} }));
	check('accepting twice is refused', r.type === 'failure');
	r = result(await cashier(`${appUrl(a.id)}?/accept`, { form: {} }));
	check(
		'cashier cannot accept',
		r.type === 'error' || r.type === 'http-403' || r.status === 403,
		JSON.stringify(r).slice(0, 80)
	);
	r = result(
		await registrar(`${appUrl(a.id)}?/requirement`, { form: { kind: 'SF9', received: 'yes' } })
	);
	check(
		'SF9 marked received',
		r.type === 'success' &&
			!!db
				.prepare("SELECT 1 FROM enr_requirement WHERE application_id = ? AND kind = 'SF9'")
				.get(a.id)
	);
	r = result(await registrar(`${appUrl(a.id)}?/assess`, { form: { fheStatus: 'FHE_COVERED' } }));
	const asmt = db.prepare('SELECT * FROM fin_assessment WHERE application_id = ?').get(a.id);
	check(
		'assess (FHE) → ₱4,850 total, ₱50 due',
		r.type === 'success' && asmt?.total_centavos === 485000 && asmt?.net_due_centavos === 5000,
		JSON.stringify(asmt)
	);

	r = result(
		await registrar(`/staff/cashier?/pay`, {
			form: { id: a.id, orNumber: 'OR-1001', amount: '50', method: 'CASH' }
		})
	);
	check('registrar cannot use the cashier', r.type !== 'success');
	r = result(
		await cashier(`/staff/cashier?/pay`, {
			form: { id: a.id, orNumber: 'OR-1001', amount: '49.99', method: 'CASH' }
		})
	);
	check('underpayment is refused', r.type === 'failure');
	r = result(
		await cashier(`/staff/cashier?/pay`, {
			form: { id: a.id, orNumber: 'OR-1001', amount: '50.00', method: 'CASH' }
		})
	);
	const s1 = db
		.prepare(
			"SELECT value FROM core_person_identifier WHERE scheme = 'STUDENT_NO' AND person_id = (SELECT person_id FROM enr_application WHERE id = ?)"
		)
		.get(a.id)?.value;
	check(
		'payment → OFFICIAL, student no. 2026-00001',
		r.type === 'success' && s1 === '2026-00001',
		`${r.type} ${s1}`
	);
	r = result(
		await cashier(`/staff/cashier?/pay`, {
			form: { id: a.id, orNumber: 'OR-1002', amount: '50', method: 'CASH' }
		})
	);
	check('paying an official student again is refused', r.type === 'failure');
	check(
		'COR prints for the cashier',
		(await cashier(`/staff/print/${a.id}`, { accept: 'text/html' })).text.includes(
			'Certificate of Registration'
		)
	);

	// --- Paying student, duplicate OR, and a cashier double-click race ----------------------
	const b = await submit(student, '900000000002', 'BLOCK');
	await registrar(`${appUrl(b.id)}?/accept`, { form: {} });
	r = result(await registrar(`${appUrl(b.id)}?/assess`, { form: { fheStatus: 'PAYING_OPT_OUT' } }));
	check(
		'assess (opt-out) → ₱4,850 due',
		db.prepare('SELECT net_due_centavos n FROM fin_assessment WHERE application_id = ?').get(b.id)
			?.n === 485000
	);
	r = result(
		await cashier(`/staff/cashier?/pay`, {
			form: { id: b.id, orNumber: 'OR-1001', amount: '4850', method: 'GCASH' }
		})
	);
	check('duplicate OR number is refused', r.type === 'failure');
	const race = await Promise.all(
		['OR-2001', 'OR-2002', 'OR-2003'].map((orNumber) =>
			cashier(`/staff/cashier?/pay`, {
				form: { id: b.id, orNumber, amount: '4,850.00', method: 'CASH' }
			}).then(result)
		)
	);
	const wins = race.filter((x) => x.type === 'success').length;
	const pays = db
		.prepare('SELECT count(*) n FROM fin_payment WHERE application_id = ?')
		.get(b.id).n;
	check(
		'3 simultaneous payments → exactly 1 recorded',
		wins === 1 && pays === 1,
		`wins ${wins}, rows ${pays}`
	);

	// --- Cancel and section moves give seats back -------------------------------------------
	const before1A = [enrolled('BSIT 1-A'), classSum('BSIT 1-A')];
	const c = await submit(student, '900000000003', 'BLOCK');
	await registrar(`${appUrl(c.id)}?/accept`, { form: {} });
	r = result(await registrar(`${appUrl(c.id)}?/cancel`, { form: { reason: 'Withdrew (test)' } }));
	check(
		'cancel releases section and class seats',
		r.type === 'success' &&
			enrolled('BSIT 1-A') === before1A[0] &&
			classSum('BSIT 1-A') === before1A[1],
		`${enrolled('BSIT 1-A')}/${classSum('BSIT 1-A')}`
	);

	const d = await submit(student, '900000000004', 'IRREGULAR');
	const sec = (code) => db.prepare('SELECT id FROM enr_section WHERE code = ?').get(code).id;
	const b1 = [enrolled('BSIT 1-B'), classSum('BSIT 1-B')];
	r = result(await registrar(`${appUrl(d.id)}?/section`, { form: { sectionId: sec('BSIT 1-B') } }));
	check(
		'irregular student placed in BSIT 1-B (+7 class seats)',
		r.type === 'success' && enrolled('BSIT 1-B') === b1[0] + 1 && classSum('BSIT 1-B') === b1[1] + 7
	);
	r = result(await registrar(`${appUrl(d.id)}?/section`, { form: { sectionId: sec('BSED 1-A') } }));
	check('wrong-program section is refused', r.type === 'failure');
	r = result(await registrar(`${appUrl(d.id)}?/section`, { form: { sectionId: sec('BSIT 1-A') } }));
	check(
		'moving to 1-A gives 1-B its seats back',
		r.type === 'success' && enrolled('BSIT 1-B') === b1[0] && classSum('BSIT 1-B') === b1[1]
	);

	// --- Student status lookup --------------------------------------------------------------
	r = result(
		await student('/status', { form: { ref: a.ref, lrn: '900000000001', birthdate: '2005-02-03' } })
	);
	check(
		'student status lookup finds their COR',
		r.type === 'success' && r.data.includes('2026-00001')
	);
	r = result(
		await student('/status', { form: { ref: a.ref, lrn: '900000000001', birthdate: '2005-02-04' } })
	);
	check('wrong birthdate reveals nothing', r.type === 'failure' && !r.data.includes('Tester'));

	// --- Invariants -------------------------------------------------------------------------
	const sectionDrift = db
		.prepare(
			`SELECT code FROM enr_section s WHERE enrolled != (SELECT count(*) FROM enr_application a WHERE a.section_id = s.id AND a.status != 'CANCELLED')`
		)
		.all();
	const classDrift = db
		.prepare(
			`SELECT code FROM enr_class c WHERE enrolled != (SELECT count(*) FROM enr_class_enrollment e WHERE e.class_id = c.id AND e.status = 'ENROLLED')`
		)
		.all();
	check(
		'every section counter matches its students',
		sectionDrift.length === 0,
		JSON.stringify(sectionDrift)
	);
	check(
		'every class counter matches its seats',
		classDrift.length === 0,
		JSON.stringify(classDrift)
	);
	const events = db
		.prepare(
			"SELECT count(*) n FROM sys_event WHERE type LIKE 'enrollment.%' OR type LIKE 'records.%'"
		)
		.get().n;
	const audits = db
		.prepare(
			"SELECT count(*) n FROM sys_audit_log WHERE action = 'UPDATE' AND entity = 'enr_application'"
		)
		.get().n;
	check(
		'every change wrote events and audit rows',
		events >= 15 && audits >= 10,
		`events ${events}, audits ${audits}`
	);
} catch (e) {
	failed++;
	console.error('✖', e);
} finally {
	db?.close();
	server.kill();
	await new Promise((r) => server.once('exit', r));
	rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
