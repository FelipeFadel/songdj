# Iconografia

Os ícones são **pixel art em SVG**, definidos em [`src/app/icons.tsx`](../../../src/app/icons.tsx). Cada um é um `path` feito de retângulos de 1 px num grid pequeno.

## Regras de desenho

- `shape-rendering="crispEdges"` sempre.
- Escala só por **inteiros** (`s = 1, 2, 3…`). Nunca redimensione com CSS.
- `fill="currentColor"` nos ícones de interface: eles herdam a cor do texto, inclusive o cinza de desabilitado.
- `aria-hidden`: o ícone é decorativo, e o texto ou o `title` do botão descreve a ação.

## Ícones de interface (`px(w, h, d)`)

| Componente | Grid | Uso |
|---|---|---|
| `PlayIcon` | 7 × 9 | Tocar |
| `PauseIcon` | 8 × 9 | Pausar |
| `PrevIcon` / `NextIcon` | 10 × 9 | Voltar / avançar 16 tempos |
| `NoteIcon` | 8 × 9 | Logo do app (barra de título, taskbar) |
| `UploadIcon` | 5 × 5 | Carregar arquivo |
| `CaretIcon` | 7 × 4 | Abre menu suspenso |
| `UpIcon` / `DownIcon` | 5 × 3 | Spinner (BPM ±1) |
| `MinIcon` | 6 × 2 | Minimizar |
| `MaxIcon` | 9 × 8 | Maximizar |
| `CloseIcon` | 8 × 7 | Fechar |

```tsx
<PlayIcon />        // 1×
<NoteIcon s={2} />  // 2×
```

## Ícones da área de trabalho (`DeskIcon`)

São 16 × 16 com três camadas: **corpo**, **detalhe** e **contorno** (sempre `#000`). Por padrão aparecem em 2× (32 px) na área de trabalho e em 1× na barra de título das janelas flutuantes.

| `kind` | Rótulo | Corpo | Detalhe |
|---|---|---|---|
| `pc` | Meu Computador | `#C3C3C3` | `#1084D0` |
| `trash` | Lixeira | `#FFFFFF` | `#7E7E7E` |
| `dj` | songdj | `#001CF5` | `#FFFFFF` |
| `cd` | Spotify | `#B1B1B1` | `#F0F0F0` |
| `milk` | Milkdrop | `#000080` | `#FF00FF` |

## Criando um ícone novo

1. Desenhe no grid (papel quadriculado ou Figma com grade de 1 px).
2. Converta cada linha de pixels em `M{x} {y}h{w}v{h}H{x}z`.
3. Adicione com `px(w, h, d)` em `icons.tsx`.

## lucide-react

A tela do Spotify usa alguns ícones do `lucide-react` (`ArrowLeft`, `LogOut`, `Music2`, `ListMusic`, `Clock`, `RefreshCw`). Isso é **legado**: os traços anti-aliased não combinam com a pixel art. Em telas novas, prefira ícones pixel.
