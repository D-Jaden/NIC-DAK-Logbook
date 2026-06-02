<div align="center">
  
![logo](https://github.com/D-Jaden/DAK-Register/blob/main/public/images/NIC-Logo-white.png)
# NIC DAK Logbook

**A bilingual (English/Hindi) web-based logbook system for managing government postal correspondence.**

Developed as part of an internship at the **National Informatics Centre (NIC)**

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)

</div>

---

## Overview

NIC DAK Logbook is a full-stack Node.js web application designed for NIC offices to digitally record and track official **DAK** (mail/correspondence). It supports two workflows:

- **Despatch** — Log and track outgoing letters/documents sent to recipients.
- **Receipt** — Log and track incoming letters/documents received from other offices or individuals.

All entries support bilingual fields in both **English and Hindi**, with an integrated automatic translation service. Each user account maintains its own isolated records.

---

## Features

<details>
<summary><b> Authentication</b></summary>

- Register with First Name, Last Name, and Phone Number
- CAPTCHA verification and agreement checkbox on signup
- Login using registered Phone Number
- Only numeric values accepted in the phone number field
- Duplicate accounts prevented (case-insensitive name matching, unique phone number check)
- Passwords hashed securely with **Argon2**
- JWT-based session tokens 
- All data is scoped per user via `user_id`

</details>

<details>
<summary><b> Despatch Module (Outgoing Mail)</b></summary>

Each despatch entry captures:

| Field | Details |
|---|---|
| Date of Despatch | |
| Letter No | |
| Date of Letter | |
| Mode of Despatch | Hand, E-mail, E-file, Speed Post, Registered Post |
| Priority | Immediate, Priority |
| Subject | Auto-translated to Hindi |
| Sent From | Name, Designation, Pincode, State, City, District, Zone, Full Address |
| Received By | Name, Designation, Department |
| Copy Sent To | Name, Office/Room No, Pincode, State, City, District |
| Remarks | Optional |

</details>

<details>
<summary><b> Receipt Module (Incoming Mail)</b></summary>

Each receipt entry captures:

| Field | Details |
|---|---|
| Receipt Date | |
| Letter No | |
| Date of Letter | |
| Mode of Receipt | Hand, E-mail, E-file, Speed Post, Registered Post |
| Priority | Immediate, Priority |
| Subject | Auto-translated to Hindi |
| Sent By | Name, Designation, Department |
| Sent To | Name, Pincode, State, City, District, Zone, Full Address |
| Copy Sent To | Name, Office/Room No, Pincode, State, City, District |
| Remarks | Optional |

</details>

<details>
<summary><b> Common Actions (Both Modules)</b></summary>

- **New Entry** — Create a new Despatch or Receipt record
- **Save as Draft** — Save entry to Pending for later completion
- **Save & Submit** — Finalize and submit an entry
- **Edit** — Modify existing entries
- **Delete** — Remove entries
- **Quick Search** — Jump between Despatch and Receipt views
- **Dashboard** — Overview of all entries

**Search & Filter by:**
- Zone
- Priority
- Mode
- Date Range (From → To)

**Reports & PDF Export:**
- All Time
- Specific Month
- Past 6 Months
- Full Year
- Custom Date Range (From → To)

</details>

<details>
<summary><b> Bilingual Support & Integrations</b></summary>

- All major fields stored in **English and Hindi**
- Auto-translation powered by a HuggingFace-hosted Python service
- **Pincode Lookup** — Auto-fills State, City, District using the India Post Pincode API
- **PDF Export** — Generate and download PDF records using jsPDF + html2canvas

</details>

---

