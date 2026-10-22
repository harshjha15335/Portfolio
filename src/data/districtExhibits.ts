/**
 * Physical exhibits in the seven districts beyond CST–Fort. Each one is a free-standing
 * board on the pavement (or the promenade) that faces the road; pressing E in front of it
 * opens a focused panel. Positions are in the district's local frame (road along Z,
 * pavements at |x|≈5), the same frame `catalog.ts` builds in. Every fact on a board comes
 * from src/data (experience, projects, journey, achievements, shops); nothing is invented.
 */
import { achievements, experience } from './experience';
import { journey } from './city';
import { POWAI_PROJECTS, projects } from './projects';
import { SHOPS } from './shops';

export interface DistrictExhibit {
  id: string; district: string;
  /** Prompt shown when the visitor faces it. */
  label: string;
  /** Local position of the board's centre on the ground plane. The board faces the road (towards x = 0). */
  x: number; z: number;
  /** 'board' stands on posts (default); 'wall' hangs flush on a wall behind it; 'marker' builds nothing (the place itself is the exhibit). */
  mount?: 'board' | 'wall' | 'marker';
  /** A shop-sign header over a free-standing board, so it reads from down the street. */
  topper?: string;
  panel: { eyebrow: string; title: string; lines: string[] };
  /** What the guide says about it on the tour. */
  tour: { title: string; body: string };
}

const flagships = POWAI_PROJECTS.map(id => projects.find(p => p.id === id)!);
/** Powai's workplaces along the east frontage: one per Powai project, then ASTFLOW (built by `catalog.ts` with the same spacing). */
export const POWAI_PODS = { start: 14, w: 8.5, gap: 1.2, setback: 3.5, depth: 7 };
export const powaiPodZ = (i: number) => POWAI_PODS.start - i * (POWAI_PODS.w + POWAI_PODS.gap) - POWAI_PODS.w / 2;
/** Each board stands on the forecourt at its workplace's entrance, beside the door, facing the road. */
export const powaiBoard = (i: number) => ({ x: 7 + POWAI_PODS.setback - 1.2, z: powaiPodZ(i) + 2.4 });

/** Andheri's skill-shop boards (local x, z): at the shopfronts, alternating sides; `catalog.ts` keeps the pavement stalls clear of them. */
export const ANDHERI_SHOP_BOARDS: Array<[number, number]> = [[6.45, -11], [-6.45, -11], [6.45, -26], [-6.45, -26], [6.45, -41]];

