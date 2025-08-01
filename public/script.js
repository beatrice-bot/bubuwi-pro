document.addEventListener('DOMContentLoaded', () => {
    const contentContainer = document.getElementById('content-container');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');

    // --- State Management ---
    const appState = {
        history: JSON.parse(localStorage.getItem('bubuwi_history')) || [],
        favorites: JSON.parse(localStorage.getItem('bubuwi_favorites')) || [],
        currentPage: 'home', // 'home', 'search', 'watch'
        currentData: null,
    };

    // --- API Helper ---
    const api = {
        fetch: async (endpoint) => {
            showLoader();
            try {
                const response = await fetch(`/api/scrape?${endpoint}`);
                if (!response.ok) {
                    throw new Error(`API Error: ${response.statusText}`);
                }
                return await response.json();
            } catch (error) {
                showError(error.message);
                return null;
            }
        }
    };

    // --- Rendering Functions ---
    const render = {
        home: (data) => {
            const template = document.getElementById('home-page-template').content.cloneNode(true);
            const latestEpisodesContainer = template.getElementById('latest-episodes');
            
            data.results.forEach(item => {
                const card = createCard(item.title, item.link, item.thumbnail, item.episode);
                latestEpisodesContainer.appendChild(card);
            });
            
            contentContainer.innerHTML = '';
            contentContainer.appendChild(template);
            render.sidebar();
        },
        search: (data) => {
            contentContainer.innerHTML = `
                <div class="main-content">
                    <button class="back-button">← Kembali ke Beranda</button>
                    <h2>Hasil untuk: "${data.query}"</h2>
                    <div class="episode-grid"></div>
                </div>`;
            const grid = contentContainer.querySelector('.episode-grid');
            if (data.results.length === 0) {
                grid.innerHTML = '<p>Tidak ada hasil yang ditemukan.</p>';
            } else {
                data.results.forEach(item => {
                    const card = createCard(item.title, item.link, item.thumbnail);
                    grid.appendChild(card);
                });
            }
            contentContainer.querySelector('.back-button').onclick = init;
        },
        watch: (data) => {
            appState.currentData = data;
            const template = document.getElementById('watch-page-template').content.cloneNode(true);
            template.getElementById('video-title-watch').textContent = data.title;
            template.getElementById('video-player').src = data.videoFrames[0] || ''; // Ambil link video pertama
            
            contentContainer.innerHTML = '';
            contentContainer.appendChild(template);

            contentContainer.querySelector('.back-button').onclick = init;
            contentContainer.querySelector('#add-favorite-btn').onclick = () => addToFavorites(data);
            
            addToHistory(data);
        },
        sidebar: () => {
            const favList = document.getElementById('favorites-list');
            const histList = document.getElementById('history-list');
            if (!favList || !histList) return;

            favList.innerHTML = appState.favorites.length ? '' : '<p style="font-size:0.8rem;">Belum ada favorit.</p>';
            appState.favorites.forEach(item => {
                favList.innerHTML += `<a href="#" data-link="${item.link}">${item.title}</a>`;
            });

            histList.innerHTML = appState.history.length ? '' : '<p style="font-size:0.8rem;">Belum ada riwayat.</p>';
            appState.history.forEach(item => {
                histList.innerHTML += `<a href="#" data-link="${item.link}">${item.title}</a>`;
            });
            
            // Add event listeners to sidebar links
            document.querySelectorAll('.sidebar a').forEach(link => {
                link.onclick = (e) => {
                    e.preventDefault();
                    handleCardClick(link.dataset.link);
                };
            });
        }
    };
    
    // --- UI Component Functions ---
    const showLoader = () => {
        contentContainer.innerHTML = '<div class="loader"></div>';
    };

    const showError = (message) => {
        contentContainer.innerHTML = `<div class="error-message"><h3>Oops! Terjadi Kesalahan</h3><p>${message}</p><button class="back-button">Coba Lagi</button></div>`;
        contentContainer.querySelector('.back-button').onclick = init;
    };
    
    const createCard = (title, link, thumbnail, episodeText = '') => {
        const card = document.createElement('a');
        card.className = 'episode-card';
        card.href = '#';
        card.dataset.link = link;
        card.innerHTML = `
            <img src="${thumbnail}" alt="${title}" loading="lazy">
            <div class="title">${title} <span class="epx">${episodeText}</span></div>
        `;
        card.onclick = (e) => {
            e.preventDefault();
            handleCardClick(link);
        };
        return card;
    };

    // --- Event Handlers & Logic ---
    const handleCardClick = async (link) => {
        const data = await api.fetch(`url=${encodeURIComponent(link)}`);
        if (data) {
            data.link = link; // Simpan link original untuk history/favorit
            render.watch(data);
        }
    };
    
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            const data = await api.fetch(`search=${encodeURIComponent(query)}`);
            if (data) render.search(data);
            searchInput.value = '';
        }
    });

    const addToHistory = (item) => {
        appState.history = [item, ...appState.history.filter(h => h.link !== item.link)].slice(0, 5);
        localStorage.setItem('bubuwi_history', JSON.stringify(appState.history));
    };

    const addToFavorites = (item) => {
        if (!appState.favorites.some(f => f.link === item.link)) {
            appState.favorites = [item, ...appState.favorites];
            localStorage.setItem('bubuwi_favorites', JSON.stringify(appState.favorites));
            alert(`"${item.title}" ditambahkan ke favorit!`);
            render.sidebar();
        } else {
            alert('Anime ini sudah ada di favorit.');
        }
    };

    // --- Initialization ---
    const init = async () => {
        const data = await api.fetch(''); // Fetch latest
        if (data) {
            render.home(data);
        }
    };

    init();
});

