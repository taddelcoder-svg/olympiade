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
    sp:'ironhorizon', name:'Iron Horizon', emoji:'🛡️', pfad:'/iron-horizon/', wertung:'wert', gruppeMax:6,
    online:'https://iron-horizon.onrender.com', lokal:10400,
    regel:'Online-Panzergefecht gegeneinander: Eure Gruppe wird auf Blau und Rot verteilt, freie Plätze fahren Bots, jeder wählt seinen Panzer. Punkte für den Sieg deines Teams, Abschüsse, Treffer und Zeit am Punkt. Ab 7 Leuten gibt es mehrere Gefechte, gewertet wird zusammen nach Punkten.',
    einst:[
      { id:'karte', name:'Karte', std:'border', werte:[['border', 'Grenzposten'], ['quarry', 'Steinbruch'], ['valley', 'Flusstal']] },
      { id:'modus', name:'Modus', std:'domination', werte:[['domination', 'Vorherrschaft'], ['attack', 'Durchbruch']] },
      { id:'bots', name:'Bots', std:'veteran', werte:[['recruit', 'Rekrut'], ['veteran', 'Veteran'], ['ace', 'Ass']] }
    ]
  },
  leben:{
    sp:'lifesim', name:'LifeSim', emoji:'🏙️', pfad:'/', wertung:'wert',
    online:'https://lifesim-842c.onrender.com', lokal:3000,
    regel:'Vermögens-Sprint: Jeder startet mit einer frischen Figur und 500 €. Wer nach Ablauf der Zeit am meisten Vermögen dazugewonnen hat, gewinnt.',
    einst:[
      { id:'minuten', name:'Dauer', std:8, werte:[[5, '5 Min.'], [8, '8 Min.'], [12, '12 Min.']] }
    ]
  },
  fussball:{
    sp:'futbolero', name:'Futbolero', emoji:'⚽', pfad:'/', wertung:'rang', gruppeMax:8,
    online:'https://futbolero-nynr.onrender.com', lokal:10600,
    regel:'Ein Online-Spiel eurer Gruppe: Ihr werdet auf zwei Teams verteilt, jeder steuert einen Spieler, freie Plätze spielt der Computer. Das Siegerteam liegt vorn, innerhalb eines Teams zählen die eigenen Tore. Ab 9 Leuten gibt es mehrere Spiele, gewertet wird zusammen.',
    einst:[
      { id:'stufe', name:'Computer', std:'normal', werte:[['leicht', 'Leicht'], ['normal', 'Normal'], ['schwer', 'Schwer']] },
      { id:'dauer', name:'Spielzeit', std:4, werte:[[2, '2 Min.'], [4, '4 Min.'], [6, '6 Min.']] },
      { id:'groesse', name:'Spieler', std:5, werte:[[5, '5 gegen 5'], [7, '7 gegen 7']] }
    ]
  },
  tuerme:{
    sp:'pingutowers', name:'Pingu Towers', emoji:'🐧', pfad:'/', wertung:'wert',
    online:'https://pingutowers.onrender.com', lokal:10700,
    regel:'Tower-Defense: Jeder verteidigt allein denselben Eiskanal mit Pinguinen und einem Helden gegen dieselben Fischwellen, ein Versuch. Wer die meisten Runden schafft, gewinnt – bei Gleichstand zählen die übrigen Leben.',
    einst:[
      { id:'karte', name:'Karte', std:'scholle', werte:[['scholle', 'Eisscholle'], ['bucht', 'Pinguinbucht'], ['spalte', 'Gletscherspalte'], ['erebus', 'Erebus-Krater'], ['nacht', 'Polarnacht'], ['doppel', 'Doppelstrom']] },
      { id:'stufe', name:'Schwierigkeit', std:'mittel', werte:[['leicht', 'Leicht'], ['mittel', 'Mittel'], ['schwer', 'Schwer']] },
      { id:'runden', name:'Runden', std:30, werte:[[20, '20 Runden'], [30, '30 Runden'], [40, '40 Runden']] }
    ]
  },
  boxen:{
    sp:'ringfieber', name:'Ringfieber', emoji:'🥊', pfad:'/', wertung:'rang', gruppeMax:16,
    online:'https://boxing-w060.onrender.com', lokal:10800,
    regel:'Boxturnier im K.-o.-System: Ihr boxt eins gegen eins, wer verliert, scheidet aus und schaut zu – mit Kampf um Platz 3. Dahinter zählt, wie weit man kam und wie viel Schaden man austeilte.',
    einst:[
      { id:'dauer', name:'Kampfdauer', std:90, werte:[[60, '60 Sek.'], [90, '90 Sek.'], [120, '2 Min.']] },
      { id:'platz3', name:'Kampf um Platz 3', std:1, werte:[[1, 'Ja'], [0, 'Nein']] }
    ]
  },
  kueche:{
    sp:'loewenkueche', name:'Löwenküche', emoji:'🦁', pfad:'/', wertung:'rang', gruppeMax:12,
    online:'https://l-wenk-che.onrender.com', lokal:10900,
    regel:'Koch-Schicht: Jeder kocht in seiner eigenen Küche, alle bekommen denselben Ansturm an Gästen. Wer am Ende am meisten verdient hat, gewinnt – Trinkgeld gibt es für schnelles Servieren, wütende Gäste kosten Münzen.',
    einst:[
      { id:'menu', name:'Gerichte', std:'einfach', werte:[['einfach', 'Salat & Burger'], ['mittel', '+ Steak & Pommes'], ['voll', '+ Pizza']] },
      { id:'dauer', name:'Dauer', std:240, werte:[[180, '3 Min.'], [240, '4 Min.'], [300, '5 Min.']] }
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
