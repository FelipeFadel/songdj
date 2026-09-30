# Camelot wheel

Componente de domínio do songdj. Mostra o tom dos dois decks na roda Camelot e a distância entre eles.

## Anatomia

```
          ┌── anel externo: tons B (maiores), raio 70–100
      ┌───┼── anel interno: tons A (menores), raio 40–70
      │   │
   ┌──┴───┴──┐
   │  Dif.   │ ← centro: raio 40, fundo FACE
   │   +1    │ ← distância em semitons na roda, cor semântica
   └─────────┘
```

## Especificação

| Parte | Valor |
|---|---|
| Contêiner | `field`, altura 216, SVG 204 × 204 centralizado |
| Segmento | 30°, contorno `#7E7E7E` 1 px |
| Rótulo do segmento | 10 px, ex.: `8B` |
| Centro | círculo `#C3C3C3`, "Dif." 12 px `#7E7E7E` e valor 18 px |

## Cores dos segmentos

| Situação | Fundo | Texto |
|---|---|---|
| Nenhum deck | `#FFFFFF` | `#000` |
| Tom do Deck A | `#001CF5` | `#FFF` |
| Tom do Deck B | `#EB3323` | `#FFF` |
| Mesmo tom nos dois | `#000080` | `#FFF` |

## Valor central

- Mostra a distância de B em relação a A, de −6 a +6, com sinal (`+1`, `-2`, `0`).
- Se os decks estão em anéis diferentes (A × B), acrescenta `↕`.
- A cor segue a [compatibilidade](../patterns/feedback.md).

## Interação

Clicar em um segmento define o tom do **deck em foco**.
