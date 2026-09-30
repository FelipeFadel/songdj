# Desktop icon

Atalho na área de trabalho que abre uma janela ou tela.

## Anatomia

```
   ┌────┐
   │ 🖥 │   ← DeskIcon, 32 × 32 (16 × 16 em 2×)
   └────┘
 Meu Computador   ← rótulo branco, centralizado
```

## Especificação

| Propriedade | Valor |
|---|---|
| Coluna | 76 px de largura, gap 18 px entre ícones, `paddingTop: 4` |
| Ícone | `DeskIcon` em 2× |
| Ícone → rótulo | gap 4 px |
| Rótulo | `#FFFFFF`, `padding: 1px 3px`, centralizado |
| Rótulo selecionado | fundo `#000080`, `outline: 1px dotted #fff` |
| Cursor | `default` (não é link) |

## Interação

| Ação | Resultado |
|---|---|
| Clique simples | Seleciona o ícone |
| Duplo clique | Abre a janela ou tela |

## Ícones atuais

| Ícone | Abre |
|---|---|
| Meu Computador | Set list (janela flutuante) |
| Lixeira | — |
| songdj | — (janela principal, já aberta) |
| Spotify | Tela do Spotify |
| Milkdrop | Visualizador (janela flutuante) |
