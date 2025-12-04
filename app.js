const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const db = require('./db'); // Połączenie z bazą z pliku db.js
require('dotenv').config();

const app = express();

// --- KONFIGURACJA SERWERA ---

// 1. Tworzenie folderu na zdjęcia, jeśli nie istnieje
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// 2. Konfiguracja Multer (przesyłanie plików)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        // Unikalna nazwa pliku: timestamp + oryginalna nazwa
        cb(null, Date.now() + '-' + file.originalname)
    }
});
const upload = multer({ storage: storage });

// 3. Middleware
app.use(express.static(path.join(__dirname))); // Serwowanie plików statycznych (HTML, CSS, JS)
app.use('/uploads', express.static('uploads')); // Udostępnienie folderu ze zdjęciami
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// ==========================================
//                 TRASY (ROUTES)
// ==========================================

// --- AUTORYZACJA (Auth) ---

// Rejestracja
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Sprawdzenie duplikatów
        const checkQuery = 'SELECT * FROM users WHERE email = ? OR username = ?';
        db.query(checkQuery, [email, username], (err, results) => {
            if (err) return res.json({ success: false, message: 'Błąd bazy danych.' });
            if (results.length > 0) {
                return res.json({ success: false, message: 'Taki email lub nazwa użytkownika są już zajęte.' });
            }

            // Dodanie usera
            const insertUserQuery = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
            db.query(insertUserQuery, [username, email, hashedPassword], (err, result) => {
                if (err) return res.json({ success: false, message: 'Błąd rejestracji.' });

                const newUserId = result.insertId;
                // Automatyczne utworzenie profilu
                const insertProfileQuery = 'INSERT INTO profile (user_id) VALUES (?)';
                db.query(insertProfileQuery, [newUserId], () => {
                    res.json({ success: true, message: 'Konto utworzone pomyślnie!' });
                });
            });
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Błąd serwera');
    }
});

// Logowanie
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], (err, results) => {
        if (err) return res.json({ success: false, message: 'Błąd bazy danych' });

        if (results.length > 0) {
            const user = results[0];
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (isMatch) {
                    res.json({ success: true, message: 'Zalogowano!', userId: user.id, username: user.username });
                } else {
                    res.json({ success: false, message: 'Nieprawidłowe hasło' });
                }
            });
        } else {
            res.json({ success: false, message: 'Użytkownik nie istnieje' });
        }
    });
});


// --- PROFIL UŻYTKOWNIKA ---

// Pobieranie danych profilu
app.get('/api/profile', (req, res) => {
    const userId = req.query.userId; 
    const query = `
        SELECT u.username, u.email, p.bio, p.location, p.birthdate, p.avatar_url 
        FROM users u 
        LEFT JOIN profile p ON u.id = p.user_id 
        WHERE u.id = ?`;
    
    db.query(query, [userId], (err, results) => {
        if (err) return res.json({ success: false });
        if (results.length > 0) {
            res.json({ success: true, data: results[0] });
        } else {
            res.json({ success: false, message: "Nie znaleziono użytkownika" });
        }
    });
});

// Aktualizacja profilu (z opcjonalnym awatarem)
app.post('/api/profile/update', upload.single('avatar'), (req, res) => {
    const { userId, bio, location, birthdate } = req.body;
    let avatarUrl = null;
    
    if (req.file) {
        avatarUrl = '/uploads/' + req.file.filename;
    }

    let query = 'UPDATE profile SET bio = ?, location = ?, birthdate = ?';
    let params = [bio, location, birthdate];

    if (avatarUrl) {
        query += ', avatar_url = ?';
        params.push(avatarUrl);
    }
    
    query += ' WHERE user_id = ?';
    params.push(userId);

    db.query(query, params, (err, result) => {
        if (err) return res.json({ success: false, message: 'Błąd bazy danych' });
        res.json({ success: true, message: 'Profil zaktualizowany', newAvatar: avatarUrl });
    });
});


// --- ZNAJOMI (SPOŁECZNOŚĆ) ---

// Wyszukiwanie użytkowników
app.get('/api/users/search', (req, res) => {
    const { currentUserId, search } = req.query;
    const searchTerm = `%${search}%`;

    const query = `
        SELECT u.id, u.username, p.avatar_url 
        FROM users u 
        LEFT JOIN profile p ON u.id = p.user_id 
        WHERE u.id != ? AND u.username LIKE ? 
        LIMIT 10`;
    
    db.query(query, [currentUserId, searchTerm], (err, results) => {
        if (err) return res.json({ success: false });
        res.json({ success: true, users: results });
    });
});

