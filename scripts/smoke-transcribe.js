import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';

function createSineWav({ durationSec = 1, freq = 440, sampleRate = 16000, amplitude = 0.3 } = {}) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const bytesPerSample = 2; // PCM 16-bit
  const dataSize = numSamples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;
  const writeString = (s) => { buffer.write(s, offset); offset += s.length; };
  const writeUint32 = (v) => { buffer.writeUInt32LE(v, offset); offset += 4; };
  const writeUint16 = (v) => { buffer.writeUInt16LE(v, offset); offset += 2; };

  // RIFF header
  writeString('RIFF');
  writeUint32(36 + dataSize);
  writeString('WAVE');

  // fmt chunk
  writeString('fmt ');
  writeUint32(16); // PCM header size
  writeUint16(1);  // PCM format
  writeUint16(1);  // channels: mono
  writeUint32(sampleRate);
  writeUint32(sampleRate * bytesPerSample * 1); // byte rate
  writeUint16(bytesPerSample * 1); // block align
  writeUint16(16); // bits per sample

  // data chunk
  writeString('data');
  writeUint32(dataSize);

  // Sine wave samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * freq * t) * (amplitude * 32767);
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), 44 + i * 2);
  }
  return buffer;
}

function extractText(data) {
  const openai = data?.choices?.[0]?.message?.content;
  if (openai) return String(openai);
  const parts = data?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) return parts.map(p => p?.text || '').filter(Boolean).join('\n');
  return '';
}

async function main() {
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const wavPath = path.join(tmpDir, 'smoke.wav');
  fs.writeFileSync(wavPath, createSineWav());

  const form = new FormData();
  form.append('file', fs.createReadStream(wavPath), { filename: 'smoke.wav', contentType: 'audio/wav' });
  form.append('model', 'gemini-2.5-flash');

  const r = await fetch('http://localhost:3000/api/gemini/audio/transcriptions', {
    method: 'POST',
    headers: { ...form.getHeaders() },
    body: form,
  });
  const data = await r.json();
  const text = extractText(data) || data?.text || (Array.isArray(data?.segments) ? data.segments.map(s => s.text).join(' ') : '');
  console.log('Status:', r.status);
  console.log('Transcription:', (text || JSON.stringify(data)).slice(0, 200));
}

main().catch(err => {
  console.error('Smoke transcribe error:', err);
  process.exit(1);
});