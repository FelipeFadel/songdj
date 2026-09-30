# Menu

## Menu bar

Linha de 20 px abaixo da barra de título da janela principal.

| Propriedade | Valor |
|---|---|
| Altura | 20 px |
| Padding do contêiner | `0 2px`, gap 2 px |
| Padding do item | `2px 6px` |
| Itens | <u>A</u>rquivo · <u>D</u>ecks · <u>M</u>ixer · <u>E</u>xibir · Aj<u>u</u>da |

Todo item tem a letra de acesso sublinhada.

## Menu suspenso (dropdown)

Aberto por um botão com `CaretIcon` (ex.: **Fonte ▾** no deck).

```
[ Fonte ▾ ]            ← botão; fica afundado (btn(true)) enquanto o menu está aberto
┌────────────────────┐ ← windowFrame, top: 25, minWidth 210, zIndex 5
│   YouTube…         │ ← item 20 px, padding 0 20px
│███Biblioteca███████│ ← hover: fundo #000080, texto #fff
│   Playlist…        │
└────────────────────┘
```

| Propriedade | Valor |
|---|---|
| Moldura | `windowFrame` |
| Posição | `absolute`, 25 px abaixo do topo do botão |
| Largura mínima | 210 px |
| Item | `button.flat.menu-item`, altura 20, `padding: 0 20px`, alinhado à esquerda |
| Hover | `.menu-item:hover` → fundo `#000080`, texto `#FFFFFF` (em `theme.css`) |

## Comportamento

- Clicar em um item executa a ação e fecha o menu.
- Clicar fora fecha o menu (o contêiner tem `data-menu`).
- Itens que abrem diálogo terminam com reticências (`YouTube…`).
