// Six evolution lines, each with six forms (egg -> ... -> legendary).
// `art` is the creature description fed to the image model (joined with STYLE).
// `emoji` is the placeholder shown until a generated PNG exists.
//
// All prompts are written in chibi Q-style: oversized round head, tiny body, big sparkling
// eyes, soft pastel palette. Every form should feel cute — even the legendary one is a chibi
// king, not a majestic adult — so the whole journey reads as a tiny mascot growing up.
export const FORMS = ['egg', 'hatchling', 'juvenile', 'adolescent', 'adult', 'legendary'];

export const LINES = {
  phoenix: {
    name: '凤凰', emoji: '🔥',
    forms: {
      egg:        { emoji: '🥚', art: 'a round warm-orange egg with cute tiny flame-shaped freckles on a glossy shell' },
      hatchling:  { emoji: '🐣', art: 'a tiny chibi orange chick peeking out of a cracked egg, big head small body, sparkling round eyes, a few soft little flames floating around it' },
      juvenile:   { emoji: '🐤', art: 'a chubby chibi orange birdie, oversized round head, fluffy little wing buds, a tiny flame tuft on top, big bright eyes' },
      adolescent: { emoji: '🐦', art: 'a chibi young phoenix, soft orange-red plumage, small open wings, a little flame mohawk, head still bigger than the body, gentle smile' },
      adult:      { emoji: '🦅', art: 'a chibi phoenix mascot, glossy gold-orange feathers, small fluffy spread wings, a short flame plume tail, round happy face' },
      legendary:  { emoji: '🔥', art: 'a chibi legendary phoenix king, sparkling golden feathers, a fluffy flame halo behind the head, a tiny glowing gem on the forehead, still big-head-small-body kawaii proportions' },
    },
  },
  dragon: {
    name: '龙王', emoji: '🐉',
    forms: {
      egg:        { emoji: '🥚', art: 'a round bright-green egg with a cute scale pattern and tiny gold cracks on a glossy shell' },
      hatchling:  { emoji: '🥚', art: 'a chibi green baby dragon poking out of a cracked shell, oversized round head, tiny tail, sparkling round eyes' },
      juvenile:   { emoji: '🦎', art: 'a chubby chibi green dragon, big round head, little stub wings, two tiny horns, round belly, soft glossy scales' },
      adolescent: { emoji: '🐲', art: 'a chibi young dragon, jade-green scales, curvy little horns, small folded wings, big curious eyes' },
      adult:      { emoji: '🐉', art: 'a chibi cute dragon mascot, soft green body, small golden horns, tiny spread wings, plump tail, glossy shading' },
      legendary:  { emoji: '🐉', art: 'a chibi legendary dragon king, bright emerald scales, golden curly horns, a tiny glowing orb floating beside it, still Q-style big-head-small-body proportions' },
    },
  },
  kitsune: {
    name: '九尾狐', emoji: '✨',
    forms: {
      egg:        { emoji: '🥚', art: 'a round pearl-white egg with a soft pink swirl on a glossy shell' },
      hatchling:  { emoji: '🐾', art: 'a chibi tiny white fox kit, oversized fluffy head, one little tail, big triangular ears with pink inside, sparkling round eyes' },
      juvenile:   { emoji: '🦊', art: 'a chibi white fox, two fluffy tails, big triangular pink-lined ears, round chubby body, gentle smile' },
      adolescent: { emoji: '🦊', art: 'a chibi mystical fox, three fluffy softly glowing tails, sparkling eyes, a tiny gem on the forehead' },
      adult:      { emoji: '🦊', art: 'a chibi multi-tailed fox, five soft golden floating tails, kawaii head-to-body proportions, glittery sparkling eyes' },
      legendary:  { emoji: '✨', art: 'a chibi legendary nine-tailed kitsune, nine fluffy golden tails fanning behind the head, a small red mark on the forehead, big head small body kawaii' },
    },
  },
  cerberus: {
    name: '地狱犬', emoji: '🐺',
    forms: {
      egg:        { emoji: '🥚', art: 'a round dark-purple egg with tiny cute paw-print patterns on a glossy shell' },
      hatchling:  { emoji: '🐶', art: 'a chibi tiny black puppy, oversized round head, big shiny round eyes, tiny ears up, plump body' },
      juvenile:   { emoji: '🐕', art: 'a chibi small black puppy, chubby body, a simple round collar, big round eyes, friendly face' },
      adolescent: { emoji: '🐕', art: 'a chibi black puppy with two tiny extra head-buds just emerging on top of its head, round and plump, bright happy eyes' },
      adult:      { emoji: '🐺', art: 'a chibi three-headed puppy, three tiny round dog heads side by side, plump body, all heads cute and friendly, not scary' },
      legendary:  { emoji: '🐺', art: 'a chibi legendary three-headed pup king, three round happy puppy heads, each wearing a tiny gold chain, soft little mist puffs at the paws, still Q-style proportions' },
    },
  },
  sphinx: {
    name: '狮身兽', emoji: '🦁',
    forms: {
      egg:        { emoji: '🥚', art: 'a round sandy-gold egg with cute tiny wing-shaped marks on a glossy shell' },
      hatchling:  { emoji: '🐱', art: 'a chibi tiny sandy kitten, oversized round head, big curious eyes, plump body, friendly face' },
      juvenile:   { emoji: '🐱', art: 'a chibi small cat with faint golden tabby markings, chubby round belly, big round ears, gentle smile' },
      adolescent: { emoji: '🐈', art: 'a chibi small cat with tiny fluffy wing-buds sprouting on its back, a thin golden collar, big eyes' },
      adult:      { emoji: '🦁', art: 'a chibi baby sphinx, round head round body, a pair of small spread feathered wings, a tiny gold tiara' },
      legendary:  { emoji: '🦁', art: 'a chibi legendary sphinx mascot, lifted tail, tiny spread golden wings, a miniature crown on its head, plump and cute not majestic' },
    },
  },
  golem: {
    name: '魔像王', emoji: '💎',
    forms: {
      egg:        { emoji: '🥚', art: 'a round translucent pale-blue jelly egg with cute tiny crystal shards floating inside' },
      hatchling:  { emoji: '🟢', art: 'a chibi tiny droplet slime, round translucent blue-green body, sparkling round eyes, glossy surface' },
      juvenile:   { emoji: '🟢', art: 'a chibi chubby slime, happy round face, a tiny single crystal sprouting on top of its head, glossy translucent body' },
      adolescent: { emoji: '🟩', art: 'a chibi crystal slime, a few small gems softly floating inside its translucent body, round and bouncy shape' },
      adult:      { emoji: '💠', art: 'a chibi crystal spirit, soft jade-blue jelly body, a big single crystal on top of its head, tiny round arms, sparkling eyes' },
      legendary:  { emoji: '💎', art: 'a chibi legendary crystal spirit king, a glowing gem core inside the translucent body, a small crystal crown on the head, still Q-style big-head-small-body kawaii' },
    },
  },
};

export const LINE_IDS = Object.keys(LINES);
export function lineFor(id) { return LINES[id] || null; }

// The egg hatches into a uniformly-random line — the user never chooses. rng is injectable for tests.
export function pickSpecies(rng = Math.random) {
  return LINE_IDS[Math.floor(rng() * LINE_IDS.length)];
}
