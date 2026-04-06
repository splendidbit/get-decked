import { Card, CardType } from './types';

interface CardTemplate {
  name: string;
  description: string;
}

const STRESS_TEMPLATES: Array<{ value: number; cards: CardTemplate[] }> = [
  {
    value: 1,
    cards: [
      { name: 'Judgmental Pigeon', description: 'A pigeon stares at you with quiet disapproval. Stress +1.' },
      { name: 'Slightly Haunted Sock', description: 'One sock. Slightly haunted. Stress +1.' },
      { name: 'Aggressive Breeze', description: 'The wind has opinions. Stress +1.' },
      { name: 'Passive-Aggressive Note', description: 'Someone left a note. It is technically polite. Stress +1.' },
      { name: 'Suspicious Yogurt', description: 'Is it fine? Probably fine. Stress +1.' },
      { name: 'Unreliable Wi-Fi', description: 'Three bars. No signal. Stress +1.' },
      { name: 'Wet Doorknob', description: 'You touched it. You will think about it all day. Stress +1.' },
      { name: 'Overly Honest Mirror', description: 'It sees you. All of you. Stress +1.' },
      { name: 'Mildly Cursed Sandal', description: 'Something is wrong with this sandal. Stress +1.' },
      { name: 'Unsolicited Wink', description: 'From a stranger. Lingering. Stress +1.' },
      { name: 'Sentient Speed Bump', description: 'It chose its moment. Stress +1.' },
      { name: 'Disappointed Cloud', description: 'The cloud is not angry, just disappointed. Stress +1.' },
      { name: 'Backhanded Compliment', description: 'Wow, you look so much better than usual. Stress +1.' },
      { name: 'Awkward Eye Contact', description: 'Too long. Way too long. Stress +1.' },
    ],
  },
  {
    value: 2,
    cards: [
      { name: 'Existential Pudding', description: 'The pudding asks the real questions. Stress +2.' },
      { name: 'Sentient Traffic Jam', description: 'It knows you are in a hurry. Stress +2.' },
      { name: 'Unsolicited Advice Tornado', description: 'It spins. It advises. You did not ask. Stress +2.' },
      { name: 'Rude Clouds', description: 'The clouds formed a rude shape just for you. Stress +2.' },
      { name: 'Anxious Furniture', description: 'The couch is worried. You are worried about the couch. Stress +2.' },
      { name: 'Emotional Baggage Claim', description: 'Your feelings have arrived on carousel three. Stress +2.' },
      { name: 'Paranoid Toaster', description: 'It suspects you. Rightly so. Stress +2.' },
      { name: 'Passive-Aggressive Weather', description: 'Technically sunny. Emotionally drizzling. Stress +2.' },
      { name: 'Condescending GPS', description: 'Recalculating. Again. You are the problem. Stress +2.' },
      { name: 'Haunted Spreadsheet', description: 'The cells remember everything. Stress +2.' },
    ],
  },
  {
    value: 3,
    cards: [
      { name: 'Surprise Ghost Audit', description: 'The ghosts are reviewing your finances. Stress +3.' },
      { name: 'Angry Volcano Invitation', description: 'You have been invited to a volcano. It is not optional. Stress +3.' },
      { name: 'Tax Return That Bites', description: 'The paperwork has teeth this year. Stress +3.' },
      { name: 'Spontaneous Gravity Reversal', description: 'Everything is falling up. This is your fault somehow. Stress +3.' },
      { name: 'Existential Crisis Delivery', description: 'Next day shipping. Signature required. Stress +3.' },
      { name: 'Enraged Souffle', description: 'You looked at it wrong. It knows. Stress +3.' },
    ],
  },
  {
    value: 4,
    cards: [
      { name: 'Full Moon of Bureaucracy', description: 'Every form. Every queue. Every hold music. Stress +4.' },
      { name: 'The Pudding Strikes Back', description: 'You thought the pudding was gone. The pudding was not gone. Stress +4.' },
      { name: 'Catastrophic Brunch', description: 'The mimosas have turned. Everything is on fire. Stress +4.' },
      { name: 'Maximum Overdrive Monday', description: 'Monday achieved sentience and chose violence. Stress +4.' },
    ],
  },
];

const CHILL_TEMPLATES: Array<{ value: number; cards: CardTemplate[] }> = [
  {
    value: 1,
    cards: [
      { name: 'Complimentary Nap', description: 'A brief, uninstructed nap. No charge. Stress -1.' },
      { name: 'Friendly Void', description: 'The void waved. You waved back. Stress -1.' },
      { name: 'Lukewarm Approval', description: 'Someone mildly approves of you. Stress -1.' },
      { name: 'Ambient Birdsong', description: 'Birds singing at an acceptable volume. Stress -1.' },
      { name: 'Acceptable Parking Spot', description: 'Not great, not bad. It will do. Stress -1.' },
      { name: 'Pleasant Surprise', description: 'Something nice happened. You were not ready. Stress -1.' },
      { name: 'Adequate Burrito', description: 'It is a burrito. It is adequate. Stress -1.' },
      { name: 'Mild Validation', description: 'You made a decent choice. Someone noticed. Stress -1.' },
    ],
  },
  {
    value: 2,
    cards: [
      { name: 'Spa Day (No Bees)', description: 'A spa day with a strict no-bee policy. Stress -2.' },
      { name: 'Suspiciously Calm River', description: 'Too calm. But you take it. Stress -2.' },
      { name: 'Therapeutic Sunset', description: 'The sunset is doing its job. Stress -2.' },
      { name: 'Unearned Confidence', description: 'You feel great about something. No reason required. Stress -2.' },
      { name: 'Cozy Thunderstorm', description: 'Lightning outside, blanket inside, perfect. Stress -2.' },
      { name: 'Perfectly Ripe Avocado', description: 'The stars aligned. The avocado is perfect. Stress -2.' },
    ],
  },
  {
    value: 3,
    cards: [
      { name: 'Perfect Burrito', description: 'The platonic ideal of burrito. You weep. Stress -3.' },
      { name: 'Cloud That Believes in You', description: 'One specific cloud. It believes. Stress -3.' },
      { name: 'Infinite Blanket', description: 'The blanket has no end. Neither does the comfort. Stress -3.' },
      { name: 'Enlightened Noodle', description: 'A noodle that has seen the truth. It shares. Stress -3.' },
    ],
  },
];

