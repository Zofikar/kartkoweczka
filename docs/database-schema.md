# Database Schema

**Project:** Kartkówka
**Version:** 1.0
**Last Updated:** 2026-07-30
**Status:** Approved

---

## Overview

The Kartkówka database is an embedded relational store backed by **PGlite** (PostgreSQL compiled to WASM) with **Drizzle ORM** for type-safe schema definitions and query building. All primary keys use **UUIDv7** (time-sortable, monotonic) generated client-side via the `uuid` npm package.

The database serves **authoring workflows only** — question management, tagging, test composition, and revision generation. Grading is ephemeral: revision snapshots are embedded directly into printed answer sheet QR codes, making each sheet fully self-contained for scoring with zero database lookups at scan time.

| Property             | Value                                   |
| -------------------- | --------------------------------------- |
| Engine               | PGlite (`@electric-sql/pglite`)         |
| ORM                  | Drizzle ORM (`drizzle-orm/pglite`)      |
| Migrations           | Drizzle Kit + custom SQL runner         |
| Primary key strategy | UUIDv7, client-generated (`$defaultFn`) |
| Timestamp columns    | `timestamptz` with `DEFAULT now()`      |
| Total tables         | 7                                       |

---

## Entity-Relationship Diagram

```
                                        ┌──────────────────────┐
                                        │     question_tags     │
                                        │                      │
                                        │ PK: (question_id,    │
                                        │      tag_name)       │
                                        └───┬────────────┬─────┘
                                            │            │
                                   ┌────────┘            └────────┐
                                   ▼                              ▼
 ┌──────────┐                                              ┌───────────┐
 │   tags   │                                              │ questions │
 │          │                                              │           │
 │ PK: name │                                              │ PK: id    │
 └──────────┘                                              │ type:     │
                                                           │ choice |  │
                                                           │ true_false│
 ┌───────────────┐                                         └──┬───┬────┘
 │ test_questions│◄────────┐                                  │   │
 │               │         │                                  │   │
 │ PK: (test_id, │         │                              ┌───┘   │
 │   question_id)│         │                              │       │
 └───┬───────┬───┘         │                              │       │
     │       │             │                              ▼       │
     │       └─────────────┼──────────────────┐   ┌──────────┐   │
     │                     │                  │   │ answers  │   │
     ▼                     │                  │   │          │   │
 ┌─────────┐               │                  │   │ PK: id   │◄──┘
 │  tests  │               │                  │   │ FK: ques-│
 │         │               │                  │   │ tion_id  │
 │ PK: id  │               │                  │   └──────────┘
 └────┬────┘               │                  │
      │                    │                  │
      │              ┌─────┴──────┐           │
      │              │test_revisions│         │
      │              │             │         │
      │              │ PK: id      │         │
      └──────────────► FK: test_id │         │
                     │ content:    │         │
                     │   jsonb     │         │
                     └─────────────┘         │
                                             │
   ◄────  FK / belongsTo                    │
   ◄────  junction (M:N) via join table ────┘
```

> **Solid lines with arrowheads** represent foreign key (`belongsTo`) relationships.  
> **Dotted crossing lines** represent many-to-many relationships implemented through a junction table.

---

## Design Principles

- **Questions are a global pool** — reusable across multiple tests via the `test_questions` junction table.
- **Tags use natural keys** — `tag_name` is the primary key, avoiding unnecessary surrogate IDs and simplifying tag-based queries.
- **Answers are a first-class relational table** — each answer has its own UUIDv7 primary key and a foreign key to its parent question, providing referential integrity and native Drizzle relation support.
- **No special treatment for TRUE/FALSE questions** — they use the same `answers` table with two standard rows (`"True"` / `"False"`), one marked `is_correct`. This keeps the schema uniform and avoids branching logic.
- **Revisions are immutable JSONB snapshots** — at creation time, the complete current state of all questions (text, type) and answers (text, correctness) is frozen into the `content` column as an ordered array of plain values. Once created, a revision is never modified, guaranteeing that printed answer sheets remain valid regardless of subsequent edits to the source questions.
- **Grading data is not persisted** — the revision snapshot, embedded in the answer sheet QR code, contains everything needed to compute a score. No `sheets` or `sheet_answers` tables exist; the scanning workflow is purely ephemeral.
- **UUIDv7 for all primary keys** — time-sortable, globally unique, generated client-side before `INSERT`. This provides good B-tree index locality and is essential for offline-first scenarios (no server round-trip for ID generation).

