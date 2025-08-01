document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');
    const state = {
        history: [], // Untuk navigasi tombol kembali
    };

    const api = {
        fetch: async (params) => {
            try {
                const response = await fetch(`/api/scrape?${params}`);
                if (!response.ok) throw new Error(`Server Error: ${response.status}`);
                return await response.json();
            } catch (error) {
                render.error(error.message);
                return null;
            }
        },
    };

    const render = {
        // --- RENDER HALAMAN ---
        home: () => {
            app.innerHTML = templates.header('Bubuwi Elegant') + templates.contact();
        },
        search: async (query) => {
            app.innerHTML = templates.skeletonLoader();
            const data = await api.fetch(`search=${query}`);
            if (!data) return;
            let content;
            if (data.results.length === 0) {
                content = `<p>Tidak ada hasil untuk "${query}".</p>`;
            } else {
                content = data.results.map(item => templates.resultCard(item, true)).join('');
            }
            app.innerHTML = templates.header('Hasil Pencarian') + templates.backButton() + `<div class="search-results fade-in">${content}</div>`;
        },
        animePage: async (url, title) => {
            app.innerHTML = templates.skeletonLoader();
            const data = await api.fetch(`animePage=${encodeURIComponent(url)}`);
            if (!data) return;

            const header = `
                <div class="anime-header fade-in">
                    <img src="${data.thumbnail}" class="anime-header-thumb" alt="${title}">
                    <div>
                        <h2>${title}</h2>
                        <p class="anime-synopsis">
                            <strong>Total Episode:</strong> ${data.episodeCount}
                        </p>
                    </div>
                </div>`;
            const episodeList = data.episodes.map(ep => templates.episodeCard(ep)).join('');
            app.innerHTML = templates.header(title, true) + templates.backButton() + header + `<div class="episode-list fade-in">${episodeList}</div>`;
        },
        watchPage: async (url) => {
            app.innerHTML = templates.skeletonLoader();
            const data = await api.fetch(`url=${encodeURIComponent(url)}`);
            if (!data) return;
            app.innerHTML = `
                <div class="fade-in">
                    ${templates.backButton()}
                    <h3 class="watch-page-title">${data.title}</h3>
                    <div class="video-container">
                        <iframe src="${data.videoFrames[0] || ''}" frameborder="0" allowfullscreen></iframe>
                    </div>
                </div>
            `;
        },
        error: (message) => {
            app.innerHTML = templates.header('Error') + `<p>Oops! ${message}</p>`;
        },
    };

    const templates = {
        // --- TEMPLATE KOMPONEN ---
        header: (title, isSubPage = false) => `
            <header class="header ${isSubPage ? '' : 'fade-in'}">
                ${isSubPage ? '' : `<h1>${title}</h1>`}
                <form id="search-form">
                    <input type="text" id="search-input" placeholder="Cari anime..." required>
                </form>
            </header>`,
        backButton: () => `<button class="back-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"></path></svg>
            Kembali
            </button>`,
        skeletonLoader: () => `
            ${templates.header('Loading...')}
            <div class="skeleton shimmer skeleton-title"></div>
            <div class="skeleton-grid">
                ${'<div class="skeleton shimmer skeleton-card"></div>'.repeat(6)}
            </div>`,
        resultCard: (item, fromSearch = false) => `
            <a href="#" class="result-card" data-link="${item.link}" data-title="${item.title}">
                ${item.thumbnail ? `<img src="${item.thumbnail}" alt="" class="result-card-thumb">` : ''}
                <div class="result-card-info">
                    <h3>${item.title}</h3>
                    ${fromSearch ? `<p>${new Date(item.pubDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' })}</p>` : ''}
                </div>
            </a>`,
        episodeCard: (ep) => `
             <a href="#" class="episode-card" data-link="${ep.link}">
                <div class="result-card-info">
                    <h3>${ep.title}</h3>
                    <p>${ep.date}</p>
                </div>
            </a>`,
        contact: () => `
            <div class="fade-in">
                <h2 class="page-title">Kontak Developer</h2>
                <div class="contact-card">
                    <a href="https://www.instagram.com/adnanmwa" target="_blank" class="contact-link">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Instagram_logo_2022.svg/1000px-Instagram_logo_2022.svg.png" alt="Instagram Logo">
                        <span>@adnanmwa</span>
                    </a>
                    <a href="https://www.tiktok.com/@adnansagiri" target="_blank" class="contact-link">
                        <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSrLEt7CpnTRQ1va0on-RGO3aDsgpdlNFUoaw&s" alt="TikTok Logo">
                        <span>@adnansagiri</span>
                    </a>
                </div>
            </div>
        `,
    };

    // --- NAVIGASI & EVENT HANDLING ---
    const handleNavigation = (view, params) => {
        state.history.push({ view, params });
        runView(view, params);
    };

    const goBack = () => {
        state.history.pop(); // Hapus view saat ini
        const last = state.history[state.history.length-1] || { view: 'home', params: [] }; // Ambil view sebelumnya
        runView(last.view, last.params, true);
    };

    const runView = (view, params, isGoingBack = false) => {
        if (!isGoingBack) state.history.push({ view, params });
        switch (view) {
            case 'search': render.search(...params); break;
            case 'animePage': render.animePage(...params); break;
            case 'watchPage': render.watchPage(...params); break;
            default: state.history = []; render.home();
        }
    };
    
    app.addEventListener('submit', e => {
        if (e.target.id === 'search-form') {
            e.preventDefault();
            const query = e.target.querySelector('#search-input').value.trim();
            if (query) runView('search', [query]);
        }
    });

    app.addEventListener('click', e => {
        const link = e.target.closest('a[data-link], button.back-button');
        if (!link) return;
        e.preventDefault();

        if (link.classList.contains('back-button')) {
            goBack();
        } else {
            const linkUrl = link.dataset.link;
            const title = link.dataset.title;
            if (title) {
                runView('animePage', [linkUrl, title]);
            } else {
                runView('watchPage', [linkUrl]);
            }
        }
    });
    
    // Inisialisasi Aplikasi
    runView('home', []);
});
