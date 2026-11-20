// ─────────────────────────────────────────────────────────────
//  Configuration du site « Opération 40 »
// ─────────────────────────────────────────────────────────────

// Config Firebase (Paramètres du projet › Général › Vos applications › Web).
// Ce n'est pas un secret : la sécurité vient des règles (database.rules.json).
// Remettre à null pour repasser en « mode démo » (dispos sur l'appareil seulement).
export const firebaseConfig = {
  apiKey: 'AIzaSyDjQYxPYZPjqpnX8VAB1gPW8mK1qkPB4OI',
  authDomain: 'operation-40-ac0ba.firebaseapp.com',
  databaseURL: 'https://operation-40-ac0ba-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'operation-40-ac0ba',
  storageBucket: 'operation-40-ac0ba.firebasestorage.app',
  messagingSenderId: '106247171125',
  appId: '1:106247171125:web:5110f713d4bec0284b957c',
};

// Dossier de la base Realtime Database où tout est rangé.
export const ROOT = 'trip40';

// Les mois proposés (mois numérotés de 1 à 12).
export const MONTHS = [
  { y: 2027, m: 6 },
  { y: 2027, m: 7 },
];

// Les destinations de la roue.
export const CITIES = [
  { id: 'dublin', name: 'Dublin', emoji: '🍀', color: '#169b62', ink: '#ffffff',
    fact: 'Pintes de Guinness, Temple Bar et musique live à chaque coin de rue.' },
  { id: 'liverpool', name: 'Liverpool', emoji: '🎸', color: '#e63946', ink: '#ffffff',
    fact: 'La ville des Beatles, Anfield et les quais de l’Albert Dock.' },
  { id: 'manchester', name: 'Manchester', emoji: '🐝', color: '#ffb703', ink: '#141c3f',
    fact: 'Une abeille pour emblème, deux clubs mythiques et des nuits qui finissent tard.' },
  { id: 'belfast', name: 'Belfast', emoji: '🚢', color: '#1d4e89', ink: '#ffffff',
    fact: 'Le Titanic y est né, et la Chaussée des Géants est à une heure de route.' },
];

// Le maillot de chacun, aux couleurs d'une équipe NFL (sans logo).
// body : le maillot · stripes : bandes des manches (de la plus proche du poignet)
// collar : le col · num / numLine : les initiales et leur liseré · team : surnom affiché
// tagBg / tagInk (facultatif) : couleurs de l'étiquette du surnom (sinon body / num)
export const KITS = {
  felix:  { team: 'Vikings',  body: '#4f2683', stripes: ['#ffc62f', '#ffffff', '#ffc62f'], collar: '#ffc62f', num: '#ffffff', numLine: '#ffc62f' },
  benj:   { team: 'Dolphins', body: '#008e97', stripes: ['#ffffff', '#fc4c02', '#ffffff'], collar: '#fc4c02', num: '#ffffff', numLine: '#fc4c02' },
  jo:     { team: '49ers',    body: '#aa0000', stripes: ['#ffffff', '#b3995d', '#ffffff'], collar: '#b3995d', num: '#ffffff', numLine: '#b3995d' },
  franck: { team: 'Saints',   body: '#101820', stripes: ['#d3bc8d', '#ffffff', '#d3bc8d'], collar: '#d3bc8d', num: '#ffffff', numLine: '#d3bc8d' },
  adrian: { team: 'Patriots', body: '#002244', stripes: ['#ffffff', '#c60c30', '#ffffff'], collar: '#c60c30', num: '#ffffff', numLine: '#c60c30' },
  yo:     { team: 'OM',       body: '#ffffff', stripes: ['#009ddc', null, '#009ddc'],      collar: '#009ddc', num: '#009ddc', numLine: '#ffffff', tagBg: '#009ddc', tagInk: '#ffffff' },
};

// Données de départ (reprises du calendrier v6). Elles ne sont écrites
// qu'une seule fois, quand la base est encore vide.
export const SEED = {
  people: [
    { id: 'jo', name: 'Jo', note: 'Dispo partout.' },
    { id: 'yo', name: 'Yo', note: 'Peut-être partout.' },
    { id: 'benj', name: 'Benj', note: 'Dispo du 1er au 11 juin, week-end de 3 jours du 3 au 5 juillet, vacances scolaires à partir du 23 juillet.' },
    { id: 'felix', name: 'Félix', note: 'Pas dispo en juin, dispo en juillet.' },
    { id: 'adrian', name: 'Adrian', note: 'En compétition du 9 au 11 juillet.' },
    { id: 'franck', name: 'Franck', note: 'Dispo sûr du 12 au 16 juillet, peut-être le reste.' },
  ],
  // [personne, du, au, statut] : les lignes suivantes écrasent les précédentes.
  ranges: [
    ['jo', '2027-06-01', '2027-07-31', 'ok'],
    ['yo', '2027-06-01', '2027-07-31', 'maybe'],
    ['benj', '2027-06-01', '2027-06-11', 'ok'],
    ['benj', '2027-06-12', '2027-07-02', 'no'],
    ['benj', '2027-07-03', '2027-07-05', 'ok'],
    ['benj', '2027-07-06', '2027-07-22', 'no'],
    ['benj', '2027-07-23', '2027-07-31', 'ok'],
    ['felix', '2027-06-01', '2027-06-30', 'no'],
    ['felix', '2027-07-01', '2027-07-31', 'ok'],
    ['adrian', '2027-06-01', '2027-07-31', 'ok'],
    ['adrian', '2027-07-09', '2027-07-11', 'no'],
    ['franck', '2027-06-01', '2027-07-31', 'maybe'],
    ['franck', '2027-07-12', '2027-07-16', 'ok'],
  ],
};
