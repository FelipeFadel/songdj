# Window

Contêiner principal da interface. Tudo o que o usuário vê fica dentro de uma janela ou na área de trabalho.

## Anatomia

```
┌─────────────────────────────────────────┐ ← windowFrame (padding 3)
│▓▓[ícone] Título                 [_][□][×]│ ← title bar, 18 px
│ Arquivo  Decks  Mixer  Exibir  Ajuda    │ ← menu bar (opcional), 20 px
│                                         │
│              conteúdo                   │
│                                         │
│ [status] [status              ] [status]│ ← status bar (opcional), 22 px
└─────────────────────────────────────────┘
```

## Title bar — `titleBar(active)`

| Propriedade | Ativa | Inativa |
|---|---|---|
| Fundo | `linear-gradient(90deg, #000080, #1084D0)` | `#7E7E7E` |
| Texto | `#FFFFFF` | `#C3C3C3` |
| Altura | 18 px | 18 px |
| Fonte | 13 px | 13 px |
| Padding | `0 2px 0 3px`, gap 3 px | idem |

- O título usa `flex: 1` e empurra os botões de legenda para a direita.
- A ordem dos botões é **Minimizar, Maximizar, Fechar**. O Fechar tem `marginLeft: 2`.
- O ícone à esquerda aparece em 1× (`DeskIcon s={1}`) ou 2× (`NoteIcon s={2}`).
- Janelas arrastáveis usam `cursor: "move"` na barra.

## Variantes

| Variante | Componente | Características |
|---|---|---|
| **Janela principal** | `App` | Barra ativa, menu bar, status bar. Duplo clique na barra devolve todas as janelas ao lugar |
| **Painel (deck, mixer)** | `DeckPanel`, coluna Mixer | Janela dentro da janela. A barra fica ativa quando o deck tem foco e inativa quando não tem. O Mixer usa sempre `titleBar(false)` |
| **Janela flutuante** | `FloatWin` | `position: fixed`, arrastável, ícone 1× na barra, só o botão Fechar |
| **Diálogo** | `LinkDialog`, `Dialog` (Spotify) | Largura fixa (340–460 px), padding 10, botões alinhados à direita |

## Diálogo

- O conteúdo fica numa coluna com `gap: 6`.
- O rótulo do campo termina com **espaço + dois-pontos** (`Link de vídeo ou playlist :`).
- O erro aparece em `#C00000` logo abaixo do campo.
- Botões: `justifyContent: "flex-end"`, `gap: 6`, `marginTop: 4`.
- **Enter** confirma e **Esc** fecha.

## Arrastar (`useDrag`)

- A barra de título é a alça, e a janela se desloca via `transform`.
- Cada arraste traz a janela para a frente (`z`).
- **Duplo clique** na barra devolve a janela à posição original.

## Painel com a identidade do deck

A barra do deck mostra um quadrado de 9 × 9 px na cor do deck, com contorno branco de 1 px, e à direita o resumo `8B · 128.0`. Veja [Identidade dos decks](../patterns/deck-identity.md).

## Código

```tsx
<div style={{ ...windowFrame, width: 340 }}>
  <div style={titleBar()}>
    <span style={{ flex: 1 }}>Abrir do YouTube</span>
    <button onClick={onClose} style={capBtn}><CloseIcon /></button>
  </div>
  <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>…</div>
</div>
```
