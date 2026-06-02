const express = require('express');
const path = require('path');
const Sql = require('./data/sql'); // Importa a classe SQL que você tem
require('dotenv').config(); // Carrega variáveis de ambiente

const app = express();

// 1. Inicialização do Banco de Dados
// Se você não usa .env, substitua process.env.DB_HOST pelos valores reais
Sql.init({
    host: process.env.sql_host ,
    user: process.env.sql_user,
    password: process.env.sql_password,
    database: process.env.sql_database,
    connectionLimit: process.env.sql_connectionLimit
});

// 2. Configurações do Express
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware para servir arquivos estáticos (CSS, JS, Imagens)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Rotas
const indexRoutes = require('./routes/index');
app.use('/', indexRoutes);

// 4. Iniciar Servidor
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});