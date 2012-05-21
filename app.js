var http    = require('http'),
	url     = require('url'),
	request = require('request'),
	jsdom   = require('jsdom'),
	express = require('express'),
    moment  = require('moment'),
    _       = require('underscore'),
    jenkins = require('jenkins'),
    iconv   = require('iconv-lite')

var providers = []

providers.push({
    name: 'Alsacreation',
    url_list : 'http://emploi.alsacreations.com/offres.html',
    url_item : 'http://emploi.alsacreations.com/',
    date_formater: 'DD MMM YYYY',
    date_lang : 'fr',
    selectors: {
        row    : 'table.results tr',
        label  : '.intitule',
        date   : 'td:eq(2)',
        company: 'td:eq(0) b',
        href   : '.intitule',
        place  : 'td:eq(1)'
    },
    place_contents: 2
})

providers.push({
    name: 'Lolix',
    url_list : 'http://fr.lolix.org/search/offre/search.php?page=0&mode=find&posteid=0&regionid=0&contratid=0',
    url_item : 'http://fr.lolix.org/search/offre/',
    enc: "ISO-8859-1",
    date_formater: 'DD MMMM YYYY',
    date_lang : 'en',
    selectors: {
        row    : 'td.Contenu table:eq(1) tr:gt(0)',
        label  : 'td:eq(2)',
        date   : 'td:eq(0)',
        company: 'td:eq(1)',
        href   : 'td:eq(2) a',
        place  : 'td:eq(3)'
    }
})

providers.push({
    name: 'Remixjobs',
    url_list : 'http://remixjobs.com',
    date_formater: "DD MMM YYYY",
    date_lang : 'fr',
    selectors: {
        row    : '.job-infos',
        label  : '.job-title',
        date   : '.job-details-right',
        company: '.company',
        href   : '.job-link',
        place  : '.workplace'
    }
})

providers.push({
    name: 'French web',
    url_list : 'http://emploi.frenchweb.fr/',
    url_item : '',
    date_formater: "DD MMM YYYY",
    date_lang : 'fr',
    selectors: {
        row    : '.job',
        label  : '.title strong',
        date   : '.date',
        company: '.title > a',
        href   : '.title strong a',
        place  : '.location'
    }
})

providers.push({
    name: 'Express-board',
    url_list : 'http://www.express-board.fr',
    date_formater: "DD MMM YYYY",
    date_lang : 'fr',
    selectors: {
        row    : '.stb:eq(0) tbody tr',
        label  : 'td:eq(0) a',
        date   : 'td:eq(3)',
        company: 'td:eq(1) a',
        href   : 'td:eq(0) a',
        place  : 'td:eq(2) a'
    }
})

providers.push({
    name: 'Humancoders',
    url_list : 'http://jobs.humancoders.com/',
    date_formater: ["DD MMM YYYY", "DD MMMM YYYY"],
    date_year : 2012,
    date_lang : 'fr',
    selectors: {
        row    : '.job',
        label  : '.job_title',
        date   : '.date',
        company: '.second .left span',
        href   : '.job_title a',
        place  : '.location'
    }
})

providers.push({
    name: 'developpez.com',
    url_list : 'http://www.developpez.net/forums/f592/emploi-etudes-informatique/annonces-emplois/offres-demploi/',
    url_item : '',
    date_formater: "DD/MM/YYYY HH:mm",
    date_lang : 'fr',
    selectors: {
        row    : '#threadbits_forum_592 tr:gt(2)',
        label  : 'td:eq(1) div a',
        date   : 'td:eq(2) div',
        company: 'td:eq(1) div:eq(1)',
        href   : 'td:eq(1) div a',
        place  : '#unknown'
    },
    date_contents: [0,1]
})


var offres = [],
    offres_nb = 0,
    providers_done = 0
var UTF8 = {
    encode: function(s){
        for(var c, i = -1, l = (s = s.split("")).length, o = String.fromCharCode; ++i < l;
            s[i] = (c = s[i].charCodeAt(0)) >= 127 ? o(0xc0 | (c >>> 6)) + o(0x80 | (c & 0x3f)) : s[i]
        );
        return s.join("");
    },
    decode: function(s){
        for(var a, b, i = -1, l = (s = s.split("")).length, o = String.fromCharCode, c = "charCodeAt"; ++i < l;
            ((a = s[i][c](0)) & 0x80) &&
            (s[i] = (a & 0xfc) == 0xc0 && ((b = s[i + 1][c](0)) & 0xc0) == 0x80 ?
            o(((a & 0x03) << 6) + (b & 0x3f)) : o(128), s[++i] = "")
        );
        return s.join("");
    }
};

