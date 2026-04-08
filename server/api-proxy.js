/**
 * Claude API 프록시
 * 브라우저에서 직접 API를 호출하지 않고, 서버를 통해 호출합니다.
 * API 키가 브라우저에 노출되지 않아 안전합니다.
 */

const express = require('express');

function createApiProxy() {
  const router = express.Router();

  // Claude API 프록시
  router.post('/ask', async (req, res) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey || apiKey === '여기에_API키_입력') {
      return res.status(400).json({
        error: 'API 키가 설정되지 않았습니다. server/.env 파일에 ANTHROPIC_API_KEY를 입력하세요.'
      });
    }

    try {
      const { system, messages, max_tokens, model } = req.body;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model || 'claude-haiku-4-5-20251001',
          max_tokens: max_tokens || 300,
          system: system || '',
          messages: messages || []
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      res.json(data);
    } catch (err) {
      console.error('[API Proxy] 에러:', err.message);
      res.status(500).json({ error: '서버 에러: ' + err.message });
    }
  });

  // Claude Vision API 프록시 (카메라 AI용)
  router.post('/vision', async (req, res) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey || apiKey === '여기에_API키_입력') {
      return res.status(400).json({
        error: 'API 키가 설정되지 않았습니다.'
      });
    }

    try {
      const { system, image_base64, prompt, max_tokens } = req.body;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: max_tokens || 400,
          system: system || '',
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image_base64 } },
              { type: 'text', text: prompt || '이 이미지를 분석해주세요.' }
            ]
          }]
        })
      });

      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error('[Vision Proxy] 에러:', err.message);
      res.status(500).json({ error: '서버 에러: ' + err.message });
    }
  });

  return router;
}

module.exports = { createApiProxy };
