# Espaçamento e layout

## Escala de espaçamento

Todos os valores são inteiros, em px. A escala é densa: a base é **2 px** e os passos mais usados são 4 e 6.

| Token | Valor | Uso típico |
|---|---|---|
| `space.0` | 0 | — |
| `space.1` | 2 px | Entre rótulo e campo (`Labeled`), entre itens de barra de menu e status bar |
| `space.2` | 4 px | Entre controles relacionados, grade dos pads, ícone + texto |
| `space.3` | 6 px | Entre botões de um grupo, entre painéis, padding de listas |
| `space.4` | 8 px | Entre blocos de um painel |
| `space.5` | 10 px | Padding interno de diálogos |
| `space.6` | 12 px | Entre colunas da área de trabalho |
| `space.7` | 18 px | Entre ícones da área de trabalho |

## Tamanhos de controle

| Token | Valor | Onde |
|---|---|---|
| `size.control.sm` | 16 × 14 px | Botões da barra de título (`capBtn`) |
| `size.control.md` | 20 px | Linha de lista, barra de menu, item de menu suspenso |
| `size.control.lg` | 23 px | **Botão padrão**, aba |
| `size.control.xl` | 44 px | Pad |
| `size.titlebar` | 18 px | Barra de título |
| `size.statusbar` | 22 px | Status bar |
| `size.taskbar` | 28 px | Barra de tarefas |
| `size.button.min-width` | 75 px | Botões de diálogo (OK, Cancelar, Salvar) |
| `size.trackbar` | 21 px | Altura do trackbar e do thumb (11 × 21) |

## Layout da tela principal

```
┌─ desktop (#008080), padding 16 20 20 8 ─────────────────────────────────┐
│ ┌icons┐ ┌─ janela principal (windowFrame) ─────────────────────────────┐ │
│ │ 76px│ │ title bar 18                                                 │ │
│ │     │ │ menu bar 20                                                  │ │
│ │ gap │ │ TransitionView (waveforms)                                   │ │
│ │ 18  │ │ ┌ Deck A 1fr ┐ ┌ Mixer 272px ┐ ┌ Deck B 1fr ┐   gap 6       │ │
│ │     │ │ └────────────┘ └─────────────┘ └────────────┘               │ │
│ │     │ │ status bar 22: [110px | 1fr | 90px]                          │ │
│ └─────┘ └──────────────────────────────────────────────────────────────┘ │
├─ taskbar 28 ─────────────────────────────────────────────────────────────┤
```

- Área mínima: **1300 × 820 px**. Abaixo disso a área de trabalho rola, e o layout não se adapta.
- Grade dos decks: `gridTemplateColumns: "minmax(0, 1fr) 272px minmax(0, 1fr)"`.
- Use `minWidth: 0` / `minHeight: 0` em filhos de flex e grid que podem encolher.

## Janelas flutuantes

As janelas abertas por ícone da área de trabalho (`FloatWin`) usam `position: fixed`, `zIndex` a partir de 1000 e posição inicial fixa (ex.: Milkdrop em 160, 90; Set list em 110, 60).

## Camadas (z-index)

| Camada | Valor |
|---|---|
| Menu suspenso do deck | 5 |
| Diálogo modal dentro do deck | 10 |
| Janelas flutuantes | 1000 + ordem de arraste |
