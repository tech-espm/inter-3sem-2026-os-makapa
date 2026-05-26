const express = require('express');
const router = express.Router();
const Sql = require('../data/sql');

router.get('/', (req, res) => {
    res.render('index/index', { layout: false });
});

router.get('/monitoramentoTempoReal', async (req, res) => {
    try {
        const dados = await Sql.connect(async (sql) => {
            return await sql.query(`
                (SELECT id_sensor, ocupado, time_to_sec(timediff(now(), data)) delta_agora FROM presenca WHERE id_sensor = 1 ORDER BY id DESC LIMIT 1)
                UNION ALL
                (SELECT id_sensor, ocupado, time_to_sec(timediff(now(), data)) delta_agora FROM presenca WHERE id_sensor = 2 ORDER BY id DESC LIMIT 1)
                UNION ALL
                (SELECT id_sensor, ocupado, time_to_sec(timediff(now(), data)) delta_agora FROM presenca WHERE id_sensor = 3 ORDER BY id DESC LIMIT 1)
                UNION ALL
                (SELECT id_sensor, ocupado, time_to_sec(timediff(now(), data)) delta_agora FROM presenca WHERE id_sensor = 4 ORDER BY id DESC LIMIT 1)
                UNION ALL
                (SELECT id_sensor, ocupado, time_to_sec(timediff(now(), data)) delta_agora FROM presenca WHERE id_sensor = 5 ORDER BY id DESC LIMIT 1)
                UNION ALL
                (SELECT id_sensor, ocupado, time_to_sec(timediff(now(), data)) delta_agora FROM presenca WHERE id_sensor = 6 ORDER BY id DESC LIMIT 1)
                UNION ALL
                (SELECT id_sensor, ocupado, time_to_sec(timediff(now(), data)) delta_agora FROM presenca WHERE id_sensor = 7 ORDER BY id DESC LIMIT 1)
                UNION ALL
                (SELECT id_sensor, ocupado, time_to_sec(timediff(now(), data)) delta_agora FROM presenca WHERE id_sensor = 8 ORDER BY id DESC LIMIT 1)
            `);
        });
        res.json({ sensorState: dados });
    } catch (err) {
        console.error("Erro na API:", err);
        res.status(500).json({ error: "Erro ao buscar sensores" });
    }
});

router.get('/historico', async (req, res) => {
    try {
        const dias = parseInt(req.query.dias) || 30;
        const dados = await Sql.connect(async (sql) => {
            return await sql.query(`
                SELECT id_sensor, DATE(data) AS dia,
                       SUM(delta) AS presenca_total,
                       AVG(delta) AS presenca_media
                FROM presenca
                WHERE data >= DATE_SUB(NOW(), INTERVAL ? DAY) AND ocupado = 1
                GROUP BY id_sensor, dia
                ORDER BY id_sensor, dia
            `, [dias]);
        });
        res.json({ historico: dados });
    } catch (err) {
        console.error("Erro no histórico:", err);
        res.status(500).json({ historico: [] });
    }
});

module.exports = router;