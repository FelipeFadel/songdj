# Identidade dos decks

O songdj tem dois decks, e o usuário precisa saber de relance a qual deles cada informação pertence. A regra é simples: **Deck A = azul `#001CF5` (`CA`), Deck B = vermelho `#EB3323` (`CB`).**

## Onde a cor do deck aparece

| Elemento | Como |
|---|---|
| Barra de título do deck | Quadrado 9 × 9 na cor do deck, com contorno branco |
| Display do tom Camelot | Texto grande na cor do deck |
| Trackbars (posição, tempo, EQ, volume) | Preenchimento do trilho |
| Valor do EQ | Texto na cor do deck |
| Pads marcados | Fundo na cor do deck, texto branco |
| Toggles ativos (Key lock) | Texto na cor do deck |
| Botões A/B (set list, cue de saída) | Letra na cor do deck |
| Crossfader | Letras `A` e `B` nas pontas |
| Roda Camelot | Segmento do tom de cada deck |
| Waveforms | Cada faixa na cor do seu deck |

## Foco do deck

- Só um deck tem foco por vez. Clicar em qualquer parte do painel dá foco a ele.
- O deck em foco tem a **barra de título ativa** (gradiente azul) e o outro fica com a barra inativa (cinza).
- Ações sem alvo explícito (clicar na roda Camelot, escolher na Biblioteca) valem para o deck em foco.

## Regras

- A cor do deck é **identidade**, e não estado. Não a use para indicar sucesso ou erro.
- Controles que afetam os dois decks (crossfader, sincronizar BPM, master) ficam neutros.
- Quando os dois decks coincidem (mesmo tom na roda), use `#000080`.
