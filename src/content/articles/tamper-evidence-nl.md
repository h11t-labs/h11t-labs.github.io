---
title: "Hoe firm's auditlog merkt dat er in geknoeid is"
description: "Een auditlog is alleen nuttig als je erop kunt vertrouwen dat er niet in gewijzigd is. Zo bewijst firm dat niemand stiekem een logregel heeft veranderd, verwijderd of vervalst — zo simpel mogelijk uitgelegd."
pubDate: 2026-07-23
key: tamper-evidence
lang: nl
readMin: 8
project: firm
repo: https://github.com/h11t-labs/firm
url: https://h11t-labs.github.io/firm/audit/tamper-evidence/
tags: ["python", "audit-log", "security", "cryptography", "postgresql"]
---

Stel je houdt een dagboek bij, met één regel: je mag alleen nieuwe regels *toevoegen*.
Je gumt nooit iets uit. Dat is een **auditlog** — een lijst van dingen die gebeurd
zijn, op volgorde, waar je voor altijd op moet kunnen vertrouwen. "Gebruiker 12 heeft
de prijs gewijzigd." "Factuur 4200 is betaald." "Beheerder heeft een account
verwijderd."

En nu de vervelende vraag. Dat dagboek staat in je database. Heel veel mensen — en
programma's — kunnen bij die database. Wat houdt iemand tegen om het dagboek stiekem
open te slaan, één regel te veranderen, en het weer dicht te doen alsof er niets is
gebeurd?

Bij een gewone auditlog: niets. En dát is precies het probleem. Een log die je niet
kunt vertrouwen is gewoon een verhaaltje.

De audit-module van firm heeft een optionele functie die **tamper evidence**
(knoeidetectie) heet en dit oplost. De naam zegt het al: het houdt een vastberaden
persoon niet tegen om aan je data te zitten — dat kan niemand beloven. Wat het wél
garandeert, is dat áls ze dat doen, **jij het merkt**. Nooit meer stiekeme
wijzigingen.

Dit is hoe het werkt, in drie lagen, waarbij elke laag een gat dicht dat de vorige
open liet.

## Laag 1: een geheime vingerafdruk op elke regel

Als je tamper evidence aanzet, geef je firm een **geheime sleutel** — zie het als een
wachtwoord dat alleen jouw app kent.

Elke keer dat er een nieuwe regel in het dagboek komt, gebruikt firm dat geheim om er
een kleine **vingerafdruk** naast te stempelen. Die vingerafdruk wordt berekend uit
de exacte woorden van de regel *plus* het geheim. (De technische term is een HMAC,
maar "vingerafdruk gemaakt met een geheim" is alles wat je hoeft te onthouden.)

De truc: verander één letter in de regel, en de vingerafdruk klopt niet meer. En
omdat je het geheim nodig hebt om een goede vingerafdruk te maken, kan een aanvaller
die een regel wijzigt **er geen nieuwe bij verzinnen**. Hij heeft het wachtwoord niet.

Laag 1 betrapt dus: *iemand heeft een bestaande regel aangepast.*

Maar er blijft een gat. Wat als ze geen regel wijzigen — maar een hele **bladzijde**
eruit scheuren? Regel #50 helemaal verwijderen. Elke overgebleven regel heeft nog
steeds een perfecte vingerafdruk. Er lijkt niets mis… omdat juist het bewijs
verdwenen is.

## Laag 2: hele bladzijdes dichtzegelen

Om verdwenen bladzijdes te betrappen, stempelt firm niet alleen elke regel. Zo nu en
dan neemt het een batch regels — zeg regel 1 tot en met 100 — en schrijft één
**getekend zegel** dat zegt: *"Regel 1 tot 100. Precies deze set. Verzegeld."*

Probeer nu regel #50 eruit te scheuren. De losse vingerafdrukken kloppen nog, maar
het zegel over het hele bereik breekt, want het bereik is niet meer wat er verzegeld
werd. Een bladzijde weghalen, een valse bladzijde ertussen schuiven, de volgorde
omgooien — het breekt allemaal het zegel.

Er is één eerlijke uitzondering die je juist *wél* wilt: soms mág je oude regels
weggooien. Auditlogs worden groot, en de administratie van vorig jaar bewust
verwijderen is normaal (dat heet retentie). Hoe weet firm dan het verschil tussen
"netjes opgeruimd" en "een aanvaller heeft het bewijs gewist"?