export const DISTRICT_EXHIBITS: DistrictExhibit[] = [
  /* ---------------- BKC: the internship brief at the Systems Office entrance, the rest inside the lobby */
  { id: 'bkc-brief', district: 'bkc', label: 'Read the internship brief', x: 9.7, z: 7.8, topper: `${experience[1].organization} INTERNSHIP`,
    panel: { eyebrow: `${experience[1].organization.toUpperCase()} · ${experience[1].period.toUpperCase()}`, title: experience[1].title, lines: ['Python policy-analysis CLI', 'Manifest V3 browser extension', 'OAuth2 · rate-limited ingestion'] },
    tour: { title: 'The brief', body: `${experience[1].description} The board lists what was built; press E for the full brief and its source.` } },
  { id: 'bkc-ratelimit', district: 'bkc', label: 'Run the rate-limit console', x: 23.4, z: 4.9,
    panel: { eyebrow: 'BKC / SYSTEMS ACTIVITY', title: 'Rate-limit console', lines: ['Ingest 40 pages from a rate-limited API', 'without a single 429.', 'Teaching model, not the internship code'] },
    tour: { title: 'Your turn: the rate limit', body: 'Enterprise APIs ration requests. This console simulates a token-bucket limit: choose how fast to send and whether to back off, and try to ingest every page without a 429 in the least time.' } },
  { id: 'bkc-flow', district: 'bkc', label: 'Follow the request path', x: 27.15, z: 7.2, mount: 'wall',
    panel: { eyebrow: 'BKC / HOW THE PIECES MEET', title: 'Policy → OAuth2 → Access', lines: ['The pieces of the integration', 'and how a request moves', 'through them']},
    tour: { title: 'How the pieces meet', body: 'A security tool is only as useful as its integration: authenticate with OAuth2, call the API within its limits, then analyse what comes back. Press E to step through the path.' } },

  /* ---------------- Andheri: one big board per skill shop, at a shopfront; the pavement stalls keep clear of them (no header: the awnings would hide it) */
  ...SHOPS.map((shop, i) => ({
    id: `andheri-shop-${shop.id}`, district: 'andheri', label: `Visit ${shop.name}`,
    x: ANDHERI_SHOP_BOARDS[i][0], z: ANDHERI_SHOP_BOARDS[i][1],
    panel: { eyebrow: `SHOP ${shop.sign} · ANDHERI TECH BAZAAR`, title: shop.name, lines: [shop.skills.slice(0, 3).map(s => s.name).join(' · '), 'Every skill linked to its source', 'Working bench inside'] },
    tour: { title: shop.name, body: `${shop.pitch} Press E to open the shop and its bench.` },
  })),

  /* ---------------- Powai: each project's board at the entrance of its own workplace */
  ...flagships.map((p, i) => ({
    id: p.id, district: 'powai', label: `Open ${p.title}`, ...powaiBoard(i), topper: `${p.title.toUpperCase()} · ${p.id === 'reco' ? 'CASE STUDY' : 'WORKING DEMO'}`,
    panel: { eyebrow: p.category.toUpperCase(), title: p.title, lines: [p.subtitle, p.architecture.slice(0, 3).join(' → '), p.id === 'reco' ? 'Case study inside' : 'Working demo inside'] },
    tour: { title: p.title, body: `${p.shortDescription} Press E to ${p.id === 'reco' ? 'read the case study' : 'run the working demo'}.` },
  })),
  { id: 'astflow', district: 'powai', label: 'Open the ASTFLOW lab', ...powaiBoard(flagships.length), topper: 'ASTFLOW · WORKING LAB',
    panel: { eyebrow: 'POWAI / ASTFLOW LAB', title: 'ASTFLOW', lines: ['BM25 + dense retrieval, fused', 'The experiment record, replayed', 'Working lab inside'] },
    tour: { title: 'The ASTFLOW lab', body: 'ASTFLOW’s engineering lab shows the shipped retrieval results and replays the fusion experiments on the frozen runs: change k, the weighting or the depth and see the ranking move.' } },

  /* ---------------- Dadar: the journey as platform indicators along the east pavement */
  ...journey.map((stop, i) => ({
    id: `dadar-stop-${i}`, district: 'dadar', label: `Platform ${i + 1}: ${stop.title}`, x: 6.5, z: [-3, -10, -16, -27, -33, -43][i],
    panel: { eyebrow: `PLATFORM ${i + 1} · ${stop.date.toUpperCase()}`, title: stop.title, lines: [stop.detail.length > 60 ? stop.detail.slice(0, stop.detail.lastIndexOf(' ', 58)) + '…' : stop.detail] },
    tour: { title: `Platform ${i + 1}: ${stop.title}`, body: stop.detail },
  })),

  /* ---------------- Worli: evidence cases on the promenade, facing the road */
  ...achievements.map((a, i) => ({
    id: `worli-case-${i}`, district: 'worli', label: `Check the receipt: ${a.title}`, x: -10.9, z: [3.5, -7.5, -19, -29.5][i],
    panel: { eyebrow: `EVIDENCE CASE ${i + 1}`, title: a.title, lines: [a.detail.split(' · ')[0], 'Is it publicly verifiable', 'or résumé reported?'] },
    tour: { title: a.title, body: `${a.detail}. Each case asks you to check the kind of evidence behind the claim before you trust it.` },
  })),

  /* ---------------- Juhu: inside the studio */
  { id: 'juhu-about', district: 'juhu', label: 'Read the studio notice board', x: 21.66, z: 9, mount: 'wall',
    panel: { eyebrow: 'JUHU STUDIO · ABOUT', title: 'Harsh Jha', lines: ['B.Tech CSE, VIT Vellore', 'Scientific computing · software', 'engineering · applied AI'] },
    tour: { title: 'The person behind the systems', body: 'Harsh studies Computer Science and Engineering at VIT Vellore and builds tools that make complicated ideas usable: scientific computing, software engineering and applied AI.' } },
  { id: 'juhu-resume', district: 'juhu', label: 'Pick up the résumé', x: 15, z: 1,
    panel: { eyebrow: 'JUHU STUDIO · RÉSUMÉ', title: 'Résumé stand', lines: ['Download the résumé', 'GitHub · LinkedIn', 'Everything in the city, on one page'] },
    tour: { title: 'The résumé', body: 'Everything in this city, on paper: download the résumé, or follow the GitHub and LinkedIn links.' } },
  { id: 'juhu-contact', district: 'juhu', label: 'Use the contact terminal', x: 15, z: 9.2,
    panel: { eyebrow: 'JUHU STUDIO · SAY HELLO', title: 'Contact terminal', lines: ['Engineering roles · research', 'or a good technical conversation', 'Press E to write'] },
    tour: { title: 'Say hello', body: 'The contact terminal opens a message to Harsh: engineering opportunities, research, or a good technical conversation.' } },

  /* ---------------- Film City: box office and scene board in the Talkies lobby, and the screen itself */
  { id: 'filmcity-boxoffice', district: 'filmcity', label: 'Buy a ticket at the box office', x: 13.5, z: -4.5,
    panel: { eyebrow: 'FILM CITY TALKIES · BOX OFFICE', title: 'House full tonight', lines: ['The film · 42 s · with sound', 'Pause, replay or leave any time', 'Press E for a seat'] },
    tour: { title: 'The box office', body: 'Tonight the Talkies is house full for a 42-second action film of Harsh’s work: open source, the internship, the builds and the signals, cut from this city with an original score. Pause, replay, read the nine scenes as text, or leave.' } },
  { id: 'filmcity-scenes', district: 'filmcity', label: 'Read the scene board', x: 14.93, z: 7.5, mount: 'wall',
    panel: { eyebrow: 'FILM CITY TALKIES · PROGRAMME', title: 'Nine scenes', lines: ['Arrival · Foundations · First builds', 'Open source · Enterprise · Products', 'Signals · Next chapter · Finale'] },
    tour: { title: 'The programme', body: 'The scene board lists all nine scenes. Pick any scene to start the film there.' } },
  { id: 'filmcity-screen', district: 'filmcity', label: 'Watch the film with controls', x: 30.5, z: 1.2, mount: 'marker',
    panel: { eyebrow: 'FILM CITY TALKIES · SCREEN 1', title: 'House full', lines: ['The film is on the big screen', 'Your seat: row E, seat 7, on the aisle', 'A standing ovation after every show'] },
    tour: { title: 'The auditorium', body: 'Through the lobby doors is the hall itself: ten full rows facing the screen, where the film is already running. One seat is kept for you, row E, seat 7, on the aisle: press E there to sit and watch. When the film ends the whole house stands up and applauds, then the next show starts. At the screen, press E to watch from the start with controls and captions.' } },
];

export const exhibitsOf = (district: string) => DISTRICT_EXHIBITS.filter(e => e.district === district);
export const exhibitById = (id: string) => DISTRICT_EXHIBITS.find(e => e.id === id);

/** Where a visitor stands to read an exhibit: 1.9 m in front, eyes on the board (local frame). */
export function readingSpot(e: Pick<DistrictExhibit, 'x' | 'z'>) {
  const nx = e.x > 0 ? -1 : 1;
  return { x: e.x + nx * 1.9, z: e.z, yaw: nx < 0 ? -Math.PI / 2 : Math.PI / 2, pitch: -.07 };
}
