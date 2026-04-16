# Retro GP (Pseudo-3D)

## 1. Visão Geral
Este projeto é um jogo de corrida web inspirado no clássico Grand Prix do Atari. O diferencial técnico reside na implementação de uma estrada em Pseudo-3D, utilizando cálculos de projeção geométrica para simular profundidade em um ambiente 2D.

## 2. Mecânicas do Jogo
- **Controle de Velocidade:** Aceleração progressiva e frenagem (Setas para Cima/Baixo).
- **Esquiva:** Desviar de carros lentos (obstáculos) gerados proceduralmente (Setas para Esquerda/Direita).
- **Cronômetro:** O objetivo é completar o percurso no menor tempo possível.
- **Sistema de Colisão:** Impactos com outros veículos reduzem drasticamente a velocidade atual.

## 3. Arquitetura Técnica
O jogo utiliza o conceito de **Estrada Escaneada (Scanline Road)**.
- **Motor Gráfico:** JavaScript Vanilla com HTML5 Canvas.
- **Efeito Pseudo-3D:** A estrada é dividida em segmentos. Cada segmento possui coordenadas $Z$ que são projetadas para a tela ($X, Y$) usando um fator de escala baseado na perspectiva:
  $$escala = \frac{focalLength}{z - cameraZ}$$
- **Loop de Jogo:** Processamento de entrada, atualização da posição da câmera e renderização dos segmentos visíveis de trás para frente (Painter's Algorithm).

## 4. Estética
- **Paleta de Cores:** Estilo vibrante e saturado (Neon/Retro).
- **Sprites:** Veículos em visão superior/inclinada.
- **Fundo:** Parallax infinito.

---
Desenvolvido com foco em alta performance e fidelidade visual ao estilo Atari.
