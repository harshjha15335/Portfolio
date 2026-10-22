/** The Film City Talkies film: rendered from this city with an original synthesised score (see docs/TALKIES_FILM.md). */
export const FILM = {
  poster: '/media/talkies-film.jpg', captions: '/media/talkies-film.vtt', seconds: 42,
  /** H.264/AAC first (every major browser with system codecs), then VP9/Opus for browsers built without them. */
  sources: [
    { src: '/media/talkies-film.mp4', type: 'video/mp4; codecs="avc1.4d401f, mp4a.40.2"' },
    { src: '/media/talkies-film.webm', type: 'video/webm; codecs="vp9, opus"' },
  ],
};
/** The first source this browser says it can play. */
export const filmSource = (video: HTMLVideoElement) => (FILM.sources.find(s => video.canPlayType(s.type)) ?? FILM.sources[0]).src;
