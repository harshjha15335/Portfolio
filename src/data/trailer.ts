/** The Film City Talkies trailer: rendered from this city with an original synthesised score (see docs/TALKIES_TRAILER.md). */
export const TRAILER = {
  poster: '/media/talkies-trailer.jpg', captions: '/media/talkies-trailer.vtt', seconds: 42,
  /** H.264/AAC first (every major browser with system codecs), then VP9/Opus for browsers built without them. */
  sources: [
    { src: '/media/talkies-trailer.mp4', type: 'video/mp4; codecs="avc1.4d401f, mp4a.40.2"' },
    { src: '/media/talkies-trailer.webm', type: 'video/webm; codecs="vp9, opus"' },
  ],
};
/** The first source this browser says it can play. */
export const trailerSource = (video: HTMLVideoElement) => (TRAILER.sources.find(s => video.canPlayType(s.type)) ?? TRAILER.sources[0]).src;