var app = express.createServer();
app.set("view options", {layout: false});
app.register('.html', {
    compile: function(str, options){
      return function(locals){
        return str;
      };
    }
});
app.use(express.static(__dirname + '/public'));
app.get("/test", function(req, res){
    moment.lang("fr");
    var a = moment("16 mai 2012", "DD MMM YYYY").format("DD/MM/YY");
    res.end(a)

})
app.get('/offres', function(req, res){
    console.log("---");
    providers_done = 0;
    offres = [];
    offres_nb = 0;

    res.charset = 'UTF-8';
    res.header('Content-Type', 'application/json');
    //load_provider(providers[0], res);
    _.each(providers, function(p){
        var max = 100; 
        var i = 0;

        request({url: p.url_list, timeout: 3000}, function (error, response, body) {
            if (error || !body){
                console.log("Error on "+p.name);
                if (++providers_done == providers.length){
                    offres = _.sortBy(offres, function(o){
                        return -o.ts;
                    })

                    res.json(offres);
                }
                return;
            }
            jsdom.env({html: body, scripts: ['http://code.jquery.com/jquery-1.7.2.min.js']}, function(err, window){
                var $ = window.jQuery;
                moment.lang(p.date_lang);
                
                $(p.selectors.row).each(function(i,row){
                    var offre = {
                        label : $(row).find(p.selectors.label).text().trim(),
                        company: $(row).find(p.selectors.company).text().trim(),
                        href: (p.url_item !== undefined ? p.url_item : p.url_list)+$(row).find(p.selectors.href).attr("href"),
                        place: p.place_contents
                            ? $(row).find(p.selectors.place).contents().eq(p.place_contents).text()
                            : $(row).find(p.selectors.place).text().trim(),
                        source: p.name,
                        fresh: 1
                    }
                    /*
                    if (p.enc){
                        console.log("avant : "+offre.label)
                        offre.label = utf8_decode(offre.label);
                        console.log("apres : "+offre.label)
                    }
                    */

                    var date_str = $(row).find(p.selectors.date).text().trim() + (p.date_year ? ' '+p.date_year : '');
                    date_str = date_str.toLowerCase();
                    var res = null;
                    // Si la date est de la forme "x minute(s)"
                    if (res = date_str.match(/(\d+) minutes?/i)){
                        offre.ts = moment().subtract('minutes', res[1]).valueOf();
                    }
                    // Si la date est de la forme "x heure(s)"
                    else if (res = date_str.match(/(\d+) heures?/i)){
                        offre.ts = moment().subtract('hours', res[1]).valueOf();
                    }
                    // Si la date est de la forme "x jour(s)"
                    else if (res = date_str.match(/(\d+) jours?/i)){
                        offre.ts = moment().subtract('days', res[1]).valueOf();
                    }
                    // Si la date est de la forme "x mois"
                    else if (res = date_str.match(/(\d+) mois/i)){
                        offre.ts = moment().subtract('months', res[1]).valueOf();
                    }
                    // Si la date est de la forme "Aujourd'hui 00h00"
                    else if (res = date_str.match(/Aujourd'hui (\d+)h(\d+)/i)){
                        offre.ts = moment().hours(res[1]).minutes(res[2]).valueOf();
                    }
                    // Si la date est de la forme "hier 00h00"
                    else if (res = date_str.match(/Hier (\d+)h(\d+)/i)){
                        offre.ts = moment().subtract('days', 1).hours(res[1]).minutes(res[2]).valueOf();
                    }
                    // sinon, on suit le formater du provider
                    else{
                        // spécial pour human coders, on met "mar" en "mars", car leur "short month" n'est pas usuel
                        date_str = date_str.replace(" mar ", " mars ");
                        offre.ts = moment(date_str,p.date_formater).valueOf()
                    }

                    offre.id = jenkins.hash(offre.href);

                    offres.push(offre);

                    offres_nb++;

                    if (++i > max)
                        return false;
                });
                if (++providers_done == providers.length){

                    offres = _.sortBy(offres, function(o){
                        return -o.ts;
                    })

                    res.json(offres);
                }
            });
        });


    });

    //res.send('Hello World');
});

app.get('/', function(req, res){
    res.render('index.html');
    res.end();
});


app.listen(3000);
