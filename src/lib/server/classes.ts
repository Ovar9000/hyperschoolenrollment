import { asc, eq, inArray, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { db } from './db/index.ts';
import { classMeeting, klass, person, section, subject } from './db/schema/index.ts';
import type { Meeting } from '../schedule.ts';

const faculty = alias(person, 'faculty');

/** Class offerings with subject, section, professor and meetings (one query + one for meetings). */
export function listClasses(where: SQL | undefined) {
	const rows = db
		.select({
			id: klass.id,
			code: klass.code,
			subjectCode: subject.code,
			subjectTitle: subject.title,
			units: subject.creditUnits,
			sectionId: section.id,
			sectionCode: section.code,
			capacity: klass.capacity,
			enrolled: klass.enrolled,
			facultyLast: faculty.lastName,
			facultyFirst: faculty.firstName
		})
		.from(klass)
		.innerJoin(subject, eq(subject.code, klass.subjectCode))
		.leftJoin(section, eq(section.id, klass.sectionId))
		.leftJoin(faculty, eq(faculty.id, klass.facultyPersonId))
		.where(where)
		.orderBy(asc(section.code), asc(subject.code))
		.all();

	const meetings = new Map<string, Meeting[]>();
	if (rows.length > 0) {
		for (const m of db
			.select({
				classId: classMeeting.classId,
				day: classMeeting.day,
				startMin: classMeeting.startMin,
				endMin: classMeeting.endMin,
				room: classMeeting.room
			})
			.from(classMeeting)
			.where(
				inArray(
					classMeeting.classId,
					rows.map((r) => r.id)
				)
			)
			.all()) {
			const list = meetings.get(m.classId) ?? [];
			list.push(m);
			meetings.set(m.classId, list);
		}
	}

	return rows.map((r) => ({
		...r,
		faculty: r.facultyLast ? `${r.facultyLast}, ${r.facultyFirst}` : null,
		meetings: meetings.get(r.id) ?? []
	}));
}
