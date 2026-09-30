# Pad

Botão grande de hot cue. Cada deck tem 8 pads (grade 4 × 2) dentro do group box **Pads**.

## Anatomia

```
┌──────────────┐
│    01:23     │  ← tempo marcado, 14 px
│            1 │  ← tecla de atalho, 11 px, canto inferior direito
└──────────────┘
```

## Estados

| Estado | Fundo | Texto | Tecla |
|---|---|---|---|
| Vazio | `#C3C3C3` (`raised`) | — | `#7E7E7E` |
| Marcado | cor do deck (`CA` / `CB`) | `#FFFFFF` | `#FFFFFF` |
| Desabilitado (deck sem faixa) | `#C3C3C3` | — | cinza gravado |

## Especificação

| Propriedade | Valor |
|---|---|
| Altura | 44 px |
| Grade | `repeat(4, 1fr)`, gap 4 px |
| Fonte do tempo | 14 px |
| Fonte da tecla | 11 px, `position: absolute; right: 4; bottom: 2` |

## Interação

| Ação | Resultado |
|---|---|
| Clique / tecla, pad vazio | Marca a posição atual |
| Clique / tecla, pad marcado | Pula para a posição |
| Duplo clique ou botão direito | Apaga o pad |

Teclas: Deck A usa `1`–`4` (e `⇧1`–`⇧4` para a segunda linha). Deck B usa `5`–`8` (e `⇧5`–`⇧8`).

O `title` sempre descreve a próxima ação: `marcar ponto (tecla 1)` ou `voltar para 01:23 (tecla 1) · duplo clique apaga`.
