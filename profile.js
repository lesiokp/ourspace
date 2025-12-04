document.addEventListener('DOMContentLoaded', () => {
    // 1. Sprawdzamy czy użytkownik jest zalogowany (JA)
    const userJson = localStorage.getItem('user');
    if (!userJson) {
        window.location.href = '/login.html';
        return;
    }
    const loggedUser = JSON.parse(userJson);
    const loggedUserId = parseInt(loggedUser.id); 

    // 2. Sprawdzamy kogo profil mamy wyświetlić
    // Czy w pasku adresu jest ?id=XY ?
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get('id');

    // Jeśli jest ID w URL, to oglądamy TEGO użytkownika. Jeśli nie, to SIEBIE.
    const viewedUserId = urlId ? parseInt(urlId) : loggedUserId;

    // Czy oglądamy własny profil?
    const isMyProfile = (viewedUserId === loggedUserId);

    // --- DOSTOSOWANIE INTERFEJSU ---
    
    // Ukryj/Pokaż przycisk edycji
    const editBtn = document.getElementById('editProfileBtn');
    if (editBtn) {
        editBtn.style.display = isMyProfile ? 'inline-block' : 'none';
    }

    // Uruchamiamy ładowanie danych dla OGLĄDANEGO użytkownika
    loadProfile(viewedUserId);
    loadFriends(viewedUserId);


    // ==========================================
    //           1. OBSŁUGA PROFILU
    // ==========================================
    async function loadProfile(userId) {
        try {
            const res = await fetch(`/api/profile?userId=${userId}`);
            const result = await res.json();

            if (result.success) {
                const data = result.data;
                
                // Karta profilu
                setText('usernameDisplay', data.username);
                setText('profileEmail', data.email);
                setText('profileBio', data.bio || 'Brak opisu.');
                setText('profileLocation', data.location || '-');
                
                let birthdateDisplay = '-';
                if (data.birthdate) birthdateDisplay = data.birthdate.split('T')[0];
                setText('profileBirthdate', birthdateDisplay);

                // Awatary
                if (data.avatar_url) {
                    setSrc('avatarLarge', data.avatar_url);
                }

                // Pasek nawigacji (Zawsze wyświetla MNIE - zalogowanego)
                setText('userName', loggedUser.username);

                // Kliknięcie w Twój awatar w rogu -> Powrót do Twojego profilu
                const myNavAvatar = document.querySelector('.navbar-right .profile-avatar');
                if (myNavAvatar) {
                myNavAvatar.onclick = () => {
                window.location.href = 'profile.html';
                    };
                }
                
                // Formularz edycji (wypełniamy tylko jeśli to mój profil)
                if (isMyProfile) {
                    setValue('editBio', data.bio);
                    setValue('editLocation', data.location);
                    setValue('editBirthdate', birthdateDisplay !== '-' ? birthdateDisplay : '');
                }
            }
        } catch (e) { console.error("Błąd ładowania profilu:", e); }
    }

    // ==========================================
    //           2. EDYCJA (Tylko własny)
    // ==========================================
    // (Kod obsługi modala edycji działa tylko, jeśli przycisk jest widoczny)
    const modal = document.getElementById('editModal');
    if(document.getElementById('editProfileBtn')) {
        document.getElementById('editProfileBtn').onclick = () => modal.style.display = "block";
    }
    if(document.getElementById('closeEditModal')) {
        document.getElementById('closeEditModal').onclick = () => modal.style.display = "none";
    }

    document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!isMyProfile) return; // Zabezpieczenie

        const formData = new FormData();
        formData.append('userId', loggedUserId);
        formData.append('bio', document.getElementById('editBio').value);
        formData.append('location', document.getElementById('editLocation').value);
        formData.append('birthdate', document.getElementById('editBirthdate').value);
        
        const fileInput = document.getElementById('editAvatar');
        if (fileInput.files[0]) {
            formData.append('avatar', fileInput.files[0]);
        }

        const res = await fetch('/api/profile/update', { method: 'POST', body: formData });
        const result = await res.json();
        
        if (result.success) {
            alert('Profil zaktualizowany!');
            modal.style.display = "none";
            loadProfile(loggedUserId); 
        } else {
            alert('Błąd: ' + result.message);
        }
    });

    // ==========================================
    //           3. LISTA ZNAJOMYCH
    // ==========================================
    async function loadFriends(userId) {
        const res = await fetch(`/api/friends?userId=${userId}`);
        const result = await res.json();

        const invitesList = document.getElementById('friendRequestsList');
        const friendsList = document.getElementById('friendsList');
        const invitesSection = document.getElementById('invitesSection');
        
        invitesList.innerHTML = '';
        friendsList.innerHTML = '';

        if (result.success) {
            let pendingCount = 0;

            result.data.forEach(relation => {
                const li = document.createElement('li');
                const avatar = relation.avatar_url || 'https://via.placeholder.com/30';
                
                // Ustalenie ID przyjaciela (tego drugiego w relacji)
                // Jeśli relacja to JA(5)-ON(8), to przyjacielem jest 8.
                // Jeśli relacja to ON(8)-JA(5), to przyjacielem jest 8.
                // Musimy uważać, bo 'userId' w argumencie funkcji to profil na który patrzymy
                const friendPersonId = (relation.user_id == userId) ? relation.friend_id : relation.user_id;

                // --- 1. ZAPROSZENIA (Widoczne tylko na MOIM profilu) ---
                if (isMyProfile && relation.status === 'pending' && relation.friend_id == loggedUserId) {
                    pendingCount++;
                    li.innerHTML = `
                        <div style="display:flex; align-items:center; gap:10px;">
                             <img src="${avatar}" style="width:30px;height:30px;border-radius:50%; object-fit:cover;">
                             <span class="clickable-name" onclick="window.location.href='profile.html?id=${friendPersonId}'">${relation.username}</span>
                        </div>
                        <button class="btn-small btn-accept" onclick="acceptRequest(${relation.relation_id})">Akceptuj</button>
                    `;
                    invitesList.appendChild(li);
                } 
                // --- 2. ZNAJOMI (Widoczni u każdego) ---
                else if (relation.status === 'accepted') {
                    li.innerHTML = `
                        <div style="display:flex; align-items:center; gap:10px;">
                             <img src="${avatar}" style="width:30px;height:30px;border-radius:50%; object-fit:cover;">
                             <span class="clickable-name" onclick="window.location.href='profile.html?id=${friendPersonId}'">${relation.username}</span>
                        </div>
                        <button class="btn-small" style="background:#ddd; cursor:default;">Znajomy</button>
                    `;
                    friendsList.appendChild(li);
                }
            });

            if (invitesSection) {
                // Zaproszenia pokazujemy tylko właścicielowi profilu
                invitesSection.style.display = (isMyProfile && pendingCount > 0) ? 'block' : 'none';
            }
        }
    }

    // ==========================================
    //           4. WYSZUKIWARKA
    // ==========================================
    // Wyszukiwanie działa zawsze "ode mnie" (loggedUserId)
    document.getElementById('searchBtn').addEventListener('click', async () => {
        const query = document.getElementById('userSearchInput').value.trim();
        const list = document.getElementById('searchResultsList');
        list.innerHTML = '';

        if (query.length === 0) { alert("Wpisz kogo szukasz."); return; }

        const res = await fetch(`/api/users/search?currentUserId=${loggedUserId}&search=${query}`);
        const result = await res.json();

        if (result.success && result.users.length > 0) {
            result.users.forEach(u => {
                const li = document.createElement('li');
                const avatar = u.avatar_url || 'https://via.placeholder.com/40';
                li.innerHTML = `
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${avatar}" class="search-avatar">
                        <span class="clickable-name" onclick="window.location.href='profile.html?id=${u.id}'">${u.username}</span>
                    </div>
                    <button class="btn-small btn-add" onclick="sendRequest(${u.id})">Dodaj</button>
                `;
                list.appendChild(li);
            });
        } else {
            list.innerHTML = '<li style="padding:10px;color:#888">Nikogo nie znaleziono.</li>';
        }
    });

    // ==========================================
    //      FUNKCJE GLOBALNE
    // ==========================================
    
    window.sendRequest = async (friendId) => {
        const res = await fetch('/api/friends/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: loggedUserId, friendId: friendId })
        });
        const result = await res.json();
        if (result.success) {
            alert('Zaproszenie wysłane!');
            // Odśwież listę, ale pamiętaj o kontekście (czyj profil oglądasz)
            loadFriends(viewedUserId);
        } else {
            alert(result.message);
        }
    };

    window.acceptRequest = async (relationId) => {
        if(!confirm("Na pewno chcesz zaakceptować to zaproszenie?")) return;
        try {
            const res = await fetch('/api/friends/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ relationId: relationId })
            });
            const result = await res.json();
            if (result.success) {
                loadFriends(loggedUserId); 
            } else { alert("Błąd."); }
        } catch(e) { console.error(e); }
    };

    // Pobieranie mojego awatara do paska nawigacji (bo tam zawsze ma być mój)
    fetch(`/api/profile?userId=${loggedUserId}`)
        .then(res => res.json())
        .then(res => {
            if(res.success && res.data.avatar_url) {
                setSrc('avatarImg', res.data.avatar_url);
            }
        });

    function setText(id, text) { const el = document.getElementById(id); if(el) el.textContent = text; }
    function setSrc(id, src) { const el = document.getElementById(id); if(el) el.src = src; }
    function setValue(id, val) { const el = document.getElementById(id); if(el) el.value = val || ''; }
});