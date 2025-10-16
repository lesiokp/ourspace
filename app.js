require('dotenv').config();
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');

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

// REJESTRACJA (POST /api/register)
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Wszystkie pola są wymagane.' });
    }

    try {
        // sprawdzenie, czy taki użytkownik już istnieje
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Użytkownik o podanym adresie lub nazwie już istnieje.' });
        }

        // hashowanie hasła
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // zapis użytkownika w bazie
        await pool.query(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword]
        );

        res.status(201).json({ message: 'Rejestracja zakończona sukcesem!' });
    } catch (error) {
        res.status(500).json({ error: 'Błąd serwera: ' + error.message });
    }
});

// LOGOWANIE (POST /api/login)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Wszystkie pola są wymagane.' });
    }

    try {
        // pobranie użytkownika z bazy
        const [rows] = await pool.query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );
        if (rows.length === 0) {
            return res.status(400).json({ error: 'Nieprawidłowe dane logowania.' });
        }

        const user = rows[0];

        // porównanie hasła
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(400).json({ error: 'Nieprawidłowe dane logowania.' });
        }

        // logowanie udane
        res.json({ message: 'Zalogowano pomyślnie!', userId: user.id, username: user.username });
    } catch (error) {
        res.status(500).json({ error: 'Błąd serwera: ' + error.message });
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