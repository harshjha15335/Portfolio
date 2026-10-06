import type { Project } from '../data/projects';
import { Annotation } from './Annotation';
import { ProjectDemo } from './ProjectDemo';
import { ProjectGraphic } from './ProjectGraphic';
import { useModalClose } from './Modal';

export function CaseStudy({ project, world, onClose }: { project: Project; world: boolean; onClose: () => void }) {
  const dismiss = useModalClose(onClose);
  return <article className={`case-study project-${project.id}`}>
    <div className="case-heading"><div className="case-title-block"><p className="eyebrow">0{project.priority} / {project.category} · {project.year}</p><h1>{project.title}<span className="blue-period">.</span></h1><h2>{project.subtitle}</h2><Annotation mark="underline" /><p className="case-lead">{project.longDescription}</p></div>
      <div className="case-preview">{project.priority <= 4 ? <ProjectDemo project={project} /> : <ProjectGraphic project={project} />}<span className="caption">WORKING IDEAS / EXPLAINED IN THE OPEN</span></div>
    </div>
    {project.metrics.length > 0 && <div className="metrics">{project.metrics.map(metric => <div key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span>{metric.source && <a href={metric.source} target="_blank" rel="noreferrer">EVIDENCE ↗</a>}</div>)}</div>}
    <div className="case-narrative"><span className="case-margin-note">the engineering<br />behind the thing <Annotation mark="arrow" /></span><div className="case-grid"><section><span className="eyebrow">01 / THE PROBLEM</span><p>{project.problem}</p></section><section><span className="eyebrow">02 / WHAT I BUILT</span><p>{project.approach}</p></section><section><span className="eyebrow">03 / THE DIFFICULT PART</span><p>{project.challenges}</p></section><section><span className="eyebrow">04 / THE RESULT</span><p>{project.results}</p></section></div></div>
    <section className="ownership"><span className="eyebrow">MY CONTRIBUTION</span><p>{project.ownership}</p></section>
    <div className="case-skills">{project.skills.map(skill => <span key={skill}>{skill}</span>)}</div>
    <div className="case-links"><a className="primary-button" href={project.github} target="_blank" rel="noreferrer">VIEW CODE <span>↗</span></a><a className="text-button" href={project.source} target="_blank" rel="noreferrer">{project.id === 'ffprime' ? 'GSOC REPORT ↗' : 'SOURCE / EVIDENCE ↗'}</a>{project.demo && <a className="text-button" href={project.demo} target="_blank" rel="noreferrer">LIVE PROJECT ↗</a>}{project.id === 'ffprime' && <a className="text-button" href="https://github.com/theochem/ffprime/pulls?q=is%3Apr+author%3Aharshjha15335" target="_blank" rel="noreferrer">UPSTREAM CONTRIBUTIONS ↗</a>}</div>
    <button className="text-button return-button" onClick={dismiss}>← {world ? 'RETURN TO THE WORLD' : 'BACK TO PORTFOLIO'}</button>
  </article>;
}
