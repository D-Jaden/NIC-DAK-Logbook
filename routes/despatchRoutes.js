//==============================
// DESPATCH ROUTES (updated)
//==============================

require('@dotenvx/dotenvx').config();
const express = require('express');
const router  = express.Router();
const validate = require('../middleware/validate');
const { saveDespatchSchema } = require('../schemas/despatchSchemas');
const logger = require('../utils/logger');
const pool    = require('../utils/db.js');
const { authenticateJWT } = require('../utils/auth');

// Simple pass-through — dates stored as VARCHAR strings
function passDate(val) { return val || null; }

// ── GET /api/despatch/next-serial ─────────────────────────────────────────────
router.get('/next-serial', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user?.user_id;
        if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
        const maxRes = await pool.query('SELECT COALESCE(MAX(serial_no), 0) as max_sn FROM despatch WHERE user_id = $1', [userId]);
        const nextSerial = parseInt(maxRes.rows[0].max_sn) + 1;
        res.json({ success: true, nextSerial });
    } catch (e) {
        logger.error(e, 'Error fetching next serial:');
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── POST /api/despatch/save ───────────────────────────────────────────────────
router.post('/save', authenticateJWT, validate(saveDespatchSchema), async (req, res) => {
    const client = await pool.connect();
    try {
        const { data } = req.body;
        const userId = req.user?.user_id;
        if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
        if (!Array.isArray(data) || data.length === 0)
            return res.status(400).json({ success: false, error: 'No valid data provided' });

        await client.query('BEGIN');
        let savedCount = 0;

        const maxRes = await client.query('SELECT COALESCE(MAX(serial_no), 0) as max_sn FROM despatch WHERE user_id = $1', [userId]);
        let currentSerial = parseInt(maxRes.rows[0].max_sn);

        for (const row of data) {
            let rowSerial = row.serialNo;
            if (!rowSerial) {
                currentSerial++;
                rowSerial = currentSerial;
            }
            // Build combined sent_by JSON string for eng/hi columns
            const engSentBy = [row.sentByName, row.sentByDesignation, row.sentByDepartment]
                .filter(Boolean).join(' | ') || row.sentBy || null;
            const hiSentBy  = [row.sentByNameHi, row.sentByDesignationHi, row.sentByDepartmentHi]
                .filter(Boolean).join(' | ') || row.sentByHindi || null;

            // Build combined copy_sent_to strings (array of copy objects → JSON string)
            const engCopy = row.copies
                ? JSON.stringify(row.copies.map(c => ({ name: c.name, office: c.office, city: c.city, state: c.state, zone: c.zone, pin: c.pin })))
                : (row.copySentTo || null);
            const hiCopy  = row.copySentToHindi || null;

            await client.query(`
                INSERT INTO despatch (
                    serial_no, letter_date, despatch_date,
                    eng_to_whom_sent, hi_to_whom_sent,
                    eng_copy_sent_to, hi_copy_sent_to,
                    eng_main_address, hi_main_address,
                    eng_place, hi_place,
                    eng_subject, hi_subject,
                    eng_sent_by, hi_sent_by,
                    letter_no, delivery_method, language, zone, user_id, status, priority
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
            `, [
                rowSerial,
                passDate(row.letterDate) || '',
                passDate(row.despatchDate) || '',
                row.sentToName     || row.toWhom      || '',
                row.sentToNameHi   || row.toWhomHindi || '',
                engCopy            || '',
                hiCopy             || '',
                row.sentToAddress  || row.mainAddress      || '',
                row.sentToAddressHi|| row.mainAddressHindi || '',
                row.place          || row.sentToZone  || '',
                row.placeHindi     || '',
                row.subject        || '',
                row.subjectHindi   || '',
                engSentBy          || '',
                hiSentBy           || '',
                row.letterNo       || '',
                Array.isArray(row.modes) ? row.modes.join(', ') : (row.deliveryMethod || ''),
                row.letterLanguage || row.language || '',
                row.zone           || '',
                userId,
                row.status         || 'submitted',
                row.priority       || 'priority'
            ]);
            savedCount++;
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `Saved ${savedCount} rows`, rowsSaved: savedCount });

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(error, '[despatch /save]');
        res.status(500).json({ success: false, error: 'Database error: ' + error.message });
    } finally {
        client.release();
    }
});

