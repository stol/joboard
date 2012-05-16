var http    = require('http'),
	url     = require('url'),
	request = require('request'),
	jsdom   = require('jsdom'),
	express = require('express'),
    moment  = require('moment'),
    _       = require('underscore'),
    jenkins = require('jenkins')

var providers = [
    {
        name: 'Alsacreation',
        url_list : 'http://emploi.alsacreations.com/offres.html',
        url_item : 'http://emploi.alsacreations.com/',
        date_formater: 'DD MMM YYYY',
        date_lang : 'fr',
        selectors: {
            row    : 'table.results tr',
            label  : '.intitule',
            date   : 'td:eq(2)',
            company: 'td:eq(0) strong',
            href   : '.intitule',
            place  : 'td:eq(1)'
        },
        place_contents: 5
    }
    ,{
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
    },
    {
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
    },
    {
        name: 'Humancoders Ruby',
        url_list : 'http://jobs.humancoders.com/ruby',
        url_item : 'http://jobs.humancoders.com/',
        date_formater: "DD MMM YYYY",
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
    },
    {
        name: 'Humancoders Javascript',
        url_list : 'http://jobs.humancoders.com/javascript',
        url_item : 'http://jobs.humancoders.com/',
        date_formater: "DD MMM YYYY",
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
    },
    {
        name: 'French web',
        url_list : 'http://emploi.frenchweb.fr/',
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
    },
    {
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
    }
    
]

var offres = {},
    offres_nb = 0,
    providers_done = 0

function load_provider(p, res)
{
    moment.lang(p.date_lang);
    var max = 1; 
    var i = 0;

    request({url: p.url_list}, function (error, response, body) {
        jsdom.env({html: body, scripts: ['http://code.jquery.com/jquery-1.7.2.min.js']}, function(err, window){
            var $ = window.jQuery;
            
            $(p.selectors.row).each(function(i,row){
                var offre = {
                    label : $(row).find(p.selectors.label).text().trim(),
                    company: $(row).find(p.selectors.company).text().trim(),
                    href: (p.url_item ? p.url_item : p.url_list)+$(row).find(p.selectors.href).attr("href"),
                    lieu: p.place_contents
                        ? $(row).find(p.selectors.place).contents().eq(p.place_contents).text()
                        : $(row).find(p.selectors.place).text().trim(),
                    source: p.name,
                    fresh: 1
                }

                var date_str = $(row).find(p.selectors.date).text().trim() + (p.date_year ? p.date_year : '');

                if (date_str.indexOf('heures')>=0){
                    offre.ts = moment().subtract('hours', parseInt(date_str.substring(7),10)).valueOf();
                }
                else if (date_str.indexOf('jour')>=0){
                    offre.ts = moment().subtract('days', parseInt(date_str,10)).valueOf();
                }
                else {
                    offre.ts = moment(date_str,p.date_formater).valueOf()
                }

                var id = jenkins.hash(offre.href);

                if (offres[id])
                    offre.fresh = 0;

                res.write(",\n"+JSON.stringify(offre));

                offres[id] = offre;

                offres_nb++;

                if (++i > max)
                    return false;
            });
            if (++providers_done == providers.length){
                res.end(']')
            }
        });
    });
}


var app = express.createServer();

app.get('/', function(req, res){
    res.charset = 'UTF-8';
    res.header('Content-Type', 'application/json');
    res.write('[null')
    //load_provider(providers[0], res);
    _.each(providers, function(p){
        load_provider(p, res);
    });

    //res.send('Hello World');
});

app.listen(3000);

/*
http.createServer(function (req, res) {
	res.writeHead(200, {'Content-Type': 'text/plain'});
  	

	request({url: "http://remixjobs.com/"}, function (error, response, body) {
		jsdom.env({html: body, scripts: ['http://code.jquery.com/jquery-1.7.2.min.js']}, function(err, window){
            var $ = window.jQuery; 
            console.log($('title').text());
            res.end($('title').text());
        });
	});

}).listen(8124);

console.log('Server running at http://127.0.0.1:8124/');
*/