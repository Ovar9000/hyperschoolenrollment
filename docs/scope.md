# Scope: San Pascual Polytechnic College Student Records System

**What we are building:** the Registrar's system of record. It tracks who the students are, what they
are enrolled in, what they finished, and what the college reports to CHED and UniFAST. Enrollment is
its front door. Every later system (LMS sync, library, clinic, alumni) plugs into it through the
shared identity tables and the event/API contract in [architecture.md](architecture.md).

**What we are not building:** a do-everything campus ERP. See [Won't build](#wont-build).

Any new feature request is checked against this file first. If it isn't in a phase below, it needs
an explicit decision to add it here.

## Users and devices

| User                | Device                                   | Area           | Design target                                 |
| ------------------- | ---------------------------------------- | -------------- | --------------------------------------------- |
| Student             | Phone (budget Android), sometimes laptop | `/`, `/enroll` | Mobile-first, ≤ 50 KB JS, works on bad signal |
| Registrar staff     | Office PC                                | `/staff`       | PC-first, dense tables, keyboard friendly     |
| Cashier             | Office PC                                | `/staff`       | PC-first                                      |
| Dean / Program head | Office PC                                | `/staff`       | PC-first                                      |
| Faculty             | PC / laptop                              | `/staff`       | PC-first (Phase 3 grade sheets)               |
| Admin / DPO         | Office PC                                | `/staff`       | Accounts, settings, exports, access log       |

One web app, one database, one server. Staff and students use different areas of the same app.

## Phases

| Phase | Module                     | Delivers                                                                                                                                                                                                                                                            | Status  |
| ----- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 0     | Intake                     | Mobile enrollment form, consent, LRN dedupe, one-tap block seat                                                                                                                                                                                                     | ✅ Done |
| 1a    | **Records backbone**       | Subjects, curriculum, class offerings (schedule, room, professor, slots), student records, staff accounts + roles + login, read-only staff screens (dashboard, application queue/detail, class slots)                                                               | ✅ Done |
| 1b    | **Enrollment processing**  | Registrar: requirements checklist (hardcopies), section assignment for irregular/unseated, status changes with history. Fees + assessment (TOSF, RA 10931 FHE rules). Cashier: OR encoding → OFFICIAL, student number issued. Printable COR. Student status lookup. | ✅ Done |
| 2     | Class offerings management | Staff create/edit sections, classes, schedules, rooms, faculty load; irregular students pick subjects with clash + prerequisite + unit-cap checks; CHED Enrollment List export                                                                                      | Planned |
| 3     | Grades                     | Faculty final-grade sheets (1.00–5.00, INC, DRP), grade records, prerequisite checking, CHED Promotional Report                                                                                                                                                     | Planned |
| 4     | Records                    | Transcript of Records, certifications, graduation lists, alumni handoff                                                                                                                                                                                             | Planned |

Phase 1b decisions (confirm with the Registrar): full payment of the net amount due is required
to become OFFICIAL (installments later); a student who is OFFICIAL with missing original documents
stays enrolled for the term but is flagged, and the hold blocks next-term enrollment.

## Won't build

| Not building                             | Use instead / why                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| LMS (quizzes, modules, attendance, chat) | Google Classroom / Moodle; we can roster them from our data later (OneRoster) |
| Payroll, HR, leave                       | Different law (CSC/GSIS), different users, LGU systems exist                  |
| Accounting / general ledger              | LGU Treasurer / eNGAS. We only record OR numbers the cashier issues           |
| Online payment gateway                   | Deferred: merchant fees + COA reconciliation. Revisit after Phase 1b          |
| Library, clinic, gate RFID               | Separate systems that can read our `/api/v1` later                            |
| Native mobile app                        | The web app is the app; no app-store installs on budget phones                |

## Assumptions (confirm with the Registrar)

These shape the design; wrong guesses are cheap to fix now and expensive later.

- **Students:** ~1,000–3,000 total; ~600–1,000 new each year.
- **Programs:** a handful (BSIT and BSEd used as sample data).
- **Sectioning:** most students are regular and take a fixed block (e.g. "BSIT 1-A"); irregulars and
  transferees are a minority and get schedules built by the Registrar until Phase 2.
- **Free tuition:** the college is a CHED-recognized LUC covered by RA 10931 (FHE), so most students
  pay ₱0 tuition but still need an assessment record.
- **Staff concurrency:** fewer than 15 staff logged in at once.

## Opening-day load plan (the "8 AM crash")

The database size is not the risk; thousands of students hitting submit in the same minute is.

1. **Light pages:** the form is ~1.5 KB of HTML; JS/CSS are cached by the service worker.
2. **One request per regular student:** block enrollment is a single submit and one SQLite
   transaction (< 1 ms); no catalog browsing.
3. **No polling.** Slot counts are shown on demand.
4. **Stagger by year level** (policy): e.g. 4th years 08:00, 3rd years 10:00, 2nd years 13:00.
5. **Cloudflare in front** absorbs junk traffic before it reaches the campus server.
6. **Load test before every opening day** (target: 3,000 submits in 60 s with p95 < 1 s), using
   the seeded data and a staging copy of the server.

## Data size estimate

| Data                                                 | Per year | After 10 years |
| ---------------------------------------------------- | -------- | -------------- |
| People                                               | ~1,500   | ~15,000        |
| Class enrollments (3,000 × 8 subjects × 2 semesters) | ~48,000  | ~500,000       |
| Events + audit log                                   | ~200,000 | ~2,000,000     |
| SQLite file                                          |          | ~0.5–1 GB      |
| Document scans (on disk, not in SQLite)              | ~2 GB    | ~20 GB         |
