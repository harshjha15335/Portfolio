/**
 * Named people in the city: Harsh (the CST host) and the friends and family who stand in the districts.
 * Each is a stylised likeness on a licensed Rocketbox body (scripts/characters/likeness.py), built from photos
 * shared with their consent; Abhinav is a generic young-teen figure with only his outfit matched.
 */
import { characterCast } from './characterCast';

export interface FriendAction { label: string; open: string }
export interface Friend {
  id: string; name: string; role: string;
  /** Cast member id in characterCast. */
  cast: string;
  /** District id (city.ts); 'fort' and 'cst' stand on the CST–Fort street. */
  district: string;
  /** Where they stand in a district's local frame, relative to the arrival stop (dx is towards the buildings). */
  offset: [number, number];
  lines: string[];
  actions: FriendAction[];
}

export const FRIENDS: Friend[] = [
  {
    id: 'aarush', name: 'Aarush Shetty', role: 'Fellow contributor, Fort Open Source Hall', cast: 'aarush', district: 'fort', offset: [0, 0],
    lines: [
      'Hey, I’m Aarush. I look after the Open Source Hall while Harsh is out on the streets.',
      'Harsh was a Google Summer of Code 2026 contributor at QC-Devs. Everything in here is FFprime: multipole electrostatics, written upstream and merged after review.',
      'Five pull requests were merged after review. The cork board on the wall strings them together in order, and each card links to GitHub.',
      'My favourite is the gradient check by the door. Three field formulas, one correct. One of Harsh’s PRs fixed exactly that factor of two.',
    ],
    actions: [{ label: 'RUN THE GRADIENT CHECK', open: 'fort-gradient' }, { label: 'FOLLOW THE PULL REQUESTS', open: 'fort-source' }, { label: 'FFPRIME CASE STUDY ↗', open: 'ffprime' }],
  },
  {
    id: 'pavit', name: 'Pavit Singh', role: 'Systems engineer, BKC Systems Office', cast: 'pavit', district: 'bkc', offset: [0, -2.4],
    lines: [
      'Pavit Singh. Welcome to the BKC office, where Harsh did his CCIEeXpert internship.',
      'The work was enterprise security tooling: Python policy analysis, and a Manifest V3 browser extension that talks to Cisco Secure Access.',
      'Real constraints, real APIs. Try the rate-limit console inside: pull forty pages from a limited API without a single 429.',
    ],
    actions: [{ label: 'READ THE INTERNSHIP BRIEF', open: 'bkc-brief' }, { label: 'RUN THE RATE-LIMIT CONSOLE', open: 'bkc-ratelimit' }, { label: 'THE BKC OFFICE ↗', open: 'bkc' }],
  },
  {
    id: 'anuj', name: 'Anuj Deshpande', role: 'Stack guide, Andheri Tech Bazaar', cast: 'anuj', district: 'andheri', offset: [-.6, -3.4],
    lines: [
      'Anuj here. Every stall on this lane sells one part of Harsh’s stack.',
      'Languages at one end, then frontend, backend, AI and DevOps. Each shop shows the projects where the skill was actually used.',
      'Skip the hype stalls. If a skill has no project behind it, it isn’t on sale here.',
    ],
    actions: [{ label: 'BROWSE THE BAZAAR ↗', open: 'andheri' }],
  },
  {
    id: 'arham', name: 'Arham Jain', role: 'Demo lead, Powai Builder’s District', cast: 'arham', district: 'powai', offset: [0, -2.4],
    lines: [
      'I’m Arham. I run the demos in Powai, so everything here actually works.',
      'Each lab on this street is one of Harsh’s projects, live in the browser: walk in, press buttons, break things.',
      'Try NorthStar for AI market research, or the ASTFLOW lab at the end if you like search: BM25 and dense retrieval, fused.',
    ],
    actions: [{ label: 'OPEN THE ASTFLOW LAB', open: 'astflow' }, { label: 'ALL POWAI PROJECTS ↗', open: 'powai' }],
  },
  {
    id: 'ranjan', name: 'Ranjan Jha', role: 'Timeline keeper, Dadar Junction', cast: 'ranjan', district: 'dadar', offset: [0, -2.4],
    lines: [
      'Namaste. I’m Ranjan, and I keep the timetable at Dadar.',
      'Every platform here is a stop on Harsh’s timeline: B.Tech at VIT Vellore, the projects, Summer of Code, the internship. Read them in order and the journey lines up.',
      'Good habits are like good trains. They run on time, every day.',
    ],
    actions: [{ label: 'READ THE TIMELINE ↗', open: 'dadar' }],
  },
  {
    id: 'rina', name: 'Rina Jha', role: 'Host, Worli Proof Deck', cast: 'rina', district: 'worli', offset: [0, -2.4],
    lines: [
      'Hello! I’m Rina. Welcome to the Proof Deck.',
      'Every case along the sea face holds one achievement or hackathon, with the evidence right next to it. No claim without a receipt.',
      'Take your time with them. The sea breeze is free.',
    ],
    actions: [{ label: 'SEE THE ACHIEVEMENTS ↗', open: 'worli' }],
  },
  {
    id: 'abhinav', name: 'Abhinav Jha', role: 'Studio helper, Juhu Studio', cast: 'abhinav', district: 'juhu', offset: [0, -2.4],
    lines: [
      'Hi! I’m Abhinav. Power up in progress!',
      'This is Juhu Studio, the human side of the city: who Harsh is, his résumé, and how to say hello.',
      'Start with the notice board, pick up a résumé, then leave a message at the contact terminal. Press J any time to see your achievements.',
    ],
    actions: [{ label: 'READ THE NOTICE BOARD', open: 'juhu-about' }, { label: 'PICK UP THE RÉSUMÉ', open: 'juhu-resume' }, { label: 'USE THE CONTACT TERMINAL', open: 'juhu-contact' }],
  },
];

/** The CST arrival host is Harsh himself; he keeps the district's guide role (interaction id 'cst'). */
export const HOST = { name: 'Harsh Jha', cast: 'harsh' } as const;

/** Height of a friend's talk point; the prompt marker floats .34 m above it, so tall friends get theirs raised to clear the head. */
export const talkHeight = (cast: string) => Math.max(1.45, (characterCast[cast]?.height ?? 1.75) - .27);

export const friendInteraction = (id: string) => `friend-${id}`;
export const friendById = (interaction: string) => FRIENDS.find(f => friendInteraction(f.id) === interaction);
