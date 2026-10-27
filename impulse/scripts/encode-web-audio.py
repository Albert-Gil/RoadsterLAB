"""Offline compressed copies of the processed web WAVs for the served site.
Usage: python scripts/encode-web-audio.py   (requires ffmpeg with libopus and aac)
Never edits the WAV masters. Writes assets/audio/compressed/<name>.webm (Opus) and
<name>.m4a (AAC-LC) plus manifest.json with sizes, exact frame counts and SHA-256.
The standalone HTML keeps embedding the WAVs; browsers that cannot decode a
compressed copy fall back to the WAV automatically (see src/audio.js).
"""
from pathlib import Path
import hashlib, json, subprocess, tempfile, wave
ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'assets' / 'audio' / 'web'
OUT = ROOT / 'assets' / 'audio' / 'compressed'
OUT.mkdir(parents=True, exist_ok=True)
catalog = json.loads((ROOT / 'assets' / 'audio' / 'catalog.json').read_text())
manifest = {}
for name, asset in catalog.items():
    src = WEB / asset['file']
    with wave.open(str(src)) as w:
        frames, rate, channels, width = w.getnframes(), w.getframerate(), w.getnchannels(), w.getsampwidth()
        pcm = w.readframes(frames)
    # Loops are encoded with a wrapped quarter second on both sides, so the codec sees the real
    # neighbours at the seam; the browser keeps only frames [lead, lead + frames).
    lead = round(.25 * rate) if asset['loop'] else 0
    frame_bytes = channels * width
    body = pcm[-lead * frame_bytes:] + pcm + pcm[:lead * frame_bytes] if lead else pcm
    tmp = Path(tempfile.mkstemp(suffix='.wav')[1])
    with wave.open(str(tmp), 'wb') as w:
        w.setnchannels(channels); w.setsampwidth(width); w.setframerate(rate); w.writeframes(body)
    entry = {'frames': frames, 'lead': lead, 'sampleRate': rate, 'channels': channels, 'loop': asset['loop'], 'wavBytes': src.stat().st_size}
    # Music and stereo ambience get a little more bitrate than mono effects.
    kbps = 112 if name == 'background_music' else 96 if channels == 2 else 64
    for ext, codec in [('webm', ['-c:a', 'libopus', '-b:a', f'{kbps}k', '-vbr', 'on', '-application', 'audio']),
                       ('m4a', ['-c:a', 'aac', '-b:a', f'{kbps + 32}k', '-movflags', '+faststart'])]:
        dst = OUT / f'{name}.{ext}'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(tmp), *codec, '-map_metadata', '-1', '-fflags', '+bitexact', str(dst)], check=True)
        data = dst.read_bytes()
        entry[ext] = {'file': dst.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    tmp.unlink()
    manifest[name] = entry
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=1) + '\n')
total = lambda key: sum(e[key]['bytes'] for e in manifest.values())
print('wav', sum(e['wavBytes'] for e in manifest.values()), 'webm', total('webm'), 'm4a', total('m4a'))
