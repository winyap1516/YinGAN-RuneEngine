import fetch from 'node-fetch';

function extractText(data) {
  const openai = data?.choices?.[0]?.message?.content;
  if (openai) return String(openai);
  const parts = data?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) return parts.map(p => p?.text || '').filter(Boolean).join('\n');
  return '';
}

async function main() {
  const body = {
    model: 'gemini-2.5-flash',
    messages: [
      {
        role: 'system',
        content: '你是图像理解助手，只返回简短中文描述。'
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: '请描述这张图片的主要内容' },
          { type: 'image_url', image_url: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg/640px-Tour_Eiffel_Wikimedia_Commons.jpg' } }
        ]
      }
    ]
  };
  const r = await fetch('http://localhost:3000/api/gemini/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  const content = extractText(data) || JSON.stringify(data);
  console.log('Status:', r.status);
  console.log('Vision:', content.slice(0, 200));
}

main().catch(err => {
  console.error('Smoke vision error:', err);
  process.exit(1);
});