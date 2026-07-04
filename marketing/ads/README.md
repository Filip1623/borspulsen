# BörsPulsen — Ads (Higgsfield)

Samlade AI-genererade marknadsföringstillgångar för BörsPulsen. Filerna själva
kunde inte laddas ner automatiskt (se "Känt problem" nedan) — länkarna nedan
pekar på Higgsfields CDN.

## Bild-annons

- **Fil:** `borspulsen-ad-01.png`
- **Modell:** `marketing_studio_image`
- **Kostnad:** 2 credits
- **Länk:** https://d8j0ntlcm91z4.cloudfront.net/user_3G2wAw6WsqfnaabNwuVdELnfyQP/hf_20260704_173242_2e4a8a87-cc0e-4d1a-bb52-5d4c9ca5cff6.png
- Premium fintech-annons, 1:1, dark navy, telefon/laptop med kursgrafer, tagline "BörsPulsen — Börsen i realtid".

## Video v1 — långsam inzoom

- **Fil:** `borspulsen-ad-video-v1-slowzoom.mp4`
- **Modell:** `kling3_0_turbo` (start_image = bild-annonsen ovan)
- **Kostnad:** 7,5 credits
- **Längd:** 5s, 1:1
- **Länk:** https://d8j0ntlcm91z4.cloudfront.net/user_3G2wAw6WsqfnaabNwuVdELnfyQP/hf_20260704_173546_6e889e0d-d21b-4e92-b40b-2e1ab6cce015.mp4
- **Virality-analys:** overall 54/100, viral potential 53/100, **hook_score 38/100** (svag), sustain 100/100, peak vid sekund 5.
- **Rapport:** https://d8j0ntlcm91z4.cloudfront.net/user_3G2wAw6WsqfnaabNwuVdELnfyQP/hf_20260704_174115_41ce1374-ff66-4447-bc4c-f518e7d8e84c.html

## Video v2 — snabb, punchig öppning (förbättrad hook)

- **Fil:** `borspulsen-ad-video-v2-punchyhook.mp4`
- **Modell:** `kling3_0_turbo` (start_image = bild-annonsen ovan)
- **Kostnad:** 7,5 credits
- **Längd:** 5s, 1:1
- **Länk:** https://d8j0ntlcm91z4.cloudfront.net/user_3G2wAw6WsqfnaabNwuVdELnfyQP/hf_20260704_174715_111a290b-de7f-47c0-be90-a62e15f8e1d3.mp4
- Gjord om utifrån v1:s analys: snabb sifferräkning, ljusblixt och stapel-shoot-up under första sekunden i stället för långsam inzoom, för att stärka hooken. Ej omanalyserad ännu.

## Bild-annonser, batch 2 — fem vinklar

Alla 1:1, `marketing_studio_image`, 2 credits styck.

1. **"Följ börsen i realtid"** — real-time ticker/candlestick-hook
   `borspulsen-ad-02-realtid.png`
   https://d8j0ntlcm91z4.cloudfront.net/user_3G2wAw6WsqfnaabNwuVdELnfyQP/hf_20260704_220401_1e7d390e-8e4a-4067-988c-7859abf9c037.png
2. **"Alla sektorer. En app."** — sektor-ikoner (tech, finans, industri, hälsa, energi, material, konsument)
   `borspulsen-ad-03-sektorer.png`
   https://d8j0ntlcm91z4.cloudfront.net/user_3G2wAw6WsqfnaabNwuVdELnfyQP/hf_20260704_220404_cf56cb6f-99e3-42d1-9d58-69802ec13aea.png
3. **"Din AI-analytiker, dygnet runt"** — AI-chatten
   `borspulsen-ad-04-ai-chatt.png`
   https://d8j0ntlcm91z4.cloudfront.net/user_3G2wAw6WsqfnaabNwuVdELnfyQP/hf_20260704_220406_0aab379b-3f86-4f26-9169-5a00554696e8.png
4. **"Börsen i fickan"** — mobil/på språng, Stockholm-vibe
   `borspulsen-ad-05-fickan.png`
   https://d8j0ntlcm91z4.cloudfront.net/user_3G2wAw6WsqfnaabNwuVdELnfyQP/hf_20260704_220409_79d42ee0-7b2d-4d9f-ada7-b0f2b9b2101b.png
5. **"Nyckeltal på sekunden"** — fundamentals-dashboard (P/E, P/S, direktavkastning, EPS)
   `borspulsen-ad-06-nyckeltal.png`
   https://d8j0ntlcm91z4.cloudfront.net/user_3G2wAw6WsqfnaabNwuVdELnfyQP/hf_20260704_220412_f5c3b0df-407e-40c2-90c9-231b77a0ffe9.png

## Känt problem — filer ej nedladdade

Sandboxens nätverksproxy blockerar (403) utgående anrop till Higgsfields
CDN-domän (`d8j0ntlcm91z4.cloudfront.net`) enligt organisationens
egress-policy. Det går alltså inte att `curl`/ladda ner filerna direkt till
repot härifrån. Alternativ:

1. Ladda ner filerna manuellt via länkarna ovan och lägg dem i denna mapp
   (`marketing/ads/`) med filnamnen som anges.
2. Be en admin whitelista domänen i nätverkspolicyn för sessionen.