const SPECIAL_TEMPLATES: Array<{ type: CardType; cards: CardTemplate[] }> = [
  {
    type: CardType.Zen,
    cards: [
      { name: 'Ascended Potato', description: 'A potato that transcended the material plane. Reset your stress to zero.' },
      { name: 'Nirvana Achieved (Temporarily)', description: 'Brief enlightenment. Stress vanishes. Enjoy it while it lasts.' },
    ],
  },
  {
    type: CardType.Dump,
    cards: [
      { name: 'Not My Problem', description: 'Transfer all your stress to another player. Their problem now.' },
      { name: 'Strategic Blame Redistribution', description: 'Scientifically reassign responsibility. Pass your stress to a target.' },
      { name: 'Emotional Hot Potato', description: 'The potato is hot. Pass it quickly.' },
      { name: 'Plausible Deniability', description: 'You were never here. Transfer your stress elsewhere.' },
      { name: 'Masterful Deflection', description: 'A masterwork of not dealing with things. Dump stress on a target.' },
      { name: 'Someone Else\'s Crisis', description: 'Make it someone else\'s crisis. Immediately.' },
    ],
  },
  {
    type: CardType.Shield,
    cards: [
      { name: 'Emotional Armor', description: 'A protective layer of emotional distance. Block the next stress card played on you.' },
      { name: 'Blanket Fort of Denial', description: 'Impenetrable. Cozy. Totally in denial. Block incoming stress.' },
      { name: 'Vibes-Only Force Field', description: 'Powered entirely by good vibes. Blocks stress this turn.' },
      { name: 'Blissful Ignorance', description: 'You simply do not know about that stress card. It cannot affect you.' },
    ],
  },
  {
    type: CardType.Deflect,
    cards: [
      { name: 'Look Behind You!', description: 'Classic distraction. Redirect an incoming stress card to someone else.' },
      { name: 'It Was Like That When I Got Here', description: 'Plausible. Redirect stress to another target.' },
      { name: 'Classic Misdirection', description: 'The oldest trick. Stress goes somewhere else entirely.' },
      { name: 'The Old Switcheroo', description: 'A timeless maneuver. Redirect that stress to a new destination.' },
    ],
  },
  {
    type: CardType.Snap,
    cards: [
      { name: 'Caffeine Surge', description: 'A bolt of pure caffeine. Play an additional card immediately.' },
      { name: 'Sudden Clarity Tornado', description: 'Everything makes sense for exactly one more card play.' },
      { name: 'Adrenaline Dumpling', description: 'A dumpling filled with pure adrenaline. Take another turn action.' },
      { name: 'Double Espresso of Doom', description: 'Two shots. Two actions. One existential price.' },
    ],
  },
  {
    type: CardType.ChainReaction,
    cards: [
      { name: 'Domino Theory', description: 'One falls, they all fall. Stress splashes to adjacent players.' },
      { name: 'Cascading Oops', description: 'One small mistake. Catastrophically contagious.' },
      { name: 'Butterfly Effect Burrito', description: 'A burrito in Brazil causes stress for everyone at the table.' },
      { name: 'One Thing Led to Another', description: 'As it always does. Stress propagates outward.' },
    ],
  },
  {
    type: CardType.Swap,
    cards: [
      { name: 'Identity Crisis', description: 'You and another player swap stress levels entirely.' },
      { name: 'Freaky Friday Juice', description: 'You drank the juice. Swap stress with your chosen target.' },
    ],
  },
  {
    type: CardType.Peek,
    cards: [
      { name: 'Suspicious Telescope', description: 'A telescope pointed at someone\'s hand. See their cards.' },
      { name: 'Gossip from the Void', description: 'The void whispers. Look at another player\'s hand.' },
    ],
  },
];

export function buildDeck(): Card[] {
  const cards: Card[] = [];
  let idx = 0;

  for (const group of STRESS_TEMPLATES) {
    for (const template of group.cards) {
      cards.push({
        id: `card_${idx++}`,
        type: CardType.Stress,
        name: template.name,
        description: template.description,
        value: group.value,
      });
    }
  }

  for (const group of CHILL_TEMPLATES) {
    for (const template of group.cards) {
      cards.push({
        id: `card_${idx++}`,
        type: CardType.Chill,
        name: template.name,
        description: template.description,
        value: group.value,
      });
    }
  }

  for (const group of SPECIAL_TEMPLATES) {
    for (const template of group.cards) {
      cards.push({
        id: `card_${idx++}`,
        type: group.type,
        name: template.name,
        description: template.description,
        value: 0,
      });
    }
  }

  return cards;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
