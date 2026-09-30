# Cores

A paleta é a do Windows 98: cinza de superfície, azul-marinho de seleção e verde-azulado de área de trabalho. Por cima dela entram duas cores de marca, uma para cada deck, e três cores semânticas de compatibilidade.

## Neutros (superfície e bordas)

| Token | Hex | Constante | Uso |
|---|---|---|---|
| `color.neutral.black` | `#000000` | — | Texto padrão, contorno de ícones, foco pontilhado |
| `color.neutral.shadow-dark` | `#262626` | — | Borda externa escura dos chanfros |
| `color.neutral.shadow` | `#7E7E7E` | `DIM` | Borda interna escura, texto secundário, texto desabilitado, barra de título inativa |
| `color.neutral.light-shadow` | `#B1B1B1` | — | Borda interna do campo afundado, linhas de grade da waveform |
| `color.neutral.face` | `#C3C3C3` | `FACE` | Superfície de janelas, botões e painéis |
| `color.neutral.highlight` | `#F0F0F0` | — | Luz dos chanfros, fundo claro da trilha da scrollbar |
| `color.neutral.white` | `#FFFFFF` | — | Campos de texto, listas, displays, texto sobre fundos escuros |

## Sistema

| Token | Hex | Constante | Uso |
|---|---|---|---|
| `color.desktop` | `#008080` | `DESK` | Fundo da área de trabalho (`body`) |
| `color.selection` | `#000080` | — | Item de menu em hover, ícone selecionado, segmento da roda Camelot quando A e B coincidem |
| `color.title.start` | `#000080` | — | Início do gradiente da barra de título ativa |
| `color.title.end` | `#1084D0` | — | Fim do gradiente da barra de título ativa |

Barra de título ativa: `linear-gradient(90deg, #000080, #1084D0)`.
Barra de título inativa: fundo `#7E7E7E` e texto `#C3C3C3`.

## Marca: decks

| Token | Hex | Constante | Uso |
|---|---|---|---|
| `color.deck.a` | `#001CF5` | `CA` | Tudo que pertence ao Deck A |
| `color.deck.b` | `#EB3323` | `CB` | Tudo que pertence ao Deck B |

Veja [Identidade dos decks](../patterns/deck-identity.md).

## Semânticas: compatibilidade harmônica

| Token | Hex | Constante | Significado |
|---|---|---|---|
| `color.feedback.success` | `#008000` | `COMPAT_OK` | Combinação **perfeita**. Também o verde do Spotify (`GREEN`) |
| `color.feedback.warning` | `#806000` | `COMPAT_MID` | Combinação **harmônica** |
| `color.feedback.danger` | `#C00000` | `COMPAT_BAD` | **Incompatível**. Também mensagens de erro |

As cores semânticas ficam escuras de propósito, para ter contraste sobre branco (campos). Sobre `#C3C3C3` (status bar) o vermelho fica abaixo do AA, então o texto em cor semântica deve sempre vir com uma palavra (`CLASH`), nunca com a cor sozinha.

## Acentos pontuais

| Hex | Onde |
|---|---|
| `#FF00FF` | Detalhe do ícone Milkdrop |
| `#E3E3E3` | Uso isolado em `App.tsx`. Evite em código novo |

## Contraste

| Combinação | Razão aproximada | WCAG AA (texto normal) |
|---|---|---|
| `#000` sobre `#C3C3C3` | 11,9 : 1 | ✅ |
| `#FFF` sobre `#000080` | 16,0 : 1 | ✅ |
| `#001CF5` sobre `#FFF` | 8,5 : 1 | ✅ |
| `#EB3323` sobre `#FFF` | 4,2 : 1 | ⚠️ só para texto ≥ 18 px ou negrito |
| `#806000` sobre `#FFF` | 5,9 : 1 | ✅ |
| `#C00000` sobre `#C3C3C3` | 3,7 : 1 | ⚠️ abaixo do AA nos 12 px da status bar (no display do mixer o fundo é branco e passa) |
| `#7E7E7E` sobre `#C3C3C3` | 2,3 : 1 | ❌ use só para rótulos auxiliares e estados desabilitados |

## Regras

- **Faça:** use as constantes de `win98.ts`. Pinte com a cor do deck apenas o que pertence àquele deck.
- **Não faça:** criar novos tons de cinza, usar opacidade para gerar cor (a exceção é o estado `inert`) ou pôr cor de deck em controles globais.
