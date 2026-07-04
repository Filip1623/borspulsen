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

## Känt problem — filer ej nedladdade

Sandboxens nätverksproxy blockerar (403) utgående anrop till Higgsfields
CDN-domän (`d8j0ntlcm91z4.cloudfront.net`) enligt organisationens
egress-policy. Det går alltså inte att `curl`/ladda ner filerna direkt till
repot härifrån. Alternativ:

1. Ladda ner filerna manuellt via länkarna ovan och lägg dem i denna mapp
   (`marketing/ads/`) med filnamnen som anges.
2. Be en admin whitelista domänen i nätverkspolicyn för sessionen.
