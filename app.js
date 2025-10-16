require('dotenv').config();
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Udostępniaj statyczne pliki z głównego katalogu
app.use(express.static(__dirname));

// Połączenie z MySQL
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT
});

// Endpoint testowy — czy działa połączenie z bazą danych
app.get('/api/status', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT NOW() AS currentTime');
        res.json({ status: 'OK', currentTime: rows[0].currentTime });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

// Endpoint do strony głównej – index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback — dla każdego innego nieznanego endpointu wyślij stronę główną (SPA)
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Serwer działa na porcie ${port}`);
});