# Scrollbar

Barra de rolagem estilizada globalmente em `theme.css`. Funciona só em navegadores WebKit/Blink (Chrome, Edge, Safari). O Firefox mostra a barra nativa.

## Especificação

| Parte | Valor |
|---|---|
| Largura / altura | 16 px |
| Trilha | xadrez de 2 × 2 px `#C3C3C3` / `#F0F0F0` (`repeating-conic-gradient`) |
| Thumb e setas | 16 px, `#C3C3C3`, chanfro `raised` |

```css
::-webkit-scrollbar-track {
  background: repeating-conic-gradient(#C3C3C3 0 25%, #F0F0F0 0 50%) 0 0 / 2px 2px;
}
```

## Regras

- Não sobrescreva a scrollbar por componente.
- As listas rolam dentro de um `field` com altura fixa (`overflowY: "auto"`).
