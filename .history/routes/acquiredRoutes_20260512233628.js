//==============================
// ACQUIRED ROUTES (updated)
//==============================

require('@dotenvx/dotenvx').config();
const express = require('express');
const router  = express.Router();
const pool    = require('../utils/db.js');
const { authenticateJWT } = require('../utils/auth');

// ── POST /api/acquired/save ───────────────────────────────────────────────────
router.post('/save', authenticateJWT, async (req, res) => {
    const client = await pool.connect();
    try {
        const { data } = req.body;
        const userId = req.user?.user_id;
        if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
        if (!Array.isArray(data) || data.length === 0)
            return res.status(400).json({ success: false, error: 'No valid data provided' });

        await client.query('BEGIN');
        let savedCount = 0;

        for (const row of data) {
            await client.query(`
                INSERT INTO acquired (
                    serial_no, acquired_date, acquired_on_date,
                    eng_received_from, hi_received_from,
                    specific_person, specific_person_hindi,
                    letter_no, eng_subject, hi_subject,
                    language, zone, acquisition_method, user_id
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            `, [
                row.serialNo             || null,
                row.letterDate           || row.acquiredDate      || null,
                row.acquiredOn           || null,
                row.officeName           || row.receivedFrom      || null,
                row.officeNameHindi      || row.receivedFromHindi || null,
                row.specificPerson       || null,
                row.specificPersonHindi  || null,
                row.letterNo             || row.letterNumber      || null,
                row.subject              || null,
                row.subjectHindi         || null,
                row.letterLanguage       || null,
                row.zone                 || null,
                Array.isArray(row.modes) ? row.modes.join(', ') : (row.acquisitionMethod || null),
                userId
            ]);
            savedCount++;
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `Saved ${savedCount} rows`, rowsSaved: savedCount });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[acquired /save]', error);
        res.status(500).json({ success: false, error: 'Database error: ' + error.message });
    } finally {
        client.release();
    }
});

// ── GET /api/acquired/load ────────────────────────────────────────────────────
router.get('/load', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const result = await pool.query(`
            SELECT
                id, serial_no,
                acquired_date, acquired_on_date,
                eng_received_from, hi_received_from,
                specific_person, specific_person_hindi,
                letter_no, eng_subject, hi_subject,
                language, zone, acquisition_method,
                created_at, updated_at
            FROM acquired
            WHERE user_id = $1
            ORDER BY serial_no ASC
        `, [userId]);

        const data = result.rows.map(row => ({
            id:                   row.id,
            serialNo:             row.serial_no,
            letterDate:           row.acquired_date           || '',
            acquiredOn:           row.acquired_on_date        || '',
            officeName:           row.eng_received_from       || '',
            officeNameHindi:      row.hi_received_from        || '',
            specificPerson:       row.specific_person         || '',
            specificPersonHindi:  row.specific_person_hindi   || '',
            letterNo:             row.letter_no               || '',
            subject:              row.eng_subject             || '',
            subjectHindi:         row.hi_subject              || '',
            letterLanguage:       row.language                || '',
            zone:                 row.zone                    || '',
            acquisitionMethod:    row.acquisition_method      || '',
            isFromDatabase:       true,
            hasChanges:           false
        }));

        res.json({ success: true, data, message: `Loaded ${result.rows.length} records` });

    } catch (error) {
        console.error('[acquired /load]', error);
        res.status(500).json({ success: false, error: 'Database error: ' + error.message });
    }
});

