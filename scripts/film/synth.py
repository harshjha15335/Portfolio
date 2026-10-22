"""Original film score, synthesised from scratch with numpy (no samples, no third-party audio).
120 BPM, D minor. Cold open drone -> BRAAM title -> driving percussion + ostinato -> anthem -> riser -> silence -> final BRAAM + horn line."""
import numpy as np, wave, sys

SR = 48000
DUR = 42.0
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)
BEAT = .5

def t_arr(d): return np.arange(int(d * SR)) / SR
def midi(m): return 440 * 2 ** ((m - 69) / 12)

def add(sig, at, gain=1., pan=0.):
    i = int(at * SR); j = min(N, i + len(sig)); s = sig[:j - i]
    L[i:j] += s * gain * np.sqrt((1 - pan) / 2) * 1.414
    R[i:j] += s * gain * np.sqrt((1 + pan) / 2) * 1.414

def lowpass(x, cutoff):
    """One-pole low-pass; cutoff may be an array (sweeps)."""
    cutoff = np.broadcast_to(np.asarray(cutoff, float), x.shape)
    a = (1 - np.exp(-2 * np.pi * cutoff / SR)).tolist()
    y = [0.] * len(x); acc = 0.
    for i, v in enumerate(x.tolist()):
        acc += a[i] * (v - acc); y[i] = acc
    return np.array(y)

def lp_fast(x, cutoff, passes=2):
    for _ in range(passes): x = lowpass(x, cutoff)
    return x

def saw(f, t, detune=0.):
    ph = np.cumsum(np.broadcast_to(f * (1 + detune), t.shape)) / SR
    return 2 * (ph % 1) - 1

def env(t, a, d, s=0., r=0., hold=None):
    e = np.where(t < a, t / max(a, 1e-4), 1.)
    if hold is None: e = e * np.where(t >= a, np.exp(-(t - a) / d) * (1 - s) + s, 1.)
    return e

def noise(d): return rng.standard_normal(int(d * SR))

# ---------------------------------------------------------------- instruments
def kick(gain=1.):
    t = t_arr(.6); f = 45 + 110 * np.exp(-t * 28)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5)
    s += .3 * np.tanh(3 * s); click = noise(.6) * np.exp(-t * 300) * .3
    return (s + click) * gain

def taiko(pitch=70., gain=1.):
    t = t_arr(1.4); f = pitch * (1 + .6 * np.exp(-t * 20))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    skin = lp_fast(noise(1.4), 900) * np.exp(-t * 12) * 2.5
    return np.tanh((body + skin) * 1.6) * gain

def snare(gain=1.):
    t = t_arr(.5)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25)
    n = noise(.5); n = n - lp_fast(n, 1500, 1)
    n = lp_fast(n, 6000, 1)
    return (tone * .8 + n * np.exp(-t * 16) * .6) * gain

def hat(gain=1., open_=False):
    t = t_arr(.25); n = noise(.25); n = n - lp_fast(n, 7000, 1)
    return n * np.exp(-t * (18 if open_ else 70)) * gain

def braam(d=4.5, gain=1., root=38):
    t = t_arr(d); out = np.zeros_like(t)
    for m, g in [(root - 12, 1.), (root, .9), (root + 7, .55), (root + 12, .35)]:
        for dt in (-.006, .0, .007):
            out += saw(midi(m), t, dt) * g
    cut = 200 + 2600 * np.exp(-t * 1.6) + 400 * np.exp(-t * .3)
    out = lp_fast(out, 900, 1) * .5 + lowpass(out, cut) * .8
    e = np.minimum(1, t / .015) * np.exp(-t / (d * .38))
    sub = np.sin(2 * np.pi * midi(root - 24) * t) * np.exp(-t * .9) * 1.6
    boom = kick(1.4); out = np.tanh(out * e * .7) + sub * np.minimum(1, t / .01)
    out[:len(boom)] += boom
    return out * gain

