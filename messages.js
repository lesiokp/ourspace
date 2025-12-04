document.addEventListener('DOMContentLoaded', async () => {
    const userJson = localStorage.getItem('user');
    if (!userJson) { window.location.href = '/login.html'; return; }
    const currentUser = JSON.parse(userJson);

    // Wyświetl nazwę w navbarze
    document.getElementById('navUserName').textContent = currentUser.username;

    // Zmienne globalne
    let activeFriendId = null;
    let activeFriendAvatar = 'https://via.placeholder.com/40';
    let currentUserAvatar = 'https://via.placeholder.com/40';
    let refreshInterval = null;

    // --- 0. POBIERAMY AWATAR ---
    try {
        const res = await fetch(`/api/profile?userId=${currentUser.id}`);
        const result = await res.json();
        if (result.success && result.data.avatar_url) {
            currentUserAvatar = result.data.avatar_url;
            // Aktualizacja w prawym górnym rogu
            document.getElementById('navUserAvatar').src = currentUserAvatar;
        }
    } catch (e) { console.error("Błąd pobierania mojego awatara", e); }


    // --- 1. POBIERZ LISTĘ ZNAJOMYCH DO SIDEBARA ---
    loadChatFriends();

    async function loadChatFriends() {
        const list = document.getElementById('chatFriendsList');
        try {
            const res = await fetch(`/api/friends?userId=${currentUser.id}`);
            const result = await res.json();
            
            list.innerHTML = '';

            if (result.success) {
                const friends = result.data.filter(r => r.status === 'accepted');

                if(friends.length === 0) {
                    list.innerHTML = '<li style="padding:15px;">Brak znajomych.</li>';
                    return;
                }

                friends.forEach(f => {
                    const friendId = (f.user_id === currentUser.id) ? f.friend_id : f.user_id;
                    const avatar = f.avatar_url || 'https://via.placeholder.com/40';
                    
                    const li = document.createElement('li');
                    li.className = 'friend-chat-item';
                    li.innerHTML = `
                        <img src="${avatar}">
                        <span>${f.username}</span>
                    `;
                    
                    // Przekazujemy avatar znajomego do funkcji openChat
                    li.onclick = () => openChat(f.other_user_id, f.username, avatar, li);
                    
                    list.appendChild(li);
                });
            }
        } catch (e) { console.error(e); }
    }

    // --- 2. OTWIERANIE CZATU ---
    function openChat(friendId, friendName, friendAvatarUrl, liElement) {
        activeFriendId = friendId;
        activeFriendAvatar = friendAvatarUrl || 'https://via.placeholder.com/40'; // Zapisujemy awatar kolegi

        // Aktualizacja UI (zaznaczenie aktywnego)
        document.querySelectorAll('.friend-chat-item').forEach(el => el.classList.remove('active'));
        liElement.classList.add('active');

        // Nagłówek czatu
        document.getElementById('chatHeader').style.display = 'flex';
        document.getElementById('chatHeaderName').textContent = friendName;
        document.getElementById('chatHeaderAvatar').src = activeFriendAvatar;
        
        // Pokaż formularz
        document.getElementById('messageForm').style.display = 'flex';

        loadMessages();

        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(loadMessages, 3000);
    }

    // --- 3. POBIERANIE WIADOMOŚCI (Z AWATARAMI) ---
    async function loadMessages() {
        if (!activeFriendId) return;

        try {
            const res = await fetch(`/api/messages/${activeFriendId}?userId=${currentUser.id}`);
            const result = await res.json();
            const area = document.getElementById('messagesArea');

            if (result.success) {
                area.innerHTML = ''; 

                if (result.messages.length === 0) {
                    area.innerHTML = '<p style="text-align:center;color:#ccc;margin-top:20px;">Tu zaczyna się historia waszej rozmowy.</p>';
                }

                result.messages.forEach(msg => {
                    const isMine = (msg.sender_id === currentUser.id);
                    
                    // Wybór odpowiedniego awatara dla tej wiadomości
                    const msgAvatarSrc = isMine ? currentUserAvatar : activeFriendAvatar;

                    // Główny kontener wiersza
                    const rowDiv = document.createElement('div');
                    rowDiv.className = `msg-row ${isMine ? 'row-sent' : 'row-received'}`;

                    // HTML Awatara
                    const avatarHtml = `<img src="${msgAvatarSrc}" class="msg-avatar-small" alt="Avatar">`;

                    // HTML Bąbelka
                    let contentHtml = `<div>${msg.message}</div>`;
                    if (msg.file_url) {
                        contentHtml += `<a href="${msg.file_url}" target="_blank"><img src="${msg.file_url}" class="msg-img"></a>`;
                    }
                    
                    const bubbleDiv = document.createElement('div');
                    bubbleDiv.className = `msg-bubble`;
                    bubbleDiv.innerHTML = contentHtml;

                    // Składanie całości: Row -> Avatar + Bubble
                    rowDiv.innerHTML = avatarHtml; 
                    rowDiv.appendChild(bubbleDiv);

                    area.appendChild(rowDiv);
                });

                // Auto-scroll (jeśli jesteśmy blisko dołu lub ładowanie początkowe)
                area.scrollTop = area.scrollHeight;
            }
        } catch (e) { console.error(e); }
    }

    // --- 4. WYSYŁANIE WIADOMOŚCI ---
    document.getElementById('messageForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('msgInput');
        const fileInput = document.getElementById('msgFile');
        
        const messageText = input.value.trim();
        const file = fileInput.files[0];

        if (!messageText && !file) return;

        const formData = new FormData();
        formData.append('senderId', currentUser.id);
        formData.append('receiverId', activeFriendId);
        formData.append('message', messageText);
        if (file) formData.append('image', file);

        try {
            const res = await fetch('/api/messages', {
                method: 'POST',
                body: formData
            });
            const result = await res.json();

            if (result.success) {
                input.value = '';
                fileInput.value = '';
                loadMessages();
            }
        } catch (e) { console.error(e); }
    });
});