# AI provider plugins

Docodez can use AI for some operations — translating a node, finding objects or a document in a photo, reading text
(OCR), transcribing dictation — and plugins can ask for AI too (see [`aiExtract`](api.md#ai-api-3)). Docodez is not
tied to any provider: **providers are plugins**.

An AI plugin is **declarative**: a `docodez-plugin.json` with an `ai` section, no page and no JavaScript. Docodez
implements the protocols itself, so:

- a new provider that speaks a known protocol is just a manifest;
- it works the same on desktop, Android and the web;
- the user's API keys never pass through third-party code (they are stored protected by the system: DPAPI on Windows,
  Keystore on Android, the user's settings on Docodez Web).

## Example

```json
{
  "id": "me.ai-myprovider",
  "name": "My Provider (AI)",
  "version": "1.0.0",
  "description": "AI with My Provider (needs an API key): translate, objects and documents in photos, read text.",
  "category": "ai",
  "author": "Me",
  "icon": "icon.svg",
  "apiVersion": 2,
  "ai": {
    "protocol": "openai",
    "baseUrl": "https://api.myprovider.com/v1",
    "baseUrlEditable": false,
    "needsKey": true,
    "keyUrl": "https://myprovider.com/account/keys",
    "capabilities": ["text.translate", "image.objects", "image.document", "image.text", "speech.transcribe"],
    "models": { "text": "fast-model", "vision": "vision-model", "transcribe": "whisper-large-v3" }
  }
}
```

## The `ai` section

| Field | Meaning |
|---|---|
| `protocol` | `ollama` (Ollama's own API: `/api/chat`, `/api/tags`), `openai` (chat completions, `/audio/transcriptions`, `/models` — OpenAI, Groq, LiteLLM, OpenRouter, LM Studio, Ollama's `/v1`...) or `anthropic` (Messages API). |
| `baseUrl` | The API address. Must be an absolute URL. |
| `baseUrlEditable` | `true` (default) lets the user change it — for self-hosted servers (Ollama, LiteLLM). `false` for fixed services. |
| `needsKey` | The provider needs an API key. |
| `keyUrl` | Where the user gets a key (shown in the settings). |
| `capabilities` | What the provider can do (unknown values are ignored; at least one known one is required). |
| `models` | Default model per role; the user can change them (Docodez lists the provider's models). |

| Capability | Input → output | Model role |
|---|---|---|
| `text.translate` | text or page + language → translated text | `text` |
| `image.objects` | photo → named boxes | `vision` |
| `image.document` | photo → the document's corners | `vision` |
| `image.text` | photo → its text (OCR); also used by `aiExtract` | `ocr` (falls back to `vision`) |
| `speech.transcribe` | audio → text | `transcribe` |

## What the user does

1. Installs your plugin (from a catalog or the `.dczp`).
2. In *Settings → Extensions → AI providers*: sets the address and key if needed, presses **Test** (Docodez fetches the
   model list), and **accepts** that what they ask will be sent to that provider. Nothing is sent before that consent.
3. Buttons appear where your capabilities apply. The user can choose which provider handles each capability.

## Examples in this repository

[`examples/ai-ollama`](../examples/ai-ollama), [`ai-openai`](../examples/ai-openai),
[`ai-groq`](../examples/ai-groq), [`ai-claude`](../examples/ai-claude), [`ai-litellm`](../examples/ai-litellm).
Pack one with `node tools/pack.mjs examples/ai-groq`.

If you need a provider with a protocol Docodez does not speak, open an issue: protocols are added to Docodez itself.
