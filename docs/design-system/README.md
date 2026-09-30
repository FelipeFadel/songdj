# songdj Design System

Design system do **songdj**, um mixer de DJ no navegador com cara de Windows 98.
Os tokens vêm do *Unofficial Windows 98 UI Kit* (Figma), em escala 1×. O gradiente da barra de título vem da referência *Music Player* e o layout vem do *Camelot DJ v2*.

> Fonte da verdade no código: [`src/app/win98.ts`](../../src/app/win98.ts) (tokens e estilos base), [`src/app/icons.tsx`](../../src/app/icons.tsx) (ícones) e [`src/styles/theme.css`](../../src/styles/theme.css) (estilos globais). Se este documento e o código divergirem, o código vale, e o documento deve ser corrigido.

## Princípios

1. **Fidelidade ao Win98.** Cantos retos, bordas chanfradas de 2 px, fonte bitmap sem suavização. Nada de sombras difusas, arredondamentos ou gradientes fora da barra de título.
2. **Pixel perfeito.** Tamanhos inteiros, ícones em escala inteira (`s = 1, 2…`), `shape-rendering: crispEdges`.
3. **Deck A é azul, Deck B é vermelho.** Em todo lugar: texto, preenchimento de sliders, pads, roda Camelot.
4. **Densidade de ferramenta.** Fonte de 12 px, controles de 23 px, espaçamentos de 2 a 8 px. Um DJ precisa ver tudo de uma vez.
5. **Teclado primeiro.** Todo comando frequente tem atalho, e a letra de acesso aparece sublinhada.

## Estrutura

```
docs/design-system/
├── README.md                 ← você está aqui
├── CHANGELOG.md
├── foundations/              ← os fundamentos visuais
│   ├── colors.md
│   ├── typography.md
│   ├── spacing-and-layout.md
│   ├── elevation.md          ← bordas chanfradas (bevels)
│   ├── iconography.md
│   └── motion.md
├── components/               ← um arquivo por componente
│   ├── button.md
│   ├── window.md             ← janela, barra de título, diálogo
│   ├── menu.md               ← barra de menu e menu suspenso
│   ├── text-field.md
│   ├── group-box.md
│   ├── trackbar.md           ← slider horizontal e EQ vertical
│   ├── tabs.md
│   ├── pad.md
│   ├── status-bar.md
│   ├── taskbar.md
│   ├── desktop-icon.md
│   ├── scrollbar.md
│   └── camelot-wheel.md
├── patterns/                 ← como os componentes se combinam
│   ├── deck-identity.md
│   ├── states.md
│   ├── feedback.md
│   └── keyboard.md
├── content/
│   └── voice-and-tone.md     ← textos e microcopy
└── tokens/
    └── tokens.json           ← tokens no formato W3C Design Tokens (DTCG)
```

## Como usar no código

Os estilos são objetos `CSSProperties` compostos com spread. Não há CSS por componente nem classes utilitárias para a pele Win98.

```tsx
import { btn, field, windowFrame, titleBar, capBtn, CA, CB, DIM, FONT } from "./win98";
import { CloseIcon } from "./icons";

<div style={{ ...windowFrame, width: 340 }}>
  <div style={titleBar()}>
    <span style={{ flex: 1 }}>Título</span>
    <button onClick={onClose} style={capBtn}><CloseIcon /></button>
  </div>
  <div style={{ padding: 10 }}>
    <button style={{ ...btn(), height: 23, minWidth: 75 }}>OK</button>
  </div>
</div>
```

Regras rápidas:

- Use as constantes (`FACE`, `DIM`, `CA`, `CB`…) em vez de repetir hex.
- Estenda o estilo base com spread e sobrescreva só o necessário (`{ ...btn(), height: 23 }`).
- Um estilo novo que se repete em dois lugares vai para `win98.ts`.

## Contribuindo

1. Mudou um token ou componente? Atualize o `.md` correspondente e o `tokens/tokens.json`.
2. Registre a mudança no [CHANGELOG](./CHANGELOG.md).
3. Componente novo: copie a estrutura de um arquivo em `components/` (Visão geral → Anatomia → Especificação → Estados → Uso → Código).
