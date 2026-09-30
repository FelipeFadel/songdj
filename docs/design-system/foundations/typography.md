# Tipografia

## Família

```css
font-family: W95FA, 'MS Sans Serif', Tahoma, sans-serif; /* constante FONT */
-webkit-font-smoothing: none;
```

- **W95FA** é uma fonte bitmap que imita a MS Sans Serif, carregada de `src/assets/fonts/w95fa.woff` com `font-display: block`, para evitar o flash de fonte substituta.
- A suavização fica **desligada**: o texto precisa ficar serrilhado, como no Win98.
- Há uma família só, sem pesos. Para dar ênfase, use tamanho ou cor, nunca `bold`.

## Escala

| Token | Tamanho | Uso |
|---|---|---|
| `font.size.xs` | 11 px | Legenda do atalho dentro do pad |
| `font.size.sm` | 12 px | **Base.** Todo texto de interface, botões, campos, menus |
| `font.size.md` | 13 px | Texto da barra de título |
| `font.size.lg` | 14 px | Tempo marcado no pad |
| `font.size.xl` | 18 px | Displays numéricos médios (tom no mixer, compatibilidade, "Dif." da roda) |
| `font.size.display` | 32 px | Display grande do tom Camelot no deck |

A roda Camelot usa 10 px nos rótulos dos segmentos (SVG).

## Altura de linha

É a padrão do navegador. Em blocos de texto corrido, como as instruções do Spotify, use `line-height: 1.4`.

## Letra de acesso (mnemônico)

Como no Windows, a letra do atalho de teclado aparece sublinhada com `<u>`:

```tsx
<button style={{ ...btn(), height: 23 }}><span><u>S</u>incronizar BPM A → B</span></button>
<span>Aj<u>u</u>da</span>
```

## Truncamento

Textos que podem ser longos (nomes de faixa, presets) usam:

```ts
{ overflow: "hidden", whiteSpace: "nowrap", minWidth: 0 }
```

Sem reticências (`text-overflow: ellipsis`): o Win98 corta seco. Mostre o texto completo em `title`.
