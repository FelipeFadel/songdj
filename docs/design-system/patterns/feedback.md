# Feedback

## Compatibilidade harmônica

A compatibilidade entre os tons dos dois decks é o principal feedback do app. Ela aparece em três lugares: a status bar, o display do mixer e o centro da roda Camelot.

| Resultado | Regra | Cor |
|---|---|---|
| `PERFECT` | Mesmo número e mesma letra (ex.: 8B × 8B) | `#008000` |
| `HARMONIC` | Mesmo número, letras diferentes (8A × 8B), **ou** números vizinhos com a mesma letra (8B × 9B, 12B × 1B) | `#806000` |
| `CLASH` | Qualquer outra combinação | `#C00000` |

## Mensagens de erro

- Aparecem em texto `#C00000`, inline, perto da causa (ex.: abaixo do campo no diálogo do YouTube).
- Não use pop-up nem toast para erros de formulário.
- O diálogo continua aberto até o usuário corrigir ou cancelar.

## Progresso

- Operações curtas (detecção de BPM, carregar playlist) mostram um texto em `#7E7E7E` com `blink` ou um ícone `.spin`.
- Texto no gerúndio e minúsculo, terminando com reticências: `detectando…`, `carregando…`.

## Tooltips

Use o atributo nativo `title`. É a forma de explicar gestos escondidos:

- `duplo clique para resetar`
- `duplo clique: próximo preset`
- `carregar no Deck A`
