'use strict';
// Die Disziplinen der Olympiade: welche Spiele, wo sie laufen, wie gewertet wird.
// wertung 'rang': das Spiel meldet die Reihenfolge einer Gruppe. 'wert': jeder Spieler meldet eine Zahl (höher ist besser).
// gruppeMax: so viele passen in einen Raum; bei mehr Leuten gibt es Vorläufe, die nach Leistung (wert) zusammen gewertet werden.

const SPIELE = {
  kart:{
    sp:'loewenkart', name:'Löwen-Kart', emoji:'🏎️', pfad:'/', wertung:'rang', gruppeMax:8,
    online:'https://taddelcart.onrender.com', lokal:10100,
    regel:'Ein Rennen über 3 Runden. Freie Plätze fahren Computer mit, gewertet wird nur die Reihenfolge unter euch. Ab 9 Leuten gibt es Vorläufe – dann zählt die Zielzeit.',
    einst:[
      { id:'strecke', name:'Strecke', std:0, werte:[[0, 'Löwenwiese'], [1, 'Kaktus-Canyon'], [2, 'Frostgipfel']] },
      { id:'stufe', name:'Tempo', std:1, werte:[[0, '50 ccm'], [1, '100 ccm'], [2, '150 ccm']] }
    ]
  },
  bummler:{
    sp:'weltenbummler', name:'Weltenbummler', emoji:'🌍', pfad:'/', wertung:'rang', gruppeMax:12,
    online:'https://taddelgeo.onrender.com', lokal:10200,
    regel:'Alle raten dieselben Orte. Wer am Ende die meisten Punkte hat, gewinnt. Ab 13 Leuten gibt es Vorläufe – dann zählen die Punkte.',
    einst:[
      { id:'runden', name:'Runden', std:5, werte:[[3, '3 Runden'], [5, '5 Runden'], [7, '7 Runden']] },
      { id:'zeit', name:'Zeit pro Runde', std:90, werte:[[60, '60 Sek.'], [90, '90 Sek.'], [120, '2 Min.'], [180, '3 Min.']] }
    ]
  },
  blau:{
    sp:'blauestunde', name:'Blaue Stunde', emoji:'🌃', pfad:'/', wertung:'rang', gruppeMax:16,
    online:'https://blauestunde.onrender.com', lokal:10000,
    regel:'3 Minuten Autobahn bei Nacht, alle gleichzeitig. Knappe Manöver bringen Punkte, ein Unfall beendet die Fahrt.',
    einst:[
      { id:'stufe', name:'Verkehr', std:'normal', werte:[['leicht', 'Leicht'], ['normal', 'Normal'], ['schwer', 'Schwer']] }
    ]
  },
  reiche:{
    sp:'weltreiche', name:'Weltreiche', emoji:'🏰', pfad:'/', wertung:'rang', gruppeMax:4,
    online:'https://weltreiche.onrender.com', lokal:10300,
    regel:'Jeder gegen jeden um die Insel. Höchstens 4 Reiche pro Schlacht, bei mehr Leuten gibt es Vorläufe. Nach Ablauf der Zeit gewinnt das größte Reich. Über die Vorläufe hinweg zählt, wer am Ende am meisten besitzt oder am längsten durchhielt.',
    einst:[
      { id:'minuten', name:'Zeitlimit', std:10, werte:[[6, '6 Min.'], [10, '10 Min.'], [15, '15 Min.']] },
      { id:'karte', name:'Karte', std:'zufall', werte:[['zufall', 'Zufall'], ['mittelinsel', 'Mittelinsel'], ['flussland', 'Flussland'], ['dreilaendereck', 'Dreiländereck'], ['vierwinde', 'Vier Winde']] }
    ]
  },
  panzer:{
    sp:'ironhorizon', name:'Iron Horizon', emoji:'🛡️', pfad:'/iron-horizon/', wertung:'wert',
    online:'https://iron-horizon.onrender.com', lokal:10400,
    regel:'Gefechts-Challenge: Alle fahren dieselbe Schlacht (gleiche Karte, gleicher Panzer, gleiche Gegner). Punkte für Abschüsse, Treffer, Zeit am Punkt und den Sieg. Ein Versuch.',
    einst:[
      { id:'karte', name:'Karte', std:'border', werte:[['border', 'Grenzposten'], ['quarry', 'Steinbruch'], ['valley', 'Flusstal']] },
      { id:'panzer', name:'Panzer', std:'luchs', werte:[['luchs', 'Luchs'], ['keiler', 'Keiler']] }
    ]
  },
  leben:{
    sp:'lifesim', name:'LifeSim', emoji:'🏙️', pfad:'/', wertung:'wert',
    online:'https://lifesim-842c.onrender.com', lokal:3000,
    regel:'Vermögens-Sprint: Jeder startet mit einer frischen Figur und 500 €. Wer nach Ablauf der Zeit am meisten Vermögen dazugewonnen hat, gewinnt.',
    einst:[
      { id:'minuten', name:'Dauer', std:8, werte:[[5, '5 Min.'], [8, '8 Min.'], [12, '12 Min.']] }
    ]
  }
};

// Adresse eines Spiels: auf Render die echte, lokal der Port aus .claude/launch.json.
// Überschreiben geht mit SPIEL_URL_<SCHLÜSSEL>, z. B. SPIEL_URL_KART=http://localhost:10101
function spielUrl(spiel){
  const eigen = process.env['SPIEL_URL_' + spiel.toUpperCase()];
  if (eigen) return eigen.replace(/\/+$/, '');
  return process.env.RENDER ? SPIELE[spiel].online : `http://localhost:${SPIELE[spiel].lokal}`;
}

module.exports = { SPIELE, spielUrl };
