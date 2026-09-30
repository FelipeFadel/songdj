# Status bar

Barra no rodapé da janela principal, com o estado global do app.

## Anatomia

```
┌──────────┐┌─────────────────────────────────────────────┐┌────────┐
│ HARMONIC ││ A 8B C · 128.0 BPM   ⇔   B 9B G · 126.0 BPM ││ Tocando│
└──────────┘└─────────────────────────────────────────────┘└────────┘
   110px              1fr                      90px
```

## Especificação

| Propriedade | Valor |
|---|---|
| Altura | 22 px |
| Layout | `grid`, `gridTemplateColumns: "110px minmax(0, 1fr) 90px"`, gap 2 px |
| Célula | `status` (afundado raso), `padding: 1px 6px`, alinhada ao centro verticalmente |

## Células

1. **Compatibilidade**: `PERFECT`, `HARMONIC` ou `CLASH`, na cor semântica (ver [Feedback](../patterns/feedback.md)).
2. **Resumo dos decks**: tom Camelot, tom musical e BPM efetivo de cada deck, separados por `⇔`. O texto é cortado quando não cabe.
3. **Estado**: `Tocando` ou `Parado`.

## Regras

- Só texto. Nada de botões na status bar.
- A célula `status` também é usada fora dela, para mostrar informação passiva: o nome do preset no Milkdrop e o relógio da taskbar.
