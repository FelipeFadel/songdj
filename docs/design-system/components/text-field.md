# Text field e display

Superfície branca afundada (`field`). Serve para entrada de texto, listas e displays de valor.

## Variantes

| Variante | Estilo | Uso |
|---|---|---|
| **Input** | `{ ...field, border: "none", outline: "none", fontFamily: FONT, fontSize: 12, padding: "3px 4px" }` | Link do YouTube, Client ID do Spotify |
| **Display** | `textField(fontSize, height, color?)` | Valores somente leitura: tom, BPM, compatibilidade |
| **List** | `{ ...field, height, overflowY: "auto" }` | Set list, biblioteca, faixas do Spotify |
| **Canvas** | `{ ...field, padding: 0, background: "#000" }` | Milkdrop, waveforms |
| **Select** | `{ ...field, height: 22, fontFamily: FONT, fontSize: 12 }` | Dispositivo de saída |

## Display — `textField(fontSize, height, color)`

```ts
{ ...field, height, boxSizing: "border-box", padding: "0 6px", display: "flex", alignItems: "center",
  overflow: "hidden", whiteSpace: "nowrap", fontSize, color }
```

| Tamanho | Uso |
|---|---|
| `textField(32, 42, corDoDeck)` | Tom Camelot grande no deck |
| `textField(18, 28)` | Tom de cada deck no mixer |
| `textField(18, 30, corSemantica)` | Resultado da compatibilidade |

## Rótulo — `Labeled`

O rótulo fica em cima e o campo embaixo, com `gap: 2`. O texto do rótulo termina com ` :` (espaço + dois-pontos, como no Win98 em francês e português).

```tsx
<Labeled label="Deck A :">
  <div style={textField(18, 28)}>8B</div>
</Labeled>
```

## Linha de lista

| Propriedade | Valor |
|---|---|
| Altura | 20 px |
| Padding | `0 2px 0 4px` |
| Número da linha | `#7E7E7E` |
| Selecionada | fundo `#000080`, texto `#FFFFFF` |
| Estado vazio | texto `#7E7E7E` com instrução ("Escolha uma pasta do computador ou do pen drive") |

## Foco

Os inputs não mostram outline (`outline: "none"`): o cursor de texto já indica o foco. Use `autoFocus` no primeiro campo de um diálogo.
