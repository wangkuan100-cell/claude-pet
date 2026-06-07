// Twelve evolution lines, each with six forms (egg -> ... -> legendary).
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
  unicorn: {
    name: '独角兽', emoji: '🦄',
    forms: {
      egg:        { emoji: '🥚', art: 'a round pearl-pink egg with a tiny spiral horn mark and soft rainbow speckles on a glossy shell' },
      hatchling:  { emoji: '🐴', art: 'a tiny chibi white foal with a soft pastel mane, oversized round head, tiny stubby horn, sparkling eyes, plump baby body' },
      juvenile:   { emoji: '🐴', art: 'a chibi white unicorn child, short golden horn, fluffy pastel rainbow mane, round cheeks, tiny hooves, gentle smile' },
      adolescent: { emoji: '🦄', art: 'a chibi young unicorn, longer pearly horn, curled pastel mane, small star charm on the neck, big curious eyes' },
      adult:      { emoji: '🦄', art: 'a chibi unicorn mascot, glossy white coat, soft rainbow mane and tail, golden hooves, plump tiny body, happy face' },
      legendary:  { emoji: '🦄', art: 'a chibi legendary unicorn prince, pearly white coat, luminous spiral horn, floating rainbow ribbons, tiny star crown, still big-head-small-body kawaii' },
    },
  },
  griffin: {
    name: '狮鹫', emoji: '🦅',
    forms: {
      egg:        { emoji: '🥚', art: 'a round cream-gold egg with tiny feather and paw markings on a glossy shell' },
      hatchling:  { emoji: '🐥', art: 'a tiny chibi griffin chick, round eagle face, soft lion paws, stub wings, oversized head, bright button eyes' },
      juvenile:   { emoji: '🦅', art: 'a chibi young griffin, fluffy cream feathers, small lion tail, tiny talons, round body, curious sparkling eyes' },
      adolescent: { emoji: '🦅', art: 'a chibi adolescent griffin, golden feather crest, small spread wings, lion cub body, big proud but cute eyes' },
      adult:      { emoji: '🦁', art: 'a chibi griffin mascot, rounded eagle head, soft golden wings, tiny lion paws, fluffy tail tuft, glossy warm shading' },
      legendary:  { emoji: '🦅', art: 'a chibi legendary griffin guardian, golden eagle crest, plush lion body, bright feather wings, tiny sun medallion, kawaii proportions' },
    },
  },
  pegasus: {
    name: '天马', emoji: '🐴',
    forms: {
      egg:        { emoji: '🥚', art: 'a round sky-blue egg with little cloud swirls and tiny wing marks on a glossy shell' },
      hatchling:  { emoji: '🐴', art: 'a tiny chibi winged foal, soft sky-blue mane, little feather wing buds, oversized round head, shiny gentle eyes' },
      juvenile:   { emoji: '🐴', art: 'a chibi young pegasus, fluffy small wings, white coat with pale blue socks, round cheeks, tiny hooves' },
      adolescent: { emoji: '🐴', art: 'a chibi adolescent pegasus, cloud-like mane, half-open feather wings, bright eyes, airy floating pose' },
      adult:      { emoji: '🐴', art: 'a chibi pegasus mascot, white plush body, spread sky-blue wings, curly cloud mane, happy tiny trot' },
      legendary:  { emoji: '🐴', art: 'a chibi legendary pegasus, luminous cloud mane, wide soft feather wings, tiny silver crown, star dust around hooves, cute Q-style proportions' },
    },
  },
  leviathan: {
    name: '小海龙', emoji: '🌊',
    forms: {
      egg:        { emoji: '🥚', art: 'a round aqua egg with tiny wave marks and pearly bubbles floating inside a glossy shell' },
      hatchling:  { emoji: '🐟', art: 'a tiny chibi sea dragon hatchling, round aqua head, little fin ears, small curled tail, sparkling watery eyes' },
      juvenile:   { emoji: '🐟', art: 'a chibi young sea dragon, teal scales, soft frill fins, plump curled body, cheerful round eyes' },
      adolescent: { emoji: '🐬', art: 'a chibi adolescent leviathan, long cute teal body, little coral horns, flowing side fins, playful smile' },
      adult:      { emoji: '🐋', art: 'a chibi sea dragon mascot, glossy aqua body, rounded fins, pearl-like belly, curled tail, bright friendly face' },
      legendary:  { emoji: '🌊', art: 'a chibi legendary leviathan, aqua-blue sea dragon body, coral crown, pearl necklace, soft wave aura, still tiny and adorable' },
    },
  },
  basilisk: {
    name: '蛇羽蜥', emoji: '🐍',
    forms: {
      egg:        { emoji: '🥚', art: 'a round moss-green egg with tiny feather-scale marks and golden freckles on a glossy shell' },
      hatchling:  { emoji: '🦎', art: 'a tiny chibi basilisk lizard, round green head, tiny feather crest, short curled tail, big harmless eyes' },
      juvenile:   { emoji: '🦎', art: 'a chibi young basilisk, soft green scales, fluffy feather collar, plump little body, friendly shy expression' },
      adolescent: { emoji: '🐍', art: 'a chibi adolescent basilisk, emerald body, golden feather crest, curled tail, tiny claws, sparkling gentle eyes' },
      adult:      { emoji: '🐍', art: 'a chibi basilisk mascot, bright green scales, soft golden feather mane, rounded snake-lizard body, cute smile' },
      legendary:  { emoji: '🐍', art: 'a chibi legendary basilisk, emerald scales, golden feather crown, curled ribbon tail, tiny glowing charm, kawaii not scary' },
    },
  },
  mandrake: {
    name: '曼德拉草', emoji: '🌿',
    forms: {
      egg:        { emoji: '🥚', art: 'a round warm-brown seed egg with cute leaf sprouts and tiny root freckles on a glossy shell' },
      hatchling:  { emoji: '🌱', art: 'a tiny chibi mandrake sprout, round root baby body, two little leaves on the head, big sleepy eyes, soft smile' },
      juvenile:   { emoji: '🌱', art: 'a chibi young mandrake, plump root body, leafy hair tuft, tiny root feet, rosy cheeks, shy sparkling eyes' },
      adolescent: { emoji: '🌿', art: 'a chibi adolescent mandrake, larger leaf crown, small vine arms, rounded root body, curious tilted head' },
      adult:      { emoji: '🌿', art: 'a chibi mandrake mascot, fluffy green leaf hair, warm tan root body, tiny vine scarf, happy round face' },
      legendary:  { emoji: '🌿', art: 'a chibi legendary mandrake sage, lush leaf crown, tiny flower ornaments, glowing root body, soft green aura, big gentle eyes' },
    },
  },
};

export const LINE_IDS = Object.keys(LINES);
export function lineFor(id) { return LINES[id] || null; }

// The egg hatches into a uniformly-random line — the user never chooses. rng is injectable for tests.
export function pickSpecies(rng = Math.random) {
  return LINE_IDS[Math.floor(rng() * LINE_IDS.length)];
}
