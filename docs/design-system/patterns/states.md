# Estados

Referência única dos estados de interação. No Win98, estado se mostra pela **forma** (elevado ou afundado, pontilhado), e não por cor.

| Estado | Tratamento | Implementação |
|---|---|---|
| **Hover** | Nenhum em botões. Em itens de menu, fundo `#000080` e texto branco | `.menu-item:hover` |
| **Pressionado** | Chanfro `sunken` enquanto o botão do mouse está apertado | `button:not(.flat):active` em `theme.css` |
| **Ativo / ligado** | `sunken` permanente e conteúdo deslocado 1 px | `btn(true)` |
| **Selecionado** (lista, ícone) | Fundo `#000080`, texto `#FFFFFF`. Nos ícones da área de trabalho, também contorno pontilhado | inline |
| **Foco (teclado)** | `outline: 1px dotted #000`, `offset -4px` | `button:focus-visible` |
| **Desabilitado** | Texto `#7E7E7E` com sombra branca de 1 px (gravado) | `button:disabled` |
| **Inerte** | `opacity: 0.45; pointer-events: none` | const `inert` |
| **Arrastando sobre (drop)** | `outline: 1px dotted #000`, `outlineOffset: -6` no painel | `DeckPanel` |
| **Carregando** | Texto `#7E7E7E` piscando (`blink`) ou ícone girando (`.spin`) | ver [Movimento](../foundations/motion.md) |
| **Vazio** | Texto de instrução em `#7E7E7E` dentro da área vazia | ex.: set list |

## Desabilitado × inerte

- **Desabilitado**: o controle existe, mas agora não dá para usar (ex.: pads sem faixa carregada). Use `disabled`.
- **Inerte**: o bloco inteiro não se aplica ao contexto atual (ex.: EQ e tempo quando o deck toca do YouTube, cujo áudio o app não consegue processar). Use o estilo `inert`.