// ── POST /api/acquired/save-changes ──────────────────────────────────────────
router.post('/save-changes', authenticateJWT, async (req, res) => {
    const client = await pool.connect();
    try {
        const { changedRows = [], newRows = [] } = req.body;
        const userId = req.user.user_id;

        await client.query('BEGIN');
        let updatedCount = 0, insertedCount = 0;
        const newRowIds = {};

        for (const row of changedRows) {
            const r = await client.query(`
                UPDATE acquired SET
                    acquired_date = $1, acquired_on_date = $2,
                    eng_received_from = $3, hi_received_from = $4,
                    specific_person = $5, specific_person_hindi = $6,
                    letter_no = $7, eng_subject = $8, hi_subject = $9,
                    language = $10, zone = $11, acquisition_method = $12,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $13 AND user_id = $14
            `, [
                row.letterDate          || row.acquiredDate      || null,
                row.acquiredOn          || null,
                row.officeName          || row.receivedFrom      || null,
                row.officeNameHindi     || row.receivedFromHindi || null,
                row.specificPerson      || null,
                row.specificPersonHindi || null,
                row.letterNo            || row.letterNumber      || null,
                row.subject             || null,
                row.subjectHindi        || null,
                row.letterLanguage      || null,
                row.zone                || null,
                Array.isArray(row.modes) ? row.modes.join(', ') : (row.acquisitionMethod || null),
                row.id, userId
            ]);
            if (r.rowCount > 0) updatedCount++;
        }

        for (const row of newRows) {
            const r = await client.query(`
                INSERT INTO acquired (
                    serial_no, acquired_date, acquired_on_date,
                    eng_received_from, hi_received_from,
                    specific_person, specific_person_hindi,
                    letter_no, eng_subject, hi_subject,
                    language, zone, acquisition_method, user_id,
                    created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
                          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id
            `, [
                row.serialNo,
                row.letterDate          || row.acquiredDate      || null,
                row.acquiredOn          || null,
                row.officeName          || row.receivedFrom      || null,
                row.officeNameHindi     || row.receivedFromHindi || null,
                row.specificPerson      || null,
                row.specificPersonHindi || null,
                row.letterNo            || row.letterNumber      || null,
                row.subject             || null,
                row.subjectHindi        || null,
                row.letterLanguage      || null,
                row.zone                || null,
                Array.isArray(row.modes) ? row.modes.join(', ') : (row.acquisitionMethod || null),
                userId
            ]);
            if (r.rows.length > 0) {
                newRowIds[row.serialNo - 1] = r.rows[0].id;
                insertedCount++;
            }
        }

        await client.query('COMMIT');
        res.json({
            success: true,
            message: `Saved ${updatedCount + insertedCount} changes`,
            updatedCount, insertedCount, newRowIds,
            totalChanges: updatedCount + insertedCount
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[acquired /save-changes]', error);
        res.status(500).json({ success: false, error: 'Database error: ' + error.message });
    } finally {
        client.release();
    }
});

// ── GET /api/acquired/stats ───────────────────────────────────────────────────
router.get('/stats', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const params = [userId];
        let dateFilter = '';

        if (req.query.from_date && req.query.to_date) {
            dateFilter = `AND TO_DATE(NULLIF(acquired_date,''),'DD/MM/YYYY') BETWEEN $2::date AND $3::date`;
            params.push(req.query.from_date, req.query.to_date);
        }

        const base = `FROM acquired WHERE user_id = $1 ${dateFilter}`;

        const monthParams = [userId];
        let monthFilter = dateFilter
            ? dateFilter
            : `AND TO_DATE(NULLIF(acquired_date,''),'DD/MM/YYYY') >= CURRENT_DATE - INTERVAL '12 months'`;
        if (req.query.from_date && req.query.to_date) monthParams.push(req.query.from_date, req.query.to_date);

        const [total, byLang, bySender, byMonth, byZone, zoneByLang] = await Promise.all([
            pool.query(`SELECT COUNT(*) as count ${base}`, params),
            pool.query(`SELECT unnest(string_to_array(COALESCE(NULLIF(language,''),'Unknown'),', ')) as language, COUNT(*) as count ${base} GROUP BY 1`, params),
            pool.query(`SELECT COALESCE(eng_received_from, hi_received_from, 'Unknown') as sender, COUNT(*) as count ${base} GROUP BY sender ORDER BY count DESC LIMIT 10`, params),
            pool.query(`SELECT TO_CHAR(TO_DATE(NULLIF(acquired_date,''),'DD/MM/YYYY'),'YYYY-MM') as month, COUNT(*) as count FROM acquired WHERE user_id = $1 AND acquired_date != '' AND acquired_date IS NOT NULL ${monthFilter} GROUP BY month ORDER BY month ASC`, monthParams),
            pool.query(`SELECT unnest(string_to_array(COALESCE(NULLIF(zone,''),'Not Set'),', ')) as zone, COUNT(*) as count ${base} GROUP BY 1 ORDER BY count DESC`, params),
            pool.query(`SELECT unnest(string_to_array(zone,', ')) as zone, language, COUNT(*) as count FROM acquired WHERE user_id = $1 AND COALESCE(zone,'') != '' ${dateFilter} GROUP BY 1, language ORDER BY 1 ASC, language ASC`, params),
        ]);

        res.json({
            success:        true,
            total:          parseInt(total.rows[0].count),
            byLanguage:     byLang.rows,
            bySender:       bySender.rows,
            byMonth:        byMonth.rows,
            byZone:         byZone.rows,
            zoneByLanguage: zoneByLang.rows
        });

    } catch (error) {
        console.error('[acquired /stats]', error);
        res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
    }
});

module.exports = router;