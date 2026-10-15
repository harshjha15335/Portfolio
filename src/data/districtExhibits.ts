/**
 * Physical exhibits in the seven districts beyond CST–Fort. Each one is a free-standing
 * board on the pavement (or the promenade) that faces the road; pressing E in front of it
 * opens a focused panel. Positions are in the district's local frame (road along Z,
 * pavements at |x|≈5), the same frame `catalog.ts` builds in. Every fact on a board comes
 * from src/data (experience, projects, journey, achievements, shops); nothing is invented.
 */
import { achievements, experience } from './experience';
import { journey } from './city';
import { projects } from './projects';
import { SHOPS } from './shops';

export interface DistrictExhibit {
  id: string; district: string;
  /** Prompt shown when the visitor faces it. */
  label: string;
  /** Local position of the board's centre on the ground plane. The board faces the road (towards x = 0). */
  x: number; z: number;
  panel: { eyebrow: string; title: string; lines: string[] };
  /** What the guide says about it on the tour. */
  tour: { title: string; body: string };
}

const flagships = projects.filter(p => p.id !== 'ffprime');
const powaiZ = [8, 0, -8, -15, -28, -38, -48];

export const DISTRICT_EXHIBITS: DistrictExhibit[] = [
  /* ---------------- BKC: the internship floor, on the plaza in front of the Systems Office */
  { id: 'bkc-brief', district: 'bkc', label: 'Read the internship brief', x: 9.8, z: -16,
    panel: { eyebrow: `${experience[1].organization.toUpperCase()} · ${experience[1].period.toUpperCase()}`, title: experience[1].title, lines: ['Python policy-analysis CLI', 'Manifest V3 browser extension', 'OAuth2 · rate-limited ingestion'] },
    tour: { title: 'The brief', body: `${experience[1].description} The board lists what was built; press E for the full brief and its source.` } },
  { id: 'bkc-ratelimit', district: 'bkc', label: 'Run the rate-limit console', x: 9.8, z: -24,
    panel: { eyebrow: 'BKC / SYSTEMS ACTIVITY', title: 'Rate-limit console', lines: ['Ingest 40 pages from a rate-limited API', 'without a single 429.', 'Teaching model, not the internship code'] },
    tour: { title: 'Your turn: the rate limit', body: 'Enterprise APIs ration requests. This console simulates a token-bucket limit: choose how fast to send and whether to back off, and try to ingest every page without a 429 in the least time.' } },
  { id: 'bkc-flow', district: 'bkc', label: 'Follow the request path', x: 9.8, z: -32,
    panel: { eyebrow: 'BKC / HOW THE PIECES MEET', title: 'Policy → OAuth2 → Access', lines: ['The pieces of the integration', 'and how a request moves', 'through them']},
    tour: { title: 'How the pieces meet', body: 'A security tool is only as useful as its integration: authenticate with OAuth2, call the API within its limits, then analyse what comes back. Press E to step through the path.' } },

  /* ---------------- Andheri: one kiosk per skill shop, in the gaps between the pavement stalls */
  ...SHOPS.map((shop, i) => ({
    id: `andheri-shop-${shop.id}`, district: 'andheri', label: `Visit ${shop.name}`,
    x: [6.3, -6.3, 6.3, -6.3, 6.3][i], z: [-11, -11, -26, -26, -41][i],
    panel: { eyebrow: `SHOP ${shop.sign} · ANDHERI TECH BAZAAR`, title: shop.name, lines: [shop.skills.slice(0, 3).map(s => s.name).join(' · '), 'Every skill linked to its source', 'Working bench inside'] },
    tour: { title: shop.name, body: `${shop.pitch} Press E to open the shop and its bench.` },
  })),

  /* ---------------- Powai: a lab sign in front of each workplace on the lakeside paving */
  ...flagships.map((p, i) => ({
    id: p.id, district: 'powai', label: `Open ${p.title}`, x: 8.9, z: powaiZ[i],
    panel: { eyebrow: p.category.toUpperCase(), title: p.title, lines: [p.subtitle, p.architecture.slice(0, 3).join(' → '), p.id === 'reco' ? 'Case study inside' : 'Working demo inside'] },
    tour: { title: p.title, body: `${p.shortDescription} Press E to ${p.id === 'reco' ? 'read the case study' : 'run the working demo'}.` },
  })),
  { id: 'astflow', district: 'powai', label: 'Open the ASTFLOW lab', x: 8.9, z: powaiZ[6],
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

  /* ---------------- Juhu: in front of the studio */
  { id: 'juhu-about', district: 'juhu', label: 'Read the studio notice board', x: 6.5, z: 6,
    panel: { eyebrow: 'JUHU STUDIO · ABOUT', title: 'Harsh Jha', lines: ['B.Tech CSE, VIT Vellore', 'Scientific computing · software', 'engineering · applied AI'] },
    tour: { title: 'The person behind the systems', body: 'Harsh studies Computer Science and Engineering at VIT Vellore and builds tools that make complicated ideas usable: scientific computing, software engineering and applied AI.' } },
  { id: 'juhu-resume', district: 'juhu', label: 'Pick up the résumé', x: 6.5, z: -3,
    panel: { eyebrow: 'JUHU STUDIO · RÉSUMÉ', title: 'Résumé stand', lines: ['Download the résumé', 'GitHub · LinkedIn', 'Everything in the city, on one page'] },
    tour: { title: 'The résumé', body: 'Everything in this city, on paper: download the résumé, or follow the GitHub and LinkedIn links.' } },
  { id: 'juhu-contact', district: 'juhu', label: 'Use the contact terminal', x: 6.5, z: -10.5,
    panel: { eyebrow: 'JUHU STUDIO · SAY HELLO', title: 'Contact terminal', lines: ['Engineering roles · research', 'or a good technical conversation', 'Press E to write'] },
    tour: { title: 'Say hello', body: 'The contact terminal opens a message to Harsh: engineering opportunities, research, or a good technical conversation.' } },

  /* ---------------- Film City: box office and the scene board by the Talkies */
  { id: 'filmcity-boxoffice', district: 'filmcity', label: 'Buy a ticket at the box office', x: 6.3, z: 6,
    panel: { eyebrow: 'FILM CITY TALKIES · BOX OFFICE', title: 'Tonight: one story', lines: ['Nine scenes · you set the pace', 'Restart, skip or leave any time', 'Press E for a seat'] },
    tour: { title: 'The box office', body: 'The Talkies shows Harsh’s story in nine scenes. You control the pace: next, previous, autoplay, restart, skip to the end, or leave.' } },
  { id: 'filmcity-scenes', district: 'filmcity', label: 'Read the scene board', x: 6.3, z: -1,
    panel: { eyebrow: 'FILM CITY TALKIES · PROGRAMME', title: 'Nine scenes', lines: ['Arrival · Foundations · First builds', 'Open source · Enterprise · Products', 'Signals · Next chapter · Finale'] },
    tour: { title: 'The programme', body: 'The scene board lists all nine scenes. Pick any scene to start the film there.' } },
];

export const exhibitsOf = (district: string) => DISTRICT_EXHIBITS.filter(e => e.district === district);
export const exhibitById = (id: string) => DISTRICT_EXHIBITS.find(e => e.id === id);

/** Where a visitor stands to read an exhibit: 1.9 m in front, eyes on the board (local frame). */
export function readingSpot(e: Pick<DistrictExhibit, 'x' | 'z'>) {
  const nx = e.x > 0 ? -1 : 1;
  return { x: e.x + nx * 1.9, z: e.z, yaw: nx < 0 ? -Math.PI / 2 : Math.PI / 2, pitch: -.07 };
}
