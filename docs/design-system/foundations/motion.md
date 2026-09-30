# Movimento

O Win98 quase não tem animação, e o songdj segue isso: as mudanças de estado são **instantâneas**, sem transições de cor, fade ou easing.

## Animações existentes

| Nome | Definição | Uso |
|---|---|---|
| `spin` | `transform: rotate(360deg)`, 1 s, `linear`, infinito (classe `.spin`) | Indicador de carregamento |
| `blink` | Opacidade 1 → 0 → 1, usada com `1s step-end infinite` | Rótulo "detectando…" durante a detecção de BPM |

Movimento contínuo que **representa áudio** (playhead da waveform, visualizador Milkdrop) não conta como animação decorativa: é dado em tempo real, desenhado em `canvas` via `requestAnimationFrame`.

## Regras

- **Não** use `transition` em hover e press. O botão afunda no mesmo frame.
- **Não** use a lib `motion` para efeitos de UI da pele Win98.
- Arrastar janelas acompanha o ponteiro 1:1, sem inércia.
- Ao adicionar animação nova, respeite `prefers-reduced-motion`.
