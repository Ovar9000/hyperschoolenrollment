// Client-safe schedule formatting. Meetings are stored as ISO day (1 = Mon) + minutes since midnight.

export interface Meeting {
	day: number;
	startMin: number;
	endMin: number;
	room: string | null;
}

const DAY_CODES = ['', 'M', 'T', 'W', 'Th', 'F', 'S', 'Su'];

export function formatTime(min: number, withPeriod = true): string {
	const h = Math.floor(min / 60);
	const m = min % 60;
	const h12 = ((h + 11) % 12) + 1;
	const time = `${h12}:${String(m).padStart(2, '0')}`;
	return withPeriod ? `${time} ${h < 12 ? 'AM' : 'PM'}` : time;
}

function formatRange(start: number, end: number): string {
	const samePeriod = start < 720 === end < 720;
	return `${formatTime(start, !samePeriod)}–${formatTime(end)}`;
}

/** Groups days that share a time and room: [{M 8–9},{W 8–9},{F 8–9}] → "MWF 8:00–9:00 AM · Rm 101". */
export function formatMeetings(meetings: Meeting[]): string[] {
	const groups = new Map<string, { days: number[]; m: Meeting }>();
	for (const m of [...meetings].sort((a, b) => a.day - b.day || a.startMin - b.startMin)) {
		const key = `${m.startMin}-${m.endMin}-${m.room ?? ''}`;
		const g = groups.get(key);
		if (g) g.days.push(m.day);
		else groups.set(key, { days: [m.day], m });
	}
	return [...groups.values()].map(({ days, m }) => {
		const when = `${days.map((d) => DAY_CODES[d]).join('')} ${formatRange(m.startMin, m.endMin)}`;
		return m.room ? `${when} · ${m.room}` : when;
	});
}