##  Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Frontend** | HTML, CSS, JavaScript | - |
| **Runtime** | Node.js , npm  | v22.21.1 , v11.15.0|
| **Framework** | Express 5 | - |
| **Database** | PostgreSQL (via `pg` pool) | v18.3 |
| **Auth** | JWT (`jsonwebtoken`) + Argon2 hashing | - |
| **Sessions** | `express-session` | - |
| **Config** | `@dotenvx/dotenvx` | v1.48.4 |
| **PDF Export** | jsPDF + html2canvas | - |
| **Translation API** | Python (Deep Translator) on HuggingFace | - |
| **Dev Tool** | Nodemon | v3.1.10 |

---

##  Project Structure

```
NIC-DAK-Logbook/
├── server.js                  # Express app entry point
├── package.json
│
├── routes/
│   ├── userRoutes.js          # POST /users/login, /users/register
│   ├── despatchRoutes.js      # CRUD for outgoing mail
│   └── acquiredRoutes.js      # CRUD for incoming mail (Receipt)
│
├── utils/
│   ├── db.js                  # PostgreSQL connection pool
│   ├── auth.js                # JWT middleware
│   ├── helpers.js             # Date formatting utilities
│   └── initDatabase.js        # Auto-creates/migrates tables on startup
│
├── public/
│   ├── despatch/              # Despatch app (HTML, CSS, JS)
│   ├── acquired/              # Receipt app (HTML, CSS, JS)
│   ├── signup/login/          # Login & registration pages
│   ├── shared/                # Shared assets
│   └── images/                # Static images
│
└── Translator/
    ├── app.py                 # Translation microservice
    ├── Dockerfile
    └── requirements.txt
```

---

##  Database Schema

> Tables are **automatically created** on first run via `initDatabase.js`. No manual migration required.

The app uses a PostgreSQL database named **`dak`**.

<details>
<summary><b>users</b></summary>

| Column | Type | Notes |
|---|---|---|
| user_id | INTEGER (PK) | Auto-generated identity |
| first_name | VARCHAR(255) | |
| last_name | VARCHAR(255) | |
| phone_no | VARCHAR(15) | Unique |
| password_hash | TEXT | Argon2 hash of phone number |

</details>

<details>
<summary><b>user_sessions</b></summary>

| Column | Type | Notes |
|---|---|---|
| sid | VARCHAR | |
| sess | JSON | |
| expire | TIMESTAMP | |

</details>

<details>
<summary><b>acquired</b> (Receipt / Incoming Mail)</summary>

| Column | Type |
|---|---|
| id | INTEGER (PK) |
| serial_no | INTEGER |
| acquired_date | VARCHAR(50) |
| acquired_on_date | VARCHAR(50) |
| eng_received_from | VARCHAR(1000) |
| hi_received_from | VARCHAR(1000) |
| specific_person | TEXT |
| specific_person_hindi | TEXT |
| letter_no | VARCHAR(255) |
| eng_subject | VARCHAR(5000) |
| hi_subject | VARCHAR(5000) |
| language | VARCHAR(20) |
| zone | VARCHAR(50) |
| acquisition_method | VARCHAR(100) |
| priority | VARCHAR(50) |
| status | VARCHAR(20) |
| user_id | INTEGER (FK → users) |

</details>

<details>
<summary><b>despatch</b> (Outgoing Mail)</summary>

| Column | Type |
|---|---|
| id | INTEGER (PK) |
| serial_no | INTEGER |
| letter_date | VARCHAR(50) |
| despatch_date | VARCHAR(50) |
| eng_to_whom_sent | VARCHAR(5000) |
| hi_to_whom_sent | VARCHAR(5000) |
| eng_copy_sent_to | VARCHAR(5000) |
| hi_copy_sent_to | VARCHAR(5000) |
| eng_main_address | TEXT |
| hi_main_address | TEXT |
| eng_place | VARCHAR(5000) |
| hi_place | VARCHAR(5000) |
| eng_subject | VARCHAR(5000) |
| hi_subject | VARCHAR(5000) |
| eng_sent_by | VARCHAR(5000) |
| hi_sent_by | VARCHAR(5000) |
| letter_no | VARCHAR(100) |
| delivery_method | VARCHAR(100) |
| language | VARCHAR(20) |
| zone | VARCHAR(50) |
| priority | VARCHAR(50) |
| status | VARCHAR(20) |
| user_id | INTEGER (FK → users) |

