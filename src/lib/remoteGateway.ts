export type GatewayPayload = {
  text: string;
  tone: 'professional' | 'casual' | 'concise' | 'creative';
  fidelity: 'strict' | 'balanced';
  length: 'same' | 'shorter' | 'longer';
};

function maskText(value: string): string {
  return value
    .replace(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi, '[EMAIL]')
    .replace(/(\+?\d[\d\s().-]{7,}\d)/g, '[PHONE]')
    .replace(/\b\d+\s+[A-Za-z0-9 .'-]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr)\b/gi, '[ADDRESS]');
}

export async function rewriteViaGateway(payload: GatewayPayload) {
  const response = await fetch('http://localhost:3001/rewrite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: maskText(payload.text),
      tone: payload.tone,
      fidelity: payload.fidelity,
      length: payload.length,
    }),
  });

  if (!response.ok) {
    throw new Error('Gateway request failed');
  }

  const data = await response.json();
  return {
    type: 'REWRITE_RESPONSE',
    variants: data.variants,
    model: data.model,
    status: 'ok',
  };
}
