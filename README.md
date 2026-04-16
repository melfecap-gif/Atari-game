# 🏎️ Retro GP (Pseudo-3D)

Este é um jogo de corrida web inspirado no clássico **Grand Prix do Atari**, desenvolvido com foco em estética **Synthwave/Retro 80s** e implementação técnica de estrada em **Pseudo-3D**.

## 🏗️ Estrutura Técnica
O jogo utiliza o conceito de **Scanline Road (Estrada Escaneada)** para simular profundidade em um ambiente 2D sem o uso de WebGL, utilizando apenas HTML5 Canvas.

- **Projeção Geométrica:** Cada segmento da estrada possui uma coordenada $Z$ projetada para a tela ($X, Y$) usando um fator de escala baseado na perspectiva:
  $$escala = \frac{focalLength}{z - cameraZ}$$
- **Aesthetics:** Paleta de cores vibrante, efeito Parallax no fundo e sprites estilizados.
- **Engine:** Vanilla JavaScript com Vite para gerenciamento de assets.

## 🎮 Como Jogar
1. **Acelerar:** `Seta para Cima` ou `W`
2. **Frear:** `Seta para Baixo` ou `S`
3. **Mover:** `Setas Esquerda/Direita` ou `A/D`
4. **Iniciar:** Pressione `ENTER` ou `ESPAÇO`

## 🛠️ Tecnologias Utilizadas
- **Linguagem:** JavaScript (ES6+)
- **Estilização:** CSS3 (Neon Synthwave Style)
- **Gráficos:** HTML5 Canvas API
- **Assets:** Gerados via AI (Antigravity)
- **Build Tool:** Vite

## 🚀 Como enviar para o GitHub via GitHub Desktop
1. Abra o **GitHub Desktop**.
2. Clique em `Add` > `Add existing repository`.
3. Selecione a pasta deste projeto (`Atari game`).
4. No painel à esquerda, você verá todos os novos arquivos.
5. Digite uma mensagem de commit (ex: "Initial commit: Retro GP Game") e clique em **Commit to main**.
6. Clique em **Publish repository** (ou Push) para enviar para o seu GitHub.

---
*Desenvolvido por Antigravity.*
