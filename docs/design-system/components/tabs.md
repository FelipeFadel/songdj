# Tabs

Alterna entre painéis na mesma área (Checkpoints, Biblioteca, Saídas).

## Especificação

As abas são [botões toggle](./button.md): a selecionada fica afundada.

```tsx
const tabBtn = (k, label) => (
  <button onClick={() => setTab(k)} style={{ ...btn(tab === k), height: 23 }}>{label}</button>
);
```

| Propriedade | Valor |
|---|---|
| Altura | 23 px |
| Selecionada | `btn(true)`: `sunken`, conteúdo deslocado 1 px |
| Não selecionada | `btn()`: `raised` |

## Regras

- Rótulos curtos, de uma ou duas palavras.
- Só uma aba selecionada por vez.
- Uma ação externa pode trocar a aba. Ex.: "Biblioteca" no menu Fonte do deck foca o deck e abre a aba Biblioteca.
