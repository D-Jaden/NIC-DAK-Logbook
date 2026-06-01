//===============================
//DESPATCH ROUTES
//===============================

require('@dotenvx/dotenvx').config();
const session = require('express-session');
const express = require('express');
const router = express.Router();
const pool = require('../utils/db.js');

const { authenticateJWT } = require('../utils/auth');

// ── helpers ──────────────────────────────────────────────────────────────────
// The date column is now a plain VARCHAR so no conversion is needed.
// We keep a simple pass-through so existing code that calls these still works.
function passDate(val) { return val || null; }

// ── /save ─────────────────────────────────────────────────────────────────────
router.post('/save', authenticateJWT, async (req, res) => {
    const client = await pool.connect();
    try {
        const { data } = req.body;
        const userId = req.user ? req.user.user_id : null;

        if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
        if (!data || !Array.isArray(data) || data.length === 0)
            return res.status(400).json({ success: false, error: 'No valid data provided' });

        await client.query('BEGIN');

        let savedCount = 0;
        for (const row of data) {
            const query = `
                INSERT INTO despatch (
                    serial_no, letter_date, registration_date,
                    eng_to_whom_sent, hi_to_whom_sent,
                    eng_copy_sent_to, hi_copy_sent_to,
                    eng_main_address, hi_main_address,
                    eng_place, hi_place,
                    eng_subject, hi_subject,
                    eng_sent_by, hi_sent_by,
                    letter_no, delivery_method, language, zone, user_id
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
            `;
            await client.query(query, [
                row.serialNo || null,
                passDate(row.letterDate),
                passDate(row.registrationDate),
                row.toWhom || null,
                row.toWhomHindi || null,
                row.copySentTo || null,
                row.copySentToHindi || null,
                row.mainAddress || null,
                row.mainAddressHindi || null,
                row.place || null,
                row.placeHindi || null,
                row.subject || null,
                row.subjectHindi || null,
                row.sentBy || null,
                row.sentByHindi || null,
                row.letterNo || null,
                row.deliveryMethod || null,
                row.letterLanguage || null,
                row.zone || null,
                userId
            ]);
            savedCount++;
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `Saved ${savedCount} rows`, rowsSaved: savedCount });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Save error:', error);
        res.status(500).json({ success: false, error: 'Database error: ' + error.message });
    } finally {
        client.release();
    }
});

// ── /load ─────────────────────────────────────────────────────────────────────
router.get('/load', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const result = await pool.query(`
            SELECT
                id, serial_no,
                letter_date, registration_date,
                eng_to_whom_sent, hi_to_whom_sent,
                eng_copy_sent_to, hi_copy_sent_to,
                eng_main_address, hi_main_address,
                eng_place, hi_place,
                eng_subject, hi_subject,
                eng_sent_by, hi_sent_by,
                letter_no, delivery_method, language, zone,
                created_at, updated_at
            FROM despatch
            WHERE user_id = $1
            ORDER BY serial_no ASC
        `, [userId]);

        const transformedData = result.rows.map(row => ({
            id: row.id,
            serialNo: row.serial_no,
            letterDate: row.letter_date || '',
            registrationDate: row.registration_date || '',
            toWhom: row.eng_to_whom_sent || '',
            toWhomHindi: row.hi_to_whom_sent || '',
            copySentTo: row.eng_copy_sent_to || '',
            copySentToHindi: row.hi_copy_sent_to || '',
            mainAddress: row.eng_main_address || '',
            mainAddressHindi: row.hi_main_address || '',
            place: row.eng_place || '',
            placeHindi: row.hi_place || '',
            subject: row.eng_subject || '',
            subjectHindi: row.hi_subject || '',
            sentBy: row.eng_sent_by || '',
            sentByHindi: row.hi_sent_by || '',
            letterNo: row.letter_no || '',
            deliveryMethod: row.delivery_method || '',
            letterLanguage: row.language || '',
            zone: row.zone || '',
            isFromDatabase: true,
            hasChanges: false
        }));

        res.json({ success: true, data: transformedData, message: `Loaded ${result.rows.length} records` });

    } catch (error) {
        console.error('Load error:', error);
        res.status(500).json({ success: false, error: 'Database error: ' + error.message });
    }
});

