// File: netlify/functions/scrape.js
const axios = require('axios');
const cheerio = require('cheerio');
const { parseStringPromise } = require('xml2js');

const BASE_URL = 'https://samehadaku.li';

// --- Fungsi Utama ---
exports.handler = async function (event, context) {
    const { url, search, animePage } = event.queryStringParameters;
    try {
        let data;
        if (search) {
            data = await scrapeSearchFeed(search);
        } else if (animePage) {
            data = await scrapeAnimePage(animePage);
        } else if (url) {
            data = await scrapeEpisodePage(url);
        } else {
            // Halaman utama (sekarang tidak dipakai, tapi biarkan saja)
            data = { type: 'home' }; 
        }
        return { statusCode: 200, body: JSON.stringify(data) };
    } catch (error) {
        console.error('Scraping error:', error.message);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

// --- LOGIKA SCRAPER ---

// 1. Scraping Pencarian dari RSS FEED (Cepat & Stabil)
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

// 2. Scraping Halaman Anime untuk daftar episode & thumbnail (Detail)
async function scrapeAnimePage(url) {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    
    const episodes = [];
    // Selector baru berdasarkan file HTML yang kamu berikan
    $('.episodelist ul li').each((i, el) => {
        const episodeElement = $(el);
        const linkElement = episodeElement.find('.lefttitle a');
        
        episodes.push({
            title: linkElement.text(),
            link: linkElement.attr('href'),
            date: episodeElement.find('.righttitle').text()
        });
    });
    
    const thumbnail = $('.thumb img').attr('src');
    const synopsis = $('.entry-content.series p').text();
    const episodeCount = episodes.length;

    return { type: 'animePage', episodes, thumbnail, synopsis, episodeCount };
}

// 3. Scraping Halaman Episode (Final)
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