def whoosh(d=1.2, gain=1., rise=True):
    t = t_arr(d); n = noise(d)
    cut = (300 + 6000 * (t / d) ** 2) if rise else (6000 - 5600 * (t / d) ** .5)
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** (2 if rise else 1)
    if rise: e = (t / d) ** 2.5
    return lp_fast(n, cut, 2) * e * gain

def jet(d=3.0, gain=1.):
    """Fly-by: filtered noise + turbine whine with a Doppler pitch drop at the midpoint."""
    t = t_arr(d); x = (t - d / 2) / (d / 2)
    amp = 1 / (1 + 6 * x ** 2)
    f = 1800 * (1 - .35 * np.tanh(x * 3))
    whine = np.sin(2 * np.pi * np.cumsum(f) / SR) * .12
    rum = lp_fast(noise(d), 300 + 1200 * amp, 3)
    return (rum * 2.2 + whine * .5) * amp * gain

def pluck(m, d=.24, gain=1., bright=2500):
    t = t_arr(d); s = saw(midi(m), t) + .5 * saw(midi(m), t, .004)
    s = lowpass(s, 300 + bright * np.exp(-t * 18)); return s * np.exp(-t * 9) * gain

def pad(ms, d, gain=1., cut=1200):
    t = t_arr(d); s = np.zeros_like(t)
    for m in ms:
        for dt in (-.004, .004): s += saw(midi(m), t, dt)
    s = lp_fast(s, cut, 2); e = np.minimum(1, t / .25) * np.minimum(1, (d - t) / .3)
    return s * e * gain / len(ms)

def horn(m, d, gain=1.):
    t = t_arr(d); vib = 1 + .004 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / .4)
    s = saw(midi(m) * vib, t) + .6 * saw(midi(m - 12) * vib, t, .002) + .4 * saw(midi(m) * vib, t, .006)
    s = lowpass(s, 500 + 1400 * np.minimum(1, t / .12))
    e = np.minimum(1, t / .07) * np.minimum(1, np.maximum(0, d - t) / .15)
    return np.tanh(s * 1.2) * e * gain

# ---------------------------------------------------------------- arrangement
# 0-6: cold open: drone, a distant jet, a soft taiko on the text.
t = t_arr(6.3); drone = (np.sin(2 * np.pi * midi(26) * t) + .5 * lowpass(saw(midi(38), t, .003), 260)) * np.minimum(1, t / 2.5)
add(drone * np.minimum(1, (6.3 - t) / .3), 0, .35)
add(jet(3.4), .4, .35, -.6)
add(taiko(60, .9), .45, .6); add(taiko(55, .9), 3.6, .7)
add(whoosh(1.6, .5), 4.4, .9)
# 6.0: title BRAAM.
add(braam(4.2), 6.0, .55)
# 8-32: driving section.
DM = [62, 62, 65, 62, 69, 62, 67, 65, 62, 62, 65, 62, 70, 69, 67, 65]  # D minor ostinato, sixteenths
CH = [[50, 57, 62, 65], [46, 53, 58, 62], [41, 48, 53, 57], [48, 55, 60, 64]]  # Dm Bb F C
for bar in range(12):  # 12 bars x 2 s = 8..32
    b0 = 8 + bar * 2
    for beat in range(4):
        at = b0 + beat * BEAT
        add(kick(.9), at, .45 if beat in (0, 2) or bar >= 4 else .0)
        if beat in (1, 3): add(snare(), at, .26 if bar >= 2 else .14, .1)
        for e in range(2): add(hat(.5, open_=(e == 1 and beat == 3)), at + e * .25, .07, .3)
    add(taiko(68, 1.), b0, .55, -.2); add(taiko(80, .7), b0 + 1.75, .35, .25)
    if bar % 2 == 1: add(taiko(74, .8), b0 + 1.25, .3, -.3)
    for k in range(16):
        add(pluck(DM[k] + (12 if bar >= 6 and k % 4 == 0 else 0), gain=.9), b0 + k * .125, .26 if bar < 4 else .3, (-.4 if k % 2 else .4))
    bass = CH[bar % 4][0] - 12
    for k in range(8): add(pluck(bass, .22, 1.2, 900), b0 + k * .25, .35)
    if bar >= 4: add(pad(CH[bar % 4], 2.05, 1., 1500 if bar < 8 else 2400), b0, .26)
