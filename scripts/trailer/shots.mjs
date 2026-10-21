export const time = '17:40';
const K = (a, b, extra = {}) => [{ t: 0, ...a }, { t: 1, ...b }];
export const shots = [
  { id: 's01-cst-aerial', view: 'spawn', frames: 96, ease: 'linear', keys: K({ pos: [0, 26, 44], look: [0, 6, -40], roll: .06 }, { pos: [0, 15, -4], look: [0, 4, -90], roll: 0 }) },
  { id: 's03-fort-dolly', view: 'fort', frames: 48, ease: 'linear', keys: K({ pos: [-4.2, .6, -14], look: [-3, 3, -45] }, { pos: [-4.4, .9, -26], look: [-5, 3, -50] }) },
  { id: 's04-fort-tilt', view: 'fort', frames: 48, keys: K({ pos: [-4.3, 1.2, -27.5], look: [-9.5, 2.2, -35], fov: 62 }, { pos: [-4.5, .9, -29], look: [-9.5, 9, -36], fov: 54 }) },
  { id: 's05-cst-whip', view: 'cst-traffic', frames: 48, ease: 'in', keys: K({ pos: [3, 1.5, -20], look: [-10, 3, -32] }, { pos: [3.5, 1.5, -22], look: [10, 3, -42] }) },
  { id: 's06-bkc-crane', view: 'bkc', frames: 48, keys: K({ pos: [0, 2, 25], look: [0, 6, -30] }, { pos: [0, 18, 15], look: [0, 4, -40] }) },
  { id: 's07-bkc-chase', view: 'bkc', frames: 48, ease: 'linear', follow: { near: [-2, 10, 0], from: [-2.4, 1.0, 6], to: [-1.4, .9, 3.6], look: [0, 1, -12], fov: 60 } },
  { id: 's08-bkc-flyby', view: 'bkc-boulevard', frames: 48, ease: 'linear', keys: K({ pos: [6, 3, 10], look: [-4, 6, -60], roll: .1 }, { pos: [-2, 5, -25], look: [-4, 6, -90], roll: -.05 }) },
  { id: 's09-powai', view: 'powai', frames: 36, keys: K({ pos: [2, 7, 24], look: [6, 4, -40] }, { pos: [3, 5, 4], look: [6, 4, -60] }) },
  { id: 's10-andheri', view: 'andheri-lane', frames: 36, ease: 'linear', keys: K({ pos: [-3, 1.7, 14], look: [-1, 2.5, -30] }, { pos: [-3, 1.7, 4], look: [-1, 2.5, -40] }) },
  { id: 's11-andheri-whip', view: 'andheri-stalls', frames: 24, ease: 'in', keys: K({ pos: [3.6, 1.6, -20], look: [-8, 3, -30] }, { pos: [3.6, 1.6, -21], look: [8, 3, -40] }) },
  { id: 's12-dadar-chase', view: 'dadar-traffic', frames: 48, ease: 'linear', follow: { near: [-2, -10, 0], from: [-2.6, .7, -6.5], to: [-1.9, .9, -4.8], look: [0, 1, 8], fov: 58 } },
  { id: 's13-worli-aerial', view: 'worli', frames: 48, keys: K({ pos: [0, 25, 30], look: [0, 0, -60] }, { pos: [0, 16, 0], look: [0, 2, -80] }) },
  { id: 's14-dadar-station', view: 'dadar-station', frames: 48, ease: 'linear', keys: K({ pos: [4.8, 1.7, 16], look: [6, 3, -20] }, { pos: [4.8, 1.7, 8], look: [6, 3, -30] }) },
  { id: 's15-juhu', view: 'juhu', frames: 48, keys: K({ pos: [-2, 1.2, 10], look: [0, 4, -30], roll: -.05 }, { pos: [0, 6, -2], look: [0, 3, -60], roll: 0 }) },
  { id: 's17-talkies', view: 'filmcity-talkies', frames: 108, keys: K({ pos: [-3, 1.0, 16], look: [8, 3.5, 2], fov: 60 }, { pos: [-3.2, 7, 13], look: [8, 5, 0], fov: 50 }) },
];
