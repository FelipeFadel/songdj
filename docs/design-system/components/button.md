# Button

Botão de comando no estilo Win98. É o componente mais usado da interface.

## Anatomia

```
┌──────────────┐  ← chanfro raised (2 px)
│  [ícone] Rótulo │  ← FONT 12 px, #000, gap 4–5 px
└──────────────┘
```

## Variantes

| Variante | Estilo | Uso |
|---|---|---|
| **Padrão** | `{ ...btn(), height: 23 }` | Ações comuns (Sincronizar BPM, Limpar, Próximo) |
| **Diálogo** | `{ ...btn(), height: 23, minWidth: 75 }` | OK, Cancelar, Salvar |
| **Padrão do diálogo** | + `outline: "1px solid #000"` | O botão acionado pelo Enter (OK, Salvar) |
| **Toggle** | `btn(ativo)` | Key lock, cue A/B, abas. `true` = afundado |
| **Legenda (caption)** | `capBtn` (16 × 14, sem padding) | Minimizar, maximizar e fechar na barra de título. Também os botões A/B/× da set list (com `width: 18`) |
| **Spinner** | `{ ...btn(), flex: 1, padding: 0 }` + `UpIcon`/`DownIcon` | Ajuste fino de BPM |
| **Flat** | `className="flat"`, sem fundo nem borda | Links de texto ("resetar", "original"), linhas de lista, itens de menu |

## Especificação

| Propriedade | Valor |
|---|---|
| Altura | 23 px (padrão), 22 px (taskbar), 16 px (toggle compacto), 44 px (pad) |
| Padding horizontal | 6 px (padrão), 8 px (com rótulo longo) |
| Fundo | `#C3C3C3` |
| Borda | `raised`, e `sunken` quando ativo |
| Raio | 0 |
| Fonte | W95FA 12 px, `#000` |
| Layout | `inline-flex`, centralizado |

## Estados

| Estado | Visual | Onde é definido |
|---|---|---|
| Normal | `raised` | `btn()` |
| Pressionado (`:active`) | chanfro `sunken` | `theme.css` (global) |
| Ativo / selecionado | `sunken` + conteúdo deslocado 1 px (`padding: 1px 5px 0 7px`) | `btn(true)` |
| Foco (`:focus-visible`) | `outline: 1px dotted #000`, `outline-offset: -4px` | `theme.css` |
| Desabilitado | texto `#7E7E7E` com `text-shadow: 1px 1px #fff` (efeito gravado), cursor padrão | `theme.css` |

A classe `.flat` desliga o efeito de pressionar.

## Uso

- **Faça:** sublinhe a letra de acesso (`<u>S</u>alvar`). Com dois botões num diálogo, a ação principal vem primeiro (à esquerda) e é o botão padrão.
- **Faça:** use `title` para explicar ações não óbvias ("carregar no Deck A").
- **Não faça:** usar cor de fundo para dar destaque. A exceção são os [pads](./pad.md) marcados.
- Toggle de um deck pinta o **texto** com a cor do deck quando ativo (`color: info.keyLock ? color : "#000"`).

## Código

```tsx
<button onClick={ok} style={{ ...btn(), height: 23, minWidth: 75, outline: "1px solid #000" }}>OK</button>
<button onClick={onClose} style={{ ...btn(), height: 23, minWidth: 75 }}>Cancelar</button>

<button onClick={toggle} style={{ ...btn(on), height: 16, padding: "0 4px", color: on ? CA : "#000" }}>Key lock</button>
```