// ── /save-changes ─────────────────────────────────────────────────────────────
router.post('/save-changes', authenticateJWT, async (req, res) => {
    const client = await pool.connect();
    try {
        const { changedRows, newRows } = req.body;
        const userId = req.user.user_id;

        await client.query('BEGIN');

        let updatedCount = 0;
        let insertedCount = 0;
        const newRowIds = {};

        if (changedRows && changedRows.length > 0) {
            for (const row of changedRows) {
                const updateQuery = `
                    UPDATE despatch SET
                        letter_date = $1, registration_date = $2,
                        eng_to_whom_sent = $3, hi_to_whom_sent = $4,
                        eng_copy_sent_to = $5, hi_copy_sent_to = $6,
                        eng_main_address = $7, hi_main_address = $8,
                        eng_place = $9, hi_place = $10,
                        eng_subject = $11, hi_subject = $12,
                        eng_sent_by = $13, hi_sent_by = $14,
                        letter_no = $15, delivery_method = $16,
                        language = $17, zone = $18,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $19 AND user_id = $20
                `;
                const result = await client.query(updateQuery, [
                    passDate(row.letterDate),
                    passDate(row.registrationDate),
                    row.toWhom || null,
                    row.toWhomHindi || null,
                    row.copySentTo || null,
                    row.copySentToHindi || null,
                    row.mainAddress || null,
                    row.mainAddressHindi || null,
                    row.place || null,
                    row.placeHindi || null,
                    row.subject || null,
                    row.subjectHindi || null,
                    row.sentBy || null,
                    row.sentByHindi || null,
                    row.letterNo || null,
                    row.deliveryMethod || null,
                    row.letterLanguage || null,
                    row.zone || null,
                    row.id,
                    userId
                ]);
                if (result.rowCount > 0) updatedCount++;
            }
        }

        if (newRows && newRows.length > 0) {
            for (const row of newRows) {
                const insertQuery = `
                    INSERT INTO despatch (
                        serial_no, letter_date, registration_date,
                        eng_to_whom_sent, hi_to_whom_sent,
                        eng_copy_sent_to, hi_copy_sent_to,
                        eng_main_address, hi_main_address,
                        eng_place, hi_place,
                        eng_subject, hi_subject,
                        eng_sent_by, hi_sent_by,
                        letter_no, delivery_method, language, zone, user_id,
                        created_at, updated_at
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING id
                `;
                const result = await client.query(insertQuery, [
                    row.serialNo,
                    passDate(row.letterDate),
                    passDate(row.registrationDate),
                    row.toWhom || null,
                    row.toWhomHindi || null,
                    row.copySentTo || null,
                    row.copySentToHindi || null,
                    row.mainAddress || null,
                    row.mainAddressHindi || null,
                    row.place || null,
                    row.placeHindi || null,
                    row.subject || null,
                    row.subjectHindi || null,
                    row.sentBy || null,
                    row.sentByHindi || null,
                    row.letterNo || null,
                    row.deliveryMethod || null,
                    row.letterLanguage || null,
                    row.zone || null,
                    userId
                ]);
                if (result.rows.length > 0) {
                    newRowIds[row.serialNo - 1] = result.rows[0].id;
                    insertedCount++;
                }
            }
        }

        await client.query('COMMIT');
        const totalOperations = updatedCount + insertedCount;
        res.json({ success: true, message: `Saved ${totalOperations} changes`, updatedCount, insertedCount, newRowIds, totalChanges: totalOperations });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Save-changes error:', error);
        res.status(500).json({ success: false, error: 'Database error: ' + error.message });
    } finally {
        client.release();
    }
});

//======================================
// DASHBOARD STATS ROUTE
//======================================
router.get('/stats', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { from, to } = req.query;

        let dateFilter = '';
        const params = [userId];
        if (from && to) { params.push(from, to); dateFilter = `AND letter_date BETWEEN $2 AND $3`; }
        else if (from)  { params.push(from);      dateFilter = `AND letter_date >= $2`; }
        else if (to)    { params.push(to);         dateFilter = `AND letter_date <= $2`; }

        const base = `FROM despatch WHERE user_id = $1 ${dateFilter}`;

        const totalResult  = await pool.query(`SELECT COUNT(*) as total ${base}`, params);
        const zoneResult   = await pool.query(`SELECT unnest(string_to_array(COALESCE(NULLIF(zone, ''), 'Not Set'), ', ')) as label, COUNT(*) as count ${base} GROUP BY 1 ORDER BY count DESC`, params);
        
        // NEW COMBINED QUERY -> Zone + Language
        const zoneLangResult = await pool.query(`
            SELECT CONCAT(unnest(string_to_array(COALESCE(NULLIF(zone, ''), 'Not Set'), ', ')), ' (', COALESCE(NULLIF(language, ''), 'Not Set'), ')') as label, COUNT(*) as count 
            ${base} 
            GROUP BY 1 
            ORDER BY count DESC
        `, params);

        const methodResult = await pool.query(`SELECT unnest(string_to_array(COALESCE(NULLIF(delivery_method, ''), 'Not Set'), ', ')) as label, COUNT(*) as count ${base} GROUP BY 1 ORDER BY count DESC`, params);
        const langResult   = await pool.query(`SELECT unnest(string_to_array(COALESCE(NULLIF(language, ''), 'Not Set'), ', ')) as label, COUNT(*) as count ${base} GROUP BY 1 ORDER BY count DESC`, params);
        const placeResult  = await pool.query(`SELECT COALESCE(eng_place,'Not Set') as label, COUNT(*) as count ${base} AND eng_place IS NOT NULL AND eng_place != '' GROUP BY eng_place ORDER BY count DESC LIMIT 10`, params);
        const monthResult  = await pool.query(`
            SELECT letter_date as label, letter_date as sort_key, COUNT(*) as count
            FROM despatch WHERE user_id = $1
            GROUP BY letter_date ORDER BY sort_key ASC LIMIT 12
        `, [userId]);

        res.json({
            success: true,
            total: parseInt(totalResult.rows[0].total),
            byZone:     zoneResult.rows.map(r   => ({ label: r.label, count: parseInt(r.count) })),
            byZoneLang: zoneLangResult.rows.map(r => ({ label: r.label, count: parseInt(r.count) })),
            byMethod:   methodResult.rows.map(r => ({ label: r.label, count: parseInt(r.count) })),
            byLanguage: langResult.rows.map(r   => ({ label: r.label, count: parseInt(r.count) })),
            byPlace:    placeResult.rows.map(r  => ({ label: r.label, count: parseInt(r.count) })),
            byMonth:    monthResult.rows.map(r  => ({ label: r.label, count: parseInt(r.count) }))
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ success: false, error: 'Database error: ' + error.message });
    }
});

module.exports = router;        