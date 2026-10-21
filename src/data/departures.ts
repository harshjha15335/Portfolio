/**
 * The CST departure board doubles as the portfolio's navigation system: each "train" is a
 * kind of evidence, bound for the district that holds it. Times are scene props, not a timetable.
 */
export interface Departure { time: string; category: string; marathi: string; district: string; via: string }
export const DEPARTURES: Departure[] = [
  { time: '17:42', category: 'Open source', marathi: 'मुक्त स्रोत', district: 'fort', via: 'Walk · up Fort Road' },
  { time: '17:45', category: 'Internships', marathi: 'इंटर्नशिप', district: 'bkc', via: 'Taxi · BKC' },
  { time: '17:47', category: 'Skills', marathi: 'कौशल्ये', district: 'andheri', via: 'Auto · Andheri' },
  { time: '17:50', category: 'Projects', marathi: 'प्रकल्प', district: 'powai', via: 'Taxi · Powai' },
  { time: '17:52', category: 'Education', marathi: 'शिक्षण', district: 'dadar', via: 'Taxi · Dadar' },
  { time: '17:55', category: 'Achievements', marathi: 'कामगिरी', district: 'worli', via: 'Taxi · Worli' },
  { time: '17:58', category: 'About', marathi: 'माझ्याबद्दल', district: 'juhu', via: 'Auto · Juhu' },
  { time: '18:05', category: 'Cinema', marathi: 'चित्रपट', district: 'filmcity', via: 'Taxi · Goregaon' },
];
