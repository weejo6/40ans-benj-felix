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
