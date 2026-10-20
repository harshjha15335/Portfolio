/**
 * Guided tours: a guide walks the visitor through a place, framing each exhibit in the world.
 * Every step can be skipped, and the tour can be left at any time. Facts come from the same
 * sources as the exhibits themselves (src/research/evidence.json, src/data/experience.ts).
 */
import { exhibitsOf, readingSpot } from './districtExhibits';
import { cityZones } from '../game/World/streetLayout';
import { districts } from './city';

export interface TourView { x: number; z: number; yaw: number; pitch: number }
export interface TourStep { title: string; body: string; view?: TourView; exhibit?: string; next?: string }
export interface Tour { id: string; guide: string; place: string; steps: TourStep[] }

const fortFloor = (lx: number, lz: number) => ({ x: -7 + lz, z: -34 - lx });

export const TOURS: Record<string, Tour> = {
  cst: {
    id: 'cst', guide: 'The station host', place: 'CST Arrival Terminus',
    steps: [
      { title: 'Welcome to the city', body: 'Nine stops, one engineer. Each district holds a different part of Harsh’s work, and every one of them is a street you can walk.', view: { x: 4.6, z: 11.5, yaw: .14, pitch: -.015 } },
      { title: 'The departure board', body: 'The board over the pavement is the portfolio’s index: research, internships, skills, projects, education, achievements, about and cinema. Press E under it to pick a destination and mark it on your map.', view: { x: 4.6, z: 9.2, yaw: 0, pitch: .3 }, exhibit: 'cst-board' },
      { title: 'Taxis and autos', body: 'Kaali-peeli taxis and autos wait at the stand. Hail one, choose a stop and watch the meter. The fare is a game meter, not an official tariff, and you can skip to the destination or get out at any time.', view: { x: 4.4, z: 8.6, yaw: .55, pitch: -.12 } },
      { title: 'Up Fort Road', body: 'The Fort Research Institute is about 45 metres up this street, on the left. That is where the Google Summer of Code work lives.', view: { x: 4.6, z: 9.2, yaw: .2, pitch: .02 } },
      { title: 'Where next?', body: 'Walk to Fort, or open the map with M for every district. Quick View in the header has the whole portfolio on one page if you are short on time.', next: 'fort' },
    ],
  },
  fort: {
    id: 'fort', guide: 'The research fellow', place: 'Fort Research Institute',
    steps: [
      { title: 'Research, reviewed upstream', body: 'In Google Summer of Code 2026 Harsh worked with QC-Devs / Theochem on multipole electrostatics in FFprime, an open-source scientific Python package. Everything in this room points back to that code.', view: { ...fortFloor(0, -.6), yaw: Math.PI / 2, pitch: .04 } },
      { title: 'Three panels, three ideas', body: 'Moments to potential, conventions to correctness, derivative to validation. Each panel names the pull requests where that idea landed. Face one and press E to read it.', view: { ...fortFloor(0, -3.2), yaw: Math.PI / 2, pitch: .12 }, exhibit: 'fort-panel-0' },
      { title: 'The field table', body: 'Arrows show the direction of the electric field of a charge, dipole and quadrupole. The inputs are invented teaching values, not a molecule, and the same maths drives the interactive map.', view: { ...fortFloor(-2.45, -3.35), yaw: Math.PI / 2, pitch: -.55 }, exhibit: 'fort-field' },
      { title: 'The coordinate workstation', body: 'FFprime stores multipoles in Cartesian and real spherical form. This workstation runs the Stone-convention conversions Harsh wrote, converts back and checks both potentials agree.', view: { ...fortFloor(-1.25, -3.2), yaw: Math.PI / 2, pitch: -.16 }, exhibit: 'fort-workstation' },
      { title: 'Follow the source', body: 'Five pull requests were merged upstream: potentials and fields with tests (#13), input validation (#14), direct spherical evaluation (#15), the MultipoleExpansion API (#18) and example notebooks (#19). Each card links to GitHub.', view: { ...fortFloor(-2.0, -2.2), yaw: Math.PI, pitch: 0 }, exhibit: 'fort-source' },
      { title: 'Your turn: the gradient check', body: 'One of the fixes was a factor of two in the quadrupole field. The kiosk by the door has three candidate formulas. Run the finite-difference check and find the one that is right.', view: { x: -8.0, z: -36.45, yaw: 0, pitch: -.2 }, exhibit: 'fort-gradient' },
      { title: 'The FFprime case study', body: 'The terminal on the right opens the full case study: the problem, the decisions, the tests and the evidence, with every claim linked to its source.', view: { ...fortFloor(1.25, -3.2), yaw: Math.PI / 2, pitch: -.16 }, exhibit: 'ffprime' },
      { title: 'Where next?', body: 'BKC holds the CCIEeXpert internship. Powai has the flagship projects with working demos. Hail a taxi from the street outside.', next: 'bkc' },
    ],
  },
};

/** The other seven districts: the guide's greeting, then one step per exhibit board, then the next stop. */
const DISTRICT_TOUR_ORDER = ['bkc', 'andheri', 'powai', 'dadar', 'worli', 'juhu', 'filmcity'];
const INTROS: Record<string, string> = {
  bkc: 'This stop is the CCIEeXpert internship: enterprise security tooling that integrates with Cisco Secure Access. Walk into the Systems Office: the boards in the lobby walk through it, and one of them is a console you can run.',
  andheri: 'Five shops, one per kind of skill. Each kiosk names the shop; inside, every skill links to the code that uses it, and a bench runs real logic from those repositories.',
  powai: 'Seven workplaces, one per project. Each board on the paving opens a working demo that runs the project’s own logic, or the case study where there is no demo.',
  dadar: 'The journey runs along this pavement as six platform boards, each with only the dates we can source. Read all six to travel the whole route.',
  worli: 'Four claims, four evidence cases on the promenade. Before you trust a number, check what stands behind it: a public record you can open, or a line on the résumé.',
  juhu: 'The studio is where the person lives, not the projects: step through the garden gate to a notice board, the résumé stand and a terminal to say hello.',
  filmcity: 'The Talkies shows Harsh’s story in nine scenes. The box office in the lobby seats you at the start, the scene board lets you start anywhere, and the hall beyond has the screen itself.',
};
for (const [i, id] of DISTRICT_TOUR_ORDER.entries()) {
  const zone = cityZones.find(z => z.id === id)!, place = districts.find(d => d.id === id)!, next = DISTRICT_TOUR_ORDER[i + 1];
  TOURS[id] = {
    id, guide: place.guide, place: place.title,
    steps: [
      { title: place.title, body: INTROS[id], view: { x: zone.originX + zone.stop.x, z: zone.stop.z, yaw: zone.stop.yaw, pitch: 0 } },
      ...exhibitsOf(id).map(e => { const v = readingSpot(e); return { title: e.tour.title, body: e.tour.body, exhibit: e.id, view: { ...v, x: zone.originX + v.x } }; }),
      next ? { title: 'Where next?', body: `${districts.find(d => d.id === next)!.title}: ${districts.find(d => d.id === next)!.descriptor}. Hail a taxi or an auto, or open the map with M.`, next }
        : { title: 'Where next?', body: 'That is the whole city. Juhu Studio has the résumé and a way to say hello, and Quick View has everything on one page.', next: 'juhu' },
    ],
  };
}

