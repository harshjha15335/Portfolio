/** A compact, invented city. Positions describe the model, not Mumbai geography. */
export interface District {
  id: string; title: string; shortName: string; descriptor: string;
  position: [number, number, number]; color: string; guide: string; greeting: string;
}
export const districts: District[] = [
  { id: 'cst', title: 'CST Arrival Square', shortName: 'CST', descriptor: 'Start here · meet the builder', position: [0, 0, 0], color: '#d56a42', guide: 'The station host', greeting: 'Welcome aboard. Nine stops, one engineer. Pick a direction or catch a ride.' },
  { id: 'fort', title: 'Fort Open Source Labs', shortName: 'Fort', descriptor: 'GSoC · FFprime · scientific computing', position: [-25, 0, -25], color: '#327b79', guide: 'The research fellow', greeting: 'The equations are serious. The city is playful. Come see the reviewed work behind FFprime.' },
  { id: 'bkc', title: 'BKC Systems House', shortName: 'BKC', descriptor: 'CCIEeXpert · enterprise engineering', position: [35, 0, 0], color: '#537b9a', guide: 'The systems engineer', greeting: 'Real APIs, real constraints. This stop is about making enterprise security tools work.' },
  { id: 'andheri', title: 'Andheri Skill Bazaar', shortName: 'Andheri', descriptor: 'Skills with receipts, not progress bars', position: [-35, 0, 0], color: '#c57832', guide: 'The bazaar curator', greeting: 'Every skill has a story. Pick one and I’ll point you to the work that uses it.' },
  { id: 'powai', title: 'Powai Product District', shortName: 'Powai', descriptor: 'Five projects · five ways to build', position: [25, 0, -25], color: '#5f7850', guide: 'The product builder', greeting: 'Research terminals, recovery systems, route planners. Walk in with a question; leave with a case study.' },
  { id: 'dadar', title: 'Dadar Junction', shortName: 'Dadar', descriptor: 'The route from student to builder', position: [0, 0, 35], color: '#b65442', guide: 'The platform announcer', greeting: 'Some routes meet, others branch. Here’s Harsh’s journey, with the dates we can actually source.' },
  { id: 'worli', title: 'Worli Signal Deck', shortName: 'Worli', descriptor: 'Achievements · evidence · engineering signals', position: [25, 0, 25], color: '#5965a3', guide: 'The signal keeper', greeting: 'Good views. Better evidence. These numbers come with their sources and qualifiers.' },
  { id: 'juhu', title: 'Juhu Studio', shortName: 'Juhu', descriptor: 'The human bit · résumé · say hello', position: [-25, 0, 25], color: '#bd7884', guide: 'The studio neighbour', greeting: 'Sea breeze, a desk, and too many ideas. Meet the person behind the systems.' },
  { id: 'filmcity', title: 'Film City Talkies', shortName: 'Film City', descriptor: 'Nine scenes · one engineering story', position: [0, 0, -35], color: '#8a4e68', guide: 'The projectionist', greeting: 'Your seat is ready. No trailers, just the journey. You control the pace.' },
];
export const districtForProject = (id: string) => id === 'ffprime' ? 'fort' : 'powai';

export const journey = [
  { date: 'VIT · class of 2028', title: 'Learning the foundations', detail: 'B.Tech Computer Science and Engineering at VIT Vellore. Expected graduation: July 2028.' },
  { date: 'Projects · 2026', title: 'Ideas become working systems', detail: 'Scientific computing, applied AI, finance tools and full-stack products. Explore the repositories for implementation evidence.' },
  { date: 'May–August 2026', title: 'Open source, upstream', detail: 'Google Summer of Code with QC-Devs / Theochem: multipole electrostatics in FFprime, numerical tests and five merged pull requests.' },
  { date: 'July 2026', title: 'Enterprise constraints', detail: 'CCIEeXpert internship: Python policy analysis and a Manifest V3 browser extension integrating with Cisco Secure Access.' },
  { date: '2026 · résumé reported', title: 'A signal along the route', detail: 'Google Big Code qualifier cleared; top 15,000 nationally.' },
  { date: 'Next chapter', title: 'Keep building, keep validating', detail: 'Current interests span scientific computing, software engineering and applied AI. The next stop is an invitation to collaborate.' },
];