// Pobieranie listy znajomych i zaproszeń
app.get('/api/friends', (req, res) => {
    const userId = req.query.userId;
    const query = `
        SELECT f.id as relation_id, f.status, f.user_id, f.friend_id,
               u.username, u.id as other_user_id, p.avatar_url
        FROM friends f
        JOIN users u ON (u.id = f.user_id OR u.id = f.friend_id)
        LEFT JOIN profile p ON u.id = p.user_id
        WHERE (f.user_id = ? OR f.friend_id = ?) AND u.id != ?
    `;
    db.query(query, [userId, userId, userId], (err, results) => {
        if (err) return res.json({ success: false });
        res.json({ success: true, data: results });
    });
});

// Wysyłanie zaproszenia
app.post('/api/friends/add', (req, res) => {
    const { userId, friendId } = req.body;
    const check = 'SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)';
    db.query(check, [userId, friendId, friendId, userId], (err, results) => {
        if (results.length > 0) return res.json({ success: false, message: 'Już wysłano zaproszenie lub jesteście znajomymi.' });

        const query = 'INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, "pending")';
        db.query(query, [userId, friendId], (err) => {
            if (err) return res.json({ success: false });
            res.json({ success: true });
        });
    });
});

// Akceptacja zaproszenia
app.post('/api/friends/accept', (req, res) => {
    const { relationId } = req.body;
    const query = 'UPDATE friends SET status = "accepted" WHERE id = ?';
    db.query(query, [relationId], (err) => {
        if (err) return res.json({ success: false });
        res.json({ success: true });
    });
});


// --- POSTY (TABLICA) ---

// Dodawanie posta
app.post('/api/posts', upload.single('image'), (req, res) => {
    const { userId, title, content } = req.body;
    let imageUrl = null;
    if (req.file) imageUrl = '/uploads/' + req.file.filename;

    // Formatowanie: Tytuł pogrubiony + treść
    const fullContent = `**${title}**\n${content}`;

    const query = 'INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)';
    db.query(query, [userId, fullContent, imageUrl], (err) => {
        if (err) return res.json({ success: false });
        res.json({ success: true, message: 'Post opublikowany!' });
    });
});

// Pobieranie postów (z lajkami)
app.get('/api/posts', (req, res) => {
    const currentUserId = req.query.currentUserId;

    const query = `
        SELECT p.id, p.user_id, p.content, p.image_url, p.created_at, 
               u.username, pr.avatar_url,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) AS user_liked,
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count
        FROM posts p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN profile pr ON u.id = pr.user_id
        WHERE 
            -- 1. Pokaż moje własne posty
            p.user_id = ? 
            OR 
            -- 2. Pokaż posty osób, które zaprosiłem i zaakceptowały (ja jestem user_id)
            p.user_id IN (SELECT friend_id FROM friends WHERE user_id = ? AND status = 'accepted')
            OR
            -- 3. Pokaż posty osób, które mnie zaprosiły i ja zaakceptowałem (ja jestem friend_id)
            p.user_id IN (SELECT user_id FROM friends WHERE friend_id = ? AND status = 'accepted')
        ORDER BY p.created_at DESC`;

    const params = [currentUserId, currentUserId, currentUserId, currentUserId];

    db.query(query, params, (err, results) => {
        if (err) {
            console.error(err);
            return res.json({ success: false });
        }
        res.json({ success: true, posts: results });
    });
});

// Lajkowanie / Odlajkowywanie
app.post('/api/posts/like', (req, res) => {
    const { userId, postId } = req.body;
    const checkQuery = 'SELECT * FROM likes WHERE user_id = ? AND post_id = ?';
    
    db.query(checkQuery, [userId, postId], (err, results) => {
        if (err) return res.json({ success: false });

        if (results.length > 0) {
            // Odlajkowanie
            db.query('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [userId, postId], () => {
                res.json({ success: true, action: 'unliked' });
            });
        } else {
            // Lajkowanie
            db.query('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [userId, postId], () => {
                res.json({ success: true, action: 'liked' });
            });
        }
    });
});