---

## Entity Tables

These tables represent the core domain entities. Each holds its own data and serves as the "one" side of one-to-many or many-to-many relationships.

---

### `tags`

Reusable category labels assigned to questions. The tag name itself serves as the primary key.

| Column     | Type   | Constraints               | Description                            |
| ---------- | ------ | ------------------------- | -------------------------------------- |
| `tag_name` | `text` | **PRIMARY KEY**, NOT NULL | Category label, e.g. `"basic algebra"` |

**Indexes:** Implicit unique index on the primary key.

---

### `questions`

The global question pool. Questions are not owned by any single test; they can be referenced from multiple tests. The `type` column controls whether the question expects a single choice or a true/false response.

| Column       | Type          | Constraints               | Description                    |
| ------------ | ------------- | ------------------------- | ------------------------------ |
| `id`         | `uuid`        | **PRIMARY KEY**, NOT NULL | UUIDv7, client-generated       |
| `content`    | `text`        | NOT NULL                  | The question text or statement |
| `type`       | `text`        | NOT NULL                  | `'choice'` or `'true_false'`   |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |                                |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |                                |

**Question type semantics:**

| `type`       | Expected `answers` rows                               | Example                                           |
| ------------ | ----------------------------------------------------- | ------------------------------------------------- |
| `choice`     | 2 or more, at least one `is_correct = true`           | "What is 2 + 2?" with answers: 3, 4, 5, 6         |
| `true_false` | Exactly 2: `"True"` and `"False"`, one marked correct | "The Earth orbits the Sun." with `"True"` correct |

**Indexes:** `INDEX` on `created_at` (for chronological browsing of the question pool)

---

### `answers`

Answer choices belonging to a question. Both `choice` and `true_false` questions use this table. Each answer has a stable UUIDv7 that survives edits to the answer text — critical for revision snapshots that reference answers by ID.

| Column        | Type      | Constraints                                      | Description                    |
| ------------- | --------- | ------------------------------------------------ | ------------------------------ |
| `id`          | `uuid`    | **PRIMARY KEY**, NOT NULL                        | UUIDv7, stable across edits    |
| `question_id` | `uuid`    | FK → `questions(id)` ON DELETE CASCADE, NOT NULL | Parent question                |
| `content`     | `text`    | NOT NULL                                         | Answer text                    |
| `is_correct`  | `boolean` | NOT NULL, DEFAULT `false`                        | Whether this answer is correct |

**Validity constraints (enforced at application level):**

- A `choice` question must have **at least one** answer with `is_correct = true`.
- A `true_false` question must have **exactly two** answers, one marked correct.

**Indexes:** `INDEX` on `question_id`

---

### `tests`

A named test — the blueprint or "test definition". A test does not hold questions directly; membership and default ordering are established through the `test_questions` junction.

| Column       | Type          | Constraints               | Description                                         |
| ------------ | ------------- | ------------------------- | --------------------------------------------------- |
| `id`         | `uuid`        | **PRIMARY KEY**, NOT NULL | UUIDv7                                              |
| `name`       | `text`        | NOT NULL                  | Test name, e.g. `"Matematyka — funkcje kwadratowe"` |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |                                                     |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |                                                     |

**Indexes:** `INDEX` on `created_at`

---

### `test_revisions`

An **immutable snapshot** of a single variant of a test. The `content` column stores a pre-ordered copy of the test's questions and answers as plain values — no references to source tables, no seed, no IDs. The application is responsible for loading the test's current state, randomizing question and answer order, and writing the result here.

Once created, a revision row is **never updated**. This immutability guarantees that a printed answer sheet can be graded correctly at any point in the future, regardless of subsequent edits to the source questions.

