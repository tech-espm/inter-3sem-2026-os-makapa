const express = require('express');
const wrap = require("express-async-error-wrapper");
const axios = require("axios");
const router = express.Router();
const Sql = require('../data/sql');

const url_api = process.env.url_api;

router.get('/', wrap(async (req, res) => {
    res.render('index/index', { layout: false });
}));

async function atualizarDados() {
	await Sql.connect(async sql => {
		let lista = await sql.query("select max(id) id from presenca");

		let id_inferior = 82595;
		if (lista[0].id) {
			id_inferior = lista[0].id;
		}

		const response = await axios.get(url_api + "?sensor=presence&id_inferior=" + id_inferior);
		const dadosNovos = response.data;

		for (let i = 0; i < dadosNovos.length; i++) {
			const dadoNovo = dadosNovos[i];

			await sql.query("insert into presenca (id, data, id_sensor, delta, bateria, ocupado) values (?, ?, ?, ?, ?, ?)", [dadoNovo.id, dadoNovo.data, dadoNovo.id_sensor, dadoNovo.delta, dadoNovo.bateria, dadoNovo.ocupado]);
		}
	});
}

router.get('/monitoramentoTempoReal', wrap(async (req, res) => {
    try {
		await atualizarDados();

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
}));

router.get('/historico', wrap(async (req, res) => {
    try {
        const dias = parseInt(req.query.dias) || 30;
        const dados = await Sql.connect(async (sql) => {
            return await sql.query(`
                SELECT id_sensor, date_format(data, '%Y-%m-%d') AS dia,
                       SUM(delta) AS presenca_total,
                       AVG(delta) AS presenca_media
                FROM presenca
                WHERE data >= DATE_SUB(NOW(), INTERVAL ? DAY) AND ocupado = 1
                GROUP BY id_sensor, dia
                ORDER BY id_sensor, dia
            `, [dias]);
        });
		for (let i = 0; i < dados.length; i++) {
			dados[i].presenca_total = parseFloat(dados[i].presenca_total);
			dados[i].presenca_media = parseFloat(dados[i].presenca_media);
		}
        res.json({ historico: dados });
    } catch (err) {
        console.error("Erro no histórico:", err);
        res.status(500).json({ historico: [] });
    }
}));

module.exports = router;