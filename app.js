require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors()); // pozwala frontendowi na komunikację

// Konfiguracja połączenia z MySQL z .env
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT,
});

// Przykładowy endpoint sprawdzający połączenie
app.get('/api/status', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT NOW() AS currentTime');
        res.json({ status: 'OK', currentTime: rows[0].currentTime });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

// Start serwera
const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Server działa na porcie ${port}`);
});

const path = require('path');

// Dodaj obsługę plików statycznych
app.use(express.static(path.join(__dirname, 'public')));

// Jeśli adres nie jest endpointem API, wyślij index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});