# Teclado

O songdj é usado ao vivo, então os comandos frequentes precisam ter atalho.

## Atalhos globais

| Tecla | Ação |
|---|---|
| `Espaço` | Tocar/pausar o master (os dois decks) |
| `A` ou `←` | Tocar/pausar o Deck A |
| `D` ou `→` | Tocar/pausar o Deck B |
| `Enter` | Criar um checkpoint com a posição dos dois decks |
| `1`–`4` / `⇧1`–`⇧4` | Pads do Deck A |
| `5`–`8` / `⇧5`–`⇧8` | Pads do Deck B |

> A PRD diz que as teclas `1`–`9` pulam para os checkpoints, mas no código atual os dígitos são dos pads (ver o comentário em `App.tsx`). Alinhe a PRD ou o código antes de criar novos atalhos numéricos.

## Regras de implementação

- Atalhos globais **não disparam** quando o foco está em `INPUT`, `TEXTAREA`, `SELECT` ou em um elemento `contentEditable`.
- Ignore `e.repeat` e combinações com `Ctrl`, `Meta` ou `Alt`.
- Para dígitos, use `e.code` (`Digit1`), porque `⇧1` gera `!` em `e.key`.
- Chame `preventDefault()` quando o atalho for usado (evita rolar a página no Espaço).

## Diálogos

| Tecla | Ação |
|---|---|
| `Enter` | Confirma (botão padrão) |
| `Esc` | Cancela e fecha |

## Letras de acesso

A letra de acesso fica sublinhada nos rótulos (`<u>F</u>onte`, `C<u>e</u>ntro`). Ela indica o atalho no padrão Win98, mas ainda **não há** um handler `Alt + letra`. Se ele for implementado, siga as letras já sublinhadas.

## Gestos de mouse

| Gesto | Onde | Ação |
|---|---|---|
| Duplo clique | Trackbar | Volta ao valor neutro |
| Duplo clique | Barra de título | Devolve a janela ao lugar (na janela principal, devolve todas) |
| Duplo clique / botão direito | Pad | Apaga o ponto |
| Duplo clique | Ícone da área de trabalho | Abre |
| Arrastar arquivo | Deck | Carrega a faixa |
