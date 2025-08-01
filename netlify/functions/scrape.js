// File: netlify/functions/scrape.js

const axios = require('axios');
const cheerio = require('cheerio');

// URL dasar website target
const BASE_URL = 'https://samehadaku.li';

// Fungsi utama yang akan dijalankan oleh Netlify
exports.handler = async function (event, context) {
    // Mendapatkan parameter dari URL, misal: /api/scrape?url=... atau /api/scrape?search=...
    const { url, search } = event.queryStringParameters;

    try {
        let data;
        if (url) {
            // Jika ada parameter 'url', kita scrape halaman detail episode
            data = await scrapeEpisodePage(url);
        } else if (search) {
            // Jika ada parameter 'search', kita scrape hasil pencarian
            data = await scrapeSearchPage(search);
        } else {
            // Jika tidak ada parameter, kita scrape halaman utama untuk daftar terbaru
            data = await scrapeHomePage();
        }

        // Mengembalikan data sebagai JSON dengan status 200 (OK)
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error('Scraping error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Gagal melakukan scraping.', details: error.message }),
        };
    }
};

// Fungsi untuk scraping halaman utama
async function scrapeHomePage() {
    const { data } = await axios.get(BASE_URL);
    const $ = cheerio.load(data);
    const episodes = [];

    $('.post-show ul li').each((i, el) => {
        const title = $(el).find('a').attr('title');
        const link = $(el).find('a').attr('href');
        const episode = $(el).find('.epx').text().trim();
        // Thumbnail di halaman utama biasanya tidak spesifik, jadi kita bisa cari nanti
        // atau gunakan placeholder
        const thumbnail = $(el).find('img') ? $(el).find('img').attr('src') : 'placeholder.jpg';

        if (title && link) {
            episodes.push({ title, link, episode, thumbnail });
        }
    });

    return { type: 'latest', results: episodes };
}

// Fungsi untuk scraping halaman pencarian
async function scrapeSearchPage(query) {
    const { data } = await axios.get(`${BASE_URL}/?s=${query}`);
    const $ = cheerio.load(data);
    const results = [];

    $('h2.page-title').remove(); // Hapus judul utama agar tidak ikut ter-scrape
    $('.animelist-search li').each((i, el) => {
        const title = $(el).find('h2 a').text();
        const link = $(el).find('h2 a').attr('href');
        const thumbnail = $(el).find('img').attr('src');
        const genres = [];
        $(el).find('.genre-info a').each((i, genreEl) => {
            genres.push($(genreEl).text());
        });

        if (title && link) {
            results.push({ title, link, thumbnail, genres });
        }
    });

    return { type: 'search', query, results };
}


// Fungsi untuk scraping halaman detail episode (mirip dengan yang lama)
async function scrapeEpisodePage(episodeUrl) {
    const { data } = await axios.get(episodeUrl);
    const $ = cheerio.load(data);

    const title = $('.entry-title').text().trim();
    const videoFrames = [];
    $('.player-embed iframe').each((i, el) => {
        const src = $(el).attr('src');
        if (src) {
            videoFrames.push(src);
        }
    });

    return {
        type: 'episode',
        title,
        videoFrames: videoFrames.length > 0 ? videoFrames : ['Video tidak ditemukan'],
    };
}