| Column       | Type          | Constraints                                  | Description                                                                                                           |
| ------------ | ------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `id`         | `uuid`        | **PRIMARY KEY**, NOT NULL                    | UUIDv7                                                                                                                |
| `test_id`    | `uuid`        | FK → `tests(id)` ON DELETE CASCADE, NOT NULL |                                                                                                                       |
| `name`       | `text`        | NOT NULL                                     | e.g. `"Grupa A"`, `"Wersja 1"`                                                                                        |
| `content`    | `jsonb`       | NOT NULL                                     | Ordered array of questions with ordered answers — pure values, no IDs (see [Snapshot Structure](#snapshot-structure)) |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()`                    |                                                                                                                       |

**Indexes:** `INDEX` on `test_id`

---

## Relationship Tables

The following tables serve as **many-to-many junction tables**. They do not hold domain data beyond the foreign keys and ordering/sequencing metadata needed to implement the association.

---

### `question_tags`

Links questions to tags. Each row pairs one question with one tag. Both foreign keys cascade on delete.

| Column        | Type   | Constraints                                               |
| ------------- | ------ | --------------------------------------------------------- |
| `question_id` | `uuid` | **PK**, FK → `questions(id)` ON DELETE CASCADE, NOT NULL  |
| `tag_name`    | `text` | **PK**, FK → `tags(tag_name)` ON DELETE CASCADE, NOT NULL |

**Primary Key:** Composite `(question_id, tag_name)`

---

### `test_questions`

Links tests to questions with explicit ordering. Each row pairs one test with one question and records its position in the default display order. Deleting a question used in a test is **restricted** to prevent accidentally breaking existing tests.

| Column           | Type      | Constraints                                               |
| ---------------- | --------- | --------------------------------------------------------- |
| `test_id`        | `uuid`    | **PK**, FK → `tests(id)` ON DELETE CASCADE, NOT NULL      |
| `question_id`    | `uuid`    | **PK**, FK → `questions(id)` ON DELETE RESTRICT, NOT NULL |
| `question_order` | `integer` | NOT NULL, default position (0-based)                      |

**Primary Key:** Composite `(test_id, question_id)`  
**Indexes:** `INDEX` on `(test_id, question_order)`

---

## Relationship Summary

| #   | From        | To               | Type         | Implemented By                  | On Delete                                             |
| --- | ----------- | ---------------- | ------------ | ------------------------------- | ----------------------------------------------------- |
| 1   | `questions` | `answers`        | one-to-many  | `answers.question_id` FK        | CASCADE                                               |
| 2   | `tests`     | `test_revisions` | one-to-many  | `test_revisions.test_id` FK     | CASCADE                                               |
| 3   | `questions` | `tags`           | many-to-many | `question_tags` junction table  | CASCADE (both directions)                             |
| 4   | `tests`     | `questions`      | many-to-many | `test_questions` junction table | CASCADE (test→junction), RESTRICT (question→junction) |

> Relationships 1 and 2 are standard `belongsTo`/`hasMany` implemented by a foreign key column on the child table.  
> Relationships 3 and 4 are many-to-many implemented through a dedicated junction table with a composite primary key.  
> Drizzle `relations()` definitions mirror this table and live in `src/db/schema/relations.ts`.

## Snapshot Structure

The `test_revisions.content` column stores an ordered array of question snapshots, each containing everything needed to render and grade that question independently.

### TypeScript Interface

```typescript
interface SnapshotAnswer {
	content: string; // Answer text
	is_correct: boolean; // Whether this answer is correct
}

interface SnapshotQuestion {
	type: 'choice' | 'true_false'; // Question type
	content: string; // Question text
	answers: SnapshotAnswer[]; // Answers in display order (already shuffled by application)
}

// test_revisions.content: SnapshotQuestion[]
// Array order defines question sequence — index 0 is displayed first, etc.
```

### Example

```json
[
	{
		"type": "choice",
		"content": "What is the capital of France?",
		"answers": [
			{ "content": "Berlin", "is_correct": false },
			{ "content": "Paris", "is_correct": true },
			{ "content": "Madrid", "is_correct": false },
			{ "content": "London", "is_correct": false }
		]
	},
	{
		"type": "true_false",
		"content": "The Earth is flat.",
		"answers": [
			{ "content": "False", "is_correct": true },
			{ "content": "True", "is_correct": false }
		]
	}
]
```

**How grading works with the snapshot:**

1. The array index of each answer within `answers` is its physical position on the answer sheet (0 = first bubble, 1 = second bubble, etc.).
2. The scanner detects which position is filled → the answer at that array index directly provides the `is_correct` value.
3. No IDs, no references, no references to source tables — the snapshot is pure ordered content, fully self-contained.

---

---

## UUIDv7 Generator

```typescript
// Usage (imported at call sites or used as $defaultFn)
import { v7 as uuidv7 } from 'uuid';

export function generateId(): string {
	return uuidv7();
}

// In Drizzle schema:
id: uuid('id').primaryKey().$defaultFn(generateId);
```

---

## Custom Drizzle Type

A single custom column type handles the revision snapshot JSONB column with proper TypeScript typing:

```typescript
// src/db/schema/custom-types.ts
import { customType } from 'drizzle-orm/pg-core';
import type { SnapshotQuestion } from './types';

export const snapshotJsonb = customType<{
	data: SnapshotQuestion[];
	driverData: string;
}>({
	dataType: () => 'jsonb',
	toDriver: (value: SnapshotQuestion[]): string => JSON.stringify(value),
	fromDriver: (value: unknown): SnapshotQuestion[] =>
		typeof value === 'string'
			? (JSON.parse(value) as SnapshotQuestion[])
			: (value as SnapshotQuestion[]),
});
```

---

## Data Flows

### Creating a Test

1. User provides a test name → `INSERT INTO tests`.
2. User selects questions from the pool → `INSERT INTO test_questions` with sequential `question_order` values.

### Generating Revisions

1. Query `test_questions` joined with `questions` and `answers` for the given test.
2. Shuffle questions and, per question, shuffle answers.
3. Build the snapshot JSON — an array of questions, each with its answers in display order, all values inlined (see [Snapshot Structure](#snapshot-structure)).
4. `INSERT INTO test_revisions` with the frozen `content`.

### Exporting to Printable Format

1. Load the `test_revisions` row by `id`.
2. Iterate the `content` array — each entry is a question rendered in array order.
3. For each question: render the `content` text, then render `answers` in array order (already the display sequence).
4. Encode the `content` JSON (or `revision_id`) into a QR code printed on the sheet.

### Scanning and Grading

1. Scan the QR code → decode `revision_id`.
2. Load `test_revisions.content` from the database.
3. Detect filled answer positions on the sheet image.
4. The answer at the matching array index in `answers` directly provides the `is_correct` value.
5. Compute and display the score. **No data is persisted.**

---

## File Layout

```
src/db/
├── db.ts                    # PGlite initialization & migration runner
├── dbStore.ts               # Svelte writable stores (db, dbLoaded)
└── schema/
    ├── index.ts             # Drizzle pgTable definitions (7 tables)
    ├── relations.ts         # Drizzle relations() definitions
    ├── types.ts             # TypeScript interfaces (SnapshotAnswer, SnapshotQuestion)
    └── custom-types.ts      # snapshotJsonb custom column type

src/db/drizzle/              # Auto-generated SQL migration files
    └── <timestamp>_*.sql
```

**Configuration:** `drizzle.config.ts` must point to `./src/db/schema/index.ts`.

---

## Open Items

| Topic                          | Notes                                                                                                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Score semantics                | Percentage, fraction, or raw point count? Decision needed before implementing grading UI.                                                                                                                                                        |
| Multiple correct answers       | Supported by the schema. Partial credit logic is a future feature.                                                                                                                                                                               |
| QR code payload size           | A 30-question snapshot with 4 answers each is approximately 10–15 KB of JSON — well within QR code capacity in binary mode. If limits are hit, fall back to encoding only `revision_id` and loading the snapshot from the database at scan time. |
| Question deletion with history | `ON DELETE RESTRICT` on `test_questions.question_id` prevents accidental deletion of questions used in tests. A future "archive" or "soft-delete" mechanism could be considered.                                                                 |

---

## References

- [`.memory-bank.md`](../.memory-bank.md) — Condensed quick-reference version of this document
- [`FEATURE_LIST.md`](../FEATURE_LIST.md) — MVP feature scope
- [`src/db/db.ts`](../src/db/db.ts) — PGlite initialization and migration runner
