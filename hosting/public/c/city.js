// The city page (/c/{areaId}, DESIGN.md §3.1 step 12). Reads the area id from the path and shows the city's name.
// Static, no requests, no cookies, no storage. Keep CITIES in step with packages/core/src/geo/areas.json
// (packages/core/test/geo.test.ts checks it).
/* global document, window */
'use strict';
var CITIES = {
  aarhus: { da: 'Aarhus', en: 'Aarhus' },
  copenhagen: { da: 'København', en: 'Copenhagen' },
  aalborg: { da: 'Aalborg', en: 'Aalborg' },
  odense: { da: 'Odense', en: 'Odense' },
  vejle: { da: 'Vejle', en: 'Vejle' },
};

document.addEventListener('DOMContentLoaded', function () {
  var match = /^\/c\/([a-z][a-z0-9-]{1,31})\/?$/.exec(window.location.pathname);
  var city = match && Object.prototype.hasOwnProperty.call(CITIES, match[1]) ? CITIES[match[1]] : null;
  if (!city) return;
  document.title = 'Grouper ' + city.en;
  document.getElementById('title').textContent = 'Grouper · ' + city.en + ' / ' + city.da;
  document.getElementById('lead-en').textContent =
    'Grouper is opening in ' + city.en + '. Join the waitlist in the app: the more people in ' + city.en + ' sign up, the sooner it opens.';
  document.getElementById('lead-da').textContent =
    'Grouper åbner i ' + city.da + '. Skriv dig på ventelisten i appen: jo flere i ' + city.da + ' der tilmelder sig, jo før åbner vi.';
});
