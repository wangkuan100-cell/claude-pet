// Six evolution lines, each with six forms (egg -> ... -> legendary).
// `art` is the creature description fed to the image model (joined with STYLE).
// `emoji` is the placeholder shown until a generated PNG exists.
export const FORMS = ['egg', 'hatchling', 'juvenile', 'adolescent', 'adult', 'legendary'];

export const LINES = {
  phoenix: {
    name: '凤凰', emoji: '🔥',
    forms: {
      egg:        { emoji: '🥚', art: 'a warm orange speckled egg with tiny flame motifs' },
      hatchling:  { emoji: '🐣', art: 'a tiny fluffy orange chick hatching, soft embers around it' },
      juvenile:   { emoji: '🐤', art: 'a plump little chick with small glowing orange feathers' },
      adolescent: { emoji: '🐦', art: 'a young firebird with growing fiery plumage and bright eyes' },
      adult:      { emoji: '🦅', art: 'a majestic fire-hawk with blazing orange-gold wings' },
      legendary:  { emoji: '🔥', art: 'a glorious phoenix wreathed in radiant golden flames with long tail feathers' },
    },
  },
  dragon: {
    name: '龙王', emoji: '🐉',
    forms: {
      egg:        { emoji: '🥚', art: 'a green scaly egg with faint golden cracks' },
      hatchling:  { emoji: '🥚', art: 'a tiny green baby dragon poking out of its cracked shell' },
      juvenile:   { emoji: '🦎', art: 'a small round green dragon with stubby wings and big eyes' },
      adolescent: { emoji: '🐲', art: 'a young dragon with growing horns and bigger wings' },
      adult:      { emoji: '🐉', art: 'a strong adult dragon with full wings and curved horns' },
      legendary:  { emoji: '🐉', art: 'a mighty dragon king with golden horns, glowing aura and huge wings' },
    },
  },
  kitsune: {
    name: '九尾狐', emoji: '✨',
    forms: {
      egg:        { emoji: '🥚', art: 'a white egg with a soft pink swirl' },
      hatchling:  { emoji: '🐾', art: 'a tiny white fox kit with one little tail and big eyes' },
      juvenile:   { emoji: '🦊', art: 'a small fluffy fox with two tails' },
      adolescent: { emoji: '🦊', art: 'a young mystical fox with three softly glowing tails' },
      adult:      { emoji: '🦊', art: 'an elegant fox with several flowing glowing tails' },
      legendary:  { emoji: '✨', art: 'a divine nine-tailed kitsune with shimmering golden tails and a glowing forehead mark' },
    },
  },
  cerberus: {
    name: '地狱犬', emoji: '🐺',
    forms: {
      egg:        { emoji: '🥚', art: 'a dark grey egg with a faint red glow' },
      hatchling:  { emoji: '🐶', art: 'a tiny black puppy with big round eyes' },
      juvenile:   { emoji: '🐕', art: 'a small black dog with a little glowing collar' },
      adolescent: { emoji: '🐕', art: 'a young muscular hound with faint ember eyes' },
      adult:      { emoji: '🐺', art: 'a powerful black wolf-dog with glowing red eyes' },
      legendary:  { emoji: '🐺', art: 'a cute-but-fierce three-headed hellhound with ember-glowing maws' },
    },
  },
  sphinx: {
    name: '狮身兽', emoji: '🦁',
    forms: {
      egg:        { emoji: '🥚', art: 'a sandy egg with a small gold marking' },
      hatchling:  { emoji: '🐱', art: 'a tiny sandy kitten with big curious eyes' },
      juvenile:   { emoji: '🐱', art: 'a small cat with faint golden markings' },
      adolescent: { emoji: '🐈', art: 'a young cat with tiny feathered wing-buds' },
      adult:      { emoji: '🦁', art: 'a regal winged cat with a small mane and gold jewelry' },
      legendary:  { emoji: '🦁', art: 'a majestic winged sphinx-cat with a flowing mane and golden headdress' },
    },
  },
  golem: {
    name: '魔像王', emoji: '💎',
    forms: {
      egg:        { emoji: '🥚', art: 'a translucent green jelly egg' },
      hatchling:  { emoji: '🟢', art: 'a tiny glossy green slime droplet with sparkly eyes' },
      juvenile:   { emoji: '🟢', art: 'a round bouncy green slime with a happy face' },
      adolescent: { emoji: '🟩', art: 'a bigger green slime with small crystal shards forming inside' },
      adult:      { emoji: '💠', art: 'a large crystalline slime with a glowing gem core' },
      legendary:  { emoji: '💎', art: 'a towering crystal golem-king of gemstone slime with a glowing crown core' },
    },
  },
};

export const LINE_IDS = Object.keys(LINES);
export function lineFor(id) { return LINES[id] || null; }

// The egg hatches into a uniformly-random line — the user never chooses. rng is injectable for tests.
export function pickSpecies(rng = Math.random) {
  return LINE_IDS[Math.floor(rng() * LINE_IDS.length)];
}
