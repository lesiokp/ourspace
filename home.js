document.addEventListener('DOMContentLoaded', async () => {
    // 1. Sprawdzenie sesji
    const userJson = localStorage.getItem('user');
    if (!userJson) {
        window.location.href = '/login.html';
        return;
    }
    const user = JSON.parse(userJson);

    // 2. Wstawienie nazwy użytkownika
    const userNameElement = document.getElementById('userName');
    if (userNameElement) userNameElement.textContent = user.username;

    // --- NOWE: POBIERANIE AWATARA Z BAZY DLA STRONY GŁÓWNEJ ---
    try {
        const res = await fetch(`/api/profile?userId=${user.id}`);
        const result = await res.json();
        
        if (result.success && result.data.avatar_url) {
            // Podmieniamy awatar w pasku nawigacji
            const avatarImg = document.getElementById('avatarImg');
            if (avatarImg) {
                avatarImg.src = result.data.avatar_url;
            }
        }
    } catch (error) {
        console.error("Nie udało się pobrać awatara:", error);
    }

    // 3. Obsługa Modala (Okienka dodawania posta)
    const modal = document.getElementById('addPostModal');
    const btn = document.getElementById('addPostBtn');
    const span = document.getElementById('closeModalBtn');

    // Otwieranie modala po kliknięciu "Dodaj post"
    btn.onclick = function() {
        modal.style.display = "block";
    }

    // Zamykanie modala po kliknięciu "X"
    span.onclick = function() {
        modal.style.display = "none";
    }

    // Zamykanie modala po kliknięciu w tło
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    // 4. Obsługa przejścia do profilu
    window.goToProfile = function() {
        window.location.href = 'profile.html';
    }

    // 5. (Opcjonalnie) Obsługa wylogowania - możesz dodać przycisk wylogowania w HTML
    // Aby wylogować: localStorage.removeItem('user'); window.location.href = 'login.html';
});

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. SPRAWDZANIE SESJI (To co już miałeś) ---
    const userJson = localStorage.getItem('user');
    if (!userJson) {
        window.location.href = '/login.html';
        return;
    }
    const user = JSON.parse(userJson);

    // Wyświetlanie nazwy usera w nawigacji
    const userNameElement = document.getElementById('userName');
    if (userNameElement) userNameElement.textContent = user.username;

    // Pobieranie awatara do nawigacji
    try {
        const res = await fetch(`/api/profile?userId=${user.id}`);
        const result = await res.json();
        if (result.success && result.data.avatar_url) {
            const avatarImg = document.getElementById('avatarImg');
            if (avatarImg) avatarImg.src = result.data.avatar_url;
        }
    } catch (e) { console.error(e); }


    // --- 2. OBSŁUGA POSTÓW ---

    // A. Funkcja pobierająca i wyświetlająca posty
