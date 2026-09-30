# songdj — PRD

## O que é
Mixer de DJ no navegador com dois decks e mixagem harmônica pela roda Camelot. A interface imita o Windows 98.

## Para quem
DJs iniciantes e intermediários que querem ver rápido se duas faixas combinam em tom e BPM.

## Funcionalidades atuais
- **Decks A e B**: recebem faixas da set list, por arrastar e soltar, da biblioteca ou de um link do YouTube (menu Fonte). Mostram a capa embutida no mp3. Cada deck tem play/pause, avançar e voltar 16 tempos, tempo/pitch, EQ (Lo → Hi) e sync de BPM.
- **Detecção de BPM** automática ao carregar uma faixa.
- **Transpor tom e key lock**: o seletor de tom pode transpor a faixa até ±6 semitons sem mudar o BPM, e o key lock muda o tempo sem mudar o tom (SoundTouch).
- **Mixer**: roda Camelot com indicador de compatibilidade (A × B), crossfader e sincronizar BPM A → B.
- **Visão de transição**: waveforms dos dois decks, alinhadas por batida.
- **Checkpoints**: Enter marca a posição dos dois decks e as teclas 1–9 pulam para as marcas.
- **Biblioteca** das faixas carregadas na sessão, com tom e BPM.
- **Área de trabalho**: janelas arrastáveis. Duplo clique na barra de título devolve a janela ao lugar, e na janela principal devolve todas.
- **Meu Computador → Set list**: adiciona uma pasta do computador ou de um pen drive e manda cada faixa para o Deck A ou B.
- **Saídas Master e Booth**: o Master (público) vai para a caixa de som. O Booth (fone do DJ) mistura o master com o cue de cada deck, com volume próprio.
- **Milkdrop**: visualizador (butterchurn) do som que sai no master.
- **Spotify**: tela integrada, aberta pelo ícone na área de trabalho.

## Fora do escopo (por enquanto)
- Guardar a set list, a biblioteca e a posição das janelas entre sessões.
- Detecção automática de tom (hoje o tom é marcado à mão na roda Camelot).
- Gravação e exportação da mixagem.

## Métrica de sucesso
Escolher e carregar duas faixas compatíveis e sincronizadas em menos de 30 s.
