# Group box

Agrupa controles relacionados sob um título. Usa `<fieldset>` e `<legend>` nativos.

## Anatomia

```
┌─ Equalizador ────────────┐  ← legend, padding 0 3px
│                          │  ← borda gravada (etched)
│   Lo   Mid   Hi          │
└──────────────────────────┘
```

## Especificação

```ts
const groupBox = {
  margin: 0, padding: "4px 6px 6px", minWidth: 0,
  border: "1px solid #7E7E7E", boxShadow: "inset 1px 1px #F0F0F0, 1px 1px #F0F0F0",
};
```

A borda escura mais a luz de 1 px por dentro e por fora dão o efeito gravado do Win98.

## Exemplos no app

- **Equalizador**: sliders EQ verticais
- **Tom Camelot**: display do tom e transposição
- **Pads**: grade 4 × 2 de pads

## Código

```tsx
<fieldset style={groupBox}>
  <legend style={{ padding: "0 3px" }}>Equalizador</legend>
  …
</fieldset>
```
