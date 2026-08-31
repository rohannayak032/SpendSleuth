# SpendSleuth

SpendSleuth is an automated personal-finance application that eliminates manual expense logging. Instead of requiring users to manually log every purchase, SpendSleuth automatically ingests transaction alert emails from Gmail, extracts key transaction details (amount, merchant, date, payment mode), categorizes them, and provides spending analytics through a clean web dashboard.

> **V1 Scope Note:** SpendSleuth V1 is intentionally single-user. Automatic ingestion from bank and UPI alert emails is the primary workflow; manual entry and transaction editing serve strictly as fallback options.

---

## High-Level Architecture

SpendSleuth follows an automated end-to-end data pipeline:

```
Gmail Inbox
    │
    ▼
Background Ingestion (OAuth2 Polling Worker)
    │
    ▼
Transaction Extraction (Tier 1: Deterministic Regex ──fallback──► Tier 2: LLM Fallback)
    │
    ▼
Validation (Schema & Boundary Checking)
    │
    ▼
Categorization (Rule-Based Keyword Matching + Fallback)
    │
    ▼
Deduplication (Message ID & Fuzzy Timestamp/Amount Matching)
    │
    ▼
Database (SQLite via better-sqlite3)
    │
    ▼
Express REST API
    │
    ▼
React Dashboard (Spending Analytics & Visual Category Breakdown)
```

1. **Gmail Ingestion**: A background worker periodically polls the Gmail API using OAuth2 to fetch recent bank and UPI transaction alert emails.
2. **Hybrid Extraction Pipeline**:
   - **Tier 1 (Deterministic Regex)**: Fast, zero-cost regex extraction for known bank and UPI email formats (HDFC, ICICI, SBI, Axis, Swiggy, Zomato, etc.).
   - **Tier 2 (LLM Fallback)**: Structured LLM extraction for unhandled, novel, or unstructured transaction alert formats.
3. **Validation**: Enforces schema correctness (positive amount, valid ISO date, recognized currency/type) before persistence.
4. **Categorization**: Classifies transactions using keyword rules with fallback handling for unrecognized merchants.
5. **Deduplication**: Prevents duplicate entries via unique Gmail message IDs and fuzzy matching for multi-channel notifications (e.g., bank debit alert + merchant receipt).
6. **Storage**: Persists validated transactions in local SQLite (`better-sqlite3`).
7. **API Layer**: Express REST API exposing transaction management, analytics aggregations, and sync controls.
8. **Dashboard**: React web application providing spending breakdowns, category insights, and manual fallback entry.

---

## Repository Structure

```
SpendSleuth/
├── .agents/                  # Agent rules and Antigravity workspace configuration
│   └── rules/
│       └── agent-rules.md   # Project-specific development rules
├── backend/                  # Node.js backend services & API
│   ├── src/
│   │   ├── db/              # Database connection, schemas, and migrations
│   │   ├── services/        # Ingestion, regex parser prototype, categorizer
│   │   ├── routes/          # Express REST API endpoints (planned)
│   │   └── index.js         # Backend server entrypoint (planned)
│   ├── package.json         # Backend package configuration
│   └── expenses.db          # Local SQLite database (gitignored)
├── frontend/                 # React web dashboard (planned)
│   ├── src/                 # UI components, analytics charts, transaction tables
│   └── package.json         # Frontend dependencies (planned)
├── README.md                 # Project documentation
└── LICENSE                   # MIT License
```

---

## Tech Stack

### Current
- Node.js
- Express
- SQLite / `better-sqlite3`

### Planned
- Gmail API / OAuth2
- LLM API
- React

---

## Current Status & Roadmap

- [x] Database schema (`backend/src/db/`)
- [x] Keyword-based categorizer (`backend/src/services/categorizer.js`)
- [ ] Email parser (`backend/src/services/parser.js` currently has a prototype parser supporting a Swiggy Dineout email format; generalized multi-format parsing is in progress)
- [ ] Email pre-processing and validation layer
- [ ] LLM extraction fallback engine
- [ ] Gmail OAuth2 authentication & background poller
- [ ] Express REST API (transactions, analytics, sync)
- [ ] React analytics dashboard
- [ ] Manual transaction entry & category correction fallback

---

## Setup

SpendSleuth is currently under active development and does not yet have a complete runnable application. Setup instructions will be provided once the core services and entrypoints are integrated.

---

## License

MIT