// ── GET /api/despatch/load ────────────────────────────────────────────────────
router.get('/load', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const result = await pool.query(`
            SELECT
                id, serial_no,
                letter_date, despatch_date,
                eng_to_whom_sent, hi_to_whom_sent,
                eng_copy_sent_to, hi_copy_sent_to,
                eng_main_address, hi_main_address,
                eng_place, hi_place,
                eng_subject, hi_subject,
                eng_sent_by, hi_sent_by,
                letter_no, delivery_method, language, zone, status, priority,
                created_at, updated_at
            FROM despatch
            WHERE user_id = $1
            ORDER BY serial_no ASC
        `, [userId]);

        const data = result.rows.map(row => ({
            id:               row.id,
            serialNo:         row.serial_no,
            letterDate:       row.letter_date       || '',
            despatchDate:     row.despatch_date     || '',
            // Sent To
            sentToName:       row.eng_to_whom_sent  || '',
            sentToNameHi:     row.hi_to_whom_sent   || '',
            sentToAddress:    row.eng_main_address  || '',
            sentToAddressHi:  row.hi_main_address   || '',
            sentToZone:       row.eng_place         || '',
            // Copy Sent To
            copySentTo:       row.eng_copy_sent_to  || '',
            copySentToHindi:  row.hi_copy_sent_to   || '',
            // Subject
            subject:          row.eng_subject       || '',
            subjectHindi:     row.hi_subject        || '',
            // Sent By
            sentBy:           row.eng_sent_by       || '',
            sentByHindi:      row.hi_sent_by        || '',
            // Meta
            letterNo:         row.letter_no         || '',
            deliveryMethod:   row.delivery_method   || '',
            letterLanguage:   row.language          || '',
            zone:             row.zone              || '',
            status:           row.status            || 'submitted',
            priority:         row.priority          || 'priority',
            isFromDatabase:   true,
            hasChanges:       false
        }));

        res.json({ success: true, data, message: `Loaded ${result.rows.length} records` });

    } catch (error) {
        logger.error(error, '[despatch /load]');
        res.status(500).json({ success: false, error: 'Database error: ' + error.message });
    }
});

// ── POST /api/despatch/save-changes ──────────────────────────────────────────
router.post('/save-changes', authenticateJWT, validate(saveDespatchSchema), async (req, res) => {
    const client = await pool.connect();
    try {
        const { changedRows = [], newRows = [] } = req.body;
        const userId = req.user.user_id;

        await client.query('BEGIN');
        let updatedCount = 0, insertedCount = 0;
        const newRowIds = {};

        for (const row of changedRows) {
            const engSentBy = [row.sentByName, row.sentByDesignation, row.sentByDepartment]
                .filter(Boolean).join(' | ') || row.sentBy || null;
            const hiSentBy  = [row.sentByNameHi, row.sentByDesignationHi, row.sentByDepartmentHi]
                .filter(Boolean).join(' | ') || row.sentByHindi || null;
            const engCopy   = row.copies ? JSON.stringify(row.copies) : (row.copySentTo || null);

            const r = await client.query(`
                UPDATE despatch SET
                    letter_date = $1, despatch_date = $2,
                    eng_to_whom_sent = $3, hi_to_whom_sent = $4,
                    eng_copy_sent_to = $5, hi_copy_sent_to = $6,
                    eng_main_address = $7, hi_main_address = $8,
                    eng_place = $9, hi_place = $10,
                    eng_subject = $11, hi_subject = $12,
                    eng_sent_by = $13, hi_sent_by = $14,
                    letter_no = $15, delivery_method = $16,
                    language = $17, zone = $18, status = $19, priority = $20,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $21 AND user_id = $22
            `, [
                passDate(row.letterDate) || '', passDate(row.despatchDate) || '',
                row.sentToName    || row.toWhom       || '',
                row.sentToNameHi  || row.toWhomHindi  || '',
                engCopy           || '', row.copySentToHindi  || '',
                row.sentToAddress || row.mainAddress   || '',
                row.sentToAddressHi||row.mainAddressHindi||'',
                row.sentToZone   || row.place          || '',
                row.placeHindi   || '',
                row.subject      || '', row.subjectHindi   || '',
                engSentBy        || '', hiSentBy           || '',
                row.letterNo     || '',
                Array.isArray(row.modes) ? row.modes.join(', ') : (row.deliveryMethod || ''),
                row.letterLanguage || row.language || '',
                row.zone         || '',
                row.status       || 'submitted',
                row.priority     || 'priority',
                row.id, userId
            ]);
            if (r.rowCount > 0) updatedCount++;
        }

        const maxRes = await client.query('SELECT COALESCE(MAX(serial_no), 0) as max_sn FROM despatch WHERE user_id = $1', [userId]);
        let currentSerial = parseInt(maxRes.rows[0].max_sn);

        for (const row of newRows) {
            let rowSerial = row.serialNo;
            if (!rowSerial) {
                currentSerial++;
                rowSerial = currentSerial;
            }
            const engSentBy = [row.sentByName, row.sentByDesignation, row.sentByDepartment]
                .filter(Boolean).join(' | ') || row.sentBy || null;
            const hiSentBy  = [row.sentByNameHi, row.sentByDesignationHi, row.sentByDepartmentHi]
                .filter(Boolean).join(' | ') || row.sentByHindi || null;
            const engCopy   = row.copies ? JSON.stringify(row.copies) : (row.copySentTo || null);

            const r = await client.query(`
                INSERT INTO despatch (
                    serial_no, letter_date, despatch_date,
                    eng_to_whom_sent, hi_to_whom_sent,
                    eng_copy_sent_to, hi_copy_sent_to,
                    eng_main_address, hi_main_address,
                    eng_place, hi_place,
                    eng_subject, hi_subject,
                    eng_sent_by, hi_sent_by,
                    letter_no, delivery_method, language, zone, user_id, status, priority,
                    created_at, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
                          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id
            `, [
                rowSerial,
                passDate(row.letterDate) || '', passDate(row.despatchDate) || '',
                row.sentToName    || row.toWhom        || '',
                row.sentToNameHi  || row.toWhomHindi   || '',
                engCopy           || '', row.copySentToHindi   || '',
                row.sentToAddress || row.mainAddress    || '',
                row.sentToAddressHi||row.mainAddressHindi||'',
                row.sentToZone   || row.place           || '',
                row.placeHindi   || '',
                row.subject      || '', row.subjectHindi    || '',
                engSentBy        || '', hiSentBy           || '',
                row.letterNo     || '',
                Array.isArray(row.modes) ? row.modes.join(', ') : (row.deliveryMethod || ''),
                row.letterLanguage || row.language || '',
                row.zone         || '',
                userId,
                row.status       || 'submitted',
                row.priority     || 'priority'
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
        logger.error(error, '[despatch /save-changes]');
        res.status(500).json({ success: false, error: 'Database error: ' + error.message });
    } finally {
        client.release();
    }
});

// ── DELETE /api/despatch/delete/:id ──────────────────────────────────────────
router.delete('/delete/:id', authenticateJWT, async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.user.user_id;
        const result = await pool.query('DELETE FROM despatch WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Record not found' });
        res.json({ success: true, message: 'Record deleted successfully' });
    } catch (error) {
        logger.error(error, '[despatch /delete]');
        res.status(500).json({ success: false, error: 'Database error: ' + error.message });
    }
});

