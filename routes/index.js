const express = require("express");
const wrap = require("express-async-error-wrapper");
const axios = require("axios");
const sql = require("../data/sql");

const router = express.Router();

const url_api = process.env.url_api;

async function atualizarDados() {
	await sql.connect(async sql => {
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

router.get("/", wrap(async (req, res) => {
	let nomeDoUsuarioQueVeioDoBanco = "Rafael";

	let opcoes = {
		usuario: nomeDoUsuarioQueVeioDoBanco,
		quantidadeDeRepeticoes: 5
	};

	res.render("index/index", opcoes);
}));

router.get("/monitoramentoTempoReal", wrap(async (req, res) => {
	await atualizarDados();

	let dados;

	await sql.connect(async sql => {

		dados = await sql.query(`
			(select id_sensor, ocupado, time_to_sec(timediff(now(), data)) delta_agora from presenca where id_sensor = 1 order by id desc limit 1)
			union all
			(select id_sensor, ocupado, time_to_sec(timediff(now(), data)) delta_agora from presenca where id_sensor = 2 order by id desc limit 1)
			union all
			(select id_sensor, ocupado, time_to_sec(timediff(now(), data)) delta_agora from presenca where id_sensor = 3 order by id desc limit 1)
			union all
			(select id_sensor, ocupado, time_to_sec(timediff(now(), data)) delta_agora from presenca where id_sensor = 4 order by id desc limit 1)
			union all
			(select id_sensor, ocupado, time_to_sec(timediff(now(), data)) delta_agora from presenca where id_sensor = 5 order by id desc limit 1)
			union all
			(select id_sensor, ocupado, time_to_sec(timediff(now(), data)) delta_agora from presenca where id_sensor = 6 order by id desc limit 1)
			union all
			(select id_sensor, ocupado, time_to_sec(timediff(now(), data)) delta_agora from presenca where id_sensor = 7 order by id desc limit 1)
			union all
			(select id_sensor, ocupado, time_to_sec(timediff(now(), data)) delta_agora from presenca where id_sensor = 8 order by id desc limit 1)
		`);

	});

	res.json(dados);
}));

router.get("/presencaTotalPorDia", wrap(async (req, res) => {
	await atualizarDados();

	const data_inicial = req.query["data_inicial"];
	const data_final = req.query["data_final"];

	let dados;

	await sql.connect(async sql => {

		dados = await sql.query(`
			select id_sensor, date_format(date(data), '%d/%m/%Y') dia, cast(sum(delta) as signed) presenca_total from presenca
			where data between ? and ? and ocupado = 0
			group by id_sensor, dia
			order by id_sensor, dia
		`, [data_inicial, data_final]);

	});

	res.json(dados);
}));

router.get("/presencaMediaPorDia", wrap(async (req, res) => {
	await atualizarDados();

	const data_inicial = req.query["data_inicial"];
	const data_final = req.query["data_final"];

	let dados;

	await sql.connect(async sql => {

		dados = await sql.query(`
			select id_sensor, date_format(date(data), '%d/%m/%Y') dia, cast(avg(delta) as float) presenca_media from presenca
			where data between ? and ? and ocupado = 0
			group by id_sensor, dia
			order by id_sensor, dia
		`, [data_inicial, data_final]);

	});

	res.json(dados);
}));

router.get("/teste", wrap(async (req, res) => {
	let opcoes = {
		layout: "casca-teste"
	};

	res.render("index/teste", opcoes);
}));

router.get("/teste2", wrap(async (req, res) => {
	let opcoes = {
		layout: "casca-teste"
	};

	res.render("index/teste2", opcoes);
}));

router.get("/teste3", wrap(async (req, res) => {
	let opcoes = {
		layout: "casca-teste"
	};

	res.render("index/teste3", opcoes);
}));

router.get("/produtos", wrap(async (req, res) => {
	let produtoA = {
		id: 1,
		nome: "Produto A",
		valor: 25
	};

	let produtoB = {
		id: 2,
		nome: "Produto B",
		valor: 15
	};

	let produtoC = {
		id: 3,
		nome: "Produto C",
		valor: 100
	};

	let produtosVindosDoBanco = [ produtoA, produtoB, produtoC ];

	let opcoes = {
		titulo: "Listagem de Produtos",
		produtos: produtosVindosDoBanco
	};

	res.render("index/produtos", opcoes);
}));

module.exports = router;
