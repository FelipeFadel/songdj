# Elevação (bevels)

No Win98 não existe sombra projetada. A profundidade vem de **bordas chanfradas** (bevels): uma luz em cima e à esquerda, uma sombra embaixo e à direita. Aqui elas são desenhadas com `box-shadow: inset`, sem `border`. Assim a caixa não muda de tamanho entre os estados.

## Níveis

| Nível | Constante | box-shadow | Uso |
|---|---|---|---|
| **Raised** (elevado) | `raised` | `inset -1px -1px #262626, inset 1px 1px #F0F0F0, inset -2px -2px #7E7E7E` | Botões, thumb do trackbar, painéis |
| **Window** (janela) | `windowFrame` | `inset -1px -1px #262626, inset 1px 1px #B1B1B1, inset -2px -2px #7E7E7E, inset 2px 2px #F0F0F0` + `padding: 3` | Molduras de janela, menu suspenso |
| **Sunken** (afundado) | `sunken` | `inset -1px -1px #F0F0F0, inset 1px 1px #262626, inset -2px -2px #B1B1B1, inset 2px 2px #7E7E7E` | Botão pressionado ou ativo (toggle, aba selecionada) |
| **Field** (campo) | `field` | `inset 1px 1px #7E7E7E, inset -1px -1px #F0F0F0, inset 2px 2px #262626, inset -2px -2px #B1B1B1` + fundo branco | Inputs, listas, displays, canvas |
| **Status** (raso) | `status` | `inset -1px -1px #F0F0F0, inset 1px 1px #7E7E7E` + `padding: 1px 6px` | Células da status bar, relógio da taskbar, trilho do trackbar |
| **Etched** (gravado) | `groupBox` | `border: 1px solid #7E7E7E; box-shadow: inset 1px 1px #F0F0F0, 1px 1px #F0F0F0` | Group box (`fieldset`) |
| **Separator** | — | `inset 1px 0 #7E7E7E, inset -1px 0 #F0F0F0` (2 px de largura) | Divisor vertical na taskbar |

## Diagrama

```
Raised                Sunken / Field
 ┌───────────┐         ┌───────────┐
 │▔▔▔▔▔▔▔▔▔▔▔│ luz     │▁▁▁▁▁▁▁▁▁▁▁│ sombra
 │▏         ▕│         │▕         ▏│
 │▁▁▁▁▁▁▁▁▁▁▁│ sombra  │▔▔▔▔▔▔▔▔▔▔▔│ luz
 └───────────┘         └───────────┘
```

## Regras

- **Nunca** use `border-radius`, `box-shadow` com blur, nem `drop-shadow`.
- Para alternar estados, troque o nível (`raised` ↔ `sunken`), e não a cor.
- Não empilhe `raised` dentro de `raised` sem um `field` ou `groupBox` entre eles.