Dat tekent firm ook. Als oude regels worden opgeruimd, legt firm een getekende
**ondergrens** vast: *"Alles onder regel #500 is bewust verwijderd, en hier is mijn
handtekening als bewijs dat ik het was."* Een aanvaller kan die regel niet
vervalsen — geen geheim — dus kan hij een verwijdering niet verstoppen achter een
nep-"o, dat was gewoon opruimen."

Laag 2 betrapt dus: *iemand heeft regels verwijderd, ingevoegd of van volgorde
gewisseld.*

Maar er is nog een groter gat. Wat als de aanvaller geen bladzijde eruit scheurt —
maar het **hele dagboek verbrandt**? De log én de zegels weggooien, alles, en met een
vers leeg boek beginnen. Dan is er niets meer om mee te vergelijken.

## Laag 3: een briefje dat je buiten het gebouw bewaart

De oplossing voor "verbrand alles" is om een klein beetje bewijs **ergens anders** te
bewaren — helemaal buiten de database.

firm kan een briefje van één regel toevoegen aan een extern bestand (een **anker**):
*"Op vandaag had ik minstens 100 verzegelde regels, en de ondergrens stond op 500."*
Het bestand groeit alleen maar, en het staat los van de database.

Komt het dagboek nu verdacht leeg terug — 40 regels waar er 100 hoorden te staan —
dan zegt het briefje buiten iets anders, en die mismatch schreeuwt "hier is geknoeid".
Je kunt niet wissen wat je niet kunt bereiken. Het dagboek verbranden verbergt je
sporen niet meer; het verplaatst het alarm alleen naar buiten.

Laag 3 betrapt dus: *iemand heeft de hele log gewist om het te verdoezelen.*

## Twee sleutels, zodat één lek niet meteen game over is

Nog een slim detail. Het alledaagse deel van je app — de code die de hele dag nieuwe
regels schrijft — heeft het geheim nodig om vingerafdrukken te stempelen. Maar dat is
nou juist de code die het meest kans loopt om gekraakt te worden.

Daarom laat firm je **twee sleutels** gebruiken: een *schrijf*-sleutel voor de drukke
alledaagse code, en een aparte *zegel*-sleutel die je veiliger bewaart en alleen
gebruikt om de bereik-zegels te tekenen. Steelt een aanvaller de schrijfsleutel, dan
kan hij nog steeds niet de zegels vervalsen die verdwenen bladzijdes betrappen. Eén
lek geeft hem niet alles.

## Hoe het er in de praktijk uitziet

Je zet het aan met een sleutel, en firm doet het stempelen voor je:

```python
from firm.audit import AuditLog

# De sleutel staat in een env-var, niet in je code.
audit = AuditLog(database_url="postgresql://localhost/myapp")
audit.record("invoice.paid", subject=invoice, actor=user, data={"amount": 4200})
```

En wanneer je de waarheid wilt weten, vraag je firm om het hele dagboek te
controleren:

```bash
firm-audit verify
```

Het leest elke vingerafdruk, elk zegel, de ondergrens en het briefje buiten, en zegt
je één van twee dingen: **alles klopt**, of **er is geknoeid met regel #73** — met de
vinger recht op het probleem. Er is ook een dashboard met een schild dat groen wordt
als alles in orde is en rood zodra er iets niet klopt, plus een optie om die controle
stilletjes op een timer in de achtergrond te draaien.

## Het enige dat je moet onthouden

Tamper evidence is *bewijs*, geen krachtveld. Iemand met genoeg toegang kan je data
nog steeds vernietigen — dat geldt voor elk systeem. Wat firm wegneemt, is de
mogelijkheid om het **stiekem** te doen. Elke wijziging, elke verdwenen bladzijde,
elke poging om de boel te wissen breekt een handtekening die de aanvaller niet kan
repareren zonder een geheim dat hij niet heeft.

De hele taak van een auditlog is om betrouwbaar te zijn. Zo verdient firm dat
vertrouwen.

---

De volledige details — sleutelrotatie, hoe retentie en verificatie het eens worden
over wat weg mag, de exacte garanties met en zonder het externe anker — staan in de
[tamper-evidence-documentatie](https://h11t-labs.github.io/firm/audit/tamper-evidence/).
De audit-module is onderdeel van [firm](https://github.com/h11t-labs/firm), de
pure-Python port van de Rails Solid-stack.