// ── GET /api/despatch/stats ───────────────────────────────────────────────────
router.get('/stats', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { from, to } = req.query;

        const params = [userId];
        let dateFilter = '';
        if (from && to) { params.push(from, to); dateFilter = `AND letter_date BETWEEN $2 AND $3`; }
        else if (from)  { params.push(from);      dateFilter = `AND letter_date >= $2`; }
        else if (to)    { params.push(to);         dateFilter = `AND letter_date <= $2`; }

        const base = `FROM despatch WHERE user_id = $1 ${dateFilter}`;

        const [total, byZone, byZoneLang, byMethod, byLang, byPlace, byMonth] = await Promise.all([
            pool.query(`SELECT COUNT(*) as total ${base}`, params),
            pool.query(`SELECT unnest(string_to_array(COALESCE(NULLIF(zone,''),'Not Set'),', ')) as label, COUNT(*) as count ${base} GROUP BY 1 ORDER BY count DESC`, params),
            pool.query(`SELECT CONCAT(unnest(string_to_array(COALESCE(NULLIF(zone,''),'Not Set'),', ')),' (',COALESCE(NULLIF(language,''),'Not Set'),')') as label, COUNT(*) as count ${base} GROUP BY 1 ORDER BY count DESC`, params),
            pool.query(`SELECT unnest(string_to_array(COALESCE(NULLIF(delivery_method,''),'Not Set'),', ')) as label, COUNT(*) as count ${base} GROUP BY 1 ORDER BY count DESC`, params),
            pool.query(`SELECT unnest(string_to_array(COALESCE(NULLIF(language,''),'Not Set'),', ')) as label, COUNT(*) as count ${base} GROUP BY 1 ORDER BY count DESC`, params),
            pool.query(`SELECT COALESCE(eng_place,'Not Set') as label, COUNT(*) as count ${base} AND eng_place IS NOT NULL AND eng_place != '' GROUP BY eng_place ORDER BY count DESC LIMIT 10`, params),
            pool.query(`SELECT letter_date as label, letter_date as sort_key, COUNT(*) as count FROM despatch WHERE user_id = $1 GROUP BY letter_date ORDER BY sort_key ASC LIMIT 12`, [userId]),
        ]);

        res.json({
            success:    true,
            total:      parseInt(total.rows[0].total),
            byZone:     byZone.rows.map(r    => ({ label: r.label, count: parseInt(r.count) })),
            byZoneLang: byZoneLang.rows.map(r => ({ label: r.label, count: parseInt(r.count) })),
            byMethod:   byMethod.rows.map(r  => ({ label: r.label, count: parseInt(r.count) })),
            byLanguage: byLang.rows.map(r    => ({ label: r.label, count: parseInt(r.count) })),
            byPlace:    byPlace.rows.map(r   => ({ label: r.label, count: parseInt(r.count) })),
            byMonth:    byMonth.rows.map(r   => ({ label: r.label, count: parseInt(r.count) })),
        });

    } catch (error) {
        logger.error(error, '[despatch /stats]');
        res.status(500).json({ success: false, error: 'Database error: ' + error.message });
    }
});

module.exports = router;