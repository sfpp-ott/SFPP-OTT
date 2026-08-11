const fs = require('fs');
const https = require('https');

const API_KEY = "ec1c8fecd38d1cc5a27f15766f0848d5";

const fetchJson = (url) => new Promise((resolve, reject) => {
    https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
});

async function processList(inputFile, outputFile, defaultType) {
    if (!fs.existsSync(inputFile)) {
        console.log(`Fichier ${inputFile} introuvable.`);
        return;
    }
    
    console.log(`Lecture de ${inputFile}...`);
    let rawData = fs.readFileSync(inputFile);
    let items = JSON.parse(rawData);
    let updatedItems = [];

    for (let item of items) {
        if (item.id_tmdb) {
            console.log(`Recherche TMDB pour : ${item.t || item.id_tmdb}`);
            try {
                const isSeries = defaultType === "tv" || (item.cat && item.cat.toUpperCase().includes("SÉRIES"));
                const tmdbType = isSeries ? "tv" : "movie";
                
                const url = `https://api.themoviedb.org/3/${tmdbType}/${item.id_tmdb}?api_key=${API_KEY}&language=fr-FR&append_to_response=videos,credits`;
                const data = await fetchJson(url);
                
                if (data.id) {
                    item.img = item.img || (data.poster_path ? "https://image.tmdb.org/t/p/w500" + data.poster_path : null);
                    item.bg = item.bg || (data.backdrop_path ? "https://image.tmdb.org/t/p/original" + data.backdrop_path : null);
                    item.desc = item.desc || data.overview;
                    
                    let dateStr = data.release_date || data.first_air_date;
                    item.year = item.year || (dateStr ? dateStr.split('-')[0] : "2024");
                    item.note = item.note || Math.round(data.vote_average / 2);
                    
                    if (!item.cat && data.genres && data.genres.length > 0) {
                        item.cat = data.genres.map(g => g.name.toUpperCase()).join(', ');
                    }
                    
                    if (!item.trailer && data.videos && data.videos.results) {
                        const video = data.videos.results.find(v => (v.type === "Trailer" || v.type === "Teaser") && v.site === "YouTube") || data.videos.results[0];
                        if (video) item.trailer = video.key;
                    }
                    
                    if (!item.actors_pics && data.credits && data.credits.cast) {
                        item.actors_pics = data.credits.cast.slice(0, 10).map(a => ({ name: a.name, img: "https://image.tmdb.org/t/p/w185" + a.profile_path }));
                    }
                }
            } catch (error) {
                console.error(`Erreur avec l'ID ${item.id_tmdb}`);
            }
            // Petite pause pour que TMDB ne bloque pas notre robot
            await new Promise(r => setTimeout(r, 250));
        }
        updatedItems.push(item);
    }

    console.log(`Sauvegarde dans ${outputFile}...`);
    fs.writeFileSync(outputFile, JSON.stringify(updatedItems, null, 2));
}

async function run() {
    console.log("--- DÉBUT DE LA MISE À JOUR FILMS ---");
    await processList('films_base.json', 'films.json', 'movie');
    
    console.log("--- DÉBUT DE LA MISE À JOUR SÉRIES ---");
    await processList('series_base.json', 'series.json', 'tv');
    
    console.log("--- TOUT EST TERMINÉ ! ---");
}

run();
