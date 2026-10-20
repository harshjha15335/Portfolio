import { lazy, Suspense } from 'react';

/**
 * The working labs carry their ported project logic and recorded fixtures (ASTFLOW alone ships a 235 kB
 * record), so they load on first open instead of with the landing page.
 */
const Astflow = lazy(() => import('./AstflowLab').then(m => ({ default: m.AstflowLab })));
const Shops = lazy(() => import('./AndheriShops').then(m => ({ default: m.SkillShops })));
const Flagship = lazy(() => import('./FlagshipLab').then(m => ({ default: m.FlagshipDemo })));

const Loading = () => <p className="caption lab-loading" role="status">LOADING THE LAB…</p>;

export const AstflowLab = () => <Suspense fallback={<Loading />}><Astflow /></Suspense>;
export const SkillShops = (props: Parameters<typeof import('./AndheriShops').SkillShops>[0]) => <Suspense fallback={<Loading />}><Shops {...props} /></Suspense>;
export const FlagshipDemo = (props: Parameters<typeof import('./FlagshipLab').FlagshipDemo>[0]) => <Suspense fallback={<Loading />}><Flagship {...props} /></Suspense>;
