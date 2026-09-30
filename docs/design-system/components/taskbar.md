# Taskbar

A barra de tarefas no rodapé da tela, como no Windows 98.

## Anatomia

```
┌───────┐│┌──────────────────┐┌──────────────────┐          ┌───────┐
│♪ Start│││♪ songdj          ││♪ Spotify         │   …      │ 14:32 │
└───────┘│└──────────────────┘└──────────────────┘          └───────┘
          ↑ separador          ↑ janela ativa = afundada       ↑ relógio (status)
```

## Especificação

| Parte | Valor |
|---|---|
| Altura | 28 px, `padding: 2`, gap 4 px |
| Botão Start | `btn()`, altura 22, `NoteIcon s={2}` + "Start" |
| Separador | 2 × 22 px, `inset 1px 0 #7E7E7E, inset -1px 0 #F0F0F0` |
| Botão de janela | altura 22, largura 160, alinhado à esquerda, ícone + nome |
| Janela ativa | `btn(true)` (afundado) |
| Relógio | célula `status`, `padding: 0 10px`, formato `HH:MM` em `pt-BR` |

## Regras

- Cada tela aberta tem um botão. Clicar numa janela inativa troca de tela (ex.: songdj ↔ Spotify).
- O relógio não tem interação.
