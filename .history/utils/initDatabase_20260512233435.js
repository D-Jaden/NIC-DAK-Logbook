const pool = require('./db');

async function initDatabase() {
    try {
        // ── Users table ──────────────────────────────────────────────────────────
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                first_name VARCHAR(255) NOT NULL,
                last_name  VARCHAR(255) NOT NULL,
                phone_no   VARCHAR(15)  NOT NULL
            );
        `);

        // ── Acquired ─────────────────────────────────────────────────────────────
        await pool.query(`CREATE SEQUENCE IF NOT EXISTS acquired_id_seq;`);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS acquired (
                id                    INTEGER NOT NULL DEFAULT nextval('acquired_id_seq') PRIMARY KEY,
                serial_no             INTEGER NOT NULL,
                acquired_date         VARCHAR(50),
                acquired_on_date      VARCHAR(50),
                eng_received_from     VARCHAR(1000),
                hi_received_from      VARCHAR(1000),
                specific_person       TEXT,
                specific_person_hindi TEXT,
                letter_no             VARCHAR(255),
                eng_subject           VARCHAR(5000),
                hi_subject            VARCHAR(5000),
                language              VARCHAR(20),
                zone                  VARCHAR(50),
                acquisition_method    VARCHAR(100),
                user_id               INTEGER REFERENCES users(user_id),
                created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Safe migration: DATE → VARCHAR if old schema exists
        await pool.query(`
            DO $$ BEGIN
                IF (SELECT data_type FROM information_schema.columns
                    WHERE table_name='acquired' AND column_name='acquired_date') = 'date' THEN
                    ALTER TABLE acquired
                        ALTER COLUMN acquired_date TYPE VARCHAR(50)
                        USING TO_CHAR(acquired_date::date, 'DD/MM/YYYY');
                END IF;
            END $$;
        `);

        // Add columns that may be missing from older deployments
        await pool.query(`ALTER TABLE acquired ADD COLUMN IF NOT EXISTS acquired_on_date      VARCHAR(50);`);
        await pool.query(`ALTER TABLE acquired ADD COLUMN IF NOT EXISTS specific_person        TEXT;`);
        await pool.query(`ALTER TABLE acquired ADD COLUMN IF NOT EXISTS specific_person_hindi  TEXT;`);
        await pool.query(`ALTER TABLE acquired ADD COLUMN IF NOT EXISTS acquisition_method     VARCHAR(100);`);
        await pool.query(`ALTER TABLE acquired ADD COLUMN IF NOT EXISTS zone                   VARCHAR(50);`);

        // Indices
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_acquired_user_id   ON acquired(user_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_acquired_serial_no ON acquired(serial_no);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_acquired_date      ON acquired(acquired_date);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_acquired_zone      ON acquired(zone);`);

        // ── Despatch ─────────────────────────────────────────────────────────────
        await pool.query(`CREATE SEQUENCE IF NOT EXISTS despatch_id_seq;`);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS despatch (
                id                  INTEGER NOT NULL DEFAULT nextval('despatch_id_seq') PRIMARY KEY,
                serial_no           INTEGER NOT NULL,
                letter_date         VARCHAR(50),
                registration_date   VARCHAR(50),
                eng_to_whom_sent    VARCHAR(5000),
                hi_to_whom_sent     VARCHAR(5000),
                eng_copy_sent_to    VARCHAR(5000),
                hi_copy_sent_to     VARCHAR(5000),
                eng_main_address    TEXT,
                hi_main_address     TEXT,
                eng_place           VARCHAR(5000),
                hi_place            VARCHAR(5000),
                eng_subject         VARCHAR(5000),
                hi_subject          VARCHAR(5000),
                eng_sent_by         VARCHAR(5000),
                hi_sent_by          VARCHAR(5000),
                letter_no           VARCHAR(100),
                delivery_method     VARCHAR(100),
                language            VARCHAR(20),
                zone                VARCHAR(50),
                user_id             INTEGER REFERENCES users(user_id),
                created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Rename old 'date' column → 'letter_date' if needed
        await pool.query(`
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='despatch' AND column_name='date')
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='despatch' AND column_name='letter_date')
                THEN ALTER TABLE despatch RENAME COLUMN date TO letter_date; END IF;
            END $$;
        `);

        // DATE → VARCHAR migration
        await pool.query(`
            DO $$ BEGIN
                IF (SELECT data_type FROM information_schema.columns
                    WHERE table_name='despatch' AND column_name='letter_date') = 'date' THEN
                    ALTER TABLE despatch
                        ALTER COLUMN letter_date TYPE VARCHAR(50)
                        USING TO_CHAR(letter_date::date, 'DD/MM/YYYY');
                END IF;
            END $$;
        `);

        // Add missing columns
        await pool.query(`ALTER TABLE despatch ADD COLUMN IF NOT EXISTS registration_date  VARCHAR(50);`);
        await pool.query(`ALTER TABLE despatch ADD COLUMN IF NOT EXISTS eng_copy_sent_to   VARCHAR(5000);`);
        await pool.query(`ALTER TABLE despatch ADD COLUMN IF NOT EXISTS hi_copy_sent_to    VARCHAR(5000);`);
        await pool.query(`ALTER TABLE despatch ADD COLUMN IF NOT EXISTS eng_main_address   TEXT;`);
        await pool.query(`ALTER TABLE despatch ADD COLUMN IF NOT EXISTS hi_main_address    TEXT;`);
        await pool.query(`ALTER TABLE despatch ADD COLUMN IF NOT EXISTS zone               VARCHAR(50);`);

        // Widen columns
        await pool.query(`ALTER TABLE despatch ALTER COLUMN eng_to_whom_sent  TYPE VARCHAR(5000);`);
        await pool.query(`ALTER TABLE despatch ALTER COLUMN hi_to_whom_sent   TYPE VARCHAR(5000);`);
        await pool.query(`ALTER TABLE despatch ALTER COLUMN eng_place         TYPE VARCHAR(5000);`);
        await pool.query(`ALTER TABLE despatch ALTER COLUMN hi_place          TYPE VARCHAR(5000);`);
        await pool.query(`ALTER TABLE despatch ALTER COLUMN eng_subject       TYPE VARCHAR(5000);`);
        await pool.query(`ALTER TABLE despatch ALTER COLUMN hi_subject        TYPE VARCHAR(5000);`);
        await pool.query(`ALTER TABLE despatch ALTER COLUMN eng_sent_by       TYPE VARCHAR(5000);`);
        await pool.query(`ALTER TABLE despatch ALTER COLUMN hi_sent_by        TYPE VARCHAR(5000);`);
        await pool.query(`ALTER TABLE despatch ALTER COLUMN delivery_method   TYPE VARCHAR(100);`);

        // Indices
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_despatch_user_id    ON despatch(user_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_despatch_serial_no  ON despatch(serial_no);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_despatch_letter_date ON despatch(letter_date);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_despatch_zone       ON despatch(zone);`);

        console.log('✅  Database initialised successfully.');
    } catch (error) {
        console.error('❌  Database initialisation failed:', error);
        throw error;
    }
}

module.exports = initDatabase;