// --- FUNKCJA ŁADOWANIA POSTÓW ---
    async function loadPosts() {
        const postsList = document.getElementById('postsList');
        postsList.innerHTML = '<p style="text-align:center;">Ładowanie postów...</p>';

        try {
            const res = await fetch(`/api/posts?currentUserId=${user.id}`);
            const result = await res.json();

            postsList.innerHTML = '';

            if (result.success && result.posts.length > 0) {
                result.posts.forEach(post => {
                    const postDiv = document.createElement('div');
                    postDiv.className = 'post-card';
                    
                    // Awatar autora posta
                    const authorAvatar = post.avatar_url ? post.avatar_url : 'https://via.placeholder.com/40';
                    const date = new Date(post.created_at).toLocaleString('pl-PL');
                    
                    // Przycisk USUWANIA (tylko jeśli user.id == post.user_id)
                    let deleteBtnHtml = '';
                    if (post.user_id === user.id) {
                        deleteBtnHtml = `<button class="delete-post-btn" onclick="deletePost(${post.id})" title="Usuń post">🗑️</button>`;
                    }

                    // Logika tytułu/treści
                    let postContentHtml = '';
                    if (post.content.startsWith('**')) {
                        const parts = post.content.split('\n');
                        const rawTitle = parts[0].replace(/\*\*/g, '');
                        const rawBody = parts.slice(1).join('<br>');
                        postContentHtml = `<div class="post-title">${rawTitle}</div><div class="post-body">${rawBody}</div>`;
                    } else {
                        postContentHtml = `<div class="post-body">${post.content}</div>`;
                    }

                    const imageHtml = post.image_url ? `<img src="${post.image_url}" class="post-image">` : '';
                    const isLiked = post.user_liked > 0 ? 'liked' : '';

                    postDiv.innerHTML = `
                        <div class="post-header">
                            <img src="${authorAvatar}" class="post-avatar">
                            <div class="post-info">
                                <h4>${post.username}</h4>
                                <p class="post-date">${date}</p>
                            </div>
                            ${deleteBtnHtml}
                        </div>
                        
                        <div class="post-content-wrapper">
                            ${postContentHtml}
                        </div>
                        ${imageHtml}
                        
                        <div class="post-actions">
                            <div style="display:flex; align-items:center;">
                                <button class="like-btn ${isLiked}" onclick="toggleLike(${post.id})">
                                    &#10084; 
                                </button>
                                <span class="like-count-span" onclick="showLikes(${post.id})">
                                    ${post.like_count}
                                </span>
                                
                                <button class="comment-trigger-btn" onclick="toggleComments(${post.id})">
                                    Komentarze (${post.comment_count})
                                </button>
                            </div>
                        </div>

                        <div id="comments-section-${post.id}" class="comments-section">
                            <div id="comments-list-${post.id}" class="comments-list">
                                <p style="font-size:12px;color:#888;">Ładowanie...</p>
                            </div>
                            <form class="add-comment-form" onsubmit="submitComment(event, ${post.id})">
                                <input type="text" id="comment-input-${post.id}" placeholder="Napisz komentarz..." required autocomplete="off">
                                <button type="submit" class="btn-comment-submit">Wyślij</button>
                            </form>
                        </div>
                    `;
                    postsList.appendChild(postDiv);
                });
            } else {
                postsList.innerHTML = '<p style="text-align:center;">Brak postów.</p>';
            }
        } catch (error) { console.error(error); }
    }

    // --- NOWE FUNKCJE OBSŁUGI ---

    // 1. Usuwanie posta
    window.deletePost = async (postId) => {
        if(!confirm("Czy na pewno chcesz usunąć ten post?")) return;

        try {
            const res = await fetch(`/api/posts/${postId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
            });
            const result = await res.json();
            if(result.success) {
                loadPosts(); // Odśwież listę
            } else {
                alert("Błąd: " + result.message);
            }
        } catch(e) { console.error(e); }
    };

    // 2. Otwieranie/Zamykanie sekcji komentarzy
    window.toggleComments = async (postId) => {
        const section = document.getElementById(`comments-section-${postId}`);
        
        if (section.style.display === 'block') {
            section.style.display = 'none'; // Zamknij
        } else {
            section.style.display = 'block'; // Otwórz
            loadComments(postId); // Pobierz komentarze z bazy
        }
    };

    // 3. Pobieranie komentarzy
async function loadComments(postId) {
        const listDiv = document.getElementById(`comments-list-${postId}`);
        try {
            const res = await fetch(`/api/comments/${postId}`);
            const result = await res.json();

            listDiv.innerHTML = '';
            
            if (result.success && result.comments.length > 0) {
                result.comments.forEach(c => {
                    const avatar = c.avatar_url || 'https://via.placeholder.com/25';
                    
                    // Formatowanie daty (np. 12.05.2023, 14:30)
                    const dateObj = new Date(c.created_at);
                    const dateStr = dateObj.toLocaleDateString('pl-PL') + ', ' + dateObj.toLocaleTimeString('pl-PL', {hour: '2-digit', minute:'2-digit', second:'2-digit'});

                    // Przycisk usuwania (tylko dla autora komentarza)
                    let deleteBtn = '';
                    // Uwaga: user.id to string lub liczba, dla pewności porównujemy luźno (==) lub parsujemy
                    if (c.user_id == user.id) {
                        deleteBtn = `<span class="delete-comment-x" onclick="deleteComment(${c.id}, ${postId})" title="Usuń komentarz">&times;</span>`;
                    }

                    const div = document.createElement('div');
                    div.className = 'comment-item';
                    div.innerHTML = `
                        <img src="${avatar}" class="comment-avatar">
                        <div class="comment-content-block">
                            <div class="comment-bubble">
                                <span class="comment-author">${c.username}</span>
                                <span class="comment-text">${c.content}</span>
                            </div>
                            <div class="comment-meta">
                                <span>${dateStr}</span>
                                ${deleteBtn}
                            </div>
                        </div>
                    `;
                    listDiv.appendChild(div);
                });
            } else {
                listDiv.innerHTML = '<p style="font-size:12px;color:#aaa;">Brak komentarzy. Bądź pierwszy!</p>';
            }
        } catch(e) { console.error(e); }
    }

    // 5. Usuwanie komentarza (NOWE)
    window.deleteComment = async (commentId, postId) => {
        if(!confirm("Usunąć ten komentarz?")) return;

        try {
            const res = await fetch(`/api/comments/${commentId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
            });
            const result = await res.json();
            
            if(result.success) {
                loadComments(postId); // Odśwież tylko listę komentarzy w tym poście
                // Opcjonalnie: loadPosts() aby zaktualizować licznik, ale to zwinie sekcję
            } else {
                alert("Błąd: " + result.message);
            }
        } catch(e) { console.error(e); }
    };

    // 4. Wysyłanie komentarza
    window.submitComment = async (event, postId) => {
        event.preventDefault(); // Nie przeładowuj strony
        const input = document.getElementById(`comment-input-${postId}`);
        const content = input.value.trim();

        if(!content) return;

        try {
            const res = await fetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, postId: postId, content: content })
            });
            const result = await res.json();
            
            if(result.success) {
                input.value = ''; // Wyczyść pole
                loadComments(postId); // Odśwież listę komentarzy
                // Opcjonalnie: odśwież posty żeby zaktualizować licznik (loadPosts), 
                // ale żeby nie zamykać okienka, lepiej zostawić jak jest.
            }
        } catch(e) { console.error(e); }
    };

    // NOWA funkcja globalna do lajkowania
    window.toggleLike = async function(postId) {
        try {
            const res = await fetch('/api/posts/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, postId: postId })
            });
            const result = await res.json();

            if (result.success) {
                // Odświeżamy listę postów, aby zaktualizować licznik i kolor
                // Można to zrobić "inteligentniej" zmieniając tylko DOM, 
                // ale ponowne załadowanie jest pewniejsze na początek.
                loadPosts(); 
            }
        } catch (error) {
            console.error(error);
        }
    }

    // Załaduj posty na start
    loadPosts();


    // B. Obsługa Formularza "Dodaj Post"
    const modal = document.getElementById('addPostModal');
    const postForm = document.getElementById('postForm');

    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('userId', user.id);
        formData.append('title', document.getElementById('postTitle').value);
        formData.append('content', document.getElementById('postDescription').value);
        
        const fileInput = document.getElementById('postImage');
        if (fileInput.files[0]) {
            formData.append('image', fileInput.files[0]);
        }

        try {
            const res = await fetch('/api/posts', {
                method: 'POST',
                body: formData
            });
            const result = await res.json();

            if (result.success) {
                // Sukces!
                alert('Post opublikowany!');
                modal.style.display = "none"; // Zamknij okno
                postForm.reset(); // Wyczyść formularz
                loadPosts(); // Odśwież listę postów, żeby zobaczyć nowy
            } else {
                alert('Błąd: ' + result.message);
            }
        } catch (error) {
            console.error(error);
            alert('Błąd połączenia.');
        }
    });

    // --- 3. OBSŁUGA MODALA (Otwieranie/Zamykanie) ---
    // (To już miałeś, ale upewniamy się, że jest)
    const btn = document.getElementById('addPostBtn');
    const span = document.getElementById('closeModalBtn');

    btn.onclick = () => modal.style.display = "block";
    span.onclick = () => modal.style.display = "none";
    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = "none";
    }
    
    // Globalna funkcja do profilu
    window.goToProfile = function() {
        window.location.href = 'profile.html';
    }

    // --- OBSŁUGA LISTY LAJKUJĄCYCH ---
    
    const likesModal = document.getElementById('likesModal');
    const closeLikesModal = document.getElementById('closeLikesModal');
    const likesContainer = document.getElementById('likesListContainer');

    // Zamykanie modala lajków
    if(closeLikesModal) {
        closeLikesModal.onclick = () => likesModal.style.display = "none";
    }

    // Funkcja globalna do wyświetlania listy
    window.showLikes = async function(postId) {
        // Otwórz modal
        likesModal.style.display = "block";
        likesContainer.innerHTML = '<p>Ładowanie...</p>';

        try {
            const res = await fetch(`/api/posts/${postId}/likes`);
            const result = await res.json();

            likesContainer.innerHTML = ''; // Wyczyść

            if (result.success && result.likers.length > 0) {
                result.likers.forEach(user => {
                    const avatar = user.avatar_url ? user.avatar_url : 'https://via.placeholder.com/35';
                    
                    const div = document.createElement('div');
                    div.className = 'liker-item';
                    div.innerHTML = `
                        <img src="${avatar}" class="liker-avatar">
                        <span class="liker-name">${user.username}</span>
                    `;
                    likesContainer.appendChild(div);
                });
            } else {
                likesContainer.innerHTML = '<p>Jeszcze nikt nie polubił tego posta.</p>';
            }
        } catch (error) {
            console.error(error);
            likesContainer.innerHTML = '<p>Błąd pobierania danych.</p>';
        }
    }
    
    // Zamykanie modala przy kliknięciu w tło (obsługuje oba modale)
    window.onclick = (event) => {
        if (event.target == document.getElementById('addPostModal')) {
            document.getElementById('addPostModal').style.display = "none";
        }
        if (event.target == likesModal) {
            likesModal.style.display = "none";
        }
    }
});