// File: netlify/functions/scrape.js
const axios = require('axios');
const cheerio = require('cheerio');
const { parseStringPromise } = require('xml2js');

const BASE_URL = 'https://samehadaku.li';

// --- Fungsi Utama (Tidak ada perubahan) ---
exports.handler = async function (event, context) {
    const { url, search, animePage } = event.queryStringParameters;
    try {
        let data;
        if (search) {
            data = await scrapeSearchFeed(search);
        } else if (animePage) {
            data = await scrapeAnimePage(animePage); // Fungsi ini yang kita perbaiki
        } else if (url) {
            data = await scrapeEpisodePage(url);
        } else {
            data = { type: 'home' }; 
        }
        return { statusCode: 200, body: JSON.stringify(data) };
    } catch (error) {
        console.error('Scraping error:', error.message);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

// --- LOGIKA SCRAPER ---

// 1. Scraping Pencarian dari RSS FEED (Tidak ada perubahan)
async function scrapeSearchFeed(query) {
    const feedUrl = `${BASE_URL}/search/${encodeURIComponent(query)}/feed/rss2/`;
    const { data } = await axios.get(feedUrl);
    const parsed = await parseStringPromise(data);
    
    if (!parsed.rss.channel[0].item) {
        return { type: 'search', query, results: [] };
    }

    const results = parsed.rss.channel[0].item.map(item => ({
        title: item.title[0],
        link: item.link[0],
        pubDate: item.pubDate[0],
        thumbnail: null 
    }));
    return { type: 'search', query, results };
}

// 2. Scraping Halaman Anime (PERBAIKAN TOTAL DI SINI)
async function scrapeAnimePage(url) {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    
    const episodes = [];
    
    // ===== PERBAIKAN UTAMA =====
    // Selector yang benar sekarang adalah '.eplister ul li', bukan '.episodelist ul li'
    // Kita juga mengambil data dari struktur div di dalamnya.
    $('.eplister ul li').each((i, el) => {
        const episodeElement = $(el);
        const linkElement = episodeElement.find('a'); // Link utama ada di tag <a>
        
        // Ambil data dari div spesifik di dalamnya
        const title = linkElement.find('.epl-title').text();
        const link = linkElement.attr('href');
        const date = linkElement.find('.epl-date').text();
        
        // Pastikan hanya data yang valid yang masuk
        if(title && link) {
            episodes.push({ title, link, date });
        }
    });
    
    // Bagian ini tetap sama
    const thumbnail = $('.thumb img').attr('src');
    const synopsis = $('.entry-content.series p').text();
    const episodeCount = episodes.length; // Sekarang akan menghitung dengan benar

    return { type: 'animePage', episodes, thumbnail, synopsis, episodeCount };
}

// 3. Scraping Halaman Episode (Tidak ada perubahan)
async function scrapeEpisodePage(episodeUrl) {
    const { data } = await axios.get(episodeUrl);
    const $ = cheerio.load(data);
    const title = $('.entry-title').text().trim();
    const videoFrames = [];
    $('.player-embed iframe').each((i, el) => {
        const src = $(el).attr('src');
        if (src) videoFrames.push(src);
    });
    return { type: 'episode', title, videoFrames: videoFrames.length > 0 ? videoFrames : ['Video tidak ditemukan'] };
}