// Usuwanie posta (Tylko właściciel)
app.delete('/api/posts/:id', (req, res) => {
    const postId = req.params.id;
    const { userId } = req.body; // ID osoby, która chce usunąć

    // Najpierw sprawdzamy, czy ten post należy do tego użytkownika
    const checkQuery = 'SELECT user_id FROM posts WHERE id = ?';
    db.query(checkQuery, [postId], (err, results) => {
        if (err || results.length === 0) return res.json({ success: false, message: 'Błąd lub post nie istnieje' });
        
        if (results[0].user_id != userId) {
            return res.json({ success: false, message: 'Nie masz uprawnień do usunięcia tego posta.' });
        }

        // Jeśli się zgadza - usuwamy
        db.query('DELETE FROM posts WHERE id = ?', [postId], (err) => {
            if (err) return res.json({ success: false });
            res.json({ success: true });
        });
    });
});

// --- KOMENTARZE ---

// --- KOMENTARZE (ZAKTUALIZOWANE) ---

// 1. Pobieranie komentarzy (Teraz pobiera też user_id)
app.get('/api/comments/:postId', (req, res) => {
    const postId = req.params.postId;
    // DODANO: c.user_id do listy pobieranych pól
    const query = `
        SELECT c.id, c.user_id, c.content, c.created_at, u.username, p.avatar_url
        FROM comments c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN profile p ON u.id = p.user_id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC`;
    
    db.query(query, [postId], (err, results) => {
        if (err) return res.json({ success: false });
        res.json({ success: true, comments: results });
    });
});

// 2. Dodawanie komentarza (Bez zmian)
app.post('/api/comments', (req, res) => {
    const { userId, postId, content } = req.body;
    const query = 'INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)';
    db.query(query, [userId, postId, content], (err) => {
        if (err) return res.json({ success: false });
        res.json({ success: true });
    });
});

// 3. Usuwanie komentarza (NOWE)
app.delete('/api/comments/:commentId', (req, res) => {
    const commentId = req.params.commentId;
    const { userId } = req.body; // ID osoby usuwającej

    // Sprawdzamy, czy to właściciel komentarza
    const checkQuery = 'SELECT user_id FROM comments WHERE id = ?';
    db.query(checkQuery, [commentId], (err, results) => {
        if (err || results.length === 0) return res.json({ success: false, message: 'Błąd' });
        
        if (results[0].user_id != userId) {
            return res.json({ success: false, message: 'Brak uprawnień.' });
        }

        db.query('DELETE FROM comments WHERE id = ?', [commentId], (err) => {
            if (err) return res.json({ success: false });
            res.json({ success: true });
        });
    });
});

// Lista osób lubiących post
app.get('/api/posts/:id/likes', (req, res) => {
    const postId = req.params.id;
    const query = `
        SELECT u.username, p.avatar_url 
        FROM likes l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN profile p ON u.id = p.user_id 
        WHERE l.post_id = ?`;

    db.query(query, [postId], (err, results) => {
        if (err) return res.json({ success: false });
        res.json({ success: true, likers: results });
    });
});


// --- CZAT (WIADOMOŚCI) ---

// Pobierz historię
app.get('/api/messages/:friendId', (req, res) => {
    const { userId } = req.query;
    const { friendId } = req.params;

    const query = `
        SELECT * FROM messages 
        WHERE (sender_id = ? AND receiver_id = ?) 
           OR (sender_id = ? AND receiver_id = ?)
        ORDER BY sent_at ASC`;

    db.query(query, [userId, friendId, friendId, userId], (err, results) => {
        if (err) return res.json({ success: false });
        res.json({ success: true, messages: results });
    });
});

// Wyślij wiadomość
app.post('/api/messages', upload.single('image'), (req, res) => {
    const { senderId, receiverId, message } = req.body;
    let fileUrl = null;
    if (req.file) fileUrl = '/uploads/' + req.file.filename;

    const query = 'INSERT INTO messages (sender_id, receiver_id, message, file_url) VALUES (?, ?, ?, ?)';
    db.query(query, [senderId, receiverId, message, fileUrl], (err) => {
        if (err) return res.json({ success: false });
        res.json({ success: true });
    });
});


// --- URUCHOMIENIE SERWERA ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serwer działa na http://localhost:${PORT}`);
});