# Impacts and whooshes on the text slams.
for at in [12.0, 13.0, 14.0, 15.0, 16.0, 20.0, 24.0, 28.0]: add(braam(1.4, .35, 38), at, .4)
for at in [20.5, 21.0, 21.5, 22.0, 22.5, 23.0, 23.5]: add(taiko(90, .9), at, .4)
for at in [9.8, 11.8, 15.8, 17.8, 19.8, 25.8, 27.8, 29.8]: add(whoosh(.45, .7), at - .25, .5)
add(jet(2.6, 1.), 16.6, .4, .7)  # fly-by over the chase
add(jet(2.2, 1.), 25.0, .35, -.7)
# Anthem line over 24-32 (original melody).
mel = [(62, 1.), (69, .5), (67, .5), (65, 1.), (64, .5), (62, .5), (65, 1.), (67, .5), (69, 1.5), (70, 1.), (69, .5), (67, .5), (65, 2.)]
at = 24.0
for m, d in mel:
    add(horn(m, d * .98, 1.), at, .26, -.15); at += d
# 32-34: riser, accelerating snare roll, then a cut to silence.
add(whoosh(2.0, 1.4), 32.0, .55)
t = t_arr(2.0); add(np.sin(2 * np.pi * np.cumsum(110 * 2 ** (t * 1.4)) / SR) * (t / 2) ** 2, 32.0, .2)
roll, x = [], 32.0
while x < 33.95:
    roll.append(x); x += max(.04, .25 * (1 - (x - 32) / 2.2))
for i, at in enumerate(roll): add(snare(), at, .12 + .25 * i / len(roll), (-.2 if i % 2 else .2))
add(taiko(55, 1.), 33.5, .6); add(taiko(50, 1.), 33.75, .7)
# 34.0-34.5 silence; 34.5 final BRAAM and the horn line.
add(braam(6.5, 1., 38), 34.5, .7)
t = t_arr(7.0); add(pad([50, 57, 62, 65, 69], 7.0, 1., 1800) * np.minimum(1, t / 1.5), 35.0, .3)
at = 35.2
for m, d in [(62, .75), (69, .75), (74, 2.0), (72, .5), (70, .5), (69, 1.5)]:
    add(horn(m, d * .98, 1.), at, .34, .1); at += d
for k, at in enumerate([36.5, 37.5, 38.5, 39.5]): add(taiko(64 - k * 3, 1.), at, .4)
add(braam(3.5, .6, 38), 39.0, .45)

# ---------------------------------------------------------------- master: reverb, glue, fade
def reverb(x, d=2.2, mix=.22, seed=1):
    r = np.random.default_rng(seed); n = int(d * SR); tt = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-tt * 3.0 / d * 2.3); ir[:int(.012 * SR)] = 0
    ir = lp_fast(ir, 5000, 1); ir /= np.sqrt((ir ** 2).sum())
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x)]
    return x * (1 - mix) + wet * mix * 1.6

L = reverb(L, seed=1); R = reverb(R, seed=2)
# Hard cut to silence before the final hit (after the reverb, so no tail leaks through).
g0, g1 = int(34.02 * SR), int(34.5 * SR); L[g0:g1] *= .004; R[g0:g1] *= .004
mix = np.stack([L, R])
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
t = np.arange(N) / SR; mix *= np.minimum(1, (DUR - t) / 1.2)
mix /= np.abs(mix).max() / .9
out = (mix.T * 32767).astype('<i2')
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'score.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('ok')
