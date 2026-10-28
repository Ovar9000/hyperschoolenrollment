// Client-safe display helpers (Philippine locale, Manila time).

const dateTime = new Intl.DateTimeFormat('en-PH', {
	timeZone: 'Asia/Manila',
	month: 'short',
	day: 'numeric',
	hour: 'numeric',
	minute: '2-digit'
});

export const formatDateTime = (d: Date | string | number) => dateTime.format(new Date(d));

export const fullName = (p: {
	lastName: string;
	firstName: string;
	middleName?: string | null;
	suffix?: string | null;
}) =>
	`${p.lastName}, ${p.firstName}${p.suffix ? ` ${p.suffix}` : ''}${p.middleName ? ` ${p.middleName}` : ''}`;

export const STATUS_LABELS: Record<string, string> = {
	SUBMITTED: 'Submitted',
	PROVISIONAL: 'Provisional',
	ASSESSED: 'Assessed',
	OFFICIAL: 'Official',
	CANCELLED: 'Cancelled'
};

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

/** Integer centavos → "₱1,234.50". */
export const formatPeso = (centavos: number) => peso.format(centavos / 100);
