import { describe, expect, it } from 'vitest';
import { projects } from '../src/data/projects';
import { portfolio } from '../src/data/portfolio';
import { experience } from '../src/data/experience';
import { skills } from '../src/data/skills';

describe('portfolio content integrity', () => {
  it('keeps the four featured landmarks and six case studies addressable', () => {
    expect(projects.map(project => project.id)).toEqual(['ffprime', 'northstar', 'reco', 'moneymetrics', 'meeting-intelligence-service', 'rideflow']);
    expect(new Set(projects.map(project => project.id)).size).toBe(projects.length);
    expect(projects.filter(project => project.priority <= 4).map(project => project.landmarkType)).toEqual(['research', 'terminal', 'tower', 'vault']);
    expect(new Set(projects.map(project => project.priority)).size).toBe(projects.length);
  });

  it.each(projects)('$title has complete content, evidence, and valid world placement', project => {
    for (const text of [project.title, project.subtitle, project.shortDescription, project.longDescription, project.problem, project.approach, project.challenges, project.results, project.ownership]) {
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text).not.toMatch(/lorem ipsum|\bTODO\b|placeholder/i);
    }
    expect(project.architecture.length).toBeGreaterThanOrEqual(3);
    expect(project.skills.length).toBeGreaterThanOrEqual(3);
    expect(new URL(project.github).hostname).toBe('github.com');
    expect(new URL(project.source).protocol).toBe('https:');
    if (project.demo) expect(new URL(project.demo).protocol).toBe('https:');
    expect(project.worldPosition.every(Number.isFinite)).toBe(true);
    expect(project.worldRotation).toBeTypeOf('number');
    expect(project.color).toMatch(/^#[0-9a-f]{6}$/i);
    for (const metric of project.metrics) {
      if (metric.source) expect(metric.source.startsWith('https://') || metric.source === portfolio.resume).toBe(true);
    }
  });

  it('retains quantitative claim qualifiers and simulation boundaries', () => {
    const ffprime = projects.find(project => project.id === 'ffprime')!;
    expect(ffprime.metrics.filter(metric => /speedup|RMSE/.test(metric.label)).every(metric => /résumé reported/.test(metric.label) && metric.source === portfolio.resume)).toBe(true);
    const reco = projects.find(project => project.id === 'reco')!;
    expect(reco.metrics.every(metric => /seeded/.test(metric.label) && !!metric.source)).toBe(true);
    expect(reco.results).toMatch(/not production/);
    expect(projects.find(project => project.id === 'northstar')!.results).toMatch(/Real broker execution remains disabled/);
    expect(projects.find(project => project.id === 'rideflow')!.results).toMatch(/simulations/);
  });

  it('uses consistent identity, résumé, experience, and skill data', () => {
    expect(portfolio.name).toBe('Harsh Jha');
    expect(portfolio.resume).toBe('/resume/Harsh-Jha-Resume.pdf');
    expect(portfolio.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(new URL(portfolio.github).pathname).toBe('/harshjha15335');
    expect(experience.length).toBeGreaterThanOrEqual(2);
    expect(experience.every(item => item.highlights.length > 0 && !!item.source)).toBe(true);
    expect(skills.every(group => group.items.length > 0 && new Set(group.items).size === group.items.length)).toBe(true);
  });
});
