# SpendSleuth

An expense tracker that logs itself. Instead of manually typing in every purchase, 
SpendSleuth reads your bank/UPI transaction alert emails, extracts the amount and 
merchant, and automatically categorizes and logs each transaction — no manual entry 
required.

## Why I built this

I already use Money Manager, but I kept forgetting to log transactions since it's 
all manual. On top of that, its category breakdown isn't great — there's no clean 
way to see what percentage of my spending goes to each category. SpendSleuth fixes 
both: transactions get logged automatically from bank/UPI emails, and the dashboard 
is built around category breakdowns from the start.


## Features

- [x] Database schema
- [x] Keyword-based categorizer
- [ ] Email parser
- [ ] Gmail OAuth integration
- [ ] Transaction API (CRUD)
- [ ] Scheduled email polling
- [ ] React dashboard

## Tech Stack

- **Backend:** Node.js, Express
- **Database:** SQLite (better-sqlite3)
- **Auth:** Gmail API (OAuth2)
- **Frontend:** React (planned)

## Setup

_Coming soon — once there's something runnable._

## License

MIT