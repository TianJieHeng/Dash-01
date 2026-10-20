// Mock data for the prototype. Everything is relative to "today" so the demo always looks current.
window.DATA = (function () {
  var base = new Date();
  base.setHours(0, 0, 0, 0);

  function at(d, hm) {
    var p = hm.split(':');
    var x = new Date(base);
    x.setDate(x.getDate() + d);
    x.setHours(+p[0], +p[1], 0, 0);
    return x;
  }
  var n = 0;
  function ev(d, s, e, title, people, extra) {
    return Object.assign({ id: 'e' + (++n), start: at(d, s), end: at(d, e), title: title, people: people }, extra || {});
  }
  function allDay(d, days, title, people, extra) {
    return Object.assign({ id: 'e' + (++n), allDay: true, start: at(d, '00:00'), end: at(d + days, '00:00'), title: title, people: people }, extra || {});
  }

  var ALL = ['alex', 'jordan', 'maya', 'otto'];

  var people = [
    { id: 'alex', name: 'Max', color: '#2D5BFF', rgb: '45 91 255', ink: '#FFFFFF', home: true, status: 'Home' },
    { id: 'jordan', name: 'Maya', color: '#E4007C', rgb: '228 0 124', ink: '#FFFFFF', home: true, status: 'Home' },
    { id: 'maya', name: 'Leo', age: 10, color: '#378B72', rgb: '55 139 114', ink: '#FFFFFF', home: false, status: 'School', returnAt: '16:10' },
    { id: 'otto', name: 'Emi', age: 6, color: '#FFB000', rgb: '255 176 0', ink: '#111111', home: true, status: 'Home' }
  ];
  var family = { id: 'family', name: 'Family', color: '#111111', rgb: '17 17 17', ink: '#FFFFFF' };

  // ---------------------------------------------------------------- calendar
  var events = [
    // Today: corrected approved preview fixture. Names and locations are demonstration data.
    allDay(0, 1, 'School spirit day', ['otto']),
    allDay(0, 1, 'Recycling night', ALL),
    ev(0, '07:00', '07:45', 'Gym', ['jordan'], { loc: 'Gym' }),
    ev(0, '08:15', '08:40', 'School drop-off', ['alex'], { travel: 10, loc: 'School' }),
    ev(0, '09:30', '10:30', 'Design review', ['jordan'], { loc: 'Office' }),
    ev(0, '13:00', '14:00', 'Lunch with Sam', ['alex'], { loc: 'Café' }),
    ev(0, '16:30', '17:30', 'Leo’s football practice', ['maya', 'alex'], { shortTitle: 'Football practice', icon: 'ball', travel: 20, loc: 'Riverside Field', notes: 'Bring shin guards and a water bottle. Travel is a demo estimate, not live traffic.' }),
    ev(0, '17:00', '17:40', 'Groceries', ['jordan'], { icon: 'cart' }),
    ev(0, '17:00', '17:45', 'Piano lesson', ['otto'], { icon: 'music', loc: 'Music studio' }),
    ev(0, '18:00', '18:45', 'Dinner', ALL, { icon: 'utensils', loc: 'Home' }),
    ev(0, '19:00', '19:30', 'Homework', ['maya'], { icon: 'book' }),
    ev(0, '19:30', '20:00', 'Reading', ['alex'], { icon: 'book' }),
    ev(0, '20:00', '20:20', 'Pack school bag', ['maya']),
    ev(0, '20:30', '20:45', 'Water the plants', ['alex']),

    // Tomorrow → +6
    allDay(1, 3, 'Max in Montréal', ['alex'], { loc: 'Hotel William Gray' }),
    ev(1, '07:00', '07:45', 'Gym', ['jordan'], { loc: 'Iron Works' }),
    ev(1, '08:15', '08:40', 'School drop-off', ['jordan'], { travel: 10 }),
    ev(1, '10:30', '11:15', 'Vet — Biscuit', ['jordan'], { travel: 10, loc: 'Riverdale Animal Clinic' }),
    ev(1, '15:30', '16:30', 'Art club', ['maya'], { loc: 'School' }),
    ev(1, '16:00', '18:00', 'Playdate with Leo', ['otto'], { travel: 8, loc: "Leo's house" }),
    ev(1, '19:00', '21:00', 'Book club', ['jordan'], { travel: 10, loc: "Priya's" }),

    ev(2, '09:00', '14:00', 'Science Centre trip', ['otto'], { loc: 'Ontario Science Centre' }),
    ev(2, '13:00', '13:45', 'Haircuts', ['maya', 'otto'], { travel: 10, loc: 'Snip Snip Kids' }),
    ev(2, '16:30', '18:00', 'Soccer practice', ['maya'], { travel: 20, loc: 'Lakeshore Fields' }),
    ev(2, '18:00', '19:30', 'Pizza night', ALL),

    ev(3, '10:00', '10:45', 'Swim lessons', ['otto'], { travel: 12, loc: 'Wellesley Pool' }),
    ev(3, '11:00', '12:00', 'Grocery run', ['jordan']),
    ev(3, '13:00', '15:30', "Zoe's birthday party", ['maya'], { travel: 15, loc: 'Pottery Place' }),
    ev(3, '19:00', '21:00', 'Movie night', ALL),

    ev(4, '10:30', '12:00', 'Sunday brunch', ALL, { travel: 15, loc: 'Lady Marmalade' }),
    ev(4, '17:05', '18:20', 'Flight home · AC 418', ['alex'], { loc: 'YUL → YYZ' }),

    ev(5, '07:00', '07:45', 'Gym', ['jordan']),
    ev(5, '15:45', '16:30', 'Piano lesson', ['otto'], { travel: 12 }),
    ev(5, '16:30', '18:00', 'Soccer practice', ['maya'], { travel: 20 }),
    ev(5, '19:00', '20:00', 'Yoga', ['jordan']),

    allDay(6, 2, 'Grandma visits', ALL),
    ev(6, '09:00', '09:45', 'Dentist', ['otto'], { travel: 15, loc: 'Bright Smiles Dental' }),
    ev(6, '16:30', '18:00', 'Soccer practice', ['maya'], { travel: 20 })
  ];

  // Background recurring events so the month view has texture
  for (var d = -40; d <= 45; d++) {
    if (d >= 0 && d <= 6) continue;
    var dow = new Date(at(d, '00:00')).getDay();
    if (dow === 1) events.push(ev(d, '15:45', '16:30', 'Piano lesson', ['otto']));
    if (dow === 2 || dow === 4) events.push(ev(d, '16:30', '18:00', 'Soccer practice', ['maya']));
    if (dow === 3) events.push(ev(d, '19:00', '20:00', 'Yoga', ['jordan']));
    if (dow === 6) events.push(ev(d, '10:00', '10:45', 'Swim lessons', ['otto']));
    if (dow === 0) events.push(ev(d, '17:30', '19:30', "Dinner at Nonna's", ALL));
    if (dow === 5 && d % 2 === 0) events.push(ev(d, '18:00', '19:30', 'Pizza night', ALL));
    if (d % 9 === 0) events.push(ev(d, '12:00', '13:00', 'Lunch meeting', ['alex']));
    if (d % 11 === 0) events.push(ev(d, '09:00', '10:00', 'Doctor', ['jordan']));
  }
  events.push(allDay(12, 1, "Leo's birthday 🎂", ALL));
  events.push(allDay(-8, 3, 'Cottage weekend', ALL));

  // Extra events for the "overloaded day" demo
  var busyExtras = [
    ev(0, '10:00', '11:00', 'Plumber window', ['jordan']),
    ev(0, '11:00', '11:30', 'Call with bank', ['alex']),
    ev(0, '14:30', '15:30', 'Library volunteer', ['jordan']),
    ev(0, '15:30', '16:00', 'Snack prep', ['maya']),
    ev(0, '16:00', '16:45', 'Math tutor', ['otto']),
    ev(0, '16:15', '17:00', 'Swim make-up', ['otto'], { travel: 10 }),
    ev(0, '19:45', '20:30', 'Bake sale prep', ['maya', 'jordan']),
    ev(0, '20:30', '21:30', 'Hockey', ['alex'], { travel: 15 })
  ];

  // ---------------------------------------------------------------- chores
  var routines = [
    { id: 'morning', name: 'Morning', range: '6 – 11 AM', from: 0, to: 11 },
    { id: 'after', name: 'After school', range: '11 AM – 5 PM', from: 11, to: 17 },
    { id: 'evening', name: 'Evening', range: '5 – 10 PM', from: 17, to: 24 }
  ];
  var cid = 0;
  function chore(r, who, title, emoji, stars, done, extra) {
    return Object.assign({ id: 'c' + (++cid), r: r, who: who, title: title, emoji: emoji, stars: stars, done: !!done }, extra || {});
  }
  var chores = [
    chore('morning', 'maya', 'Make bed', '🛏️', 1, true),
    chore('morning', 'maya', 'Brush teeth', '🪥', 1, true),
    chore('morning', 'maya', 'Pack backpack', '🎒', 1, true),
    chore('morning', 'otto', 'Make bed', '🛏️', 1, true),
    chore('morning', 'otto', 'Brush teeth', '🪥', 1, true),
    chore('morning', 'otto', 'Get dressed', '👕', 1, false),
    chore('morning', 'alex', 'School drop-off', '🚗', 0, true),
    chore('morning', 'jordan', 'Pack lunches', '🥪', 0, true),
    chore('morning', 'any', 'Feed Biscuit', '🐶', 1, true),

    chore('after', 'maya', 'Unpack lunchbox', '🥪', 1, true),
    chore('after', 'maya', 'Homework', '📚', 2, false),
    chore('after', 'maya', 'Pack soccer bag', '⚽', 1, false),
    chore('after', 'otto', 'Unpack lunchbox', '🥪', 1, true),
    chore('after', 'otto', 'Read for 20 min', '📖', 2, false),
    chore('after', 'otto', 'Practice piano', '🎹', 2, false),
    chore('after', 'otto', 'Tidy the Lego', '🧱', 1, false),
    chore('after', 'alex', 'Take out recycling', '♻️', 0, false, { overdue: true }),
    chore('after', 'alex', 'Call the plumber', '☎️', 0, true),
    chore('after', 'jordan', 'Fold laundry', '🧺', 0, false),
    chore('after', 'jordan', 'Order Zoe’s gift', '🎁', 0, true),
    chore('after', 'any', 'Water the plants', '🪴', 1, false),
    chore('after', 'any', 'Empty dishwasher', '🍽️', 2, false),
    chore('after', 'any', 'Walk Biscuit', '🐕', 2, true),

    chore('evening', 'maya', 'Set the table', '🍴', 1, false),
    chore('evening', 'maya', 'Lay out clothes', '👕', 1, false),
    chore('evening', 'maya', 'Shower', '🚿', 1, false),
    chore('evening', 'otto', 'Clear plates', '🍽️', 1, false),
    chore('evening', 'otto', 'Bath', '🛁', 1, false),
    chore('evening', 'otto', 'Lay out clothes', '👕', 1, false),
    chore('evening', 'alex', 'Lock up', '🔐', 0, false),
    chore('evening', 'jordan', 'Run dishwasher', '🫧', 0, false),
    chore('evening', 'any', 'Wipe counters', '🧽', 1, false),
    chore('evening', 'any', 'Garbage to curb', '🗑️', 2, false)
  ];
  var stars = { maya: 42, otto: 57 };
  // Mon..Sun, 1 = all chores done, 0 = missed, null = future
  var week = { maya: [1, 1, 0, 1, 1, 0, 1], otto: [1, 0, 1, 1, 1, 1, 0] };

  // ---------------------------------------------------------------- shopping
  var stores = [{ id: 'grocer', name: 'FreshCo' }, { id: 'costco', name: 'Costco' }];
  var catOrder = {
    all: ['Produce', 'Bakery', 'Meat & Fish', 'Dairy & Eggs', 'Pantry', 'Frozen', 'Snacks', 'Household'],
    grocer: ['Produce', 'Bakery', 'Meat & Fish', 'Dairy & Eggs', 'Pantry', 'Frozen', 'Snacks', 'Household'],
    costco: ['Household', 'Pantry', 'Snacks', 'Dairy & Eggs', 'Meat & Fish', 'Frozen', 'Produce', 'Bakery']
  };
  var gid = 0;
  function g(name, cat, qty, store, done, note) {
    return { id: 'g' + (++gid), name: name, cat: cat, qty: qty, store: store, done: !!done, note: note || '' };
  }
  var groceries = [
    g('Bananas', 'Produce', 1, 'grocer', false, 'Bunch, not too ripe'),
    g('Baby spinach', 'Produce', 1, 'grocer'),
    g('Avocados', 'Produce', 3, 'grocer'),
    g('Honeycrisp apples', 'Produce', 6, 'grocer'),
    g('Sourdough loaf', 'Bakery', 1, 'grocer'),
    g('Bagels', 'Bakery', 2, 'costco', false, 'Everything'),
    g('Chicken thighs', 'Meat & Fish', 1, 'grocer', false, 'Boneless'),
    g('Salmon fillets', 'Meat & Fish', 2, 'grocer'),
    g('Milk 2%', 'Dairy & Eggs', 2, 'costco'),
    g('Eggs', 'Dairy & Eggs', 1, 'costco', false, '2 dozen'),
    g('Greek yogurt', 'Dairy & Eggs', 1, 'grocer'),
    g('Aged cheddar', 'Dairy & Eggs', 1, 'grocer'),
    g('Rigatoni', 'Pantry', 2, 'grocer'),
    g('Olive oil', 'Pantry', 1, 'costco'),
    g('Coffee beans', 'Pantry', 1, 'grocer', false, 'Dark roast'),
    g('Frozen peas', 'Frozen', 1, 'grocer'),
    g('Waffles', 'Frozen', 1, 'grocer'),
    g('Goldfish crackers', 'Snacks', 1, 'costco'),
    g('Granola bars', 'Snacks', 1, 'grocer'),
    g('Paper towels', 'Household', 1, 'costco'),
    g('Dish soap', 'Household', 1, 'grocer'),
    g('Lemons', 'Produce', 2, 'grocer', true),
    g('Butter', 'Dairy & Eggs', 1, 'grocer', true),
    g('Tortillas', 'Bakery', 1, 'grocer', true)
  ];
  var catalog = [
    ['Apples', 'Produce'], ['Avocados', 'Produce'], ['Bananas', 'Produce'], ['Baby spinach', 'Produce'], ['Blueberries', 'Produce'],
    ['Broccoli', 'Produce'], ['Carrots', 'Produce'], ['Cucumber', 'Produce'], ['Garlic', 'Produce'], ['Grapes', 'Produce'],
    ['Lemons', 'Produce'], ['Limes', 'Produce'], ['Onions', 'Produce'], ['Potatoes', 'Produce'], ['Strawberries', 'Produce'],
    ['Tomatoes', 'Produce'], ['Bread', 'Bakery'], ['Bagels', 'Bakery'], ['Croissants', 'Bakery'], ['Sourdough loaf', 'Bakery'],
    ['Tortillas', 'Bakery'], ['Hamburger buns', 'Bakery'], ['Bacon', 'Meat & Fish'], ['Chicken breasts', 'Meat & Fish'],
    ['Chicken thighs', 'Meat & Fish'], ['Ground beef', 'Meat & Fish'], ['Salmon fillets', 'Meat & Fish'], ['Shrimp', 'Meat & Fish'],
    ['Butter', 'Dairy & Eggs'], ['Cheddar', 'Dairy & Eggs'], ['Cream cheese', 'Dairy & Eggs'], ['Eggs', 'Dairy & Eggs'],
    ['Greek yogurt', 'Dairy & Eggs'], ['Milk 2%', 'Dairy & Eggs'], ['Oat milk', 'Dairy & Eggs'], ['Parmesan', 'Dairy & Eggs'],
    ['Black beans', 'Pantry'], ['Cereal', 'Pantry'], ['Coffee beans', 'Pantry'], ['Flour', 'Pantry'], ['Honey', 'Pantry'],
    ['Maple syrup', 'Pantry'], ['Olive oil', 'Pantry'], ['Pasta sauce', 'Pantry'], ['Peanut butter', 'Pantry'], ['Rice', 'Pantry'],
    ['Rigatoni', 'Pantry'], ['Spaghetti', 'Pantry'], ['Sugar', 'Pantry'], ['Tea', 'Pantry'], ['Frozen peas', 'Frozen'],
    ['Frozen berries', 'Frozen'], ['Ice cream', 'Frozen'], ['Pizza', 'Frozen'], ['Waffles', 'Frozen'], ['Chips', 'Snacks'],
    ['Crackers', 'Snacks'], ['Dark chocolate', 'Snacks'], ['Goldfish crackers', 'Snacks'], ['Granola bars', 'Snacks'],
    ['Popcorn', 'Snacks'], ['Dish soap', 'Household'], ['Dishwasher pods', 'Household'], ['Garbage bags', 'Household'],
    ['Laundry detergent', 'Household'], ['Paper towels', 'Household'], ['Toilet paper', 'Household'], ['Toothpaste', 'Household']
  ];
  var usuals = ['Milk', 'Eggs', 'Bread', 'Bananas', 'Apples', 'Rice', 'Yogurt', 'Coffee', 'Pasta', 'Cheese', 'Tomatoes', 'Soap'];

  // ---------------------------------------------------------------- home control
  var rooms = [
    { id: 'kitchen', name: 'Kitchen' },
    { id: 'living', name: 'Living Room' },
    { id: 'entry', name: 'Entry + Garage' },
    { id: 'upstairs', name: 'Upstairs' },
    { id: 'yard', name: 'Backyard' }
  ];
  var devices = [
    { id: 'k-pend', room: 'kitchen', type: 'light', name: 'Pendants', on: true, level: 80 },
    { id: 'k-under', room: 'kitchen', type: 'light', name: 'Under Cabinet', on: true, level: 55 },
    { id: 'k-island', room: 'kitchen', type: 'light', name: 'Island', on: false, level: 100 },
    { id: 'k-speaker', room: 'kitchen', type: 'blind', name: 'Window Shade', pos: 100 },
    { id: 'l-lamp', room: 'living', type: 'light', name: 'Floor Lamp', on: true, level: 45 },
    { id: 'l-ceil', room: 'living', type: 'light', name: 'Ceiling', on: false, level: 100 },
    { id: 'l-blinds', room: 'living', type: 'blind', name: 'Blinds', pos: 60 },
    { id: 'l-fire', room: 'living', type: 'light', name: 'Mantel', on: false, level: 70 },
    { id: 'e-door', room: 'entry', type: 'lock', name: 'Front Door', locked: true },
    { id: 'e-porch', room: 'entry', type: 'light', name: 'Porch', on: true, level: 100 },
    { id: 'g-door', room: 'entry', type: 'garage', name: 'Garage', state: 'closed' },
    { id: 'g-side', room: 'entry', type: 'lock', name: 'Side Door', locked: true },
    { id: 'u-maya', room: 'upstairs', type: 'light', name: "Leo's Lamp", on: true, level: 30 },
    { id: 'u-otto', room: 'upstairs', type: 'light', name: "Emi's Nightlight", on: false, level: 15 },
    { id: 'u-hall', room: 'upstairs', type: 'light', name: 'Hallway', on: false, level: 60 },
    { id: 'u-bath', room: 'upstairs', type: 'light', name: 'Bathroom', on: false, level: 100 },
    { id: 'y-string', room: 'yard', type: 'light', name: 'String Lights', on: false, level: 100, flaky: true },
    { id: 'y-back', room: 'yard', type: 'lock', name: 'Back Door', locked: true },
    { id: 'y-flood', room: 'yard', type: 'light', name: 'Floodlight', on: false, level: 100 }
  ];
  var climate = { current: 22, set: 21.5, mode: 'heat', humidity: 42, outside: 14 };
  var media = { room: 'Kitchen', title: 'Harvest Moon', artist: 'Neil Young', playing: true, volume: 35, seed: 'harvest-vinyl' };
  var cameras = [
    { id: 'c-front', name: 'Front Porch', seed: 'porch-steps' },
    { id: 'c-drive', name: 'Driveway', seed: 'driveway-maple' },
    { id: 'c-yard', name: 'Backyard', seed: 'garden-yard' }
  ];
  var scenes = [
    { id: 'morning', name: 'Morning', icon: 'sunrise', set: { 'k-pend': 100, 'k-under': 80, 'l-blinds': 100, 'l-lamp': 0, 'u-hall': 60 } },
    { id: 'dinner', name: 'Dinner', icon: 'utensils', set: { 'k-pend': 55, 'k-under': 30, 'k-island': 70, 'l-lamp': 40, 'l-ceil': 0 } },
    { id: 'movie', name: 'Movie', icon: 'film', set: { 'k-pend': 0, 'k-under': 15, 'k-island': 0, 'l-lamp': 15, 'l-ceil': 0, 'l-blinds': 0, 'l-fire': 30 } },
    { id: 'away', name: 'Away', icon: 'away', set: { 'k-pend': 0, 'k-under': 0, 'k-island': 0, 'l-lamp': 0, 'l-ceil': 0, 'l-fire': 0, 'u-maya': 0, 'u-hall': 0, 'e-porch': 100 } },
    { id: 'night', name: 'Goodnight', icon: 'moon', set: { 'k-pend': 0, 'k-under': 10, 'k-island': 0, 'l-lamp': 0, 'l-ceil': 0, 'l-fire': 0, 'u-hall': 10, 'u-otto': 15, 'e-porch': 0 } }
  ];

  // ---------------------------------------------------------------- weather (index = hour of day)
  var weather = {
    hi: 27, lo: 19, feels: 24, humidity: 51, wind: 8, advice: 'Light jacket after sunset',
    t: [19, 19, 19, 19, 19, 19, 20, 21, 22, 23, 24, 25, 26, 27, 26, 24, 24, 24, 23, 22, 21, 20, 19, 19],
    c: ['moon', 'moon', 'moon', 'moon', 'moon', 'moon', 'partly', 'partly', 'sun', 'sun', 'sun', 'partly', 'partly', 'partly', 'partly', 'partly', 'sun', 'sun', 'partly', 'cloud', 'cloud', 'cloud', 'moon', 'moon'],
    p: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 10, 10, 10, 10, 10, 10, 10, 15, 15, 10, 0, 0]
  };

  // ---------------------------------------------------------------- photos
  var t = new Date(base);
  var mmdd = ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
  var photos = [
    { seed: 'tofino-surf', o: 'l', date: '2021-' + mmdd, place: 'Tofino, BC', from: 'jordan', tag: 'tofino' },
    { seed: 'cottage-dock', o: 'l', date: '2023-08-12', place: 'Lake of Bays', from: 'alex', tag: 'cottage' },
    { seed: 'maya-kite', o: 'p', date: '2024-05-19', place: 'Humber Bay Park', from: 'jordan', tag: 'spring24' },
    { seed: 'otto-kite', o: 'p', date: '2024-05-19', place: 'Humber Bay Park', from: 'alex', tag: 'spring24' },
    { seed: 'autumn-walk', o: 'l', date: '2022-10-09', place: 'High Park', from: 'alex', tag: 'fall22' },
    { seed: 'birthday-cake', o: 'p', date: '2025-10-12', place: 'Home', from: 'jordan', tag: 'bday25' },
    { seed: 'candles-lit', o: 'p', date: '2025-10-12', place: 'Home', from: 'alex', tag: 'bday25' },
    { seed: 'mountain-lake', o: 'l', date: '2019-' + mmdd, place: 'Banff, AB', from: 'alex', tag: 'banff' },
    { seed: 'snow-day', o: 'l', date: '2024-01-21', place: 'Riverdale Hill', from: 'jordan', tag: 'winter24' },
    { seed: 'beach-dunes', o: 'l', date: '2023-07-02', place: 'Sandbanks', from: 'maya', tag: 'sandbanks' },
    { seed: 'city-night', o: 'l', date: '2022-12-18', place: 'Nathan Phillips Sq.', from: 'jordan', tag: 'xmas22' },
    { seed: 'garden-bloom', o: 'p', date: '2025-06-08', place: 'Backyard', from: 'otto', tag: 'garden' },
    { seed: 'tomato-haul', o: 'p', date: '2025-06-08', place: 'Backyard', from: 'maya', tag: 'garden' },
    { seed: 'road-trip', o: 'l', date: '2024-08-04', place: 'Cabot Trail, NS', from: 'alex', tag: 'ns' },
    { seed: 'campfire', o: 'l', date: '2024-08-06', place: 'Cape Breton', from: 'jordan', tag: 'ns' },
    { seed: 'forest-path', o: 'l', date: '2020-09-26', place: 'Algonquin', from: 'alex', tag: 'algonquin' },
    { seed: 'pancakes', o: 'p', date: '2026-03-14', place: 'Home', from: 'maya', tag: 'pancakes' },
    { seed: 'sugar-shack', o: 'p', date: '2026-03-14', place: 'Sugar Shack', from: 'jordan', tag: 'pancakes' },
    { seed: 'harbour-sail', o: 'l', date: '2025-07-19', place: 'Toronto Harbour', from: 'otto', tag: 'sail' },
    { seed: 'pumpkins', o: 'l', date: '2025-10-25', place: "Chudleigh's", from: 'maya', tag: 'fall25' }
  ];

  // ---------------------------------------------------------------- AI agent usage (CodexBar-style)
  // left = minutes until the window resets; win = window length in minutes (for pace)
  var H5 = 300, DAY = 1440, WEEK = 10080, MONTH = 43200;
  var agents = [
    {
      id: 'claude', name: 'Claude', plan: 'Max 20×', color: '#D97757', rgb: '217 119 87', status: 'ok',
      meters: [
        { label: 'Session', win: H5, used: 62, left: 134 },
        { label: 'Weekly · all models', win: WEEK, used: 41, left: 4680 }
      ],
      tokens: 3.1, cost: 21.4, week: [2.2, 3.8, 2.9, 4.4, 1.6, 0.8, 3.1]
    },
    {
      id: 'codex', name: 'Codex', plan: 'ChatGPT Pro', color: '#10A37F', rgb: '16 163 127', status: 'ok',
      meters: [
        { label: 'Session', win: H5, used: 88, left: 38 },
        { label: 'Weekly', win: WEEK, used: 57, left: 7320 }
      ],
      tokens: 4.6, cost: 17.9, week: [3.1, 2.4, 5.2, 4.0, 2.2, 1.1, 4.6]
    },
    {
      id: 'cursor', name: 'Cursor', plan: 'Pro+', color: '#111111', rgb: '17 17 17', status: 'ok',
      meters: [
        { label: 'Included usage', win: MONTH, used: 76, left: 17280, detail: '$45.60 of $60' },
        { label: 'On-demand', win: MONTH, used: 16, left: 17280, detail: '$8.20 of $50 cap' }
      ],
      tokens: 1.8, cost: 6.3, week: [1.2, 1.9, 0.7, 2.3, 1.5, 0.4, 1.8]
    },
    {
      id: 'gemini', name: 'Gemini', plan: 'AI Ultra', color: '#3F6FE4', rgb: '63 111 228', status: 'ok',
      meters: [
        { label: 'Requests · daily', win: DAY, used: 16, left: 522, detail: '320 of 2,000' },
        { label: 'Pro model · daily', win: DAY, used: 52, left: 522, detail: '104 of 200' }
      ],
      tokens: 0.9, cost: 0, week: [0.4, 1.1, 0.6, 0.2, 0.9, 1.3, 0.9]
    },
    {
      id: 'copilot', name: 'Copilot', plan: 'Pro+', color: '#8957E5', rgb: '137 87 229', status: 'degraded', incident: 'Elevated errors on coding agent',
      meters: [
        { label: 'Premium requests', win: MONTH, used: 75, left: 17280, detail: '1,124 of 1,500' },
        { label: 'Coding agent', win: MONTH, used: 38, left: 17280, detail: '19 of 50 sessions' }
      ],
      tokens: 1.2, cost: 0, week: [0.9, 1.4, 1.1, 0.8, 1.6, 0.3, 1.2]
    }
  ];

  // Shared preview configuration. Fixtures use the device's local household timezone.
  // A real provider should deliver timezone-normalized dates before replacing this model.
  var settings = { demo: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', temperatureUnit: 'C' };
  var security = { available: true, armed: true, source: 'demo' };
  chores.forEach(function (task) { task.due = task.r === 'morning' ? '09:00' : task.r === 'after' ? '17:00' : '21:00'; });
  var choresHistory = [];
  for (var ago = 6; ago > 0; ago--) {
    var historyDay = at(-ago, '00:00');
    var historyDate = historyDay.getFullYear() + '-' + ('0' + (historyDay.getMonth() + 1)).slice(-2) + '-' + ('0' + historyDay.getDate()).slice(-2);
    ALL.concat('any').forEach(function (who, index) {
      var total = chores.filter(function (c) { return c.r === 'after' && c.who === who; }).length;
      choresHistory.push({ date: historyDate, who: who, r: 'after', total: total, done: Math.max(0, total - ((ago + index) % 3 === 0 ? 1 : 0)), source: 'demo' });
    });
  }
  // Eight active items shared by the Today summary and full shopping view.
  var activeGroceries = ['g9', 'g4', 'g13', 'g10', 'g5', 'g1', 'g11', 'g21'];
  groceries.forEach(function (g) { g.done = activeGroceries.indexOf(g.id) < 0; if (g.id === 'g9') g.name = 'Milk'; if (g.id === 'g4') g.name = 'Apples'; if (g.id === 'g13') g.name = 'Rice'; });
  groceries.sort(function (a, b) { var ai = activeGroceries.indexOf(a.id), bi = activeGroceries.indexOf(b.id); return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi); });
  // Normalized raw usage fixtures coexist with legacy D.agents until the provider page migrates.
  var agentUsage = [
    { id:'claude',name:'Claude',plan:'Demo Pro',color:'#83C8AE',status:'ok',tokens:240000,cost:0,week:[180000,200000,190000,220000,240000,200000,240000],meters:[{label:'Session',used:420,quota:1000,unit:'credits',pace:50,reset:'02h 18m'},{label:'Weekly',used:6100000,quota:10000000,unit:'tokens',pace:60,reset:'2d 04h'}] },
    { id:'codex',name:'Codex',plan:'Demo API',color:'#9583BB',status:'ok',tokens:180000,cost:1.26,week:[140000,150000,145000,165000,180000,150000,180000],meters:[{label:'Daily',used:180,quota:500,unit:'requests',pace:50,reset:'12h'},{label:'Monthly',used:5800000,quota:10000000,unit:'tokens',pace:65,reset:'10d'}] },
    { id:'cursor',name:'Cursor',plan:'Demo Pro',color:'#7A9FC9',status:'ok',tokens:96000,cost:0,week:[80000,85000,80000,90000,95000,85000,96000],meters:[{label:'Daily',used:68,quota:100,unit:'requests',pace:50,reset:'12h'},{label:'Monthly',used:460,quota:500,unit:'requests',pace:65,reset:'10d'}] },
    { id:'gemini',name:'Gemini',plan:'Demo API',color:'#E0B35A',status:'degraded',incident:'Elevated response latency',tokens:120000,cost:0.42,week:[100000,110000,105000,110000,120000,105000,120000],meters:[{label:'Daily',used:140,quota:500,unit:'requests',pace:50,reset:'12h'},{label:'Monthly',used:4400000,quota:10000000,unit:'tokens',pace:65,reset:'10d'}] },
    { id:'copilot',name:'Copilot',plan:'Demo Pro',color:'#7D8C96',status:'ok',tokens:64000,cost:0,week:[60000,65000,60000,65000,65000,60000,64000],meters:[{label:'Daily',used:31,quota:100,unit:'requests',pace:50,reset:'12h'},{label:'Monthly',used:141,quota:300,unit:'requests',pace:65,reset:'10d'}] }
  ];
  // These are fixed, coherent illustrative snapshots, not advancing provider windows.
  var agentDates = ['2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18','2026-10-19','2026-10-20'];

  return {
    settings: settings, security: security, choresHistory: choresHistory, agentUsage: agentUsage, agentDates: agentDates,
    people: people, family: family, ALL: ALL,
    events: events, busyExtras: busyExtras,
    routines: routines, chores: chores, stars: stars, week: week,
    stores: stores, catOrder: catOrder, groceries: groceries, catalog: catalog, usuals: usuals,
    rooms: rooms, devices: devices, climate: climate, media: media, cameras: cameras, scenes: scenes,
    weather: weather, photos: photos, agents: agents,
    _gid: function () { return 'g' + (++gid); },
    _eid: function () { return 'e' + (++n); }
  };
})();