</details>

---

##  API Reference

### Auth — `/users`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/users/login` | Login with phone number |
| POST | `/users/register` | Register with name + phone number |

### Despatch — `/api/despatch` *(JWT required)*

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/despatch/next-serial` | Get next serial number for user |
| POST | `/api/despatch/save` | Save one or more despatch entries |
| GET | `/api/despatch/records` | Fetch all records for the user |
| PUT | `/api/despatch/:id` | Update a despatch entry |
| DELETE | `/api/despatch/:id` | Delete a despatch entry |

### Acquired/Receipt — `/api/acquired` *(JWT required)*

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/acquired/next-serial` | Get next serial number for user |
| POST | `/api/acquired/save` | Save one or more receipt entries |
| GET | `/api/acquired/records` | Fetch all records for the user |
| PUT | `/api/acquired/:id` | Update a receipt entry |
| DELETE | `/api/acquired/:id` | Delete a receipt entry |

### Utility Proxies

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/translate` | Translate English text to Hindi |
| GET | `/api/pincode/:pin` | Fetch address info for a PIN code |

---

##  Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [PostgreSQL](https://www.postgresql.org/) v14+
- npm
- Any IDE (VS Code recommended)

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/D-Jaden/NIC-DAK-Logbook.git
cd NIC-DAK-Logbook
```

**2. Install dependencies** 
Use npm or pnpm as you package installer accordingly 
```bash
npm install
npm init -y
npm install boxicons
npm install nodemon
npm install js2pdf
npm install dotenv
npm install express
npm install jsonwebtoken
npm install @dotenvx/dotenvx --save
npm install connect-pg-simple
npm install pino
npm install pino-pretty
```

**3. Create the PostgreSQL database**
```sql
CREATE DATABASE dak;
\c dak
```

**4. Set up environment variables**

Create a `.env` file in the root directory:
```env
# Database
DB_USER=your_postgres_user
DB_HOST=localhost
DB_DATABASE=dak
DB_PASSWORD=your_password
DB_PORT=5432

# Auth
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret

# Translator (optional — falls back gracefully if not set)
HF_TRANSLATE_URL= ....

# Server
PORT=3000
```

> The tables (`users`, `despatch`, `acquired`) are **created automatically** on first run via `initDatabase.js`.

---

## Running the App

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The app will be available at `http://localhost:3000`.

| Route | Description |
|---|---|
| `/` | Login / Registration page |
| `/despatch` | Despatch logbook app |
| `/acquired` | Receipt logbook app |

> Protected routes (`/despatch`, `/acquired`) redirect unauthenticated users to the login page.

---
## LOGGING
Done via pino and pino pretty
Displays info like below
| TimeStamp | Message | pid hostname | Description |
|---|---|---|---|
|[02-06-2026 01:06:12] | INFO | (205480) |Connected to the database successfully! |
|[02-06-2026 01:06:13] | INFO | (205480) |Database initialised successfully.|
|[02-06-2026 01:06:13] | INFO | (205480) |Server started|
|[02-06-2026 01:06:13] | INFO | (205480) |DAK System running on (hostname) |


---
## Translator Service

Auto-translation from English to Hindi is powered by a Python microservice hosted on HuggingFace Spaces.

The Node.js server proxies all translation requests to this service via `POST /api/translate`. If the service is unavailable, the original English text is returned as a graceful fallback.

**To run the translator locally:**
```bash
cd Translator
docker build -t dak-translator .
docker run -p 7860:7860 dak-translator
```
Then set `HF_TRANSLATE_URL=http://localhost:7860/translate` in your `.env`.

---

## License

ISC

---

<div align="center">
Made at <b>National Informatics Centre (NIC)</b>
</div>
