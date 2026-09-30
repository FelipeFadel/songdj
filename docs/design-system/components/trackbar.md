# Trackbar (slider)

Slider no estilo Win98. O visual é desenhado à mão e um `<input type="range">` nativo e invisível fica por cima, cuidando da interação e da acessibilidade.

Componentes: `SRange` (horizontal) e `EQSlider` (vertical).

## Anatomia

```
        ┌┐              ← thumb raised, 11 × 21
════════██══════════    ← trilho: 4 px (status) ou 9 px (field, "thick")
████████                ← preenchimento na cor do deck (opcional)
          |             ← tick central, 1 × 5 (opcional)
```

## Props de `SRange`

| Prop | Efeito |
|---|---|
| `color` | Preenche o trilho até o thumb. Sem `color`, não há preenchimento |
| `thick` | Trilho grosso (9 px, `field`). Usado na barra de posição da faixa |
| `tick` | Marca central (crossfader, EQ, tempo) |
| `reset` | Valor aplicado no **duplo clique**. Mostra o tooltip "duplo clique para resetar" |
| `pct` | Posição visual (0–100) |

## Especificação

| Parte | Valor |
|---|---|
| Altura total | 21 px |
| Thumb | 11 × 21, `raised` |
| Trilho fino | 4 px, `status`, `top: 8` |
| Trilho grosso | 9 px, `field`, `top: 6` |
| Preenchimento | 2 px (fino) / 5 px (grosso) |

## EQ vertical — `EQSlider`

- É o `SRange` girado −90°, com 84 px de altura.
- Faixa de −12 a +12 dB, passo 0,5, `tick` no centro, `reset={0}`.
- O rótulo da banda fica em cima e o valor embaixo, na cor do deck, com `+` explícito nos valores positivos.

## Regras

- Todo slider com um valor neutro (0 dB, crossfader no centro, tempo 0) **deve** ter `reset` e `tick`.
- O preenchimento usa a cor do deck dono do controle. Controles globais (crossfader) ficam sem `color`.
- O CSS global remove a aparência nativa (`input[type="range"] { appearance: none }`).
